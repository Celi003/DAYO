# Generated manually for adding permissions field to UserProfile

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facturation', '0002_fix_notification_cascade_delete'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='permissions',
            field=models.JSONField(blank=True, default=list),
        ),
    ] 