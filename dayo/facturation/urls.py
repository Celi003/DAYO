from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from . import views as fv_views
from rest_framework.views import APIView
from rest_framework.response import Response

class HelloView(APIView):
    def get(self, request):
        return Response({"message": "Bonjour !"})

router = DefaultRouter()
router.register(r'users', fv_views.UserProfileViewSet)
router.register(r'providers', fv_views.ProviderViewSet)
router.register(r'Companys', fv_views.CompanyViewSet)
router.register(r'companies', fv_views.BrokerViewSet)
router.register(r'invoices', fv_views.InvoiceViewSet)
router.register(r'auditlog', fv_views.AuditLogViewSet)
router.register(r'notifications', fv_views.NotificationViewSet)

urlpatterns = [
    # Specific paths MUST come before generic paths like path('', ...)
    path('users/create_subadmin/', fv_views.CreateSubadminView.as_view(), name='create_subadmin'),
    path('export/', fv_views.export_fallback, name='export'),     # ← Export endpoint (auth protected) - fallback wrapper
    path('login/', fv_views.LoginView.as_view(), name='login'),
    path('register/', fv_views.RegisterView.as_view(), name='register'),
    path('api-token-auth/', obtain_auth_token, name='api_token_auth'),
    # Generic paths at the end
    path('', include(router.urls)),                       # ← API routes
    path('', HelloView.as_view(), name='root'),          # ← Root fallback
]
