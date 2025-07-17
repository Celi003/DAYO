import React, { createContext, useContext, useState, ReactNode } from 'react';
import Notification from './Notification';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationContextProps {
  notify: (msg: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextProps>({ notify: () => {} });

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [notif, setNotif] = useState<{msg: string, type: NotificationType} | null>(null);

  const notify = (msg: string, type: NotificationType = 'info') => {
    setNotif({ msg, type });
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {notif && <Notification message={notif.msg} type={notif.type} onClose={() => setNotif(null)} />}
    </NotificationContext.Provider>
  );
}; 