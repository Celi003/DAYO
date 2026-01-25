
import React from 'react';
import { Page, User } from '../types';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  user: User;
  onLogout: () => void;
  isCollapsed: boolean;
  setCollapsed: (isCollapsed: boolean) => void;
  unreadNotificationsCount?: number;
}

const NavIcon: React.FC<{ name: Page | 'logout' }> = ({ name }: { name: Page | 'logout' }) => {
  const icons: { [key in Page | 'logout']: React.ReactNode } = {
    dashboard: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7"height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect></svg>
    ),
    registrations: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" x2="8" y1="13" y2="13"></line><line x1="16" x2="8" y1="17" y2="17"></line><line x1="10" x2="8" y1="9" y2="9"></line></svg>
    ),
    payments: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>
    ),
    partners: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
    ),
    admin: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-4.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.44.25a2 2 0 0 1-2 1.73V20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8.28a2 2 0 0 1-2-1.73l-.44-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
    ),
    logout: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
    ),
    notifications: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
    ),
  };
  return <span>{icons[name]}</span>;
};

const pageToPath: { [key in Page]: string } = {
  dashboard: '/',
  notifications: '/notifications',
  registrations: '/registrations',
  payments: '/payments',
  partners: '/partners',
  admin: '/admin',
};

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, isCollapsed, setCollapsed, unreadNotificationsCount = 0 }) => {
  const location = useLocation();
  const baseNavItems: { id: Page; label: string; path: string }[] = [
    { id: 'dashboard', label: 'Tableau de bord', path: pageToPath.dashboard },
    { id: 'registrations', label: 'Enregistrements', path: pageToPath.registrations },
    { id: 'payments', label: 'Paiements', path: pageToPath.payments },
    { id: 'partners', label: 'Partenaires', path: pageToPath.partners },
  ];
  
  const adminNavItem = { id: 'admin' as Page, label: 'Administration', path: pageToPath.admin };
  const isAdminLike = user.role === 'admin' || user.role === 'subadmin';
  const navItems = isAdminLike ? [...baseNavItems, adminNavItem] : baseNavItems;
  navItems.splice(1, 0, { id: 'notifications' as Page, label: 'Notifications', path: pageToPath.notifications });


  return (
    <aside
      className={`bg-slate-800 text-white flex flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      <div className="h-20 flex items-center justify-center border-b border-slate-700 px-3">
        <img src="/Images/Logo.png" alt="TakaCheck" className={`${isCollapsed ? 'h-12' : 'h-14'} object-contain`} />
      </div>
      <nav className="flex-1 px-4 py-6">
        <ul>
          {navItems.map((item) => (
            <li key={item.id}>
              <Link
                to={item.path}
                className={`w-full flex items-center px-4 py-3 my-1 rounded-lg text-sm font-medium transition-colors duration-200 relative ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  location.pathname === item.path
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
                aria-current={location.pathname === item.path ? 'page' : undefined}
              >
                <NavIcon name={item.id} />
                {!isCollapsed && <span className="ml-3 whitespace-nowrap">{item.label}</span>}
                {item.id === 'notifications' && unreadNotificationsCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </div>
                )}
              </Link>
            </li>
          ))}
          {/* Export PDF menu removed — export is available from Enregistrements actions */}
        </ul>
      </nav>
       <div className="px-4 py-6 border-t border-slate-700">
          <button
            onClick={onLogout}
            className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 text-slate-400 hover:bg-slate-700 hover:text-white ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "Déconnexion" : undefined}
          >
            <NavIcon name="logout" />
            {!isCollapsed && <span className="ml-3 whitespace-nowrap">Déconnexion</span>}
          </button>
      </div>
    </aside>
  );
};

export default Sidebar;