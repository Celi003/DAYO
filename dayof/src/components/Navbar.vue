<template>
    <div class="sidebar w-64 p-4">
        <h1 class="text-2xl font-bold mb-6">DAYO</h1>
        <nav>
            <router-link to="/home" class="block py-2 px-4 rounded hover:bg-gray-700">Dashboard</router-link>
            <router-link to="/invoices" class="block py-2 px-4 rounded hover:bg-gray-700">Invoices</router-link>
            <router-link v-if="isAdmin" to="/brokers" class="block py-2 px-4 rounded hover:bg-gray-700">Brokers</router-link>
            <router-link v-if="isAdmin" to="/companies" class="block py-2 px-4 rounded hover:bg-gray-700">Companies</router-link>
            <router-link v-if="isAdmin" to="/admin" class="block py-2 px-4 rounded hover:bg-gray-700">Admin Panel</router-link>
            <button @click="logout" class="block w-full text-left py-2 px-4 rounded hover:bg-red-700">Logout</button>
        </nav>
    </div>
</template>

<script>
export default {
    computed: {
        isAdmin() {
            return localStorage.getItem('role') === 'ADMIN';
        }
    },
    methods: {
        logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            this.$router.push('/login');
            this.$toast.success('Logged out successfully');
        }
    }
};
</script>