from celery import shared_task
from datetime import datetime
from .models import *
import pytz
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def send_notification_email(subject, message, recipient_list):
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.EMAIL_HOST_USER,
        recipient_list=recipient_list,
        fail_silently=False,
    )


@shared_task
def check_subscription_expiry():
    profiles = UserProfile.objects.filter(role='PROVIDER', is_active=True)
    admin_emails = UserProfile.objects.filter(role='ADMIN').values_list('email', flat=True)

    for profile in profiles:
        if profile.subscription_expiry and profile.subscription_expiry < datetime.now(pytz.UTC):
            profile.is_active = False
            profile.subscription_status = 'INACTIVE'
            profile.save()

            provider = Provider.objects.get(user=profile.user)
            provider.subscription_status = 'INACTIVE'
            provider.subscription_expiry = datetime.now(pytz.UTC)
            provider.save()

            # Notify provider
            if profile.email:
                send_notification_email.delay(
                    subject='Subscription Expired',
                    message=f'Dear {profile.user.username},\n\nYour subscription has expired on {profile.subscription_expiry}. Please renew your subscription to continue using the system.\n\nBest regards,\nSystem Admin',
                    recipient_list=[profile.email]
                )
            # Notification interne provider
            Notification.objects.create(
                user=profile.user,
                notif_type='WARNING',
                message=f"Votre abonnement a expiré le {profile.subscription_expiry.strftime('%d/%m/%Y')}. Veuillez le renouveler pour continuer à utiliser la plateforme."
            )
            # Notify admins
            if admin_emails:
                send_notification_email.delay(
                    subject=f'Provider Subscription Expired: {profile.user.username}',
                    message=f'The subscription for provider {profile.user.username} has expired on {profile.subscription_expiry}. Please review and reactivate if necessary.',
                    recipient_list=list(admin_emails)
                )
                # Notification interne admins
                for admin_user in User.objects.filter(userprofile__role='ADMIN'):
                    Notification.objects.create(
                        user=admin_user,
                        notif_type='WARNING',
                        message=f"L'abonnement du prestataire {profile.user.username} a expiré le {profile.subscription_expiry.strftime('%d/%m/%Y')}."
                    )