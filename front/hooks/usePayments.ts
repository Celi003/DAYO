import { useMemo, useState } from "react";
import { useBillingData } from "./useApi";
import { Broker, Company, Invoice, Transaction, TransactionType } from "@/types";
import { useFilter } from "./useFilter";

type PaymentTransaction = {
  month: string;
  totalPaid: number;
  totalRejected: number;
  invoices: Invoice[];
};

export type FilterConfig = {
  partner: string;
  type: TransactionType;
  status: string;
  dateMin: string;
  dateMax: string;
  amountMin: number;
  amountMax: number;
  search: string;
};
export function usePayments(selectedYear: number, filters: FilterConfig) {
  const [sort, setSort] = useState<{ col: string; asc: boolean }>({
    col: "date",
    asc: false,
  });
  const { invoices, companies, brokers, loading, companyMap, brokerMap } =
    useBillingData(selectedYear);

  const config = {
    partner: {
      value: filters.partner,
      predicate: (t: Transaction, v: string) => !v || t.partnerName === v,
    },
    type: {
      value: filters.type,
      predicate: (t: Transaction, v: string) => !v || t.type === v,
    },
    status: {
      value: filters.status,
      predicate: (t: Transaction, v: string) => !v || t.status === v,
    },
    dateMin: {
      value: filters.dateMin,
      predicate: (t: Transaction, v: string) => !v || t.date >= v,
    },
    dateMax: {
      value: filters.dateMax,
      predicate: (t: Transaction, v: string) => !v || t.date <= v,
    },
    amountMin: {
      value: filters.amountMin,
      predicate: (t: Transaction, v: string) =>
        Number(v) === 0 || t.amount >= Number(v),
    },
    amountMax: {
      value: filters.amountMax,
      predicate: (t: Transaction, v: string) =>
        Number(v) === 0 || t.amount <= Number(v),
    },
    search: {
      value: filters.search,
      predicate: (t: Transaction, v: string) => {
        if (!v) return true;
        const s = v.toLowerCase();
        return (
          t.partnerName.toLowerCase().includes(s) ||
          t.invoiceMonth.toLowerCase().includes(s) ||
          t.type.toLowerCase().includes(s) ||
          (t.reason && t.reason.toLowerCase().includes(s)) ||
          (t.providerName && t.providerName.toLowerCase().includes(s)) ||
          t.amount.toString().includes(s)
        );
      },
    },
  };

  const transactions = useMemo((): Transaction[] => {
    const allTransactions: Transaction[] = [];

    invoices.forEach((invoice: Invoice) => {
      // Ne traiter que les factures qui ont des paiements ou des rejets
      const hasPayments = invoice.payments && invoice.payments.length > 0;
      const hasRejections = invoice.rejections && invoice.rejections.length > 0;
      
      if (!hasPayments && !hasRejections) {
        return; // Ignorer les factures sans paiements ni rejets
      }

      const isCompany = !!invoice.company?.id;
      const partnerId: number | undefined = isCompany
        ? invoice.company?.id
        : invoice.broker?.id;
      
      // Récupérer les noms de compagnie et courtier
      const companyName = invoice.company?.id 
        ? (companyMap.get(invoice.company.id) as Company)?.name 
        : undefined;
      const brokerName = invoice.broker?.id 
        ? (brokerMap.get(invoice.broker.id) as Broker)?.name 
        : undefined;
      
      // Déterminer le nom du partenaire principal
      let partnerName = "Inconnu";
      if (isCompany && companyName) {
        partnerName = companyName;
      } else if (!isCompany && brokerName) {
        partnerName = brokerName;
      }

      // Ajouter les paiements
      if (hasPayments && invoice.payments) {
        invoice.payments.forEach((payment) => {
        allTransactions.push({
          id: `payment-${invoice.id}-${payment.id}`,
          date: payment.payment_date,
          partnerName,
          partnerId,
          status: "Payée",
          invoiceMonth: invoice.invoice_month,
          type: "Paiement",
          amount: payment.amount,
          providerName: invoice.provider.name,
            companyName,
            brokerName,
      });
        });
      }

      // Ajouter les rejets
      if (hasRejections && invoice.rejections) {
        invoice.rejections.forEach((rejection) => {
        allTransactions.push({
          id: `rejection-${invoice.id}-${rejection.id}`,
          date: rejection.rejection_date,
          partnerName,
          partnerId,
          status: "Rejetée",
          invoiceMonth: invoice.invoice_month,
          type: "Rejet",
          amount: rejection.rejected_amount,
          reason: rejection.rejection_reason,
          providerName: invoice.provider.name,
            companyName,
            brokerName,
          });
        });
      }
    });

    return allTransactions;
  }, [invoices, companyMap, brokerMap]);

  const monthlyTransactions: PaymentTransaction[] = useMemo(() => {
    const byMonth: { [key: string]: PaymentTransaction } = {};

    invoices.forEach((inv) => {
      const date = new Date(inv.deposit_date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;

      const paid = inv.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const rejected =
        inv.rejections?.reduce((sum, r) => sum + r.rejected_amount, 0) || 0;

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          month: monthKey,
          totalPaid: 0,
          totalRejected: 0,
          invoices: [],
        };
      }

      byMonth[monthKey].totalPaid += paid;
      byMonth[monthKey].totalRejected += rejected;
      byMonth[monthKey].invoices.push(inv);
    });

    return Object.values(byMonth).sort((a, b) =>
      b.month.localeCompare(a.month)
    );
  }, [invoices]);

  const filteredTransactions = useFilter<Transaction>(transactions, config);
  const sortedTransactions = useMemo(() => {
    if (!sort.col) return filteredTransactions;

    return [...filteredTransactions].sort((a: Transaction, b: Transaction) => {
      let comparison = 0;

      switch (sort.col) {
        case "amount":
          comparison = a.amount - b.amount;
          break;
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        default:
          // Pour les autres colonnes (string)
          const aVal = (a as any)[sort.col] || "";
          const bVal = (b as any)[sort.col] || "";
          comparison = aVal
            .toString()
            .localeCompare(bVal.toString(), undefined, { numeric: true });
      }

      return comparison * (sort.asc ? 1 : -1);
    });
  }, [filteredTransactions, sort]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    sortedTransactions.forEach((t) => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(t);
    });
    const sortedMonthKeys = Object.keys(groups).sort().reverse();
    return { groups, sortedMonthKeys };
  }, [sortedTransactions]);

  const handleSort = (col: string) => {
    setSort((s) => (s.col === col ? { col, asc: !s.asc } : { col, asc: true }));
  };

  return {
    loading,
    sortedTransactions,
    filteredTransactions,
    groupedTransactions,
    transactions,
    monthlyTransactions,
    config,
    companyMap,
    companies,
    sort,
    handleSort,
    brokers,
  };
}
