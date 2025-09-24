from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.db.models import Sum, Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from django.contrib.auth.models import Permission
import openpyxl
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from datetime import datetime, timedelta
import pytz
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
                    'role': 'ADMIN' if user.is_superuser else ('SUB_ADMIN' if user.is_staff else 'PROVIDER'),
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
                'id': str(profile.id),
                'user_id': user.id,
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
        
        if not username or not password:
            return Response({'error': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.create_user(username=username, password=password, email=email)
            UserProfile.objects.create(
                user=user,
                username=username,
                role='PROVIDER',  # Default to PROVIDER; adjust if needed
                email=email
            )

            # Notify admins of new account (optional - don't fail if email fails)
            try:
                admin_emails = UserProfile.objects.filter(role='ADMIN').values_list('email', flat=True)
                if admin_emails:
                    # Try to send email, but don't fail if it doesn't work
                    try:
                        send_notification_email.delay(
                            subject=f'New Provider Account Created: {username}',
                            message=f'A new provider account for {username} has been created. Please review and activate the account.',
                            recipient_list=list(admin_emails)
                        )
                    except:
                        # If Celery is not running or email fails, just continue
                        pass
                
                # Notification interne aux admins
                for admin_user in User.objects.filter(userprofile__role='ADMIN'):
                    Notification.objects.create(
                        user=admin_user,
                        notif_type='INFO',
                        message=f"Nouveau compte prestataire créé : {username}. Veuillez activer le compte."
                    )
            except Exception as e:
                # Log the error but don't fail the registration
                print(f"Failed to get admin emails: {e}")

            return Response({
                'user_id': user.id,
                'username': user.username,
                'message': 'Account created. Awaiting admin activation.'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': f'Error creating account: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def perform_create(self, serializer):
        if serializer.validated_data.get('role') == 'ADMIN' and not self.request.user.is_superuser:
            raise PermissionDenied('Only superusers can create ADMIN users.')
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity='UserProfile',
            details=f'Created user profile {instance.user.username} (id={instance.id})'
        )

    def perform_update(self, serializer):
        print(f"DEBUG: perform_update called with data: {serializer.validated_data}")
        print(f"DEBUG: Raw data received: {serializer.initial_data}")
        print(f"DEBUG: Model fields before save: subscription_expiry={serializer.instance.subscription_expiry if serializer.instance else 'No instance'}")
        if serializer.validated_data.get('role') == 'ADMIN' and not self.request.user.is_superuser:
            raise PermissionDenied('Only superusers can assign ADMIN role.')
        
        instance = serializer.save()
        
        print(f"DEBUG: instance after save - is_active: {instance.is_active}, subscription_status: {instance.subscription_status}, subscription_expiry: {instance.subscription_expiry}")
        print(f"DEBUG: Model fields after save: subscription_expiry={instance.subscription_expiry}")
        
        # Si le compte est désactivé, annuler automatiquement l'abonnement
        if not instance.is_active and instance.role == 'PROVIDER':
            print(f"DEBUG: Calling cancel_subscription for user {instance.user.username}")
            instance.cancel_subscription()
            print(f"DEBUG: After cancel_subscription - is_active: {instance.is_active}, subscription_status: {instance.subscription_status}")
        
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
            details=f'Created Company {instance.name} (id={instance.id})'
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity='Company',
            details=f'Updated Company {instance.name} (id={instance.id})'
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='DELETE',
            entity='Company',
            details=f'Deleted Company {instance.name} (id={instance.id})'
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
            details=f'Created Broker {instance.name} (id={instance.id})'
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity='Broker',
            details=f'Updated Broker {instance.name} (id={instance.id})'
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='DELETE',
            entity='Broker',
            details=f'Deleted Broker {instance.name} (id={instance.id})'
        )
        instance.delete()


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAdminOrActiveProvider]

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = Invoice.objects.select_related('provider', 'Broker', 'Company').prefetch_related('payments', 'rejections')
        if user.userprofile.role == 'ADMIN':
            return queryset
        return queryset.filter(provider__user=user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.userprofile.role == 'PROVIDER':
            provider, _ = Provider.objects.get_or_create(
                user=user,
                defaults={
                    'name': user.username,
                    'subscription_status': user.userprofile.subscription_status or 'ACTIVE',
                    'subscription_expiry': user.userprofile.subscription_expiry,
                }
            )
            # If payload didn't include provider_id, enforce the provider from the logged-in user
            if 'provider' not in serializer.validated_data:
                instance = serializer.save(provider=provider)
            else:
                instance = serializer.save()
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
        try:
            print(f"Starting deletion of invoice {instance.id} ({instance.invoice_number})")
            
            # Sauvegarder les informations avant suppression
            invoice_number = instance.invoice_number
            provider_user_id = instance.provider.user.id
            provider_username = instance.provider.user.username
            
            # Supprimer d'abord les notifications liées à cette facture
            try:
                instance.notifications.all().delete()
                print(f"Deleted {instance.notifications.count()} notifications")
            except Exception as e:
                print(f"Error deleting notifications: {str(e)}")
            
            # Supprimer d'abord les paiements et rejets
            try:
                instance.payments.all().delete()
                instance.rejections.all().delete()
                print(f"Deleted payments and rejections")
            except Exception as e:
                print(f"Error deleting payments/rejections: {str(e)}")
            
            # Supprimer la facture
            instance.delete()
            print(f"Invoice {instance.id} deleted successfully")
            
            # Notification au prestataire que sa facture a été supprimée
            try:
                provider_user = User.objects.get(id=provider_user_id)
                Notification.objects.create(
                    user=provider_user,
                    notif_type='WARNING',
                    message=f"Votre facture {invoice_number} a été supprimée par l'administrateur."
                )
                print(f"Notification created for user {provider_username}")
            except Exception as e:
                print(f"Error creating notification: {str(e)}")
            
            # Audit log
            try:
                AuditLog.objects.create(
                    user=self.request.user,
                    action='DELETE',
                    entity='Invoice',
                    details=f'Deleted invoice {invoice_number}'
                )
                print(f"Audit log created")
            except Exception as e:
                print(f"Error creating audit log: {str(e)}")
            
        except Exception as e:
            print(f"Error deleting invoice {instance.id}: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsActiveProvider])
    def add_payment(self, request, pk=None):
        invoice = self.get_object()
        serializer = PaymentSerializer(data=request.data)
        if serializer.is_valid():
            amount = serializer.validated_data['amount']
            # Validation: le paiement ne doit pas dépasser le reste à régler
            try:
                remaining_before = invoice.remaining_amount()
            except Exception:
                remaining_before = invoice.billed_amount - invoice.paid_amount - invoice.rejected_amount()
            if amount > remaining_before:
                return Response({'error': 'Le paiement dépasse le montant restant de la facture.'}, status=status.HTTP_400_BAD_REQUEST)

            payment = serializer.save(invoice=invoice)
            invoice.paid_amount += amount
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

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsActiveProvider])
    def add_rejection(self, request, pk=None):
        invoice = self.get_object()
        serializer = RejectionSerializer(data=request.data)
        if serializer.is_valid():
            amount = serializer.validated_data['rejected_amount']
            # Validation: le rejet ne doit pas dépasser le montant restant après paiements
            try:
                remaining_before = invoice.remaining_amount()
            except Exception:
                remaining_before = invoice.billed_amount - invoice.paid_amount - invoice.rejected_amount()
            if amount > remaining_before:
                return Response({'error': 'Le montant du rejet dépasse le solde restant de la facture.'}, status=status.HTTP_400_BAD_REQUEST)

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
            'Company_id': request.query_params.get('Company_id'),
            'Broker_id': request.query_params.get('Broker_id'),
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

        # Déterminer le destinataire et l'email selon le type de facture
        if invoice.Broker:
            # Facture avec Courtier
            recipient_name = invoice.Broker.name
            recipient_email = invoice.Broker.contact_email
        elif invoice.Company:
            # Facture avec Compagnie seulement
            recipient_name = invoice.Company.name
            recipient_email = invoice.Company.email
        else:
            return Response({'error': 'No Broker or Company found for this invoice'}, status=status.HTTP_400_BAD_REQUEST)

        # Vérifier que l'email existe
        if not recipient_email:
            return Response({'error': f'No email address found for {recipient_name}'}, status=status.HTTP_400_BAD_REQUEST)

        letter = f"""
        Reclamation Letter
        Invoice Number: {invoice.invoice_number}
        Date: {datetime.now(pytz.UTC).strftime('%Y-%m-%d')}
        To: {recipient_name}
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
        
        # Send email to recipient
        try:
            send_notification_email(
                subject=f'Payment Reclamation for Invoice {invoice.invoice_number}',
                message=letter,
                recipient_list=[recipient_email]
            )
        except Exception as e:
            return Response({'error': f'Failed to send email: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Notification interne au provider
        Notification.objects.create(
            user=invoice.provider.user,
            notif_type='REMINDER',
            message=f"Une relance de paiement a été envoyée pour la facture {invoice.invoice_number} ({remaining} FCFA restants).",
            invoice=invoice
        )
        
        # Notification interne aux admins
        for admin_user in User.objects.filter(userprofile__role='ADMIN'):
            Notification.objects.create(
                user=admin_user,
                notif_type='INFO',
                message=f"Lettre de relance envoyée pour la facture {invoice.invoice_number} ({recipient_name}) par {invoice.provider.name}."
            )
        
        return Response({'message': 'Reclamation letter sent successfully', 'letter': letter})


    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def download_template(self, request):
        workbook = openpyxl.Workbook()

        # Companys Sheet
        sheet = workbook.create_sheet('Companys')
        sheet.append(['Name'])
        # sheet.append(['DAYO'])  # Example data
        # sheet.append(['OLEA'])

        # Companies Sheet
        sheet = workbook.create_sheet('Companies')
        sheet.append(['Name', 'Company Name', 'Contact Email'])
        # sheet.append(['NSIA', 'DAYO', 'nsia@example.com'])
        # sheet.append(['SUNU', 'DAYO', 'sunu@example.com'])

        # Invoices Sheet
        sheet = workbook.create_sheet('Invoices')
        sheet.append(['Provider Name', 'Company Name', 'Broker Name', 'Invoice Number', 'Invoice Month (YYYY-MM)',
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
        created_records = {'Companys': 0, 'companies': 0, 'invoices': 0}

        # Import Companys
        if 'Companys' in workbook.sheetnames:
            sheet = workbook['Companys']
            if sheet.max_row < 2 or sheet[1][0].value != 'Name':
                errors.append('Companys sheet: Missing or incorrect header (expected "Name")')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    name = row[0]
                    if not name:
                        continue
                    if request.user.userprofile.role == 'ADMIN':
                        Company.objects.get_or_create(name=name)
                        created_records['Companys'] += 1
                    else:
                        errors.append('Only admins can import Companys')
                        break

        # Import Companies
        if 'Companies' in workbook.sheetnames:
            sheet = workbook['Companies']
            if sheet.max_row < 2 or tuple(cell.value for cell in sheet[1][:3]) != (
            'Name', 'Company Name', 'Contact Email'):
                errors.append(
                    'Companies sheet: Missing or incorrect headers (expected "Name", "Company Name", "Contact Email")')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    name, Company_name, contact_email = row[:3]
                    if not (name and Company_name):
                        continue
                    if request.user.userprofile.role == 'ADMIN':
                        try:
                            Company = Company.objects.get(name=Company_name)
                            Broker.objects.get_or_create(
                                name=name,
                                defaults={'Company': Company, 'contact_email': contact_email}
                            )
                            created_records['companies'] += 1
                        except Company.DoesNotExist:
                            errors.append(f'Broker {name}: Company {Company_name} not found')
                    else:
                        errors.append('Only admins can import companies')
                        break

        # Import Invoices
        if 'Invoices' in workbook.sheetnames:
            sheet = workbook['Invoices']
            expected_headers = ['Provider Name', 'Company Name', 'Broker Name', 'Invoice Number',
                                'Invoice Month (YYYY-MM)', 'Billed Amount', 'Paid Amount', 'Status']
            if sheet.max_row < 2 or tuple(cell.value for cell in sheet[1][:8]) != tuple(expected_headers):
                errors.append(
                    'Invoices sheet: Missing or incorrect headers (expected: ' + ', '.join(expected_headers) + ')')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    provider_name, Company_name, Broker_name, invoice_number, invoice_month, billed_amount, paid_amount, status = row[
                                                                                                                                  :8]
                    if not all(
                            [provider_name, Company_name, Broker_name, invoice_number, invoice_month, billed_amount]):
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

                        Company = Company.objects.get(name=Company_name)
                        Broker = Broker.objects.get(name=Broker_name, Company=Company)

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
                                'Company': Company,
                                'Broker': Broker,
                                'invoice_month': invoice_month,
                                'billed_amount': billed_amount,
                                'paid_amount': paid_amount,
                                'status': status,
                            }
                        )
                        created_records['invoices'] += 1
                    except (Company.DoesNotExist, Broker.DoesNotExist, Provider.DoesNotExist, ValueError) as e:
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
        # Chaque utilisateur ne voit que ses propres notifications
        return Notification.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        # Chaque utilisateur ne peut supprimer que ses propres notifications
        if instance.user != self.request.user:
            raise PermissionError("Vous ne pouvez supprimer que vos propres notifications")
        instance.delete()

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

    @action(detail=False, methods=['delete'], permission_classes=[IsAuthenticated])
    def clear_all(self, request):
        """Supprimer toutes les notifications de l'utilisateur connecté uniquement"""
        user = request.user
        # Chaque utilisateur ne peut supprimer que ses propres notifications
        count = Notification.objects.filter(user=user).delete()[0]
        
        return Response({
            'message': f'{count} notification(s) supprimée(s)',
            'deleted_count': count
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['patch'], permission_classes=[IsAuthenticated])
    def mark_all_read(self, request):
        """Marquer toutes les notifications de l'utilisateur connecté comme lues"""
        user = request.user
        # Marquer toutes les notifications non lues de l'utilisateur comme lues
        count = Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        
        return Response({
            'message': f'{count} notification(s) marquée(s) comme lue(s)',
            'updated_count': count
        }, status=status.HTTP_200_OK)




class CreateSubadminView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def post(self, request):
        """Créer un sous-admin avec des permissions personnalisées"""
        username = request.data.get('username')
        password = request.data.get('password')
        permissions = request.data.get('permissions', [])
        
        if not username or not password:
            return Response({'error': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Créer l'utilisateur
            user = User.objects.create_user(username=username, password=password)
            user.is_staff = True  # Allow access to Django admin
            user.is_superuser = False
            user.save(update_fields=["is_staff", "is_superuser"])
            
            # Créer le profil utilisateur
            profile = UserProfile.objects.create(
                user=user,
                username=username,
                role='SUB_ADMIN',  # Sous-admin distinct du rôle ADMIN
                is_active=True,
                email=user.email or f"{username}@example.com",
                permissions=permissions  # Stocker les permissions comme JSON
            )

            # Assigner les permissions Django si fournies
            assigned = 0
            for perm in permissions:
                try:
                    if isinstance(perm, str):
                        app_label = None
                        codename = perm
                        if "." in perm:
                            app_label, codename = perm.split(".", 1)
                            p = Permission.objects.get(content_type__app_label=app_label, codename=codename)
                        else:
                            p = Permission.objects.get(codename=codename)
                        user.user_permissions.add(p)
                        assigned += 1
                except Permission.DoesNotExist:
                    continue
                except Exception:
                    continue
            
            return Response({
                'user_id': user.id,
                'username': user.username,
                'message': 'Sous-admin créé avec succès'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': f'Error creating subadmin: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExportView(APIView):
    permission_classes = [IsAuthenticated, IsActiveProvider | IsAdmin]
    
    def get(self, request):
        print("Export function called!")
        print(f"Request user: {request.user}")
        print(f"Query params: {request.query_params}")
        
        # Récupérer le format d'export
        format_type = request.query_params.get('format', 'excel')
        print(f"Format: {format_type}")
        
        # Récupérer les filtres
        Broker_filter = request.query_params.get('Broker')
        status_filter = request.query_params.get('status')
        date_min = request.query_params.get('date_min')
        date_max = request.query_params.get('date_max')
        amount_min = request.query_params.get('amount_min')
        amount_max = request.query_params.get('amount_max')
        search = request.query_params.get('search')
        
        print(f"Filters: Broker={Broker_filter}, status={status_filter}, search={search}")
        
        # Construire le queryset avec les filtres
        user = request.user
        queryset = Invoice.objects.select_related('provider', 'Broker', 'Company').prefetch_related('payments', 'rejections')
        
        if user.userprofile.role != 'ADMIN':
            queryset = queryset.filter(provider__user=user)
        
        if Broker_filter:
            queryset = queryset.filter(Broker__name=Broker_filter)
        
        if status_filter:
            if status_filter == 'PAID':
                queryset = queryset.filter(status='PAID')
            elif status_filter == 'PARTIAL':
                queryset = queryset.filter(status='PARTIAL')
            elif status_filter == 'PENDING':
                queryset = queryset.filter(status='PENDING')
            elif status_filter == 'REJECTED':
                queryset = queryset.filter(status='REJECTED')
        
        if date_min:
            queryset = queryset.filter(deposit_date__gte=date_min)
        
        if date_max:
            queryset = queryset.filter(deposit_date__lte=date_max)
        
        if amount_min:
            queryset = queryset.filter(billed_amount__gte=float(amount_min))
        
        if amount_max:
            queryset = queryset.filter(billed_amount__lte=float(amount_max))
        
        if search:
            queryset = queryset.filter(
                Q(invoice_number__icontains=search) |
                Q(provider__name__icontains=search) |
                Q(Broker__name__icontains=search) |
                Q(Company__name__icontains=search)
            )
        
        # Récupérer les données
        invoices = list(queryset)
        print(f"Found {len(invoices)} invoices")
        
        if format_type == 'excel':
            return self._export_excel(invoices)
        elif format_type == 'pdf':
            return self._export_pdf(invoices)
        else:
            return Response({'error': 'Format non supporté'}, status=400)
    
    def _export_excel(self, invoices):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Factures"
        
        # En-têtes
        headers = [
            'ID', 'Numéro Facture', 'Prestataire', 'Entité',
            'Mois Facture', 'Date Dépôt', 'Montant Facturé', 'Montant Payé',
            'Montant Rejeté', 'Reste à Régler', 'Statut', 'Paiements', 'Rejets'
        ]
        
        for col, header in enumerate(headers, 1):
            sheet.cell(row=1, column=col, value=header)
        
        # Données
        for row, invoice in enumerate(invoices, 2):
            # Calculer les montants
            total_paid = sum(payment.amount for payment in invoice.payments.all())
            total_rejected = sum(rejection.rejected_amount for rejection in invoice.rejections.all())
            remaining = invoice.billed_amount - total_paid - total_rejected
            
            # Formater les paiements et rejets
            payments_str = '; '.join([f"{p.amount} ({p.payment_date})" for p in invoice.payments.all()])
            rejections_str = '; '.join([f"{r.rejected_amount} ({r.rejection_reason})" for r in invoice.rejections.all()])
            
            entity = (
                f"{invoice.Broker.name} ({invoice.Company.name})" if invoice.Broker and invoice.Company
                else (invoice.Broker.name if invoice.Broker else (invoice.Company.name if invoice.Company else 'N/A'))
            )
            data = [
                invoice.id,
                invoice.invoice_number,
                invoice.provider.name if invoice.provider else 'N/A',
                entity,
                invoice.invoice_month,
                invoice.deposit_date,
                invoice.billed_amount,
                total_paid,
                total_rejected,
                remaining,
                invoice.status,
                payments_str,
                rejections_str
            ]
            
            for col, value in enumerate(data, 1):
                sheet.cell(row=row, column=col, value=value)
        
        # Créer la réponse
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=factures.xlsx'
        workbook.save(response)
        return response
    
    def _export_pdf(self, invoices):
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=factures.pdf'
        
        doc = SimpleDocTemplate(response, pagesize=letter)
        elements = []
        
        # Titre
        from reportlab.platypus import Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
        styles = getSampleStyleSheet()
        title = Paragraph("Export des Factures", styles['Title'])
        elements.append(title)
        elements.append(Paragraph("<br/>", styles['Normal']))
        
        # Tableau des données
        data = [['ID', 'Numéro', 'Prestataire', 'Entité', 'Montant', 'Statut']]
        
        for invoice in invoices:
            entity = (
                f"{invoice.Broker.name} ({invoice.Company.name})" if invoice.Broker and invoice.Company
                else (invoice.Broker.name if invoice.Broker else (invoice.Company.name if invoice.Company else 'N/A'))
            )
            data.append([
                str(invoice.id),
                invoice.invoice_number,
                invoice.provider.name if invoice.provider else 'N/A',
                entity,
                f"{invoice.billed_amount} FCFA",
                invoice.status
            ])
        
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(table)
        doc.build(elements)
        return response