from django.contrib.auth import authenticate, login
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions
import openpyxl
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from .serializers import *
from .permissions import *
from .task import *

class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            profile = UserProfile.objects.get(user=user)
            if profile.role == 'PROVIDER' and (not profile.is_active or
                                               (
                                                       profile.subscription_expiry and profile.subscription_expiry < datetime.now(
                                                   pytz.UTC))):
                return Response({
                    'error': 'Account is inactive. Please renew your subscription to activate your account.'
                }, status=status.HTTP_403_FORBIDDEN)
            login(request, user)
            return Response({
                'user_id': user.id,
                'username': user.username,
                'role': profile.role,
                'is_active': profile.is_active,
                'token': user.auth_token.key if hasattr(user, 'auth_token') else None
            })
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        name = request.data.get('name')
        email = request.data.get('email')
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password)
        profile = UserProfile.objects.create(user=user, role='PROVIDER', is_active=False, email=email)
        Provider.objects.create(
            user=user,
            name=name,
            subscription_status='INACTIVE',
            subscription_expiry=datetime.now(pytz.UTC)
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
    permission_classes = [IsAuthenticated, IsAdmin]

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
        profile.save()

        provider = Provider.objects.get(user=profile.user)
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
    permission_classes = [IsAuthenticated, IsAdmin]


class BrokerViewSet(viewsets.ModelViewSet):
    queryset = Broker.objects.all()
    serializer_class = BrokerSerializer
    permission_classes = [IsAuthenticated, IsAdmin]


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated, IsAdmin]


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsActiveProvider | IsAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.userprofile.role == 'ADMIN':
            return Invoice.objects.all()
        return Invoice.objects.filter(provider__user=user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.userprofile.role == 'PROVIDER':
            provider = Provider.objects.get(user=user)
            serializer.save(provider=provider)
        else:
            serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def add_payment(self, request, pk=None):
        invoice = self.get_object()
        serializer = PaymentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(invoice=invoice)
            invoice.paid_amount += serializer.validated_data['amount']
            invoice.status = 'PAID' if invoice.remaining_amount() <= 0 else 'PARTIAL'
            invoice.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def add_rejection(self, request, pk=None):
        invoice = self.get_object()
        serializer = RejectionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(invoice=invoice)
            invoice.status = 'REJECTED' if invoice.remaining_amount() <= 0 else 'PARTIAL'
            invoice.save()
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
        stats = {
            'total_billed': queryset.aggregate(Sum('billed_amount'))['billed_amount__sum'] or 0,
            'total_paid': queryset.aggregate(Sum('paid_amount'))['paid_amount__sum'] or 0,
            'total_rejected': sum(invoice.rejected_amount() for invoice in queryset),
            'total_remaining': sum(invoice.remaining_amount() for invoice in queryset),
        }
        return Response(stats)

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
        send_notification_email.delay(
            subject=f'Payment Reclamation for Invoice {invoice.invoice_number}',
            message=letter,
            recipient_list=[invoice.company.contact_email]
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