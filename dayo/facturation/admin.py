from django.contrib import admin
from .models import Notification, UserProfile

# Register your models here.
admin.site.register(Notification)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
	list_display = ("user", "username", "display_role", "is_active", "subscription_status", "subscription_expiry")
	list_filter = ("role", "is_active", "subscription_status")
	search_fields = ("user__username", "username", "email")
	actions = ["make_sous_admin"]

	def display_role(self, obj):
		if obj.role == 'SUB_ADMIN':
			return 'Sous-admin'
		if obj.role == 'ADMIN':
			return 'Admin'
		if obj.role == 'PROVIDER':
			return 'Prestataire'
		return obj.role
	display_role.short_description = 'Rôle'

	def make_sous_admin(self, request, queryset):
		updated = 0
		for profile in queryset:
			profile.role = 'SUB_ADMIN'
			profile.save(update_fields=['role'])
			if profile.user and not profile.user.is_staff:
				profile.user.is_staff = True
				profile.user.save(update_fields=['is_staff'])
			updated += 1
		self.message_user(request, f"{updated} utilisateur(s) défini(s) comme Sous-admin.")
	make_sous_admin.short_description = "Définir comme Sous-admin"

