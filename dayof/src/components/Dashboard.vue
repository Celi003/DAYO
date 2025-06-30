<template>
    <div class="p-6">
        <h2 class="text-2xl font-bold mb-4">Dashboard</h2>
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
            <button @click="fetchStats" class="bg-blue-500 text-white p-2 rounded action-button">Apply Filters</button>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full border-collapse">
                <thead>
                    <tr class="table-header">
                        <th class="p-2">Year</th>
                        <th class="p-2">Month</th>
                        <th class="p-2">Billed (FCFA)</th>
                        <th class="p-2">Paid (FCFA)</th>
                        <th class="p-2">Rejected (FCFA)</th>
                        <th class="p-2">Remaining (FCFA)</th>
                        <th class="p-2">Payments</th>
                        <th class="p-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="stat in stats" :key="stat.year + '-' + stat.month">
                        <td class="p-2">{{ stat.year }}</td>
                        <td class="p-2">{{ stat.month }}</td>
                        <td class="p-2">{{ stat.total_billed }}</td>
                        <td class="p-2">{{ stat.total_paid }}</td>
                        <td class="p-2">{{ stat.total_rejected }}</td>
                        <td class="p-2">{{ stat.total_remaining }}</td>
                        <td class="p-2">{{ stat.payment_count }}</td>
                        <td class="p-2">
                            <button @click="viewPaymentDetails(stat.year, stat.month)" class="text-blue-500 underline">View Details</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-if="paymentDetails.length" class="mt-4">
            <h3 class="text-xl font-bold">Payment Details for {{ selectedYear }}-{{ selectedMonth }}</h3>
            <table class="w-full border-collapse mt-2">
                <thead>
                    <tr class="table-header">
                        <th class="p-2">Invoice Number</th>
                        <th class="p-2">Date</th>
                        <th class="p-2">Amount (FCFA)</th>
                        <th class="p-2">Method</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="payment in paymentDetails" :key="payment.id">
                        <td class="p-2">{{ payment.invoice_number }}</td>
                        <td class="p-2">{{ new Date(payment.payment_date).toLocaleDateString() }}</td>
                        <td class="p-2">{{ payment.amount }}</td>
                        <td class="p-2">{{ payment.payment_method }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export default {
    data() {
        return {
            stats: [],
            brokers: [],
            companies: [],
            filters: { broker_id: '', company_id: '', year: '', month: '' },
            paymentDetails: [],
            selectedYear: null,
            selectedMonth: null
        };
    },
    async mounted() {
        await this.fetchStats();
        await this.fetchBrokers();
        await this.fetchCompanies();
    },
    methods: {
        async fetchStats() {
            try {
                const params = new URLSearchParams(this.filters).toString();
                const response = await axios.get(`${API_BASE_URL}/invoices/statistics/?${params}`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.stats = response.data.monthly_stats;
            } catch (error) {
                this.$toast.error('Failed to load statistics');
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
        async viewPaymentDetails(year, month) {
            try {
                this.selectedYear = year;
                this.selectedMonth = month;
                const response = await axios.get(`${API_BASE_URL}/invoices/payment_details/?year=${year}&month=${month}`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.paymentDetails = response.data.payments;
            } catch (error) {
                this.$toast.error('Failed to load payment details');
            }
        }
    }
};
</script>