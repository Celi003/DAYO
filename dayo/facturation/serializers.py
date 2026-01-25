from rest_framework import serializers
from .models import *
from django.contrib.auth.models import User


class UserProfileSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        request = self.context.get('request')
        role = attrs.get('role')
        if role == 'ADMIN':
            if not request or not getattr(request.user, 'is_superuser', False):
                raise serializers.ValidationError({'role': 'Only superusers can assign ADMIN role.'})
        return attrs
    username = serializers.CharField(source='user.username', read_only=True)
    name = serializers.SerializerMethodField()
    permissions = serializers.ListField(child=serializers.CharField(), source='user.get_all_permissions', read_only=True)
    isActive = serializers.BooleanField(source='is_active', read_only=False)
    subscription_status = serializers.CharField(required=False, allow_blank=True)
    subscription_expiry = serializers.DateTimeField(required=False, allow_null=True)
    subscriptionEndDate = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    
    def get_name(self, obj):
        try:
            return obj.user.provider.name
        except:
            return None
    
    def update(self, instance, validated_data):
        print(f"DEBUG SERIALIZER: update called with validated_data: {validated_data}")
        print(f"DEBUG SERIALIZER: instance before update - subscription_expiry: {instance.subscription_expiry}")
        
        # Traiter explicitement subscriptionEndDate
        if 'subscriptionEndDate' in validated_data:
            print(f"DEBUG SERIALIZER: Found subscriptionEndDate: {validated_data['subscriptionEndDate']}")
            instance.subscription_expiry = validated_data.pop('subscriptionEndDate')
            print(f"DEBUG SERIALIZER: Set instance.subscription_expiry to: {instance.subscription_expiry}")
        
        result = super().update(instance, validated_data)
        print(f"DEBUG SERIALIZER: After super().update - subscription_expiry: {result.subscription_expiry}")
        
        # Synchroniser avec le Provider associé
        try:
            from .models import Provider
            provider = Provider.objects.get(user=instance.user)
            if instance.subscription_expiry:
                provider.subscription_expiry = instance.subscription_expiry
                provider.subscription_status = instance.subscription_status or 'ACTIVE'
                provider.save()
                print(f"DEBUG SERIALIZER: Updated Provider {provider.name} - subscription_expiry: {provider.subscription_expiry}")
            else:
                print(f"DEBUG SERIALIZER: No subscription_expiry to sync with Provider")
        except Provider.DoesNotExist:
            print(f"DEBUG SERIALIZER: No Provider found for user {instance.user.username}")
        except Exception as e:
            print(f"DEBUG SERIALIZER: Error updating Provider: {e}")
        
        return result
    
    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'name', 'role', 'is_active', 'isActive', 'subscription_status', 'subscription_expiry', 'subscriptionEndDate', 'email', 'permissions']


class ProviderSerializer(serializers.ModelSerializer):
    # Expose a lightweight user object so frontend can reliably match provider.user.id
    class SimpleUserSerializer(serializers.ModelSerializer):
        class Meta:
            model = User
            fields = ['id', 'username']

    user = SimpleUserSerializer(read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = Provider
        fields = ['id', 'name', 'user', 'user_id', 'subscription_status', 'subscription_expiry']


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name', 'email']


class BrokerSerializer(serializers.ModelSerializer):
    Companys = CompanySerializer(many=True, read_only=True)
    Company_ids = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), source='Companys', write_only=True, many=True, required=False)

    class Meta:
        model = Broker
        fields = ['id', 'name', 'Companys', 'Company_ids', 'contact_email']


class PaymentSerializer(serializers.ModelSerializer):
    payment_method = serializers.CharField(required=False, allow_blank=True, default='Virement')
    payment_date = serializers.DateTimeField(format=None, input_formats=['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', 'iso-8601'])
    
    class Meta:
        model = Payment
        fields = ['id', 'invoice', 'payment_date', 'amount', 'payment_method']


class RejectionSerializer(serializers.ModelSerializer):
    rejection_date = serializers.DateTimeField(format=None, input_formats=['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', 'iso-8601'])
    
    class Meta:
        model = Rejection
        fields = ['id', 'invoice', 'rejected_amount', 'rejection_reason', 'rejection_date']


class InvoiceSerializer(serializers.ModelSerializer):
    provider = ProviderSerializer(read_only=True)
    provider_id = serializers.PrimaryKeyRelatedField(queryset=Provider.objects.all(), source='provider', write_only=True, required=False, allow_null=True)
    # IMPORTANT: model fields are 'Company' and 'Broker'; map read-only fields correctly
    company = CompanySerializer(read_only=True, source='Company')
    company_id = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), source='Company', write_only=True, required=False, allow_null=True)
    broker = BrokerSerializer(read_only=True, source='Broker')
    broker_id = serializers.PrimaryKeyRelatedField(queryset=Broker.objects.all(), source='Broker', write_only=True, required=False, allow_null=True)
    payments = PaymentSerializer(many=True, read_only=True)
    rejections = RejectionSerializer(many=True, read_only=True)
    remaining_amount = serializers.SerializerMethodField()
    rejected_amount = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(required=False, allow_blank=True)
    invoice_month = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d', '%Y-%m'])

    class Meta:
        model = Invoice
        fields = [
            'id', 'provider', 'provider_id', 'company', 'company_id', 'broker', 'broker_id',
            'invoice_number',
            'deposit_date',
            'invoice_month', 'billed_amount', 'paid_amount', 'status',
            'payments', 'rejections', 'remaining_amount', 'rejected_amount'
        ]

    def validate_invoice_month(self, value):
        # Si c'est déjà un objet date, le retourner tel quel
        from datetime import date
        if isinstance(value, date):
            return value
        # Sinon, c'est une string au format YYYY-MM, convertir en YYYY-MM-01
        if isinstance(value, str) and len(value) == 7:  # Format YYYY-MM
            year, month = value.split('-')
            return date(int(year), int(month), 1)
        return value

    def create(self, validated_data):
        # Générer automatiquement le numéro de facture si non fourni
        if not validated_data.get('invoice_number'):
            from datetime import datetime
            # Format: INV-YYYYMM-XXXX
            year_month = datetime.now().strftime('%Y%m')
            last_invoice = Invoice.objects.filter(
                invoice_number__startswith=f'INV-{year_month}'
            ).order_by('-invoice_number').first()
            
            if last_invoice:
                # Extraire le numéro et incrémenter
                try:
                    last_num = int(last_invoice.invoice_number.split('-')[-1])
                    next_num = last_num + 1
                except (ValueError, IndexError):
                    next_num = 1
            else:
                next_num = 1
            
            validated_data['invoice_number'] = f'INV-{year_month}-{next_num:04d}'
        
        return super().create(validated_data)

    def get_remaining_amount(self, obj):
        return obj.remaining_amount()

    def get_rejected_amount(self, obj):
        return obj.rejected_amount()
    



class AuditLogSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = AuditLog
        fields = ['id', 'date', 'user', 'action', 'entity', 'details']


class NotificationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = Notification
        fields = ['id', 'username', 'notif_type', 'message', 'is_read', 'created_at', 'invoice', 'payment']