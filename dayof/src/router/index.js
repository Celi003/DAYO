import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import Home from '../views/Home.vue';
import Invoices from '../views/Invoices.vue';
import Brokers from '../views/Brokers.vue';
import Companies from '../views/Companies.vue';
import Admin from '../views/Admin.vue';

const routes = [
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/home', component: Home, meta: { requiresAuth: true } },
    { path: '/invoices', component: Invoices, meta: { requiresAuth: true } },
    { path: '/brokers', component: Brokers, meta: { requiresAuth: true, adminOnly: true } },
    { path: '/companies', component: Companies, meta: { requiresAuth: true, adminOnly: true } },
    { path: '/admin', component: Admin, meta: { requiresAuth: true, adminOnly: true } },
    { path: '/', redirect: '/login' }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach((to, from, next) => {
    const isAuthenticated = !!localStorage.getItem('token');
    const isAdmin = localStorage.getItem('role') === 'ADMIN';
    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login');
    } else if (to.meta.adminOnly && !isAdmin) {
        next('/home');
    } else {
        next();
    }
});

export default router;