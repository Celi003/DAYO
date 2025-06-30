<template>
    <div class="p-6">
        <h2 class="text-2xl font-bold mb-4">Invoices</h2>
        <div class="mb-4 flex space-x-4">
            <select v-model="filters.broker_id" class="p-2 border rounded">
                <option value="">All Brokers</option>
                <option v-for="broker in brokers" :value="broker.id">{{ broker.name }}</option>
            </select>
            <select v-model="filters.company_id" class="p-2 border rounded">
                <option value="">All Companies</option>
                <option v-for="company in companies" :value="company.id">{{ company.name }}</option>
            </select>
            <input v-model="filters.year" type="number" placeholder="Year" class="p-2 border rounded">
            <input v-model="filters.month" type="number" placeholder="Month" class="p-2 border rounded">
            <button @click="fetchInvoices" class="bg-blue-500 text-white p-2 rounded action-button">Apply Filters</button>
            <button @click="downloadTemplate" class="bg-green-500 text-white p-2 rounded action-button">Download Template</button>
            <input type="file" @change="uploadFile" accept=".xlsx" class="p-2 border rounded">
            <button @click="exportData('excel')" class="bg-blue-500 text-white p-2 rounded action-button">Export Excel</button>
            <button @click="exportData('pdf')" class="bg-blue-500 text-white p-2 rounded action-button">Export PDF</button>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full border-collapse">
                <thead>
                    <tr class="table-header">
                        <th class="p-2">Invoice Number</th>
                        <th class="p-2">Provider</th>
                        <th class="p-2">Broker</th>
                        <th class="p-2">Company</th>
                        <th class="p-2">Month</th>
                        <th class="p-2">Billed</th>
                        <th class="p-2">Paid</th>
                        <th class="p-2">Rejected</th>
                        <th class="p-2">Remaining</th>
                        <th class="p-2">Status</th>
                        <th class="p-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="invoice in invoices" :key="invoice.id">
                        <td class="p-2">{{ invoice.invoice_number }}</td>
                        <td class="p-2">{{ invoice.provider }}</td>
                        <td class="p-2">{{ invoice.broker.name }}</td>
                        <td class="p-2">{{ invoice.company.name }}</td>
                        <td class="p-2">{{ invoice.invoice_month }}</td>
                        <td class="p-2">{{ invoice.billed_amount }}</td>
                        <td class="p-2">{{ invoice.paid_amount }}</td>
                        <td class="p-2">{{ invoice.rejected_amount }}</td>
                        <td class="p-2">{{ invoice.remaining_amount }}</td>
                        <td :class="'p-2 status-' + invoice.status.toLowerCase()">{{ invoice.status }}</td>
                        <td class="p-2">
                            <button @click="addPayment(invoice.id)" class="text-blue-500 underline mr-2">Add Payment</button>
                            <button @click="addRejection(invoice.id)" class="text-red-500 underline mr-2">Add Rejection</button>
                            <button @click="generateReclamationLetter(invoice.id)" class="text-green-500 underline">Reclamation</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-if="showPaymentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div class="bg-white p-6 rounded shadow-md">
                <h3 class="text-xl font-bold mb-4">Add Payment</h3>
                <form @submit.prevent="submitPayment">
                    <div class="mb-4">
                        <label class="block text-gray-700">Amount</label>
                        <input v-model="paymentForm.amount" type="number" class="w-full p-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700">Payment Method</label>
                        <input v-model="paymentForm.payment_method" type="text" class="w-full p-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700">Payment Date</label>
                        <input v-model="paymentForm.payment_date" type="date" class="w-full p-2 border rounded" required>
                    </div>
                    <button type="submit" class="bg-blue-500 text-white p-2 rounded action-button">Submit</button>
                    <button @click="showPaymentModal = false" class="bg-gray-500 text-white p-2 rounded action-button ml-2">Cancel</button>
                </form>
            </div>
        </div>
        <div v-if="showRejectionModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div class="bg-white p-6 rounded shadow-md">
                <h3 class="text-xl font-bold mb-4">Add Rejection</h3>
                <form @submit.prevent="submitRejection">
                    <div class="mb-4">
                        <label class="block text-gray-700">Rejected Amount</label>
                        <input v-model="rejectionForm.rejected_amount" type="number" class="w-full p-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700">Reason</label>
                        <textarea v-model="rejectionForm.rejection_reason" class="w-full p-2 border rounded" required></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700">Rejection Date</label>
                        <input v-model="rejectionForm.rejection_date" type="date" class="w-full p-2 border rounded" required>
                    </div>
                    <button type="submit" class="bg-blue-500 text-white p-2 rounded action-button">Submit</button>
                    <button @click="showRejectionModal = false" class="bg-gray-500 text-white p-2 rounded action-button ml-2">Cancel</button>
                </form>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export default {
    data() {
        return {
            invoices: [],
            brokers: [],
            companies: [],
            filters: { broker_id: '', company_id: '', year: '', month: '' },
            showPaymentModal: false,
            showRejectionModal: false,
            paymentForm: { amount: '', payment_method: '', payment_date: '' },
            rejectionForm: { rejected_amount: '', rejection_reason: '', rejection_date: '' },
            selectedInvoiceId: null
        };
    },
    async mounted() {
        await this.fetchInvoices();
        await this.fetchBrokers();
        await this.fetchCompanies();
    },
    methods: {
        async fetchInvoices() {
            try {
                const params = new URLSearchParams(this.filters).toString();
                const response = await axios.get(`${API_BASE_URL}/invoices/?${params}`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.invoices = response.data;
            } catch (error) {
                this.$toast.error('Failed to load invoices');
            }
        },
        async fetchBrokers() {
            try {
                const response = await axios.get(`${API_BASE_URL}/brokers/`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.brokers = response.data;
            } catch (error) {
                this.$toast.error('Failed to load brokers');
            }
        },
        async fetchCompanies() {
            try {
                const response = await axios.get(`${API_BASE_URL}/companies/`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.companies = response.data;
            } catch (error) {
                this.$toast.error('Failed to load companies');
            }
        },
        addPayment(invoiceId) {
            this.selectedInvoiceId = invoiceId;
            this.paymentForm = { amount: '', payment_method: '', payment_date: '' };
            this.showPaymentModal = true;
        },
        async submitPayment() {
            try {
                await axios.post(`${API_BASE_URL}/invoices/${this.selectedInvoiceId}/add_payment/`, this.paymentForm, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.showPaymentModal = false;
                this.fetchInvoices();
                this.$toast.success('Payment added successfully');
            } catch (error) {
                this.$toast.error('Failed to add payment');
            }
        },
        addRejection(invoiceId) {
            this.selectedInvoiceId = invoiceId;
            this.rejectionForm = { rejected_amount: '', rejection_reason: '', rejection_date: '' };
            this.showRejectionModal = true;
        },
        async submitRejection() {
            try {
                await axios.post(`${API_BASE_URL}/invoices/${this.selectedInvoiceId}/add_rejection/`, this.rejectionForm, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.showRejectionModal = false;
                this.fetchInvoices();
                this.$toast.success('Rejection added successfully');
            } catch (error) {
                this.$toast.error('Failed to add rejection');
            }
        },
        async generateReclamationLetter(invoiceId) {
            try {
                const response = await axios.post(`${API_BASE_URL}/invoices/${invoiceId}/generate_reclamation_letter/`, {}, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.$toast.success(response.data.message);
            } catch (error) {
                this.$toast.error(error.response?.data?.error || 'Failed to generate reclamation letter');
            }
        },
        async downloadTemplate() {
            try {
                const response = await axios.get(`${API_BASE_URL}/invoices/download_template/`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` },
                    responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'data_import_template.xlsx');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            
            } catch (error) {
                this.$toast.error('Failed to download template');
            }
        },
        async uploadFile(event) {
            const file = event.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await axios.post(`${API_BASE_URL}/invoices/import_data/`, formData, {
                    headers: {
                        Authorization: `Token ${localStorage.getItem('token')}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                this.$toast.success(response.data.message);
                this.fetchInvoices();
            } catch (error) {
                this.$toast.error(error.response?.data?.errors?.join('; ') || 'Failed to import data');
            }
        },
        async exportData(format) {
            try {
                const params = new URLSearchParams(this.filters).toString();
                const response = await axios.get(`${API_BASE_URL}/invoices/export/?format=${format}&${params}`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` },
                    responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `invoices.${format}`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                this.$toast.error(`Failed to export ${format}`);
            }
        }
    }
};
</script>