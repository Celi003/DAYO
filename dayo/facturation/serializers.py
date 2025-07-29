from rest_framework import serializers
from .models import *


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    permissions = serializers.ListField(child=serializers.CharField(), source='user.get_all_permissions', read_only=True)
    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'role', 'is_active', 'subscription_status', 'subscription_expiry', 'email', 'permissions']


class ProviderSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    user_id = serializers.IntegerField(source='user.user.id', read_only=True)

    class Meta:
        model = Provider
        fields = ['id', 'name', 'user', 'user_id', 'subscription_status', 'subscription_expiry']


class BrokerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Broker
        fields = ['id', 'name']


class CompanySerializer(serializers.ModelSerializer):
    broker = BrokerSerializer(read_only=True)
    broker_id = serializers.PrimaryKeyRelatedField(queryset=Broker.objects.all(), source='broker', write_only=True, required=False, allow_null=True)

    class Meta:
        model = Company
        fields = ['id', 'name', 'broker', 'broker_id', 'contact_email']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'invoice', 'payment_date', 'amount', 'payment_method']


class RejectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rejection
        fields = ['id', 'invoice', 'rejected_amount', 'rejection_reason', 'rejection_date']


class InvoiceSerializer(serializers.ModelSerializer):
    provider = ProviderSerializer(read_only=True)
    provider_id = serializers.PrimaryKeyRelatedField(queryset=Provider.objects.all(), source='provider', write_only=True)
    broker = BrokerSerializer(read_only=True)
    broker_id = serializers.PrimaryKeyRelatedField(queryset=Broker.objects.all(), source='broker', write_only=True, required=False, allow_null=True)
    company = CompanySerializer(read_only=True)
    company_id = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), source='company', write_only=True, required=False, allow_null=True)
    payments = PaymentSerializer(many=True, read_only=True)
    rejections = RejectionSerializer(many=True, read_only=True)
    remaining_amount = serializers.SerializerMethodField()
    rejected_amount = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'provider', 'provider_id', 'broker', 'broker_id', 'company', 'company_id',
            'invoice_number',
            'deposit_date',
            'invoice_month', 'billed_amount', 'paid_amount', 'status',
            'payments', 'rejections', 'remaining_amount', 'rejected_amount'
        ]

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