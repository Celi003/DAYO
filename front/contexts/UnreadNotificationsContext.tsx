import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as api from '../services/api';

interface UnreadNotificationsContextType {
  unreadCount: number;
  updateUnreadCount: () => Promise<void>;
  decrementUnreadCount: () => void;
  incrementUnreadCount: () => void;
  setUnreadCount: (count: number) => void;
}

const UnreadNotificationsContext = createContext<UnreadNotificationsContextType | undefined>(undefined);

export const useUnreadNotifications = () => {
  const context = useContext(UnreadNotificationsContext);
  if (context === undefined) {
    throw new Error('useUnreadNotifications must be used within an UnreadNotificationsProvider');
  }
  return context;
};

interface UnreadNotificationsProviderProps {
  children: ReactNode;
  currentUser: any;
}

export const UnreadNotificationsProvider: React.FC<UnreadNotificationsProviderProps> = ({ 
  children, 
  currentUser 
}) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const updateUnreadCount = async () => {
    if (currentUser) {
      try {
        const notifications = await api.getNotifications();
        const count = notifications?.filter((n: any) => !n.is_read).length || 0;
        setUnreadCount(count);
      } catch (error) {
        console.error('Error loading notifications count:', error);
      }
    }
  };

  const decrementUnreadCount = () => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const incrementUnreadCount = () => {
    setUnreadCount(prev => prev + 1);
  };

  useEffect(() => {
    updateUnreadCount();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(updateUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const contextValue: UnreadNotificationsContextType = {
    unreadCount,
    updateUnreadCount,
    decrementUnreadCount,
    incrementUnreadCount,
    setUnreadCount,
  };

  return (
    <UnreadNotificationsContext.Provider value={contextValue}>
      {children}
    </UnreadNotificationsContext.Provider>
  );
};