from rest_framework.permissions import BasePermission
from datetime import datetime
import pytz


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.userprofile.role == 'ADMIN'

class IsActiveProvider(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        profile = request.user.userprofile
        if profile.role != 'PROVIDER':
            return False
        if not profile.is_active:
            return False
        if profile.subscription_expiry and profile.subscription_expiry < datetime.now(pytz.UTC):
            profile.is_active = False
            profile.save()
            return False
        return True
