<template>
    <div class="p-6">
        <h2 class="text-2xl font-bold mb-4">Companies</h2>
        <div class="mb-4">
            <form @submit.prevent="addCompany">
                <input v-model="newCompany.name" type="text" placeholder="Company Name" class="p-2 border rounded" required>
                <select v-model="newCompany.broker_id" class="p-2 border rounded" required>
                    <option value="">Select Broker</option>
                    <option v-for="broker in brokers" :value="broker.id">{{ broker.name }}</option>
                </select>
                <input v-model="newCompany.contact_email" type="email" placeholder="Contact Email" class="p-2 border rounded">
                <button type="submit" class="bg-blue-500 text-white p-2 rounded action-button ml-2">Add Company</button>
            </form>
        </div>
        <table class="w-full border-collapse">
            <thead>
                <tr class="table-header">
                    <th class="p-2">Name</th>
                    <th class="p-2">Broker</th>
                    <th class="p-2">Contact Email</th>
                    <th class="p-2">Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="company in companies" :key="company.id">
                    <td class="p-2">{{ company.name }}</td>
                    <td class="p-2">{{ company.broker.name }}</td>
                    <td class="p-2">{{ company.contact_email }}</td>
                    <td class="p-2">
                        <button @click="deleteCompany(company.id)" class="text-red-500 underline">Delete</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export default {
    data() {
        return {
            companies: [],
            brokers: [],
            newCompany: { name: '', broker_id: '', contact_email: '' }
        };
    },
    async mounted() {
        await this.fetchCompanies();
        await this.fetchBrokers();
    },
    methods: {
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
        async addCompany() {
            try {
                await axios.post(`${API_BASE_URL}/companies/`, this.newCompany, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.newCompany = { name: '', broker_id: '', contact_email: '' };
                this.fetchCompanies();
                this.$toast.success('Company added successfully');
            } catch (error) {
                this.$toast.error('Failed to add company');
            }
        },
        async deleteCompany(id) {
            try {
                await axios.delete(`${API_BASE_URL}/companies/${id}/`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.fetchCompanies();
                this.$toast.success('Company deleted successfully');
            } catch (error) {
                this.$toast.error('Failed to delete company');
            }
        }
    }
};
</script>