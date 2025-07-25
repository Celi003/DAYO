
import { Invoice, Payment, Rejection, User } from '../types';

const API_BASE = 'http://localhost:8000'; // À adapter selon le déploiement

let authToken: string | null = null;
// Toujours charger le token depuis sessionStorage au démarrage
if (!authToken && typeof window !== 'undefined') {
  authToken = sessionStorage.getItem('authToken');
}

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    sessionStorage.setItem('authToken', token);
  } else {
    sessionStorage.removeItem('authToken');
  }
};

const getHeaders = (isJson = true) => {
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  if (authToken || sessionStorage.getItem('authToken')) {
    headers['Authorization'] = `Token ${authToken || sessionStorage.getItem('authToken')}`;
  }
  // Log temporaire pour debug
  if (headers['Authorization']) {
    console.log('Authorization header:', headers['Authorization']);
  }
  return headers;
};

// AUTHENTICATION
export const login = async (username: string, password: string) => {
  const res = await fetch(`${API_BASE}/login/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Erreur de connexion');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return {
    ...data,
    role: data.role ? data.role.toLowerCase() : undefined
  };
};

export const registerUser = async (username: string, password: string, _name?: string, email?: string) => {
  const res = await fetch(`${API_BASE}/register/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, password, email })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Erreur d\'inscription');
  }
  return await res.json();
};

export const logout = () => {
  setAuthToken(null);
};

export const getCurrentUser = async () => {
  if (!authToken && !sessionStorage.getItem('authToken')) return null;
  const res = await fetch(`${API_BASE}/users/`, { headers: getHeaders() });
  if (!res.ok) return null;
  if (!isJsonResponse(res)) return null;
  const users = await res.json();
  if (!users[0]) return null;
  return {
    ...users[0],
    role: users[0].role ? users[0].role.toLowerCase() : undefined,
    is_active: users[0].is_active // Fix: keep the original property name
  };
};

// USERS (ADMIN)
export const getUsers = async () => {
  const res = await fetch(`${API_BASE}/users/`, { headers: getHeaders() });
  if (!res.ok) {
    if (isJsonResponse(res)) {
      const data = await res.json();
      throw new Error(data.error || 'Erreur lors de la récupération des utilisateurs');
    } else {
      throw new Error('Erreur réseau ou accès refusé (utilisateurs)');
    }
  }
  if (!isJsonResponse(res)) throw new Error('Réponse inattendue du serveur (utilisateurs)');
  const users = await res.json();
  return users.map((u: any) => ({
    ...u,
    role: u.role ? u.role.toLowerCase() : undefined,
    is_active: u.is_active // Fix: keep the original property name
  }));
};

export const updateUser = async (userId: string, data: any) => {
  const res = await fetch(`${API_BASE}/users/${userId}/`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Erreur lors de la mise à jour de l\'utilisateur');
  return await res.json();
};

// PARTNERS (Providers, Brokers, Companies)
export const getProviders = async () => {
  const res = await fetch(`${API_BASE}/providers/`, { headers: getHeaders() });
  if (!res.ok) {
    if (isJsonResponse(res)) {
      const data = await res.json();
      throw new Error(data.error || 'Erreur lors de la récupération des prestataires');
    } else {
      throw new Error('Erreur réseau ou accès refusé (prestataires)');
    }
  }
  if (!isJsonResponse(res)) throw new Error('Réponse inattendue du serveur (prestataires)');
  return await res.json();
};

export const getBrokers = async () => {
  const res = await fetch(`${API_BASE}/brokers/`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Erreur lors de la récupération des courtiers');
  return await res.json();
};

export const getCompanies = async () => {
  const res = await fetch(`${API_BASE}/companies/`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Erreur lors de la récupération des compagnies');
  return await res.json();
};

// INVOICES
export const getInvoices = async () => {
  const res = await fetch(`${API_BASE}/invoices/`, { headers: getHeaders() });
  if (!res.ok) {
    if (isJsonResponse(res)) {
      const data = await res.json();
      throw new Error(data.error || 'Erreur lors de la récupération des factures');
    } else {
      throw new Error('Erreur réseau ou accès refusé (factures)');
    }
  }
  if (!isJsonResponse(res)) throw new Error('Réponse inattendue du serveur (factures)');
  const data = await res.json();
  return data.map((inv: any) => ({
    ...inv,
    depositDate: inv.deposit_date,
    totalAmount: Number(inv.billed_amount),
    providerId: inv.provider?.id || inv.provider,
    companyId: inv.company?.id || inv.company,
    brokerId: inv.broker ? (inv.broker.id || inv.broker) : null,
    payments: (inv.payments || []).map((p: any) => ({
      ...p,
      date: p.payment_date,
      amount: Number(p.amount)
    })),
    rejections: (inv.rejections || []).map((r: any) => ({
      ...r,
      amount: Number(r.rejected_amount),
      reason: r.rejection_reason,
      date: r.rejection_date
    }))
  }));
};

export const addInvoice = async (invoiceData: any) => {
  const res = await fetch(`${API_BASE}/invoices/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(invoiceData)
  });
  if (!res.ok) throw new Error('Erreur lors de la création de la facture');
  const inv = await res.json();
  return {
    ...inv,
    depositDate: inv.deposit_date,
    totalAmount: inv.billed_amount,
    providerId: inv.provider,
    companyId: inv.company,
    brokerId: inv.broker,
    payments: (inv.payments || []).map((p: any) => ({
      ...p,
      date: p.payment_date,
      amount: p.amount
    })),
    rejections: (inv.rejections || []).map((r: any) => ({
      ...r,
      amount: r.rejected_amount,
      reason: r.rejection_reason,
      date: r.rejection_date
    }))
  };
};

// PAYMENTS
export const addPayment = async (invoiceId: string, paymentData: any) => {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/add_payment/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(paymentData)
  });
  if (!res.ok) throw new Error('Erreur lors de l\'ajout du paiement');
  const inv = await res.json();
  // Si le backend retourne un Invoice complet, on mappe comme dans getInvoices, sinon on retourne l'objet brut
  if (inv && inv.id && (inv.payments || inv.rejections)) {
    return {
      ...inv,
      depositDate: inv.deposit_date,
      totalAmount: Number(inv.billed_amount),
      providerId: inv.provider?.id || inv.provider,
      companyId: inv.company?.id || inv.company,
      brokerId: inv.broker ? (inv.broker.id || inv.broker) : null,
      payments: (inv.payments || []).map((p: any) => ({
        ...p,
        date: p.payment_date,
        amount: Number(p.amount)
      })),
      rejections: (inv.rejections || []).map((r: any) => ({
        ...r,
        amount: Number(r.rejected_amount),
        reason: r.rejection_reason,
        date: r.rejection_date
      }))
    };
  }
  return inv;
};

// REJECTIONS
export const addRejection = async (invoiceId: string, rejectionData: any) => {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/add_rejection/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(rejectionData)
  });
  if (!res.ok) throw new Error('Erreur lors de l\'ajout du rejet');
  const inv = await res.json();
  if (inv && inv.id && (inv.payments || inv.rejections)) {
    return {
      ...inv,
      depositDate: inv.deposit_date,
      totalAmount: Number(inv.billed_amount),
      providerId: inv.provider?.id || inv.provider,
      companyId: inv.company?.id || inv.company,
      brokerId: inv.broker ? (inv.broker.id || inv.broker) : null,
      payments: (inv.payments || []).map((p: any) => ({
        ...p,
        date: p.payment_date,
        amount: Number(p.amount)
      })),
      rejections: (inv.rejections || []).map((r: any) => ({
        ...r,
        amount: Number(r.rejected_amount),
        reason: r.rejection_reason,
        date: r.rejection_date
      }))
    };
  }
  return inv;
};

// STATISTICS
export const getInvoiceStatistics = async (params: Record<string, string | number> = {}) => {
  const query = new URLSearchParams(params as any).toString();
  const res = await fetch(`${API_BASE}/invoices/statistics/${query ? '?' + query : ''}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Erreur lors de la récupération des statistiques');
  return await res.json();
};

// EXPORT
export const exportInvoices = async (format: 'excel' | 'pdf', params: Record<string, string | number> = {}) => {
  const query = new URLSearchParams({ ...params, format }).toString();
  const res = await fetch(`${API_BASE}/invoices/export/?${query}`, { headers: getHeaders(false) });
  if (!res.ok) throw new Error('Erreur lors de l\'export');
  const blob = await res.blob();
  return blob;
};

// IMPORT
export const importInvoices = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/invoices/import_data/`, {
    method: 'POST',
    headers: getHeaders(false),
    body: formData
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Erreur lors de l\'import');
  }
  return await res.json();
};

// TEMPLATE IMPORT
export const downloadImportTemplate = async () => {
  const res = await fetch(`${API_BASE}/invoices/download_template/`, { headers: getHeaders(false) });
  if (!res.ok) throw new Error('Erreur lors du téléchargement du template');
  const blob = await res.blob();
  return blob;
};

// GENERATE RECLAMATION LETTER
export const generateReclamationLetter = async (invoiceId: string) => {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/generate_reclamation_letter/`, { headers: getHeaders() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Erreur lors de la génération de la lettre');
  }
  return await res.json();
};

// CRUD PROVIDERS
export const createProvider = async (data: any) => {
  const res = await fetch(`${API_BASE}/providers/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = Object.values(errorData).flat()[0] as string || 'Erreur lors de la création du prestataire';
    throw new Error(errorMessage);
  }
  return await res.json();
};
export const updateProvider = async (id: string, data: any) => {
  const res = await fetch(`${API_BASE}/providers/${id}/`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = Object.values(errorData).flat()[0] as string || 'Erreur lors de la mise à jour du prestataire';
    throw new Error(errorMessage);
  }
  return await res.json();
};
export const deleteProvider = async (id: string) => {
  const res = await fetch(`${API_BASE}/providers/${id}/`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error('Erreur lors de la suppression du prestataire');
  return true;
};
// CRUD BROKERS
export const createBroker = async (data: any) => {
  const res = await fetch(`${API_BASE}/brokers/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = Object.values(errorData).flat()[0] as string || 'Erreur lors de la création du courtier';
    throw new Error(errorMessage);
  }
  return await res.json();
};
export const updateBroker = async (id: string, data: any) => {
  const res = await fetch(`${API_BASE}/brokers/${id}/`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = Object.values(errorData).flat()[0] as string || 'Erreur lors de la mise à jour du courtier';
    throw new Error(errorMessage);
  }
  return await res.json();
};
export const deleteBroker = async (id: string) => {
  const res = await fetch(`${API_BASE}/brokers/${id}/`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error('Erreur lors de la suppression du courtier');
  return true;
};
// CRUD COMPANIES
export const createCompany = async (data: any) => {
  const res = await fetch(`${API_BASE}/companies/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = Object.values(errorData).flat()[0] as string || 'Erreur lors de la création de la compagnie';
    throw new Error(errorMessage);
  }
  return await res.json();
};
export const updateCompany = async (id: string, data: any) => {
  const res = await fetch(`${API_BASE}/companies/${id}/`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = Object.values(errorData).flat()[0] as string || 'Erreur lors de la mise à jour de la compagnie';
    throw new Error(errorMessage);
  }
  return await res.json();
};
export const deleteCompany = async (id: string) => {
  const res = await fetch(`${API_BASE}/companies/${id}/`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error('Erreur lors de la suppression de la compagnie');
  return true;
};
// PAYMENT DETAILS
export const getPaymentDetails = async (year: number, month: number) => {
  const res = await fetch(`${API_BASE}/invoices/payment_details/?year=${year}&month=${month}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Erreur lors de la récupération des détails de paiement');
  return await res.json();
};

// HOOK useApi pour factoriser les appels API et la gestion des erreurs
import { useNotification } from '../components/NotificationContext';

export function useApi() {
  const { notify } = useNotification();

  const call = async <T>(fn: () => Promise<T>, successMsg?: string): Promise<T | undefined> => {
    try {
      const result = await fn();
      if (successMsg) notify(successMsg, 'success');
      return result;
    } catch (e: any) {
      notify(e.message || 'Erreur inconnue', 'error');
      return undefined;
    }
  };

  return { call };
}

export const getAuditLog = async (params: Record<string, string> = {}) => {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/auditlog/${query ? '?' + query : ''}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Erreur lors de la récupération de l\'audit log');
  return await res.json();
};

export const getNotifications = async () => {
  const res = await fetch(`${API_BASE}/notifications/`, { headers: getHeaders() });
  if (!res.ok) {
    if (isJsonResponse(res)) {
      const data = await res.json();
      throw new Error(data.error || 'Erreur lors du chargement des notifications');
    } else {
      throw new Error('Erreur réseau ou accès refusé (notifications)');
    }
  }
  if (!isJsonResponse(res)) throw new Error('Réponse inattendue du serveur (notifications)');
  return await res.json();
};

export async function patchNotification(id: number, is_read: boolean) {
  const res = await fetch(`${API_BASE}/notifications/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read }),
  });
  if (!res.ok) throw new Error('Erreur lors de la mise à jour');
  return res.json();
}

export const activateProviderAccount = async (userId: string, duration: string) => {
  const res = await fetch(`${API_BASE}/users/${userId}/activate_account/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ duration })
  });
  if (!res.ok) {
    let errorMsg = 'Erreur lors de l’activation du compte';
    if (res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
    }
    throw new Error(errorMsg);
  }
  return await res.json();
};

const isJsonResponse = (res: Response) => {
  const contentType = res.headers.get('content-type');
  return contentType && contentType.indexOf('application/json') !== -1;
};
