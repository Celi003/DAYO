
export interface User {
  id: number;
  username: string;
  email?: string;
  role: "admin" | "provider" | "subadmin" | "broker" | "company";
  isActive: boolean;
  permissions?: string[];
  subscriptionEndDate?: string;
  subscription_status?: "active" | "inactive" | "expired";
  subscription_expiry?: string;
}


export interface Partner {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  type: "provider" | "broker" | "company";
  company_id?: number; // For brokers
}

export interface Company {
  id: number;
  name: string;
  broker?: Broker | null;
  contact_email: string;
}

export interface Broker {
  id: number;
  name: string;
  companyId?: number;
}

export interface Invoice {
  id: number;
  deposit_date: string;
  invoice_number: string;
  paid_amount: string;
  status: "PAID" | "UNPAID" | "PARTIALLY_PAID" | "REJECTED";
  remaining_amount: string;
  rejected_amount: string;
  invoice_month: string; 
  billed_amount: number;
  provider: Provider;
  company?: Company | null;
  broker?: Broker | null;
  payments?: Payment[];
  rejections?: Rejection[];
}

export interface Provider extends Pick<User, "subscription_expiry" | "subscription_status"> {
  id: number;
  user: User;
  user_id: number;
  name: string;
}

export interface Payment {
  id: number;
  amount: number;
  payment_date: string;
  invoice: number;
  payment_method?: string;
}

export interface Rejection {
  id: number;
  rejected_amount: number;
  amount: number; // Mapped from rejected_amount in API
  rejection_reason: string;
  rejection_date: string;
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

export type TransactionType = "Paiement" | "Rejet";
export interface Transaction {
  id: string;
  date: string;
  partnerId?: number;
  partnerName: string;
  invoiceMonth: string;
  status: string;
  type: TransactionType;
  amount: number;
  reason?: string;
  providerName?: string;
  companyName?: string;
  brokerName?: string;
}
export type Page = 'dashboard' | 'registrations' | 'payments' | 'partners' | 'admin' | 'notifications';
