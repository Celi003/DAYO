<template>
    <div class="flex">
        <Navbar v-if="isAuthenticated && $route.path !== '/login' && $route.path !== '/register'" />
        <router-view class="flex-1"></router-view>
    </div>
</template>

<script>
import Navbar from './components/Navbar.vue';

export default {
    components: { Navbar },
    computed: {
        isAuthenticated() {
            return !!localStorage.getItem('token');
        }
    }
};
</script>