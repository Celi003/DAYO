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
router.register(r'brokers', BrokerViewSet)
router.register(r'companies', CompanyViewSet)
router.register(r'invoices', InvoiceViewSet)

urlpatterns = [
    path('', HelloView.as_view(), name='root'),               # ← Accueil = Bonjour !
    path('api/', include(router.urls)),                       # ← API routes déplacées ici
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('api-token-auth/', obtain_auth_token, name='api_token_auth'),
]
