from rest_framework import serializers
from .models import *


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'role', 'is_active', 'subscription_status', 'subscription_expiry', 'email']


class ProviderSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)

    class Meta:
        model = Provider
        fields = ['id', 'name', 'user', 'subscription_status', 'subscription_expiry']


class BrokerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Broker
        fields = ['id', 'name']


class CompanySerializer(serializers.ModelSerializer):
    broker = BrokerSerializer(read_only=True)
    broker_id = serializers.PrimaryKeyRelatedField(queryset=Broker.objects.all(), source='broker', write_only=True)

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
    provider = serializers.StringRelatedField()
    broker = BrokerSerializer(read_only=True)
    company = CompanySerializer(read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    rejections = RejectionSerializer(many=True, read_only=True)
    remaining_amount = serializers.SerializerMethodField()
    rejected_amount = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = ['id', 'provider', 'broker', 'company', 'invoice_number', 'invoice_month',
                  'billed_amount', 'paid_amount', 'status', 'payments', 'rejections',
                  'remaining_amount', 'rejected_amount']

    def get_remaining_amount(self, obj):
        return obj.remaining_amount()

    def get_rejected_amount(self, obj):
        return obj.rejected_amount()