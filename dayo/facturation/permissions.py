from rest_framework.permissions import BasePermission
from datetime import datetime
import pytz


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.userprofile.role in ('ADMIN', 'SUB_ADMIN')

class IsActiveProvider(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        profile = request.user.userprofile
        # Les admins ne sont jamais bloqués par is_active ou l'abonnement
        if profile.role in ('ADMIN', 'SUB_ADMIN'):
            return True
        if profile.role != 'PROVIDER':
            return False
        if not profile.is_active:
            return False
        if profile.subscription_expiry and profile.subscription_expiry < datetime.now(pytz.UTC):
            profile.is_active = False
            profile.save()
            return False
        return True

class IsAdminOrActiveProvider(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        profile = getattr(user, 'userprofile', None)
        print(f"DEBUG PERM: user={getattr(user, 'username', None)}, is_authenticated={getattr(user, 'is_authenticated', None)}, role={getattr(profile, 'role', None)}, is_active={getattr(profile, 'is_active', None)}")
        if not user.is_authenticated:
            return False
        if not profile:
            return False
        if profile.role in ('ADMIN', 'SUB_ADMIN'):
            return True
        if profile.role == 'PROVIDER' and profile.is_active:
            return True
        return False
