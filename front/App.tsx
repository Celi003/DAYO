
import React, { useState, useEffect, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { User } from './types';
import * as api from './services/api';
import { NotificationProvider } from './components/NotificationContext';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Registrations = React.lazy(() => import('./pages/Registrations'));
const Payments = React.lazy(() => import('./pages/Payments'));
const Partners = React.lazy(() => import('./pages/Partners'));
const Admin = React.lazy(() => import('./pages/Admin'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const Entities = React.lazy(() => import('./pages/Entities'));
const PaymentDetails = React.lazy(() => import('./pages/PaymentDetails'));
const AuditLog = React.lazy(() => import('./pages/AuditLog'));
const Notifications = React.lazy(() => import('./pages/Notifications'));

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    const checkUser = async () => {
      const user = await api.getCurrentUser();
      setCurrentUser(user);
      setIsLoading(false);
    };
    checkUser();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-screen bg-slate-100">
      <Sidebar
        user={currentUser!}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        setCollapsed={setIsSidebarCollapsed}
      />
      <main className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out p-6">
        {children}
      </main>
    </div>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-slate-100"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div></div>;
  }

  if (!currentUser) {
    if (authView === 'login') {
      return <Login onLogin={handleLogin} onGoToSignup={() => setAuthView('signup')} />;
    }
    return <Signup onGoToLogin={() => setAuthView('login')} />;
  }
  
  const isSubscriptionExpired = currentUser.role === 'provider' && currentUser.subscriptionEndDate && new Date(currentUser.subscriptionEndDate) < new Date();

  if (!currentUser.is_active) {
     return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-100 text-center p-4">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Accès refusé</h1>
            <p className="text-slate-700 mb-6">Votre compte est actuellement inactif. Veuillez contacter un administrateur pour l'activer.</p>
            <button onClick={handleLogout} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700">Retour à la connexion</button>
        </div>
    );
  }

  if (isSubscriptionExpired) {
       return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-100 text-center p-4">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Abonnement Expiré</h1>
            <p className="text-slate-700 mb-6">Votre abonnement a expiré. Veuillez contacter un administrateur pour le renouveler.</p>
            <button onClick={handleLogout} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700">Retour à la connexion</button>
        </div>
    );
  }


  return (
    <NotificationProvider>
      <Router>
        <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-100"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div></div>}>
          <Routes>
            <Route path="/" element={<Layout><Dashboard user={currentUser} /></Layout>} />
            <Route path="/notifications" element={<Layout><Notifications /></Layout>} />
            <Route path="/registrations" element={<Layout><Registrations user={currentUser} /></Layout>} />
            <Route path="/payments" element={<Layout><Payments user={currentUser} /></Layout>} />
            <Route path="/partners" element={<Layout><Partners user={currentUser} /></Layout>} />
            <Route path="/admin" element={<Layout>{currentUser.role === 'admin' ? <Admin /> : <Dashboard user={currentUser} />}</Layout>} />
            <Route path="/entities" element={<Layout><Entities /></Layout>} />
            <Route path="/payment-details" element={<Layout><PaymentDetails /></Layout>} />
            <Route path="/audit-log" element={<Layout><AuditLog /></Layout>} />
            {/* Garder les routes sans layout pour login/signup si nécessaire */}
          </Routes>
        </Suspense>
      </Router>
    </NotificationProvider>
  );
};

export default App;
