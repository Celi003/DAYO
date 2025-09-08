from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UserProfile


@receiver(post_save, sender=User)
def sync_username_on_user_save(sender, instance, created, **kwargs):
    """
    Synchronise le username dans UserProfile quand le User est modifié
    """
    try:
        profile = instance.userprofile
        if profile.username != instance.username:
            profile.username = instance.username
            profile.save(update_fields=['username'])
    except UserProfile.DoesNotExist:
        # Le profil n'existe pas encore, sera créé plus tard
        pass


@receiver(pre_save, sender=UserProfile)
def sync_username_on_profile_save(sender, instance, **kwargs):
    """
    S'assurer que le username est synchronisé avant la sauvegarde du UserProfile
    """
    if instance.user and instance.user.username:
        if not instance.username or instance.username != instance.user.username:
            instance.username = instance.user.username