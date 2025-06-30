<template>
    <div class="p-6">
        <h2 class="text-2xl font-bold mb-4">Admin Panel</h2>
        <h3 class="text-xl font-bold mb-2">Users</h3>
        <table class="w-full border-collapse mb-6">
            <thead>
                <tr class="table-header">
                    <th class="p-2">Username</th>
                    <th class="p-2">Role</th>
                    <th class="p-2">Active</th>
                    <th class="p-2">Subscription Expiry</th>
                    <th class="p-2">Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="user in users" :key="user.id">
                    <td class="p-2">{{ user.username }}</td>
                    <td class="p-2">{{ user.role }}</td>
                    <td class="p-2">{{ user.is_active ? 'Yes' : 'No' }}</td>
                    <td class="p-2">{{ user.subscription_expiry || 'N/A' }}</td>
                    <td class="p-2">
                        <select v-if="user.role === 'PROVIDER'" v-model="user.duration" class="p-1 border rounded">
                            <option value="">Select Duration</option>
                            <option value="1_MONTH">1 Month</option>
                            <option value="3_MONTHS">3 Months</option>
                            <option value="1_YEAR">1 Year</option>
                        </select>
                        <button v-if="user.role === 'PROVIDER'" @click="activateAccount(user.id, user.duration)" class="text-blue-500 underline ml-2">Activate</button>
                    </td>
                </tr>
            </tbody>
        </table>
        <h3 class="text-xl font-bold mb-2">Providers</h3>
        <table class="w-full border-collapse">
            <thead>
                <tr class="table-header">
                    <th class="p-2">Name</th>
                    <th class="p-2">Subscription Status</th>
                    <th class="p-2">Subscription Expiry</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="provider in providers" :key="provider.id">
                    <td class="p-2">{{ provider.name }}</td>
                    <td class="p-2">{{ provider.subscription_status }}</td>
                    <td class="p-2">{{ provider.subscription_expiry }}</td>
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
            users: [],
            providers: []
        };
    },
    async mounted() {
        await this.fetchUsers();
        await this.fetchProviders();
    },
    methods: {
        async fetchUsers() {
            try {
                const response = await axios.get(`${API_BASE_URL}/users/`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.users = response.data.map(user => ({ ...user, duration: '' }));
            } catch (error) {
                this.$toast.error('Failed to load users');
            }
        },
        async fetchProviders() {
            try {
                const response = await axios.get(`${API_BASE_URL}/providers/`, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.providers = response.data;
            } catch (error) {
                this.$toast.error('Failed to load providers');
            }
        },
        async activateAccount(userId, duration) {
            if (!duration) {
                this.$toast.error('Please select a duration');
                return;
            }
            try {
                await axios.post(`${API_BASE_URL}/users/${userId}/activate_account/`, { duration }, {
                    headers: { Authorization: `Token ${localStorage.getItem('token')}` }
                });
                this.fetchUsers();
                this.$toast.success('Account activated successfully');
            } catch (error) {
                this.$toast.error('Failed to activate account');
            }
        }
    }
};
</script>