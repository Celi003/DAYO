<template>
    <div class="flex items-center justify-center min-h-screen bg-gray-100">
        <div class="bg-white p-8 rounded shadow-md w-full max-w-md">
            <h2 class="text-2xl font-bold mb-6 text-center">Register</h2>
            <form @submit.prevent="register">
                <div class="mb-4">
                    <label class="block text-gray-700">Username</label>
                    <input v-model="username" type="text" class="w-full p-2 border rounded" required>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700">Password</label>
                    <input v-model="password" type="password" class="w-full p-2 border rounded" required>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700">Name</label>
                    <input v-model="name" type="text" class="w-full p-2 border rounded" required>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700">Email</label>
                    <input v-model="email" type="email" class="w-full p-2 border rounded" required>
                </div>
                <button type="submit" class="w-full bg-blue-500 text-white p-2 rounded action-button">Register</button>
                <p class="mt-4 text-center">Already have an account? <router-link to="/login" class="text-blue-500">Login</router-link></p>
            </form>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export default {
    data() {
        return { username: '', password: '', name: '', email: '' };
    },
    methods: {
        async register() {
            try {
                await axios.post(`${API_BASE_URL}/register/`, {
                    username: this.username,
                    password: this.password,
                    name: this.name,
                    email: this.email
                });
                this.$router.push('/login');
                this.$toast.success('Registration successful. Awaiting admin activation.');
            } catch (error) {
                this.$toast.error(error.response?.data?.error || 'Registration failed');
            }
        }
    }
};
</script>