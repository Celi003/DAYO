import { useMemo } from "react";
import { Invoice } from "@/types";
import { useFilter } from "../useFilter";
import saveAs from "file-saver";
import { formatDate, getPreviousYearStats } from "@/utils/helpers";
import { useBillingData } from "../useApi";

export function useDashboard(
  selectedYear: number,
  filterPartner: string | null,
  filterStatus: string,
  filterMonth: number | null
) {
  const { invoices, partners, stats, loading } = useBillingData(
    selectedYear
  );

  const filters = {
    year: {
      value: selectedYear,
      predicate: (inv: Invoice, year: number) =>
        new Date(inv.deposit_date).getFullYear() === year,
    },
    partner: {
      value: filterPartner,
      predicate: (inv: Invoice, partnerId: number) =>
        partnerId ? inv.provider.id === partnerId : true,
    },
    status: {
      value: filterStatus,
      predicate: (inv: Invoice, status: string) => {
        const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
        const rejected =
          inv.rejections?.reduce((s, r) => s + r.rejected_amount, 0) || 0;
        const remaining = inv.billed_amount - paid - rejected;
        if (status === "payé") return remaining <= 0;
        if (status === "enAttente") return remaining > 0;
        if (status === "rejeté") return rejected > 0;
        return true;
      },
    },
    month: {
      value: filterMonth,
      predicate: (inv: Invoice, month: number) =>
        month === null ? true : new Date(inv.deposit_date).getMonth() === month,
    },
  };

  const filteredInvoices = useFilter<Invoice>(invoices, filters);

  const availableYears = useMemo(() => {
    if (!invoices.length) return [new Date().getFullYear()];
    const years = new Set(
      invoices.map((invoice) => new Date(invoice.deposit_date).getFullYear())
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  const partnerMap = useMemo(() => {
    const map = new Map<number, string>();
    partners.forEach((partner) => {
      map.set(partner.id, partner.name);
    });
    return map;
  }, [partners]);

  const prevStats = useMemo(
    () => getPreviousYearStats(invoices, selectedYear),
    [invoices, selectedYear]
  );

  const filteredInvoicesForYear = useMemo(() => {
    return filteredInvoices.sort(
      (a, b) =>
        new Date(b.deposit_date).getTime() - new Date(a.deposit_date).getTime()
    );
  }, [filteredInvoices]);

  const exportDashboardData = (format: "csv" | "excel") => {
    const headers = [
      "Partenaire",
      "Mois",
      "Date dépôt",
      "Montant",
      "Payé",
      "Rejeté",
      "Reste à régler",
      "Statut",
    ];
    const rows = filteredInvoicesForYear.map((inv) => {
      const partner = partnerMap.get(inv.provider.id) || inv.provider.id;
      const paid = inv.payments!.reduce((sum, p) => sum + p.amount, 0);
      const rejected = inv.rejections!.reduce(
        (sum, r) => sum + r.rejected_amount,
        0
      );
      const outstanding = inv.billed_amount - paid - rejected;
      let statut = "En attente";
      if (outstanding <= 0) statut = "Payée";
      if (inv.rejections!.length > 0) statut = "Rejetée";
      return [
        partner,
        inv.invoice_month,
        formatDate(inv.deposit_date),
        inv.billed_amount,
        paid,
        rejected,
        outstanding,
        statut,
      ];
    });

    let content = "";
    if (format === "csv") {
      content = [headers, ...rows]
        .map((row) => row.map((v) => `"${v}"`).join(","))
        .join("\n");
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, "dashboard.csv");
    } else {
      content = [headers, ...rows].map((row) => row.join("\t")).join("\n");
      const blob = new Blob([content], { type: "application/vnd.ms-excel" });
      saveAs(blob, "dashboard.xls");
    }
  };

  const partnerRevenueData = useMemo(() => {
    const data: { [key: string]: number } = {};
    filteredInvoices.forEach((inv) => {
      const partner = partners.find((p) => p.id === inv.provider.id);
      if (partner) {
        data[partner.name] = (data[partner.name] || 0) + inv.billed_amount;
      }
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0);
  }, [filteredInvoices, partners]);

  const partnerPaymentStatusData = useMemo(() => {
    const partnerData: Record<string, any> = {};

    filteredInvoices.forEach((invoice) => {
      const partnerName =
        partners.find((p) => p.id === invoice.broker?.id)?.name || "Inconnu";
      if (!partnerData[partnerName]) {
        partnerData[partnerName] = {
          name: partnerName,
          total: 0,
          paid: 0,
          rejected: 0,
          outstanding: 0,
        };
      }
      const paid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const rejected =
        invoice.rejections?.reduce((sum, r) => sum + r.rejected_amount, 0) || 0;

      partnerData[partnerName].total += invoice.billed_amount;
      partnerData[partnerName].paid += paid;
      partnerData[partnerName].rejected += rejected;
      partnerData[partnerName].outstanding +=
        invoice.billed_amount - paid - rejected;
    });

    return Object.values(partnerData)
      .filter((p) => p.total > 0)
      .map((p) => ({
        ...p,
        paidPercent: (p.paid / p.total) * 100,
        rejectedPercent: (p.rejected / p.total) * 100,
        outstandingPercent: (p.outstanding / p.total) * 100,
      }));
  }, [filteredInvoices, partners]);

  return {
    invoices,
    partners,
    loading,
    stats,
    availableYears,
    partnerMap,
    filteredInvoices,
    filteredInvoicesForYear,
    exportDashboardData,
    partnerPaymentStatusData,
    partnerRevenueData,
    prevStats,
  };
}
