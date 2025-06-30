<template>
    <div class="p-6">
        <h2 class="text-2xl font-bold mb-4">Brokers</h2>
        <div class="mb-4">
            <form @submit.prevent="addBroker">
                <input v-model="newBroker.name" type="text" placeholder="Broker Name" class="p-2 border rounded" required>
                <button type="submit" class="bg-blue-500 text-white p-2 rounded action-button ml-2">Add Broker</button>
            </form>
        </div>
        <table class="w-full border-collapse">
            <thead>
                <tr class="table-header">
                    <th class="p-2">Name</th>
                    <th class="p-2">Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="broker in brokers" :key="broker.id">
                    <td class="p-2">{{ broker.name }}</td>
                    <td class="p-2">
                        <button @click="deleteBroker(broker.id)" class="text-red-500 underline">Delete</button>
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
            brokers: [],
            newBroker: { name: '' }
        };
    },
    async mounted() {
        await this.fetchBrokers();
    },
    methods: {
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
        async addBroker() {
            try {
                await axios.post(`${API_BASE_URL}/brokers/`, this.newBroker, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.newBroker.name = '';
                this.fetchBrokers();
                this.$toast.success('Broker added successfully');
            } catch (error) {
                this.$toast.error('Failed to add broker');
            }
        },
        async deleteBroker(id) {
            try {
                await axios.delete(`${API_BASE_URL}/brokers/${id}/`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.fetchBrokers();
                this.$toast.success('Broker deleted successfully');
            } catch (error) {
                this.$toast.error('Failed to delete broker');
            }
        }
    }
};
</script>