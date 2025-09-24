from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import *
from rest_framework.views import APIView
from rest_framework.response import Response

class HelloView(APIView):
    def get(self, request):
        return Response({"message": "Bonjour !"})

router = DefaultRouter()
router.register(r'users', UserProfileViewSet)
router.register(r'providers', ProviderViewSet)
router.register(r'Companys', CompanyViewSet)
router.register(r'companies', BrokerViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'auditlog', AuditLogViewSet)
router.register(r'notifications', NotificationViewSet)

urlpatterns = [
    path('', HelloView.as_view(), name='root'),               # ← Accueil = Bonjour !
    path('users/create_subadmin/', CreateSubadminView.as_view(), name='create_subadmin'),  # ← Nouvelle vue pour créer des sous-admins (AVANT le router)
    path('', include(router.urls)),                       # ← API routes à la racine
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('api-token-auth/', obtain_auth_token, name='api_token_auth'),
    path('export/', ExportView.as_view(), name='export'),     # ← Nouvelle vue d'export
]
