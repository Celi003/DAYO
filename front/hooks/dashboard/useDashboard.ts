import { useMemo } from "react";
import { Invoice } from "@/types";
import { useFilter } from "../useFilter";
import saveAs from "file-saver";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, getPreviousYearStats } from "@/utils/helpers";
import { useBillingData } from "../useApi";

export function useDashboard(
  selectedYear: number,
  filterPartner: string | null,
  filterStatus: string,
  filterMonth: number | null,
  userRole: string
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
      predicate: (inv: Invoice, partnerVal: string) => {
        if (!partnerVal) return true;
        if (userRole === 'admin' || userRole === 'sub_admin') {
          const id = Number(partnerVal);
          return inv.provider.id === id;
        }
        if (partnerVal.startsWith('broker:')) {
          const id = Number(partnerVal.split(':')[1]);
          return inv.Broker?.id === id;
        }
        if (partnerVal.startsWith('company:')) {
          const id = Number(partnerVal.split(':')[1]);
          return inv.Company?.id === id;
        }
        return true;
      },
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
    const map = new Map<string, string>();
    if (userRole === 'admin' || userRole === 'sub_admin') {
      partners.forEach((p) => map.set(String(p.id), p.name));
    } else {
      // Build from invoices: include both Brokers and Companies
      invoices.forEach((inv) => {
        if (inv.Broker?.id && inv.Broker.name) {
          map.set(`broker:${inv.Broker.id}`, inv.Broker.name);
        }
        if (inv.Company?.id && inv.Company.name) {
          map.set(`company:${inv.Company.id}`, inv.Company.name);
        }
      });
    }
    return map;
  }, [partners, invoices, userRole]);

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

  const exportDashboardData = (format: "csv" | "excel" | "pdf") => {
    const headers = [
      (userRole === 'admin' || userRole === 'sub_admin') ? "Prestataire" : "Entité (Courtier/Compagnie)",
      "Mois",
      "Date dépôt",
      "Montant",
      "Payé",
      "Rejeté",
      "Reste à régler",
      "Statut",
    ];
    const rows = filteredInvoicesForYear.map((inv) => {
      let partner: string | number = '';
      if (userRole === 'admin' || userRole === 'sub_admin') {
        partner = partnerMap.get(String(inv.provider.id)) || inv.provider.id;
      } else {
        partner = inv.Broker?.name || inv.Company?.name || '';
      }
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
    } else if (format === "excel") {
      content = [headers, ...rows].map((row) => row.join("\t")).join("\n");
      const blob = new Blob([content], { type: "application/vnd.ms-excel" });
      saveAs(blob, "dashboard.xls");
    } else if (format === "pdf") {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text(`Export Dashboard - ${selectedYear}`, 14, 16);
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 22,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      doc.save(`dashboard_${selectedYear}.pdf`);
    }
  };

  const partnerRevenueData = useMemo(() => {
    const data: { [key: string]: number } = {};
    if (filteredInvoices.length === 0) return [];

    if (userRole === 'admin' || userRole === 'sub_admin') {
      filteredInvoices.forEach((inv) => {
        const partnerName = partners.find((p) => p.id === inv.provider.id)?.name || String(inv.provider.id);
        data[partnerName] = (data[partnerName] || 0) + (Number(inv.billed_amount) || 0);
      });
    } else {
      filteredInvoices.forEach((inv) => {
        if (inv.Broker?.name) {
          data[inv.Broker.name] = (data[inv.Broker.name] || 0) + (Number(inv.billed_amount) || 0);
        }
        if (inv.Company?.name) {
          data[inv.Company.name] = (data[inv.Company.name] || 0) + (Number(inv.billed_amount) || 0);
        }
      });
    }

    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0);
  }, [filteredInvoices, partners, userRole]);

  const partnerPaymentStatusData = useMemo(() => {
    const partnerData: Record<string, { name: string; total: number; paid: number; rejected: number; outstanding: number; }> = {};
    if (filteredInvoices.length === 0) return [];

    if (userRole === 'admin' || userRole === 'sub_admin') {
      filteredInvoices.forEach((invoice) => {
        const name = partners.find((p) => p.id === invoice.provider.id)?.name || "Inconnu";
        const billedAmount = Number(invoice.billed_amount) || 0;
        const paid = Number(invoice.payments?.reduce((sum, p) => sum + p.amount, 0)) || 0;
        const rejected = Number(invoice.rejections?.reduce((sum, r) => sum + r.rejected_amount, 0)) || 0;
        if (!partnerData[name]) partnerData[name] = { name, total: 0, paid: 0, rejected: 0, outstanding: 0 };
        partnerData[name].total += billedAmount;
        partnerData[name].paid += paid;
        partnerData[name].rejected += rejected;
        partnerData[name].outstanding += billedAmount - paid - rejected;
      });
    } else {
      filteredInvoices.forEach((invoice) => {
        const billedAmount = Number(invoice.billed_amount) || 0;
        const paid = Number(invoice.payments?.reduce((sum, p) => sum + p.amount, 0)) || 0;
        const rejected = Number(invoice.rejections?.reduce((sum, r) => sum + r.rejected_amount, 0)) || 0;
        const entries: string[] = [];
        if (invoice.Broker?.name) entries.push(invoice.Broker.name);
        if (invoice.Company?.name) entries.push(invoice.Company.name);
        entries.forEach((name) => {
          if (!partnerData[name]) partnerData[name] = { name, total: 0, paid: 0, rejected: 0, outstanding: 0 };
          partnerData[name].total += billedAmount;
          partnerData[name].paid += paid;
          partnerData[name].rejected += rejected;
          partnerData[name].outstanding += billedAmount - paid - rejected;
        });
      });
    }

    return Object.values(partnerData)
      .filter((p) => p.total > 0)
      .map((p) => ({
        ...p,
        paidPercent: (p.paid / p.total) * 100,
        rejectedPercent: (p.rejected / p.total) * 100,
        outstandingPercent: (p.outstanding / p.total) * 100,
      }));
  }, [filteredInvoices, partners, userRole]);

  // Build selectable partners for the filter dropdown
  const filterPartners = useMemo(() => {
    if (userRole === 'admin') {
      return partners.map((p) => ({ id: String(p.id), name: p.name }));
    }
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    invoices.forEach((inv) => {
      if (inv.Broker?.id && inv.Broker.name) {
        const key = `broker:${inv.Broker.id}`;
        if (!seen.has(key)) { seen.add(key); list.push({ id: key, name: inv.Broker.name }); }
      }
      if (inv.Company?.id && inv.Company.name) {
        const key = `company:${inv.Company.id}`;
        if (!seen.has(key)) { seen.add(key); list.push({ id: key, name: inv.Company.name }); }
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [partners, invoices, userRole]);

  return {
    invoices,
    partners: filterPartners,
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
