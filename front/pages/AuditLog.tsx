import React, { useEffect, useState } from 'react';
import { getAuditLog } from '../services/api';
import { useApi } from '../services/api';
import { useNotification } from '../components/NotificationContext';

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { call } = useApi();
  const { notify } = useNotification();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await call(() => getAuditLog());
      if (data) setLogs(data); else setLogs([]);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Historique des actions</h1>
      {loading ? <div>Chargement...</div> : logs.length === 0 ? <div className="text-slate-500">Aucune action trouvée.</div> : (
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Entité</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.date).toLocaleString()}</td>
                <td>{log.user}</td>
                <td>{log.action}</td>
                <td>{log.entity}</td>
                <td>{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AuditLog; 