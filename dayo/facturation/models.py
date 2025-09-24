from django.db import models
from django.contrib.auth.models import User
from django.db.models import Sum
from datetime import timedelta


class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('SUB_ADMIN', 'Sous-admin'),
        ('PROVIDER', 'Provider'),
    )
    SUBSCRIPTION_DURATIONS = {
        '1_MONTH': timedelta(days=30),
        '3_MONTHS': timedelta(days=90),
        '6_MONTHS': timedelta(days=120),
        '9_MONTHS': timedelta(days=270),
        '1_YEAR': timedelta(days=365),
    }
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    username = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='PROVIDER')
    is_active = models.BooleanField(default=False)
    subscription_status = models.CharField(max_length=50, blank=True, null=True)
    subscription_expiry = models.DateTimeField(blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    permissions = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.role}"

    def cancel_subscription(self):
        """Annule l'abonnement de l'utilisateur"""
        self.subscription_status = "CANCELLED"
        self.subscription_expiry = None
        self.is_active = False
        self.save()
        
        # Mettre à jour aussi le Provider associé si il existe
        try:
            provider = Provider.objects.get(user=self.user)
            # Vérifier si les champs permettent les valeurs null
            if hasattr(provider, 'subscription_status'):
                provider.subscription_status = "CANCELLED"
            if hasattr(provider, 'subscription_expiry'):
                provider.subscription_expiry = None
            provider.save()
        except Provider.DoesNotExist:
            pass  # Pas de provider associé
        except Exception as e:
            print(f"Erreur lors de la mise à jour du Provider: {e}")
            pass  # Continuer même si la mise à jour du Provider échoue

class Provider(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    subscription_status = models.CharField(max_length=50, blank=True, null=True)
    subscription_expiry = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return self.name

class Company(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, null=True)

    def __str__(self):
        return self.name

class Broker(models.Model):
    name = models.CharField(max_length=255)
    Companys = models.ManyToManyField(Company, related_name='companies', blank=True)
    contact_email = models.EmailField(blank=True, null=True)

    def __str__(self):
        return self.name

class Invoice(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PARTIAL', 'Partial'),
        ('PAID', 'Paid'),
        ('REJECTED', 'Rejected'),
    )

    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='invoices')
    Company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='invoices', null=True, blank=True)
    Broker = models.ForeignKey(Broker, on_delete=models.CASCADE, related_name='invoices', null=True, blank=True)
    invoice_number = models.CharField(max_length=100)
    deposit_date = models.DateField(null=True, blank=True)
    invoice_month = models.DateField()
    billed_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    def remaining_amount(self):
        return self.billed_amount - self.paid_amount - self.rejected_amount()

    def rejected_amount(self):
        return self.rejections.aggregate(total=Sum('rejected_amount'))['total'] or 0

    def __str__(self):
        return f"{self.invoice_number} - {self.Broker.name}"

class Payment(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    payment_date = models.DateTimeField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=100)

    def __str__(self):
        return f"Payment {self.id} for {self.invoice.invoice_number}"

class Rejection(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='rejections')
    rejected_amount = models.DecimalField(max_digits=12, decimal_places=2)
    rejection_reason = models.TextField()
    rejection_date = models.DateTimeField()

    def __str__(self):
        return f"Rejection for {self.invoice.invoice_number}"

class AuditLog(models.Model):
    date = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=100)
    entity = models.CharField(max_length=100)
    details = models.TextField(blank=True)

    def __str__(self):
        return f"{self.date} - {self.user} - {self.action} - {self.entity}"

class Notification(models.Model):
    NOTIF_TYPE_CHOICES = (
        ('REMINDER', 'Relance'),
        ('PAYMENT_ALERT', 'Alerte de paiement'),
        ('INFO', 'Information'),
        ('WARNING', 'Avertissement'),
        ('CUSTOM', 'Personnalisée'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notif_type = models.CharField(max_length=30, choices=NOTIF_TYPE_CHOICES, default='INFO')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # Optionally link to an invoice, payment, etc.
    invoice = models.ForeignKey('Invoice', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    payment = models.ForeignKey('Payment', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')

    def __str__(self):
        return f"{self.user.username} - {self.notif_type} - {self.message[:30]}..."
