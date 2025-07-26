
export interface User {
  id: string;
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
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  type: "provider" | "broker" | "company";
  company_id?: string; // For brokers
}

export interface Company {
  id: string;
  name: string;
  broker?: Broker;
  contact_email: string;
}

export interface Broker {
  id: string;
  name: string;
  companyId?: string;
}

export interface Invoice {
  id: string;
  deposit_date: string;
  invoice_number: string;
  paid_amount: string;
  status: "PAID" | "UNPAID" | "PARTIALLY_PAID" | "REJECTED";
  remaining_amount: string;
  rejected_amount: string;
  invoice_month: string; 
  billed_amount: number;
  provider: Provider;
  company: Company;
  broker?: Broker | null;
  payments?: Payment[];
  rejections?: Rejection[];
}

export interface Provider extends Pick<User, "subscription_expiry" | "subscription_status"> {
  id: string;
  user: User;
  name: string;
}

export interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  invoice: number;
  payment_method?: string;
}

export interface Rejection {
  id: string;
  rejected_amount: number;
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
  partnerId?: string;
  partnerName: string;
  invoiceMonth: string;
  status: string;
  type: TransactionType;
  amount: number;
  reason?: string;
  providerName?: string;
}
export type Page = 'dashboard' | 'registrations' | 'payments' | 'partners' | 'admin' | 'notifications';
