from django.db import migrations


def set_is_staff_for_subadmins(apps, schema_editor):
    UserProfile = apps.get_model('facturation', 'UserProfile')
    for profile in UserProfile.objects.filter(role='SUB_ADMIN'):
        user = profile.user
        if user and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=['is_staff'])


def revert_is_staff_for_subadmins(apps, schema_editor):
    # No-op on reverse
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('facturation', '0002_set_sub_admin_role'),
    ]

    operations = [
        migrations.RunPython(set_is_staff_for_subadmins, revert_is_staff_for_subadmins),
    ]
