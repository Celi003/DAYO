import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dayo.settings")  # adapte si ton settings s'appelle différemment
django.setup()

from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password

def create_admin():
    if not User.objects.filter(username="dayo").exists():
        admin = User.objects.create(
            username="dayo",
            password=make_password("dayo003"),
            is_superuser=True, 
            is_staff=True, 
            email="celibertaizonou22@gmail.com"
        )
        print(f"Creating administrator '{admin.username} {admin.email}'")
        
    else:
        print(f"Superuser 'celibertaizonou22@gmail.com' already exists. Skipping creation.")

create_admin()