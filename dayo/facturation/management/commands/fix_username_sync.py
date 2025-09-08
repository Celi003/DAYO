from django.core.management.base import BaseCommand
from facturation.models import UserProfile


class Command(BaseCommand):
    help = 'Synchronise les usernames manquants dans UserProfile avec les usernames du modèle User Django'

    def handle(self, *args, **options):
        self.stdout.write("Début de la synchronisation des usernames...")
        
        # Trouver tous les UserProfile avec des usernames vides ou None
        profiles_to_fix = UserProfile.objects.filter(
            username__in=['', None]
        ) | UserProfile.objects.filter(
            username__isnull=True
        )
        
        self.stdout.write(f"Nombre de profils à corriger : {profiles_to_fix.count()}")
        
        fixed_count = 0
        for profile in profiles_to_fix:
            if profile.user and profile.user.username:
                old_username = profile.username
                profile.username = profile.user.username
                profile.save()
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Profil ID {profile.id}: '{old_username}' → '{profile.username}'")
                )
                fixed_count += 1
            else:
                self.stdout.write(
                    self.style.ERROR(f"✗ Profil ID {profile.id}: Aucun user associé ou username vide")
                )
        
        self.stdout.write(
            self.style.SUCCESS(f"Synchronisation terminée. {fixed_count} profils corrigés.")
        )