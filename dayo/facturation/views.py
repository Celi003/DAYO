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
from io import BytesIO
import openpyxl
import os


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
            # Get provider name if exists
            provider_name = None
            try:
                provider_name = user.provider.name
            except:
                pass
            
            return Response({
                'token': token.key,
                'role': profile.role,
                'isActive': profile.is_active,
                'subscriptionEndDate': profile.subscription_expiry.isoformat() if profile.subscription_expiry else None,
                'username': user.username,
                'name': provider_name,
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

    def create(self, request, *args, **kwargs):
        print(f"DEBUG: Invoice creation data: {request.data}")
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print(f"DEBUG: Invoice validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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

        # Compagnies Sheet (list of insurance companies)
        sheet = workbook.create_sheet('Compagnies')
        sheet.append(['Name'])
        # sheet.append(['DAYO'])  # Example data
        # sheet.append(['OLEA'])

        # Courtiers Sheet (list of brokers)
        sheet = workbook.create_sheet('Courtiers')
        sheet.append(['Name', 'Company Name', 'Contact Email'])
        # sheet.append(['NSIA', 'DAYO', 'nsia@example.com'])
        # sheet.append(['SUNU', 'DAYO', 'sunu@example.com'])

        # Invoices Sheet (expanded template to support deposit date, multiple payments and rejections)
        sheet = workbook.create_sheet('Invoices')
        sheet.append([
            'Provider Name',
            'Company Name',
            'Broker Name',
            'Invoice Number',
            'Deposit Date (YYYY-MM-DD)',
            'Invoice Month (YYYY-MM)',
            'Billed Amount',
            'Paid Amounts (comma separated)',
            'Paid Dates (comma separated, same order)',
            'Rejected Amounts (comma separated)',
            'Rejected Reasons (comma separated)',
            'Status'
        ])
        # Example row:
        # sheet.append(['Provider1', 'DAYO', 'NSIA', 'INV001', '2025-01-05', '2025-01', 150000, '50000,50000', '2025-01-10,2025-02-01', '0', '', 'PARTIAL'])

        # Remove default sheet
        workbook.remove(workbook['Sheet'])

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename=data_import_template.xlsx'
        workbook.save(response)
        return response

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsActiveProvider | IsAdmin])
    def import_data(self, request):
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

        # Import Companies / Compagnies (support old 'Companys' name and new 'Compagnies')
        comp_sheet_names = [n for n in ('Compagnies', 'Companys') if n in workbook.sheetnames]
        if comp_sheet_names:
            sheet = workbook[comp_sheet_names[0]]
            if sheet.max_row < 2 or sheet[1][0].value != 'Name':
                errors.append('Compagnies sheet: Missing or incorrect header (expected "Name")')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    name = row[0]
                    if not name:
                        continue
                    if request.user.userprofile.role == 'ADMIN':
                        Company.objects.get_or_create(name=name)
                        created_records['Companys'] += 1
                    else:
                        errors.append('Only admins can import Compagnies')
                        break

        # Import Brokers / Courtiers (support old 'Companies' name and new 'Courtiers')
        broker_sheet_names = [n for n in ('Courtiers', 'Companies') if n in workbook.sheetnames]
        if broker_sheet_names:
            sheet = workbook[broker_sheet_names[0]]
            if sheet.max_row < 2 or tuple(cell.value for cell in sheet[1][:3]) != (
                    'Name', 'Company Name', 'Contact Email'):
                errors.append(
                    'Courtiers sheet: Missing or incorrect headers (expected "Name", "Company Name", "Contact Email")')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    name, company_name, contact_email = row[:3]
                    if not (name and company_name):
                        continue
                    if request.user.userprofile.role == 'ADMIN':
                        try:
                            company_obj = Company.objects.get(name=company_name)
                            broker_obj, created = Broker.objects.get_or_create(
                                name=name,
                                defaults={'contact_email': contact_email}
                            )
                            # link broker to company (ManyToMany)
                            try:
                                broker_obj.Companys.add(company_obj)
                            except Exception:
                                pass
                            created_records['companies'] += 1
                        except Company.DoesNotExist:
                            errors.append(f'Broker {name}: Company {company_name} not found')
                    else:
                        errors.append('Only admins can import brokers')
                        break

        # Import Invoices
        if 'Invoices' in workbook.sheetnames:
            sheet = workbook['Invoices']
            # Support both the old minimal template and the new expanded template by detecting headers
            header_row = [cell.value for cell in sheet[1]]
            # Define possible header names and indexes
            hdr_map = {h: i for i, h in enumerate(header_row) if h}

            # helper to get cell by header name (case-insensitive startswith)
            def idx_of(prefix_list):
                for pref in prefix_list:
                    for i, h in enumerate(header_row):
                        if not h:
                            continue
                        if str(h).strip().lower().startswith(pref.lower()):
                            return i
                return None

            # Determine indexes
            i_provider = idx_of(['Provider Name', 'Provider'])
            i_company = idx_of(['Company Name', 'Company'])
            i_broker = idx_of(['Broker Name', 'Broker'])
            i_invoice_number = idx_of(['Invoice Number', 'N° facture', 'Invoice'])
            i_deposit_date = idx_of(['Deposit Date', 'Deposit', 'Date dépôt'])
            i_invoice_month = idx_of(['Invoice Month', 'invoice_month', 'Mois facture'])
            i_billed = idx_of(['Billed Amount', 'Billed', 'Montant facturé'])
            i_paid_amounts = idx_of(['Paid Amounts', 'Paid Amount', 'Paid'])
            i_paid_dates = idx_of(['Paid Dates', 'Paid Date', 'Date(s) paiements'])
            i_rejected_amounts = idx_of(['Rejected Amounts', 'Rejected Amount', 'Montant rejeté'])
            i_rejected_reasons = idx_of(['Rejected Reasons', 'Rejected Reason', 'Motif rejet'])
            i_status = idx_of(['Status', 'Dernier statut'])

            # Minimal required indexes
            if i_provider is None or i_company is None or i_broker is None or i_invoice_number is None or i_invoice_month is None or i_billed is None:
                errors.append('Invoices sheet: Missing required headers. Expected at least Provider Name, Company Name, Broker Name, Invoice Number, Invoice Month (YYYY-MM), Billed Amount')
            else:
                for row in sheet.iter_rows(min_row=2, values_only=True):
                    provider_name = row[i_provider] if i_provider is not None else None
                    Company_name = row[i_company] if i_company is not None else None
                    Broker_name = row[i_broker] if i_broker is not None else None
                    invoice_number = row[i_invoice_number] if i_invoice_number is not None else None
                    deposit_date = row[i_deposit_date] if i_deposit_date is not None else None
                    invoice_month = row[i_invoice_month] if i_invoice_month is not None else None
                    billed_amount = row[i_billed] if i_billed is not None else None
                    paid_vals_raw = row[i_paid_amounts] if i_paid_amounts is not None else None
                    paid_dates_raw = row[i_paid_dates] if i_paid_dates is not None else None
                    rejected_vals_raw = row[i_rejected_amounts] if i_rejected_amounts is not None else None
                    rejected_reasons_raw = row[i_rejected_reasons] if i_rejected_reasons is not None else None
                    invoice_status = row[i_status] if i_status is not None else None

                    if not all([provider_name, Company_name, Broker_name, invoice_number, invoice_month, billed_amount]):
                        continue

                    try:
                        # Validate invoice month
                        invoice_month_date = None
                        try:
                            invoice_month_date = datetime.strptime(str(invoice_month), '%Y-%m').date()
                        except Exception:
                            # if deposit_date is present, try to extract year-month
                            if deposit_date:
                                try:
                                    invoice_month_date = datetime.strptime(str(deposit_date)[:10], '%Y-%m-%d').date().replace(day=1)
                                except Exception:
                                    raise ValueError('Invalid invoice month or deposit date')
                            else:
                                raise ValueError('Invalid invoice month format')

                        # Parse billed amount
                        billed_amount_f = float(billed_amount)

                        # Parse paid amounts (comma separated) -> sum
                        paid_amount_f = 0.0
                        if paid_vals_raw:
                            try:
                                if isinstance(paid_vals_raw, str):
                                    paid_list = [p.strip() for p in paid_vals_raw.split(',') if p.strip()]
                                else:
                                    paid_list = [str(paid_vals_raw)]
                                paid_amount_f = sum([float(p.replace(' ', '')) for p in paid_list])
                            except Exception:
                                paid_amount_f = float(paid_list[0]) if paid_list else 0.0

                        # Validate status against choices if present
                        if invoice_status and invoice_status not in dict(Invoice.STATUS_CHOICES):
                            errors.append(f'Invoice {invoice_number}: Invalid status {invoice_status}')
                            continue

                        # Resolve related objects without shadowing model class names
                        company_obj = Company.objects.get(name=Company_name)
                        broker_obj = Broker.objects.get(name=Broker_name, Companys__in=[company_obj]) if Broker.objects.filter(name=Broker_name, Companys__in=[company_obj]).exists() else None

                        if request.user.userprofile.role == 'ADMIN':
                            provider_obj = Provider.objects.get(name=provider_name)
                        else:
                            provider_obj = Provider.objects.get(user=request.user)
                            if provider_name != provider_obj.name:
                                errors.append(
                                    f'Invoice {invoice_number}: Provider name {provider_name} does not match authenticated user')
                                continue

                        Invoice.objects.get_or_create(
                            invoice_number=invoice_number,
                            defaults={
                                'provider': provider_obj,
                                'Company': company_obj,
                                'Broker': broker_obj,
                                'invoice_month': invoice_month_date,
                                'billed_amount': billed_amount_f,
                                'paid_amount': paid_amount_f,
                                'status': invoice_status or 'UNPAID',
                            }
                        )
                        created_records['invoices'] += 1
                    except (Company.DoesNotExist, Broker.DoesNotExist, Provider.DoesNotExist, ValueError) as e:
                        errors.append(f'Invoice {invoice_number}: {str(e)}')

        # If there are import errors, log them to the server console for diagnosis
        if errors:
            try:
                print('--- import_data DEBUG ---')
                print('errors:', errors)
                print('created_records:', created_records)
                print('-------------------------')
            except Exception:
                pass
            return Response({'errors': errors, 'created': created_records}, status=status.HTTP_400_BAD_REQUEST)

        try:
            print('--- import_data SUCCESS ---')
            print('created_records:', created_records)
            print('----------------------------')
        except Exception:
            pass
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
            'count': count
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def unread_count(self, request):
        """Obtenir le nombre de notifications non lues de l'utilisateur connecté"""
        user = request.user
        count = Notification.objects.filter(user=user, is_read=False).count()
        
        return Response({
            'count': count
        }, status=status.HTTP_200_OK)
        
        return Response({
            'count': count
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
    # Use the composed permission which already checks authentication and active/provider/admin roles
    permission_classes = [IsAdminOrActiveProvider]
    
    def get(self, request):
        print("Export function called!")
        print(f"Request user: {request.user}")
        print(f"Query params: {request.query_params}")
        # Debug headers that may affect CORS/auth behavior
        print("HTTP_ORIGIN:", request.META.get('HTTP_ORIGIN'))
        print("HTTP_AUTHORIZATION:", request.META.get('HTTP_AUTHORIZATION'))
        
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
        
        # Build filters compatible with `_build_rows_from_db` and decide which template to use
        filters = {}
        for key in ('start_date', 'end_date', 'compagnie', 'courtier'):
            v = request.query_params.get(key)
            if v:
                filters[key] = v

        # Determine target grouping: allow explicit `target` param, else prefer query filters, default to 'compagnie'
        target_param = request.query_params.get('target')
        target = 'compagnie'
        if target_param in ('compagnie', 'courtier'):
            target = target_param
        else:
            if 'courtier' in filters and filters.get('courtier'):
                target = 'courtier'
            elif 'compagnie' in filters and filters.get('compagnie'):
                target = 'compagnie'

        # Build rows using the same logic as the HTML/PDF endpoints
        rows, summary = _build_rows_from_db(filters)

        # Choose output based on requested format
        if format_type == 'json':
            return Response({'rows': rows, 'summary': summary})

        if format_type == 'excel':
            # If no explicit target and no entity filters, export both sheets
            if not request.query_params.get('target') and not (filters.get('compagnie') or filters.get('courtier')):
                # build workbook with two sheets rendered from templates (or fallback to rows)
                wb = openpyxl.Workbook()
                comp_rows = [r for r in rows if r.get('compagnie_name')]
                court_rows = [r for r in rows if r.get('courtier_name')]

                comp_sheet = wb.active
                comp_sheet.title = 'Compagnies'
                if not self._populate_sheet_from_html(comp_sheet, 'facturation/Compagnie.html', {'title': 'Etat de facturation - Compagnies', 'rows': comp_rows, 'summary': summary, 'filters': {}}):
                    self._write_rows_to_sheet(comp_sheet, comp_rows, group='compagnie')

                court_sheet = wb.create_sheet('Courtiers')
                if not self._populate_sheet_from_html(court_sheet, 'facturation/Courtier.html', {'title': 'Etat de facturation - Courtiers', 'rows': court_rows, 'summary': summary, 'filters': {}}):
                    self._write_rows_to_sheet(court_sheet, court_rows, group='courtier')

                output = BytesIO()
                wb.save(output)
                output.seek(0)
                response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                response['Content-Disposition'] = f'attachment; filename=Etat_Facturation_Compagnies_Courtiers.xlsx'
                return response

            return self._export_excel_from_template(rows, summary, group=target)

        if format_type == 'pdf':
            # Render HTML from template and convert to PDF using WeasyPrint
            from django.template.loader import render_to_string
            tmpl = 'facturation/Compagnie.html' if target == 'compagnie' else 'facturation/Courtier.html'
            ctx = {'title': f"Etat de facturation - { 'Compagnies' if target=='compagnie' else 'Courtiers' }", 'rows': rows, 'summary': summary, 'filters': filters}
            html = render_to_string(tmpl, ctx)
            try:
                from weasyprint import HTML
                # If neither compagnie nor courtier filter provided and no explicit target, render both templates into one PDF
                if not request.query_params.get('target') and not (filters.get('compagnie') or filters.get('courtier')):
                    html_c = render_to_string('facturation/Compagnie.html', {'title': 'Etat de facturation - Compagnies', 'rows': [r for r in rows if r.get('compagnie_name')], 'summary': summary, 'filters': filters})
                    html_k = render_to_string('facturation/Courtier.html', {'title': 'Etat de facturation - Courtiers', 'rows': [r for r in rows if r.get('courtier_name')], 'summary': summary, 'filters': filters})
                    # simple concatenation with a page break
                    combined = f"<div>{html_c}</div><div style='page-break-before: always'></div><div>{html_k}</div>"
                    pdf = HTML(string=combined).write_pdf()
                    resp = HttpResponse(pdf, content_type='application/pdf')
                    resp['Content-Disposition'] = 'attachment; filename=etat_compagnies_courtiers.pdf'
                    return resp
                pdf = HTML(string=html).write_pdf()
                resp = HttpResponse(pdf, content_type='application/pdf')
                resp['Content-Disposition'] = f'attachment; filename=etat_{target}.pdf'
                return resp
            except Exception as e:
                return Response({'error': f'PDF generation failed: {e}'}, status=500)

        # default: return HTML (rendered template)
        from django.template.loader import render_to_string
        tmpl = 'facturation/Compagnie.html' if target == 'compagnie' else 'facturation/Courtier.html'
        ctx = {'title': f"Etat de facturation - { 'Compagnies' if target=='compagnie' else 'Courtiers' }", 'rows': rows, 'summary': summary, 'filters': filters}
        html = render_to_string(tmpl, ctx)
        return HttpResponse(html, content_type='text/html')

    # (PaymentsTemplateExportView removed) exports will use the HTML templates and the
    # rows produced by `_build_rows_from_db` implemented in `pdf_views.py`.
    def _export_excel(self, invoices):
        # Deprecated: keep for backward-compatibility but not used when exporting from HTML-driven rows
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Factures"
        sheet.cell(row=1, column=1, value='ID')
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=factures.xlsx'
        workbook.save(response)
        return response

    def _export_excel_from_rows(self, rows, summary, group='compagnie'):
        """Build an Excel workbook from the `rows` structure produced by `_build_rows_from_db`.

        Each `inv` in `rows` should include `lines` (list of dicts with p_amount, p_date, r_amount, r_reason).
        The first line includes invoice identifiers; subsequent lines are sub-lines for payments/rejections.
        """
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        title = 'Compagnies' if group == 'compagnie' else 'Courtiers'
        sheet.title = title

        # Headers similar to HTML table
        if group == 'compagnie':
            headers = [
                'N° facture', 'Date dépôt', 'Mois facture', 'Compagnie', 'Sous-compagnie',
                'Montant facturé', 'Montant payé', 'Montant rejeté', 'Date(s) paiements',
                'Solde à percevoir', 'Dernier statut', 'Motif rejet'
            ]
        else:
            headers = [
                'N° facture', 'Date dépôt', 'Mois facture', 'Courtier', 'Sous-compagnie',
                'Montant facturé', 'Montant payé', 'Montant rejeté', 'Date(s) paiements',
                'Solde à percevoir', 'Dernier statut', 'Motif rejet'
            ]

        for col, header in enumerate(headers, 1):
            sheet.cell(row=1, column=col, value=header)

        out_row = 2
        for inv in rows:
            lines = inv.get('lines') or [{'p_amount': '', 'p_date': '', 'r_amount': '', 'r_reason': ''}]
            for i, line in enumerate(lines):
                if i == 0:
                    first_cols = [
                        inv.get('invoice_number', ''),
                        inv.get('deposit_date', ''),
                        inv.get('invoice_month', ''),
                        (inv.get('compagnie_name') if group == 'compagnie' else inv.get('courtier_name')) or '',
                        inv.get('sous_compagnie', '') or '',
                        float(inv.get('montant_facture') or 0),
                    ]
                else:
                    first_cols = [''] * 6

                paid = float(line.get('p_amount') or 0) if line.get('p_amount') not in (None, '') else ''
                rejected = float(line.get('r_amount') or 0) if line.get('r_amount') not in (None, '') else ''
                paid_date = line.get('p_date', '')
                remaining = float(inv.get('remaining') or 0) if i == 0 else ''
                status = inv.get('status', '') if i == 0 else ''
                motif = line.get('r_reason', '')

                row_vals = first_cols + [paid, rejected, paid_date, remaining, status, motif]
                for col, val in enumerate(row_vals, 1):
                    sheet.cell(row=out_row, column=col, value=val)
                out_row += 1

        output = BytesIO()
        workbook.save(output)
        output.seek(0)
        response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename=Etat_Facturation_{title}.xlsx'
        return response

    def _populate_sheet_from_html(self, sheet, tmpl, ctx):
        """Render `tmpl` with `ctx` and try to parse the first HTML table into `sheet`.
        Returns True on success, False on failure (caller should fallback).
        """
        try:
            from django.template.loader import render_to_string
            html = render_to_string(tmpl, ctx)
            # import BeautifulSoup lazily (may not be installed)
            try:
                from bs4 import BeautifulSoup
            except Exception:
                return False

            soup = BeautifulSoup(html, "html.parser")
            table = soup.find("table")
            if not table:
                return False

            out_row = 1
            for tr in table.find_all("tr"):
                cols = tr.find_all(["th", "td"])
                out_col = 1
                for c in cols:
                    # Normalize whitespace
                    text = " ".join(c.get_text(separator=" ").split())
                    sheet.cell(row=out_row, column=out_col, value=text)
                    out_col += 1
                out_row += 1
            return True
        except Exception:
            return False

    def _export_excel_from_template(self, rows, summary, group='compagnie'):
        """Attempt to build an XLSX by rendering the HTML template and parsing its table.
        Falls back to `_export_excel_from_rows` if parsing isn't possible.
        """
        from django.template.loader import render_to_string

        workbook = openpyxl.Workbook()
        sheet = workbook.active
        title = 'Compagnies' if group == 'compagnie' else 'Courtiers'
        sheet.title = title

        tmpl = 'facturation/Compagnie.html' if group == 'compagnie' else 'facturation/Courtier.html'
        ctx = {'title': f"Etat de facturation - {title}", 'rows': rows, 'summary': summary, 'filters': {}}

        populated = self._populate_sheet_from_html(sheet, tmpl, ctx)
        if not populated:
            # fallback to the robust row-based writer
            self._write_rows_to_sheet(sheet, rows, group=group)

        output = BytesIO()
        workbook.save(output)
        output.seek(0)
        response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename=Etat_Facturation_{title}.xlsx'
        return response

    def _write_rows_to_sheet(self, sheet, rows, group='compagnie'):
        """Write rows into the provided openpyxl sheet using the same layout as templates."""
        # Headers similar to HTML table
        if group == 'compagnie':
            headers = [
                'N° facture', 'Date dépôt', 'Mois facture', 'Compagnie', 'Sous-compagnie',
                'Montant facturé', 'Montant payé', 'Montant rejeté', 'Date(s) paiements',
                'Solde à percevoir', 'Dernier statut', 'Motif rejet'
            ]
        else:
            headers = [
                'N° facture', 'Date dépôt', 'Mois facture', 'Courtier', 'Sous-compagnie',
                'Montant facturé', 'Montant payé', 'Montant rejeté', 'Date(s) paiements',
                'Solde à percevoir', 'Dernier statut', 'Motif rejet'
            ]

        for col, header in enumerate(headers, 1):
            sheet.cell(row=1, column=col, value=header)

        out_row = 2
        for inv in rows:
            lines = inv.get('lines') or [{'p_amount': '', 'p_date': '', 'r_amount': '', 'r_reason': ''}]
            for i, line in enumerate(lines):
                if i == 0:
                    first_cols = [
                        inv.get('invoice_number', ''),
                        inv.get('deposit_date', ''),
                        inv.get('invoice_month', ''),
                        (inv.get('compagnie_name') if group == 'compagnie' else inv.get('courtier_name')) or '',
                        inv.get('sous_compagnie', '') or '',
                        float(inv.get('montant_facture') or 0),
                    ]
                else:
                    first_cols = [''] * 6

                paid = float(line.get('p_amount') or 0) if line.get('p_amount') not in (None, '') else ''
                rejected = float(line.get('r_amount') or 0) if line.get('r_amount') not in (None, '') else ''
                paid_date = line.get('p_date', '')
                remaining = float(inv.get('remaining') or 0) if i == 0 else ''
                status = inv.get('status', '') if i == 0 else ''
                motif = line.get('r_reason', '')

                row_vals = first_cols + [paid, rejected, paid_date, remaining, status, motif]
                for col, val in enumerate(row_vals, 1):
                    sheet.cell(row=out_row, column=col, value=val)
                out_row += 1

    def _export_excel_multi(self, rows, summary):
        """Create an Excel workbook with two sheets: Compagnies and Courtiers, populated from rows."""
        wb = openpyxl.Workbook()
        # Prepare filtered rows
        comp_rows = [r for r in rows if r.get('compagnie_name')]
        court_rows = [r for r in rows if r.get('courtier_name')]

        # Compagnie sheet
        comp_sheet = wb.active
        comp_sheet.title = 'Compagnies'
        self._write_rows_to_sheet(comp_sheet, comp_rows, group='compagnie')

        # Courtier sheet
        court_sheet = wb.create_sheet('Courtiers')
        self._write_rows_to_sheet(court_sheet, court_rows, group='courtier')

        output = BytesIO()
        wb.save(output)
        output.seek(0)
        response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename=Etat_Facturation_Compagnies_Courtiers.xlsx'
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


def export_fallback(request):
    """Django view wrapper that authenticates via Token and delegates to ExportView.get.
    Preserves token auth and permission checks while avoiding DRF content-negotiation
    that caused 404s for some Accept/Origin header combinations.
    """
    from rest_framework.authentication import TokenAuthentication
    from rest_framework.request import Request

    auth = TokenAuthentication()
    auth_result = auth.authenticate(request)
    if auth_result is None:
        return HttpResponse(status=401)
    user, token = auth_result
    request.user = user

    perm = IsAdminOrActiveProvider()
    dummy_view = ExportView()
    if not perm.has_permission(request, dummy_view):
        return HttpResponse(status=403)

    drf_request = Request(request)
    view = ExportView()
    return view.get(drf_request)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrActiveProvider]

    def get(self, request, year):
        """
        Retourne les statistiques du dashboard pour une année donnée
        """
        try:
            year = int(year)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid year'}, status=status.HTTP_400_BAD_REQUEST)

        # Filtrer les factures par année
        invoices = Invoice.objects.filter(
            deposit_date__year=year
        )

        # Si l'utilisateur est un prestataire, filtrer par son ID
        if hasattr(request.user, 'userprofile') and request.user.userprofile.role == 'PROVIDER':
            try:
                provider = Provider.objects.get(user=request.user)
                invoices = invoices.filter(provider=provider)
                print(f"DEBUG Dashboard: Provider {provider.id}, Year {year}, Invoices count: {invoices.count()}")
            except Provider.DoesNotExist:
                print(f"DEBUG Dashboard: Provider not found for user {request.user.username}")
                pass
        else:
            print(f"DEBUG Dashboard: Admin user, Year {year}, Invoices count: {invoices.count()}")

        # Calculer les statistiques globales
        total_invoices = invoices.count()
        total_revenue = invoices.aggregate(Sum('billed_amount'))['billed_amount__sum'] or 0
        
        print(f"DEBUG Dashboard: Total invoices: {total_invoices}, Total revenue: {total_revenue}")
        
        # Calculer le total des paiements
        total_payments = Payment.objects.filter(
            invoice__in=invoices
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        # Calculer le total des rejets
        total_rejections = Rejection.objects.filter(
            invoice__in=invoices
        ).aggregate(Sum('rejected_amount'))['rejected_amount__sum'] or 0

        # Calculer les factures par statut
        status_counts = {
            'pending': invoices.filter(status='PENDING').count(),
            'partially_paid': invoices.filter(status='PARTIALLY_PAID').count(),
            'paid': invoices.filter(status='PAID').count(),
            'rejected': invoices.filter(status='REJECTED').count(),
        }

        # Calculer les revenus mensuels
        monthly_revenue = []
        for month in range(1, 13):
            month_invoices = invoices.filter(deposit_date__month=month)
            month_total = month_invoices.aggregate(Sum('billed_amount'))['billed_amount__sum'] or 0
            month_payments = Payment.objects.filter(
                invoice__in=month_invoices
            ).aggregate(Sum('amount'))['amount__sum'] or 0
            
            monthly_revenue.append({
                'month': month,
                'revenue': float(month_total),
                'paid': float(month_payments)
            })

        # Statistiques par entité (compagnies et courtiers)
        companies_stats = []
        brokers_stats = []

        # Stats par compagnie
        companies = Company.objects.all()
        for company in companies:
            company_invoices = invoices.filter(Company=company)
            if company_invoices.exists():
                company_total = company_invoices.aggregate(Sum('billed_amount'))['billed_amount__sum'] or 0
                companies_stats.append({
                    'id': company.id,
                    'name': company.name,
                    'total': float(company_total),
                    'count': company_invoices.count()
                })

        # Stats par courtier
        brokers = Broker.objects.all()
        for broker in brokers:
            broker_invoices = invoices.filter(Broker=broker)
            if broker_invoices.exists():
                broker_total = broker_invoices.aggregate(Sum('billed_amount'))['billed_amount__sum'] or 0
                brokers_stats.append({
                    'id': broker.id,
                    'name': broker.name,
                    'total': float(broker_total),
                    'count': broker_invoices.count()
                })

        return Response({
            'year': year,
            'totalInvoices': total_invoices,
            'totalRevenue': float(total_revenue),
            'totalPayments': float(total_payments),
            'totalRejections': float(total_rejections),
            'statusCounts': status_counts,
            'monthlyRevenue': monthly_revenue,
            'companiesStats': companies_stats,
            'brokersStats': brokers_stats
        })


class InvoicesByYearView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrActiveProvider]

    def get(self, request, year):
        """
        Retourne la liste des factures pour une année donnée
        """
        try:
            year = int(year)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid year'}, status=status.HTTP_400_BAD_REQUEST)

        # Filtrer les factures par année
        invoices = Invoice.objects.filter(
            deposit_date__year=year
        ).select_related('provider', 'Broker', 'Company').prefetch_related('payments', 'rejections')

        # Si l'utilisateur est un prestataire, filtrer par son ID
        if hasattr(request.user, 'userprofile') and request.user.userprofile.role == 'PROVIDER':
            try:
                provider = Provider.objects.get(user=request.user)
                invoices = invoices.filter(provider=provider)
            except Provider.DoesNotExist:
                pass

        # Sérialiser les factures
        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data)


class InvoicePaymentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrActiveProvider]

    def post(self, request, invoice_id):
        """
        Ajouter un paiement à une facture
        """
        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)

        # Ajouter l'invoice_id aux données pour la validation
        data = dict(request.data)
        data['invoice'] = invoice_id
        
        print(f"DEBUG: Payment data received: {data}")
        
        serializer = PaymentSerializer(data=data)
        if serializer.is_valid():
            amount = serializer.validated_data['amount']
            # Validation: le paiement ne doit pas dépasser le reste à régler
            try:
                remaining_before = invoice.remaining_amount()
            except Exception:
                remaining_before = invoice.billed_amount - invoice.paid_amount - invoice.rejected_amount()
            
            if amount > remaining_before:
                return Response({'error': 'Le paiement dépasse le montant restant de la facture.'}, status=status.HTTP_400_BAD_REQUEST)

            payment = serializer.save()
            invoice.paid_amount += amount
            print(f"DEBUG: Adding payment of {amount}, new paid_amount: {invoice.paid_amount}")
            invoice.save()
            
            # Recalculer le statut après la sauvegarde
            remaining = invoice.remaining_amount()
            print(f"DEBUG: Remaining amount: {remaining}, Billed: {invoice.billed_amount}, Paid: {invoice.paid_amount}, Rejected: {invoice.rejected_amount()}")
            invoice.status = 'PAID' if remaining <= 0 else 'PARTIAL'
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
        print(f"Payment validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InvoicePaymentDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrActiveProvider]

    def delete(self, request, invoice_id, payment_id):
        """
        Supprimer un paiement
        """
        try:
            payment = Payment.objects.get(id=payment_id, invoice_id=invoice_id)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

        invoice = payment.invoice
        invoice.paid_amount -= payment.amount
        invoice.save()
        
        # Recalculer le statut après la sauvegarde
        if invoice.remaining_amount() >= invoice.billed_amount:
            invoice.status = 'PENDING'
        elif invoice.remaining_amount() > 0:
            invoice.status = 'PARTIAL'
        else:
            invoice.status = 'PAID'
        
        invoice.save()
        payment.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvoiceRejectionsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrActiveProvider]

    def post(self, request, invoice_id):
        """
        Ajouter un rejet à une facture
        """
        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)

        # Ajouter l'invoice_id aux données pour la validation
        data = request.data.copy()
        data['invoice'] = invoice_id
        
        serializer = RejectionSerializer(data=data)
        if serializer.is_valid():
            amount = serializer.validated_data['rejected_amount']
            # Validation: le rejet ne doit pas dépasser le montant restant après paiements
            try:
                remaining_before = invoice.remaining_amount()
            except Exception:
                remaining_before = invoice.billed_amount - invoice.paid_amount - invoice.rejected_amount()
            
            if amount > remaining_before:
                return Response({'error': 'Le montant du rejet dépasse le solde restant de la facture.'}, status=status.HTTP_400_BAD_REQUEST)

            rejection = serializer.save()
            # Le rejected_amount est calculé dynamiquement, pas besoin de le stocker
            # Juste recalculer le statut
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
        print(f"Rejection validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InvoiceRejectionDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrActiveProvider]

    def delete(self, request, invoice_id, rejection_id):
        """
        Supprimer un rejet
        """
        try:
            rejection = Rejection.objects.get(id=rejection_id, invoice_id=invoice_id)
        except Rejection.DoesNotExist:
            return Response({'error': 'Rejection not found'}, status=status.HTTP_404_NOT_FOUND)

        invoice = rejection.invoice
        
        # Recalculer le statut
        if invoice.remaining_amount() + rejection.rejected_amount >= invoice.billed_amount:
            invoice.status = 'PENDING'
        elif invoice.remaining_amount() + rejection.rejected_amount > 0:
            invoice.status = 'PARTIAL'
        
        invoice.save()
        rejection.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)