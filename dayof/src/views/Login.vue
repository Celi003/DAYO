<template>
    <div class="flex items-center justify-center min-h-screen bg-gray-100">
        <div class="bg-white p-8 rounded shadow-md w-full max-w-md">
            <h2 class="text-2xl font-bold mb-6 text-center">Login</h2>
            <form @submit.prevent="login">
                <div class="mb-4">
                    <label class="block text-gray-700">Username</label>
                    <input v-model="username" type="text" class="w-full p-2 border rounded" required>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700">Password</label>
                    <input v-model="password" type="password" class="w-full p-2 border rounded" required>
                </div>
                <button type="submit" class="w-full bg-blue-500 text-white p-2 rounded action-button">Login</button>
                <p class="mt-4 text-center">Don't have an account? <router-link to="/register" class="text-blue-500">Register</router-link></p>
            </form>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export default {
    data() {
        return { username: '', password: '' };
    },
    methods: {
        async login() {
            try {
                const response = await axios.post(`${API_BASE_URL}/login/`, {
                    username: this.username,
                    password: this.password
                });
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('role', response.data.role);
                this.$router.push('/home');
                this.$toast.success('Logged in successfully');
            } catch (error) {
                // this.$toast.error(error.response?.data?.error || 'Login failed');
                console.log(error)
            }
        }
    }
};
</script>