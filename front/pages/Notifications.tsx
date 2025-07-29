import React, { useEffect, useState } from "react";
import { Notification } from "../types";
import { useApi, getNotifications, patchNotification } from "../services/api";
import { useNotification } from "../components/NotificationContext";

const typeLabel: Record<string, string> = {
  REMINDER: "Relance",
  PAYMENT_ALERT: "Alerte paiement",
  INFO: "Info",
  WARNING: "Avertissement",
  CUSTOM: "Personnalisée",
};

// Configuration des couleurs par type avec respect des normes d'accessibilité
const typeColors: Record<
  string,
  { bg: string; bgRead: string; border: string; text: string; badge: string }
> = {
  REMINDER: {
    bg: "bg-purple-50",
    bgRead: "bg-purple-25",
    border: "border-purple-400",
    text: "text-purple-900",
    badge: "bg-purple-100 text-purple-800",
  },
  PAYMENT_ALERT: {
    bg: "bg-red-50",
    bgRead: "bg-red-25",
    border: "border-red-400",
    text: "text-red-900",
    badge: "bg-red-100 text-red-800",
  },
  INFO: {
    bg: "bg-blue-50",
    bgRead: "bg-blue-25",
    border: "border-blue-400",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-800",
  },
  WARNING: {
    bg: "bg-yellow-50",
    bgRead: "bg-yellow-25",
    border: "border-yellow-400",
    text: "text-yellow-900",
    badge: "bg-yellow-100 text-yellow-800",
  },
  CUSTOM: {
    bg: "bg-gray-50",
    bgRead: "bg-gray-25",
    border: "border-gray-400",
    text: "text-gray-900",
    badge: "bg-gray-100 text-gray-800",
  },
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

  useEffect(() => {
    load();
  }, []);

  const handleMark = async (notif: Notification, read: boolean) => {
    await call(
      () => patchNotification(notif.id, read),
      read
        ? "Notification marquée comme lue"
        : "Notification marquée comme non lue"
    );
    setNotifications((notifications: Notification[]) =>
      notifications.map((n: Notification) =>
        n.id === notif.id ? { ...n, is_read: read } : n
      )
    );
  };

  const getNotificationColors = (type: string) => {
    return typeColors[type] || typeColors.CUSTOM;
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>
      <button
        onClick={load}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Rafraîchir
      </button>
      {loading ? (
        <div>Chargement...</div>
      ) : notifications.length === 0 ? (
        <div className="text-slate-500">Aucune notification.</div>
      ) : (
        <ul className="space-y-4">
          {notifications.map((notif) => {
            const colors = getNotificationColors(notif.notif_type);
            return (
              <li
                key={notif.id}
                className={`p-4 rounded-lg shadow-sm flex items-center justify-between border-l-4 transition-all duration-200 hover:shadow-md relative ${
                  notif.is_read
                    ? `${colors.bgRead} ${colors.border} opacity-75`
                    : `${colors.bg} ${colors.border}`
                }`}
              >
                {!notif.is_read && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
                    NEW
                  </div>
                )}
                <div className="flex-1">
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2 ${colors.badge} relative`}
                  >
                    {typeLabel[notif.notif_type] || notif.notif_type}
                    {!notif.is_read && (
                      <span className="ml-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                  </div>
                  <div className={`text-base font-medium ${colors.text} mb-1`}>
                    {notif.message}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(notif.created_at).toLocaleString("fr-FR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMark(notif, true)}
                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-colors"
                      aria-label={`Marquer "${notif.message}" comme lue`}
                    >
                      Marquer comme lue
                    </button>
                  )}
                  {notif.is_read && (
                    <button
                      onClick={() => handleMark(notif, false)}
                      className="text-xs bg-slate-500 text-white px-3 py-1.5 rounded-md hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 transition-colors"
                      aria-label={`Marquer "${notif.message}" comme non lue`}
                    >
                      Marquer comme non lue
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Notifications;
