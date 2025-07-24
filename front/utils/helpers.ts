import { Invoice } from "../types";

const formatCurrency = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getPreviousYearStats = (invoices: Invoice[], year: number) => {
  const prev = invoices.filter(
    (inv) => new Date(inv.deposit_date).getFullYear() === year - 1
  );
  const totalInvoiced = prev.reduce(
    (a: number, inv: Invoice) => a + inv.billed_amount,
    0
  );
  const totalPaid = prev.reduce(
    (a: number, inv: Invoice) =>
      a + (inv.payments?.reduce((s: number, p) => s + p.amount, 0) || 0),
    0
  );
  const totalRejected = prev.reduce(
    (a: number, inv: Invoice) =>
      a +
      (inv.rejections?.reduce((s: number, r) => s + r.rejected_amount, 0) || 0),
    0
  );
  const outstanding = totalInvoiced - totalPaid - totalRejected;
  return { totalInvoiced, totalPaid, totalRejected, outstanding };
};

const getAvailableYears = (invoices: Invoice[]) => {
  if (invoices.length === 0) return [new Date().getFullYear()];
  const years = new Set(
    invoices.map((inv) => new Date(inv.deposit_date).getFullYear())
  );
  return Array.from(years).sort((a: number, b: number) => b - a);
};

const getInvoiceStatus = (
  invoice: Invoice
): { text: string; color: string } => {
  const totalPaid = (invoice.payments || []).reduce(
    (sum, p) => sum + p.amount,
    0
  );
  const totalRejected = (invoice.rejections || []).reduce(
    (sum, r) => sum + r.rejected_amount,
    0
  );
  const outstanding = invoice.billed_amount - totalPaid - totalRejected;

  if (outstanding <= 0 && invoice.billed_amount > 0) {
    if (totalPaid >= invoice.billed_amount)
      return { text: "Payé", color: "green" };
    return { text: "Rejeté", color: "red" };
  }
  if (totalPaid > 0 || totalRejected > 0) {
    return { text: "Partiel", color: "orange" };
  }
  return { text: "En attente", color: "blue" };
};

const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID": return "bg-green-100 text-green-800";
      case "UNPAID": return "bg-yellow-100 text-yellow-800";
      case "REJECTED": return "bg-red-100 text-red-800";
      case "PARTIAL": return "bg-orange-100 text-orange-800";
      case "PARTIALLY_PAID": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

const getStatusText = (status: string) => {
  switch (status) {
    case "PAID": return "Payé";
    case "UNPAID": return "En attente";
    case "REJECTED": return "Rejeté";
    case "PARTIALLY_PAID": return "Partiellement payé";
    case "PARTIAL": return "Partiel";
    default: return status;
  }
}
export { formatCurrency, formatDate, getPreviousYearStats, getAvailableYears, getInvoiceStatus, getStatusColor, getStatusText };