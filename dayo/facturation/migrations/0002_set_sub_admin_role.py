from django.db import migrations


def set_sub_admin_role(apps, schema_editor):
    UserProfile = apps.get_model('facturation', 'UserProfile')
    # Convert non-superuser ADMINs to SUB_ADMIN
    for profile in UserProfile.objects.filter(role='ADMIN', user__is_superuser=False):
        profile.role = 'SUB_ADMIN'
        profile.save(update_fields=['role'])


def revert_sub_admin_role(apps, schema_editor):
    UserProfile = apps.get_model('facturation', 'UserProfile')
    for profile in UserProfile.objects.filter(role='SUB_ADMIN'):
        profile.role = 'ADMIN'
        profile.save(update_fields=['role'])


class Migration(migrations.Migration):

    dependencies = [
        ('facturation', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(set_sub_admin_role, revert_sub_admin_role),
    ]
