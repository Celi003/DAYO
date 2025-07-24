
import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, updateUser, activateProviderAccount } from '../services/api';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../components/NotificationContext';
import { useApi } from '../services/api';

const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return 'Date invalide';
    }
};

const ALL_ROLES = ['admin', 'subadmin', 'provider', 'broker', 'company'] as const;
const ALL_PERMISSIONS = [
  'can_edit_invoice',
  'can_view_payments',
  'can_manage_partners',
  'can_export_data',
  'can_view_auditlog',
  'can_manage_entities',
];

interface AdminProps {
  subadminMode?: boolean;
  user?: User;
}

const Admin: React.FC<AdminProps> = ({ subadminMode, user: subadminUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const navigate = useNavigate();
    const { notify } = useNotification();
    const { call } = useApi();
    const [showCreateSubadmin, setShowCreateSubadmin] = useState(false);
    const [newSubadmin, setNewSubadmin] = useState<{username: string; password: string; permissions: string[]}>({username: '', password: '', permissions: []});
    const [activationUserId, setActivationUserId] = useState<string | null>(null);
    const [activationDuration, setActivationDuration] = useState<string>('1_MONTH');

    // Définir fetchUsers hors du useCallback
    const fetchUsers = async () => {
        setLoading(true);
        try {
            let usersData = await call(() => getUsers());
            if (Array.isArray(usersData)) {
              if (subadminMode && subadminUser) {
                // Filtrer pour ne montrer que les utilisateurs gérables par le subadmin
                usersData = usersData.filter(u => u.role !== 'admin' && u.id !== subadminUser.id);
              }
              setUsers(usersData);
            }
            else setUsers([]);
        } catch (e: any) {
            notify(e.message || "Erreur lors du chargement des utilisateurs", "error");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subadminMode, subadminUser]);

    const handleToggleActive = async (user: User) => {
        await call(() => updateUser(user.id, { isActive: !user.is_active }), 'Statut utilisateur mis à jour');
            await fetchUsers();
    };

    const handleDateChange = (userId: string, date: string) => {
        setUsers(prevUsers =>
            prevUsers.map(u => (u.id === userId ? { ...u, subscriptionEndDate: date } : u))
        );
    };

    const handleSaveDate = async (user: User) => {
        await call(() => updateUser(user.id, { subscriptionEndDate: user.subscriptionEndDate }), `Date d'abonnement mise à jour pour ${user.username}.`);
        await fetchUsers();
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
    };

    const handleEditChange = (field: string, value: any) => {
        if (!editingUser) return;
        setEditingUser({ ...editingUser, [field]: value });
    };

    const handlePermissionToggle = (perm: string) => {
        if (!editingUser) return;
        const perms = editingUser.permissions || [];
        if (perms.includes(perm)) {
            setEditingUser({ ...editingUser, permissions: perms.filter(p => p !== perm) });
        } else {
            setEditingUser({ ...editingUser, permissions: [...perms, perm] });
        }
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        await call(() => updateUser(editingUser.id, { role: editingUser.role, permissions: editingUser.permissions }), 'Utilisateur mis à jour');
        setEditingUser(null);
        await fetchUsers();
    };

    const handleCreateSubadmin = async () => {
        if (!newSubadmin.username || !newSubadmin.password) {
            notify('Nom d’utilisateur et mot de passe requis', 'error');
            return;
        }
        await call(() => updateUser('new', { username: newSubadmin.username, password: newSubadmin.password, role: 'subadmin', permissions: newSubadmin.permissions }), 'Sous-admin créé');
        setShowCreateSubadmin(false);
        setNewSubadmin({username: '', password: '', permissions: []});
        await fetchUsers();
    };

    const handleActivateProvider = async (userId: string) => {
        await call(() => activateProviderAccount(userId, activationDuration), 'Compte provider activé');
        setActivationUserId(null);
        await fetchUsers();
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div></div>;
    }

    return (
        <div className="p-8">
            <div className="flex gap-4 mb-6">
                <button onClick={() => navigate('/entities')} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 text-sm">Gestion des entités</button>
                <button onClick={() => navigate('/payment-details')} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 text-sm">Détails des paiements</button>
                <button onClick={() => navigate('/audit-log')} className="bg-slate-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-slate-700 text-sm">Historique des actions</button>
                {!subadminMode && <button onClick={() => setShowCreateSubadmin(true)} className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-purple-700 text-sm ml-auto">Créer un sous-admin</button>}
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-8">Administration des utilisateurs</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="p-4 text-sm font-semibold text-slate-600">Nom d'utilisateur</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Rôle</th>
                                {!subadminMode && <th className="p-4 text-sm font-semibold text-slate-600">Permissions</th>}
                                <th className="p-4 text-sm font-semibold text-slate-600">Statut</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Fin d'abonnement</th>
                                <th className="p-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b hover:bg-slate-50">
                                    <td className="p-4 font-medium">{user.username}</td>
                                    <td className="p-4 text-slate-600 capitalize">{user.role}</td>
                                    {!subadminMode && <td className="p-4 text-xs">
                                        {(user.permissions && user.permissions.length > 0)
                                            ? user.permissions.map(p => <span key={p} className="inline-block bg-slate-200 text-slate-700 rounded px-2 py-1 mr-1 mb-1">{p}</span>)
                                            : <span className="text-slate-400">-</span>}
                                    </td>}
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{user.is_active ? 'Actif' : 'Inactif'}</span>
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        <input type="date" value={user.subscriptionEndDate || ''} onChange={(e) => handleDateChange(user.id, e.target.value)} className="p-1 bg-white border border-slate-300 rounded-md shadow-sm w-40" />
                                    </td>
                                    <td className="p-4 text-center space-x-2">
                                        {user.role === 'provider' ? (
                                            activationUserId === user.id ? (
                                                <>
                                                    <select value={activationDuration} onChange={e => setActivationDuration(e.target.value)} className="text-xs p-1 border rounded mr-2">
                                                        <option value="1_MONTH">1 mois</option>
                                                        <option value="3_MONTHS">3 mois</option>
                                                        <option value="6_MONTHS">6 mois</option>
                                                        <option value="9_MONTHS">9 mois</option>
                                                        <option value="1_YEAR">1 an</option>
                                                    </select>
                                                    <button onClick={() => handleActivateProvider(user.id)} className="text-xs bg-green-600 text-white font-semibold py-1 px-3 rounded-full hover:bg-green-700">Valider</button>
                                                    <button onClick={() => setActivationUserId(null)} className="text-xs bg-slate-200 text-slate-800 font-semibold py-1 px-3 rounded-full hover:bg-slate-300 ml-2">Annuler</button>
                                                </>
                                            ) : (
                                                <button onClick={() => setActivationUserId(user.id)} className={`text-xs font-semibold py-1 px-3 rounded-full ${user.is_active ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}>{user.is_active ? 'Désactiver' : 'Activer'}</button>
                                            )
                                        ) : (
                                            <button onClick={() => handleToggleActive(user)} className={`text-xs font-semibold py-1 px-3 rounded-full ${user.is_active ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}>{user.is_active ? 'Désactiver' : 'Activer'}</button>
                                        )}
                                        <button onClick={() => handleSaveDate(user)} className="text-xs bg-blue-100 text-blue-800 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">Sauvegarder</button>
                                        {!subadminMode && <button onClick={() => handleEditUser(user)} className="text-xs bg-slate-100 text-slate-800 font-semibold py-1 px-3 rounded-full hover:bg-slate-200">Éditer</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modal édition utilisateur */}
            {editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded shadow-lg w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4">Éditer l'utilisateur {editingUser.username}</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Rôle</label>
                            <select value={editingUser.role} onChange={e => handleEditChange('role', e.target.value)} className="p-2 border rounded w-full">
                                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Permissions personnalisées</label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_PERMISSIONS.map(perm => (
                                    <label key={perm} className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded cursor-pointer">
                                        <input type="checkbox" checked={editingUser.permissions?.includes(perm) || false} onChange={() => handlePermissionToggle(perm)} />
                                        {perm}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-4 justify-end mt-6">
                            <button onClick={() => setEditingUser(null)} className="px-4 py-2 bg-slate-200 rounded">Annuler</button>
                            <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal création sous-admin */}
            {showCreateSubadmin && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded shadow-lg w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4">Créer un sous-admin</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Nom d'utilisateur</label>
                            <input type="text" value={newSubadmin.username} onChange={e => setNewSubadmin(s => ({...s, username: e.target.value}))} className="p-2 border rounded w-full" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Mot de passe</label>
                            <input type="password" value={newSubadmin.password} onChange={e => setNewSubadmin(s => ({...s, password: e.target.value}))} className="p-2 border rounded w-full" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Permissions personnalisées</label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_PERMISSIONS.map(perm => (
                                    <label key={perm} className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded cursor-pointer">
                                        <input type="checkbox" checked={newSubadmin.permissions.includes(perm)} onChange={() => setNewSubadmin(s => s.permissions.includes(perm) ? {...s, permissions: s.permissions.filter(p => p !== perm)} : {...s, permissions: [...s.permissions, perm]})} />
                                        {perm}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-4 justify-end mt-6">
                            <button onClick={() => setShowCreateSubadmin(false)} className="px-4 py-2 bg-slate-200 rounded">Annuler</button>
                            <button onClick={handleCreateSubadmin} className="px-4 py-2 bg-purple-600 text-white rounded">Créer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;