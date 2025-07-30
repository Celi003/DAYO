# Generated manually for fixing notification cascade delete

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facturation', '0001_initial'),
    ]

    operations = [
        # Change invoice foreign key to CASCADE
        migrations.AlterField(
            model_name='notification',
            name='invoice',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='notifications', to='facturation.invoice'),
        ),
        # Change payment foreign key to CASCADE
        migrations.AlterField(
            model_name='notification',
            name='payment',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='notifications', to='facturation.payment'),
        ),
    ] 