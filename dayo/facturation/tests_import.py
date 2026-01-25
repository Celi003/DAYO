from io import BytesIO
import openpyxl

from django.test import TestCase
from django.contrib.auth.models import User

from rest_framework.test import APIClient

from facturation.models import UserProfile, Provider, Company, Broker


class ImportDataTests(TestCase):
    def setUp(self):
        # Create admin user
        self.admin_user = User.objects.create_user(username='admin', password='pass')
        self.admin_user.is_superuser = True
        self.admin_user.save()
        UserProfile.objects.create(user=self.admin_user, username='admin', role='ADMIN', is_active=True)

        # Create provider for invoice rows (must be linked to a User)
        self.provider_main_user = User.objects.create_user(username='provider1', password='pass')
        self.provider = Provider.objects.create(user=self.provider_main_user, name='Provider1')

        # Create provider user (non-admin)
        self.provider_user = User.objects.create_user(username='prov', password='pass')
        UserProfile.objects.create(user=self.provider_user, username='prov', role='PROVIDER', is_active=True)
        Provider.objects.create(user=self.provider_user, name='prov')

        self.client = APIClient()

    def _make_workbook(self, provider_name='Provider1', company_name='DAYO', broker_name='NSIA', invoice_number='INV001'):
        wb = openpyxl.Workbook()
        # Compagnies sheet
        sheet = wb.create_sheet('Compagnies')
        sheet.append(['Name'])
        sheet.append([company_name])

        # Courtiers sheet
        sheet = wb.create_sheet('Courtiers')
        sheet.append(['Name', 'Company Name', 'Contact Email'])
        sheet.append([broker_name, company_name, 'broker@example.com'])

        # Invoices sheet
        sheet = wb.create_sheet('Invoices')
        sheet.append([
            'Provider Name', 'Company Name', 'Broker Name', 'Invoice Number',
            'Deposit Date (YYYY-MM-DD)', 'Invoice Month (YYYY-MM)', 'Billed Amount',
            'Paid Amounts (comma separated)', 'Paid Dates (comma separated, same order)',
            'Rejected Amounts (comma separated)', 'Rejected Reasons (comma separated)', 'Status'
        ])
        sheet.append([provider_name, company_name, broker_name, invoice_number, '2025-01-05', '2025-01', 150000, '', '', '', '', 'UNPAID'])

        # Remove default sheet if present
        if 'Sheet' in wb.sheetnames:
            wb.remove(wb['Sheet'])

        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        return bio

    def test_missing_file_returns_400(self):
        self.client.force_authenticate(user=self.admin_user)
        resp = self.client.post('/invoices/import_data/', {})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.data)

    def test_wrong_extension_returns_400(self):
        self.client.force_authenticate(user=self.admin_user)
        data = BytesIO(b'not an excel')
        data.name = 'data.txt'
        resp = self.client.post('/invoices/import_data/', {'file': data}, format='multipart')
        self.assertEqual(resp.status_code, 400)

    def test_invalid_excel_returns_400(self):
        self.client.force_authenticate(user=self.admin_user)
        data = BytesIO(b'invalidxlsxcontent')
        data.name = 'data.xlsx'
        resp = self.client.post('/invoices/import_data/', {'file': data}, format='multipart')
        self.assertEqual(resp.status_code, 400)

    def test_successful_import_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        wb = self._make_workbook()
        wb.name = 'data.xlsx'
        resp = self.client.post('/invoices/import_data/', {'file': wb}, format='multipart')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('created', resp.data)
        created = resp.data['created']
        # companies created: 1, brokers created: 1, invoices created: 1
        self.assertEqual(created.get('Companys'), 1)
        self.assertEqual(created.get('companies'), 1)
        self.assertEqual(created.get('invoices'), 1)

    def test_provider_cannot_import_compagnies(self):
        self.client.force_authenticate(user=self.provider_user)
        wb = self._make_workbook(provider_name='prov')
        wb.name = 'data.xlsx'
        resp = self.client.post('/invoices/import_data/', {'file': wb}, format='multipart')
        # provider should get errors (Only admins can import Compagnies)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('errors', resp.data)
        errors = resp.data['errors']
        self.assertTrue(any('Only admins' in e for e in errors))
