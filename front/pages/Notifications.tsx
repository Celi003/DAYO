import React, { useEffect, useState } from 'react';
import { Notification } from '../types';
import { useApi, getNotifications, patchNotification } from '../services/api';
import { useNotification } from '../components/NotificationContext';

const typeLabel: Record<string, string> = {
  REMINDER: 'Relance',
  PAYMENT_ALERT: 'Alerte paiement',
  INFO: 'Info',
  WARNING: 'Avertissement',
  CUSTOM: 'Personnalisée',
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { call } = useApi();
  const { notify } = useNotification();

  const load = async () => {
    setLoading(true);
    const data = await call(() => getNotifications());
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleMark = async (notif: Notification, read: boolean) => {
    await call(() => patchNotification(notif.id, read), read ? 'Notification marquée comme lue' : 'Notification marquée comme non lue');
    setNotifications((notifications: Notification[]) => notifications.map((n: Notification) => n.id === notif.id ? { ...n, is_read: read } : n));
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>
      <button onClick={load} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Rafraîchir</button>
      {loading ? <div>Chargement...</div> : notifications.length === 0 ? <div className="text-slate-500">Aucune notification.</div> : (
        <ul className="space-y-4">
          {notifications.map(notif => (
            <li key={notif.id} className={`p-4 rounded shadow flex items-center justify-between ${notif.is_read ? 'bg-slate-100' : 'bg-yellow-50 border-l-4 border-yellow-400'}`}>
              <div>
                <div className="font-semibold text-sm text-slate-600 mb-1">{typeLabel[notif.notif_type] || notif.notif_type}</div>
                <div className="text-base text-slate-800">{notif.message}</div>
                <div className="text-xs text-slate-400 mt-1">{new Date(notif.created_at).toLocaleString()}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {!notif.is_read && <button onClick={() => handleMark(notif, true)} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Marquer comme lue</button>}
                {notif.is_read && <button onClick={() => handleMark(notif, false)} className="text-xs bg-slate-400 text-white px-3 py-1 rounded hover:bg-slate-500">Marquer comme non lue</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Notifications; 