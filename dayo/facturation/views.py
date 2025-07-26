from django.contrib.auth import authenticate, login
from django.db.models import Sum, Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
import openpyxl
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from .serializers import *
from .permissions import *
from .task import *
from .models import AuditLog, Notification


class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            if not user.is_active:
                return Response({'error': 'User is not active'}, status=400)
            # Create UserProfile if it doesn't exist
            profile, created = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'role': 'PROVIDER' if not user.is_staff else 'ADMIN',
                    'username': user.username,
                    'email': user.email or f"{username}@example.com"
                }
            )
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'role': profile.role,
                'isActive': profile.is_active,
                'subscriptionEndDate': profile.subscription_expiry.isoformat() if profile.subscription_expiry else None,
                'username': user.username,
                'id': str(profile.id)
            })
        return Response({'error': 'Invalid credentials'}, status=400)
        # if user:
        #     profile = UserProfile.objects.get(user=user)
        #     if profile.role == 'PROVIDER' and (not profile.is_active or
        #                                        (
        #                                                profile.subscription_expiry and profile.subscription_expiry < datetime.now(
        #                                            pytz.UTC))):
        #         return Response({
        #             'error': 'Account is inactive. Please renew your subscription to activate your account.'
        #         }, status=status.HTTP_403_FORBIDDEN)
        #     login(request, user)
        #     return Response({
        #         'user_id': user.id,
        #         'username': user.username,
        #         'role': profile.role,
        #         'is_active': profile.is_active,
        #         'token': user.auth_token.key if hasattr(user, 'auth_token') else None
        #     })
        # return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        name = request.data.get('name')
        email = request.data.get('email')
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password, email=email)
        UserProfile.objects.create(
            user=user,
            username=username,
            role='PROVIDER',  # Default to PROVIDER; adjust if needed
            email=email
        )
        return Response({
            'user_id': user.id,
            'username': user.username,
            'message': 'Account created. Awaiting admin activation.'
        }, status=status.HTTP_201_CREATED)

        # Notify admins of new account
        admin_emails = UserProfile.objects.filter(role='ADMIN').values_list('email', flat=True)
        if admin_emails:
            send_notification_email.delay(
                subject=f'New Provider Account Created: {username}',
                message=f'A new provider account for {username} has been created. Please review and activate the account.',
                recipient_list=list(admin_emails)
            )

        return Response({
            'user_id': user.id,
            'username': user.username,
            'message': 'Account created. Awaiting admin activation.'
        }, status=status.HTTP_201_CREATED)


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated, IsAdminOrActiveProvider]

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity='UserProfile',
            details=f'Created user profile {instance.user.username} (id={instance.id})'
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity='UserProfile',
            details=f'Updated user profile {instance.user.username} (id={instance.id})'
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='DELETE',
            entity='UserProfile',
            details=f'Deleted user profile {instance.user.username} (id={instance.id})'
        )
        instance.delete()

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        profile = request.user.userprofile
        serializer = self.get_serializer(profile)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def activate_account(self, request, pk=None):
        profile = self.get_object()
        if profile.role != 'PROVIDER':
            return Response({'error': 'Only provider accounts can be activated'}, status=status.HTTP_400_BAD_REQUEST)

        duration = request.data.get('duration')
        if duration not in UserProfile.SUBSCRIPTION_DURATIONS:
            return Response({'error': 'Invalid duration'}, status=status.HTTP_400_BAD_REQUEST)

        expiry = datetime.now(pytz.UTC) + UserProfile.SUBSCRIPTION_DURATIONS[duration]
        profile.is_active = True
        profile.subscription_expiry = expiry
        profile.subscription_status = 'ACTIVE'
        profile.username = profile.user.username
        profile.save()

        # Création du Provider si inexistant
        provider, created = Provider.objects.get_or_create(
            user=profile.user,
            defaults={
                'name': profile.user.username,
                'subscription_status': 'ACTIVE',
                'subscription_expiry': expiry
            }
        )
        if not created:
            provider.subscription_status = 'ACTIVE'
            provider.subscription_expiry = expiry
            provider.save()

        return Response({
            'message': f'Account activated until {expiry}',
            'profile': UserProfileSerializer(profile).data
        })

        # Notify provider of activation
        if profile.email:
            send_notification_email.delay(
                subject='Account Activated',
                message=f'Dear {profile.user.username},\n\nYour account has been activated until {expiry}. You can now access the system.\n\nBest regards,\nSystem Admin',
                recipient_list=[profile.email]
            )

        return Response({
            'message': f'Account activated until {expiry}',
            'profile': UserProfileSerializer(profile).data
        })


class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [IsAdminOrActiveProvider]

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity='Provider',
            details=f'Created provider {instance.name} (id={instance.id})'
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity='Provider',
            details=f'Updated provider {instance.name} (id={instance.id})'
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='DELETE',
            entity='Provider',
            details=f'Deleted provider {instance.name} (id={instance.id})'
        )
        instance.delete()


class BrokerViewSet(viewsets.ModelViewSet):
    queryset = Broker.objects.all()
    serializer_class = BrokerSerializer
    permission_classes = [IsAdminOrActiveProvider]

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity='Broker',
            details=f'Created broker {instance.name} (id={instance.id})'
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity='Broker',
            details=f'Updated broker {instance.name} (id={instance.id})'
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='DELETE',
            entity='Broker',
            details=f'Deleted broker {instance.name} (id={instance.id})'
        )
        instance.delete()


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAdminOrActiveProvider]

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity='Company',
            details=f'Created company {instance.name} (id={instance.id})'
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity='Company',
            details=f'Updated company {instance.name} (id={instance.id})'
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='DELETE',
            entity='Company',
            details=f'Deleted company {instance.name} (id={instance.id})'
        )
        instance.delete()


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAdminOrActiveProvider]

    def get_queryset(self):
        user = self.request.user
        if user.userprofile.role == 'ADMIN':
            return Invoice.objects.all()
        return Invoice.objects.filter(provider__user=user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.userprofile.role == 'PROVIDER':
            provider = Provider.objects.get(user=user)
            instance = serializer.save(provider=provider)
        else:
            instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity='Invoice',
            details=f'Created invoice {instance.invoice_number} (id={instance.id})'
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity='Invoice',
            details=f'Updated invoice {instance.invoice_number} (id={instance.id})'
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='DELETE',
            entity='Invoice',
            details=f'Deleted invoice {instance.invoice_number} (id={instance.id})'
        )
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def add_payment(self, request, pk=None):
        invoice = self.get_object()
        serializer = PaymentSerializer(data=request.data)
        if serializer.is_valid():
            payment = serializer.save(invoice=invoice)
            invoice.paid_amount += serializer.validated_data['amount']
            invoice.status = 'PAID' if invoice.remaining_amount() <= 0 else 'PARTIAL'
            invoice.save()
            # Notification interne au provider
            Notification.objects.create(
                user=invoice.provider.user,
                notif_type='PAYMENT_ALERT',
                message=f"Un paiement de {payment.amount} FCFA a été enregistré pour la facture {invoice.invoice_number}.",
                invoice=invoice,
                payment=payment
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def add_rejection(self, request, pk=None):
        invoice = self.get_object()
        serializer = RejectionSerializer(data=request.data)
        if serializer.is_valid():
            rejection = serializer.save(invoice=invoice)
            invoice.status = 'REJECTED' if invoice.remaining_amount() <= 0 else 'PARTIAL'
            invoice.save()
            # Notification interne au provider
            Notification.objects.create(
                user=invoice.provider.user,
                notif_type='WARNING',
                message=f"Un rejet de {rejection.rejected_amount} FCFA a été enregistré pour la facture {invoice.invoice_number}. Motif : {rejection.rejection_reason}",
                invoice=invoice
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def statistics(self, request):
        filters = {
            'broker_id': request.query_params.get('broker_id'),
            'company_id': request.query_params.get('company_id'),
            'invoice_month__year': request.query_params.get('year'),
            'invoice_month__month': request.query_params.get('month'),
        }
        filters = {k: v for k, v in filters.items() if v is not None}

        queryset = self.get_queryset().filter(**filters)
        # Aggregate by month
        monthly_stats = queryset.values('invoice_month__year', 'invoice_month__month').annotate(
            total_billed=Sum('billed_amount'),
            total_paid=Sum('paid_amount'),
            total_rejected=Sum('rejections__rejected_amount'),
            total_remaining=Sum('billed_amount') - Sum('paid_amount') - Sum('rejections__rejected_amount'),
            payment_count=Count('payments'),
        ).order_by('invoice_month__year', 'invoice_month__month')

        stats = [
            {
                'year': stat['invoice_month__year'],
                'month': stat['invoice_month__month'],
                'total_billed': stat['total_billed'] or 0,
                'total_paid': stat['total_paid'] or 0,
                'total_rejected': stat['total_rejected'] or 0,
                'total_remaining': stat['total_remaining'] or 0,
                'payment_count': stat['payment_count'],
            }
            for stat in monthly_stats
        ]

        return Response({'monthly_stats': stats})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def payment_details(self, request):
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        if not (year and month):
            return Response({'error': 'Year and month parameters are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
            month = int(month)
        except ValueError:
            return Response({'error': 'Year and month must be integers'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(
            invoice_month__year=year,
            invoice_month__month=month
        )

        payments = Payment.objects.filter(invoice__in=queryset).select_related('invoice')
        payment_data = [
            {
                'id': payment.id,
                'invoice_number': payment.invoice.invoice_number,
                'payment_date': payment.payment_date,
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
            }
            for payment in payments
        ]

        return Response({'payments': payment_data})

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def generate_reclamation_letter(self, request, pk=None):
        invoice = self.get_object()
        remaining = invoice.remaining_amount()
        if remaining <= 0 and not invoice.rejections.exists():
            return Response({'error': 'No reclamation needed'}, status=status.HTTP_400_BAD_REQUEST)

        letter = f"""
        Reclamation Letter
        Invoice Number: {invoice.invoice_number}
        Date: {datetime.now(pytz.UTC).strftime('%Y-%m-%d')}
        To: {invoice.company.name}
        Subject: Payment Reclamation

        Dear Sir/Madam,

        We are writing regarding invoice {invoice.invoice_number} dated {invoice.invoice_month} 
        for {invoice.billed_amount} FCFA.

        Current Status:
        - Paid: {invoice.paid_amount} FCFA
        - Rejected: {invoice.rejected_amount()} FCFA
        - Remaining: {remaining} FCFA

        Please address the outstanding payment at your earliest convenience.

        Sincerely,
        {invoice.provider.name}
        """
        # Send email to company
        send_notification_email(
            subject=f'Payment Reclamation for Invoice {invoice.invoice_number}',
            message=letter,
            recipient_list=[invoice.company.contact_email]
        )
        # Notification interne au provider
        Notification.objects.create(
            user=invoice.provider.user,
            notif_type='REMINDER',
            message=f"Une relance de paiement a été envoyée pour la facture {invoice.invoice_number} ({remaining} FCFA restants).",
            invoice=invoice
        )
        return Response({'message': 'Reclamation letter sent successfully', 'letter': letter})


    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def export(self, request):
        format = request.query_params.get('format', 'excel')
        filters = {
            'broker_id': request.query_params.get('broker_id'),
            'company_id': request.query_params.get('company_id'),
            'invoice_month__year': request.query_params.get('year'),
            'invoice_month__month': request.query_params.get('month'),
        }
        filters = {k: v for k, v in filters.items() if v is not None}
        queryset = self.get_queryset().filter(**filters)

        if format == 'excel':
            workbook = openpyxl.Workbook()
            sheet = workbook.active
            sheet.title = 'Invoices'
            headers = ['ID', 'Provider', 'Broker', 'Company', 'Invoice Number', 'Month', 'Billed', 'Paid', 'Rejected',
                       'Remaining', 'Status']
            sheet.append(headers)

            for invoice in queryset:
                sheet.append([
                    invoice.id,
                    invoice.provider.name,
                    invoice.broker.name,
                    invoice.company.name,
                    invoice.invoice_number,
                    invoice.invoice_month.strftime('%Y-%m'),
                    float(invoice.billed_amount),
                    float(invoice.paid_amount),
                    float(invoice.rejected_amount()),
                    float(invoice.remaining_amount()),
                    invoice.status,
                ])

            response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = 'attachment; filename=invoices.xlsx'
            workbook.save(response)
            return response

        elif format == 'pdf':
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename=invoices.pdf'
            doc = SimpleDocTemplate(response, pagesize=letter)
            data = [['ID', 'Provider', 'Broker', 'Company', 'Invoice No.', 'Month', 'Billed', 'Paid', 'Rejected',
                     'Remaining', 'Status']]

            for invoice in queryset:
                data.append([
                    invoice.id,
                    invoice.provider.name,
                    invoice.broker.name,
                    invoice.company.name,
                    invoice.invoice_number,
                    invoice.invoice_month.strftime('%Y-%m'),
                    str(invoice.billed_amount),
                    str(invoice.paid_amount),
                    str(invoice.rejected_amount()),
                    str(invoice.remaining_amount()),
                    invoice.status,
                ])

            table = Table(data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            doc.build([table])
            return response

        return Response({'error': 'Invalid format'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def download_template(self, request):
        workbook = openpyxl.Workbook()

        # Brokers Sheet
        sheet = workbook.create_sheet('Brokers')
        sheet.append(['Name'])
        # sheet.append(['DAYO'])  # Example data
        # sheet.append(['OLEA'])

        # Companies Sheet
        sheet = workbook.create_sheet('Companies')
        sheet.append(['Name', 'Broker Name', 'Contact Email'])
        # sheet.append(['NSIA', 'DAYO', 'nsia@example.com'])
        # sheet.append(['SUNU', 'DAYO', 'sunu@example.com'])

        # Invoices Sheet
        sheet = workbook.create_sheet('Invoices')
        sheet.append(['Provider Name', 'Broker Name', 'Company Name', 'Invoice Number', 'Invoice Month (YYYY-MM)',
                      'Billed Amount', 'Paid Amount', 'Status'])
        # sheet.append(['Provider1', 'DAYO', 'NSIA', 'INV001', '2025-01', 150000, 100000, 'PARTIAL'])

        # Remove default sheet
        workbook.remove(workbook['Sheet'])

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename=data_import_template.xlsx'
        workbook.save(response)
        return response

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def import_data(self, request, status=None):
        if 'file' not in request.FILES:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES['file']
        if not file.name.endswith('.xlsx'):
            return Response({'error': 'File must be an Excel file (.xlsx)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workbook = openpyxl.load_workbook(file)
        except Exception as e:
            return Response({'error': f'Invalid Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        errors = []
        created_records = {'brokers': 0, 'companies': 0, 'invoices': 0}

        # Import Brokers
        if 'Brokers' in workbook.sheetnames:
            sheet = workbook['Brokers']
            if sheet.max_row < 2 or sheet[1][0].value != 'Name':
                errors.append('Brokers sheet: Missing or incorrect header (expected "Name")')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    name = row[0]
                    if not name:
                        continue
                    if request.user.userprofile.role == 'ADMIN':
                        Broker.objects.get_or_create(name=name)
                        created_records['brokers'] += 1
                    else:
                        errors.append('Only admins can import brokers')
                        break

        # Import Companies
        if 'Companies' in workbook.sheetnames:
            sheet = workbook['Companies']
            if sheet.max_row < 2 or tuple(cell.value for cell in sheet[1][:3]) != (
            'Name', 'Broker Name', 'Contact Email'):
                errors.append(
                    'Companies sheet: Missing or incorrect headers (expected "Name", "Broker Name", "Contact Email")')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    name, broker_name, contact_email = row[:3]
                    if not (name and broker_name):
                        continue
                    if request.user.userprofile.role == 'ADMIN':
                        try:
                            broker = Broker.objects.get(name=broker_name)
                            Company.objects.get_or_create(
                                name=name,
                                defaults={'broker': broker, 'contact_email': contact_email}
                            )
                            created_records['companies'] += 1
                        except Broker.DoesNotExist:
                            errors.append(f'Company {name}: Broker {broker_name} not found')
                    else:
                        errors.append('Only admins can import companies')
                        break

        # Import Invoices
        if 'Invoices' in workbook.sheetnames:
            sheet = workbook['Invoices']
            expected_headers = ['Provider Name', 'Broker Name', 'Company Name', 'Invoice Number',
                                'Invoice Month (YYYY-MM)', 'Billed Amount', 'Paid Amount', 'Status']
            if sheet.max_row < 2 or tuple(cell.value for cell in sheet[1][:8]) != tuple(expected_headers):
                errors.append(
                    'Invoices sheet: Missing or incorrect headers (expected: ' + ', '.join(expected_headers) + ')')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    provider_name, broker_name, company_name, invoice_number, invoice_month, billed_amount, paid_amount, status = row[
                                                                                                                                  :8]
                    if not all(
                            [provider_name, broker_name, company_name, invoice_number, invoice_month, billed_amount]):
                        continue

                    try:
                        # Validate invoice month
                        invoice_month = datetime.strptime(invoice_month, '%Y-%m').date()
                        # Validate status
                        if status not in dict(Invoice.STATUS_CHOICES):
                            errors.append(f'Invoice {invoice_number}: Invalid status {status}')
                            continue
                        # Validate amounts
                        billed_amount = float(billed_amount)
                        paid_amount = float(paid_amount) if paid_amount else 0.0

                        broker = Broker.objects.get(name=broker_name)
                        company = Company.objects.get(name=company_name, broker=broker)

                        if request.user.userprofile.role == 'ADMIN':
                            provider = Provider.objects.get(name=provider_name)
                        else:
                            provider = Provider.objects.get(user=request.user)
                            if provider_name != provider.name:
                                errors.append(
                                    f'Invoice {invoice_number}: Provider name {provider_name} does not match authenticated user')
                                continue

                        Invoice.objects.get_or_create(
                            invoice_number=invoice_number,
                            defaults={
                                'provider': provider,
                                'broker': broker,
                                'company': company,
                                'invoice_month': invoice_month,
                                'billed_amount': billed_amount,
                                'paid_amount': paid_amount,
                                'status': status,
                            }
                        )
                        created_records['invoices'] += 1
                    except (Broker.DoesNotExist, Company.DoesNotExist, Provider.DoesNotExist, ValueError) as e:
                        errors.append(f'Invoice {invoice_number}: {str(e)}')

        if errors:
            return Response({'errors': errors, 'created': created_records}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': 'Data imported successfully', 'created': created_records}, status=status.HTTP_200_OK)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-date')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.query_params.get('user')
        action = self.request.query_params.get('action')
        entity = self.request.query_params.get('entity')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if user:
            qs = qs.filter(user__username=user)
        if action:
            qs = qs.filter(action__icontains=action)
        if entity:
            qs = qs.filter(entity__icontains=entity)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all().order_by('-created_at')
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.userprofile.role == 'ADMIN':
            return Notification.objects.all().order_by('-created_at')
        return Notification.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        # Only allow marking as read/unread
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        if instance.user != request.user and request.user.userprofile.role != 'ADMIN':
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)