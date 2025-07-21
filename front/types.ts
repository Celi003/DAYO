
export interface User {
  id: string;
  username: string;
  password?: string; // Password should not be sent to the client, but is needed for mock login
  role: 'admin' | 'provider' | 'subadmin' | 'broker' | 'company';
  isActive: boolean;
  subscriptionEndDate: string | null; // YYYY-MM-DD
  permissions?: string[]; // ex: ['can_edit_invoice', 'can_view_payments']
}

export interface Company {
  id: string;
  name: string;
  address: string;
}

export interface Broker {
  id: string;
  name: string;
  companyId?: string;
}

export interface Invoice {
  id: string;
  providerId: string; // The ID of the provider this invoice belongs to
  companyId: string;
  brokerId: string | null;
  depositDate?: string;
  invoiceMonth: string; // e.g., "Janvier 2025"
  totalAmount: number;
  payments: Payment[];
  rejections: Rejection[];
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
}

export interface Rejection {
  id: string;
  amount: number;
  reason: string;
  date: string;
}

export interface Notification {
  id: number;
  username: string;
  notif_type: 'REMINDER' | 'PAYMENT_ALERT' | 'INFO' | 'WARNING' | 'CUSTOM';
  message: string;
  is_read: boolean;
  created_at: string;
  invoice?: number | null;
  payment?: number | null;
}

export type Page = 'dashboard' | 'registrations' | 'payments' | 'partners' | 'admin' | 'notifications';
