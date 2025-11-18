import { useState } from "react";
import { useBillingData } from "./useApi";
import { Invoice } from "../types";
import {
  downloadImportTemplate,
  getInvoices,
  importInvoices,
  useApi,
} from "../services/api";
import saveAs from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type RegistrationFilters = {
  search: string;
  Broker: string;
  status: string;
  dateMin: string;
  dateMax: string;
  amountMin: string;
  amountMax: string;
};
export default function useRegistrations(selectedYear: number) {
  const {
    invoices,
    setInvoices,
    companies,
    Companys,
    loading,
    BrokerMap,
    CompanyMap,
    partners,
  } = useBillingData(selectedYear);
  const { call } = useApi();
  const [serverPdfLoading, setServerPdfLoading] = useState(false);

  const [invoiceForReminder, setInvoiceForReminder] = useState<Invoice | null>(
    null
  );
  const [invoiceForDetails, setInvoiceForDetails] = useState<Invoice | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<RegistrationFilters>({
    search: "",
    Broker: "",
    status: "",
    dateMin: "",
    dateMax: "",
    amountMin: "",
    amountMax: "",
  });

  const handleAddInvoice = (newInvoice: Invoice) => {
    setInvoices((prev: Invoice[]) =>
      [newInvoice, ...prev].sort(
        (a: Invoice, b: Invoice) =>
          new Date(b.deposit_date ? b.deposit_date : "").getTime() -
          new Date(a.deposit_date ? a.deposit_date : "").getTime()
      )
    );
  };
  const handleUpdateInvoice = async (updatedInvoice: Invoice) => {
    // Si la facture reçue n'a pas de payments/rejections, on refetch la liste complète
    if (!updatedInvoice.payments || !updatedInvoice.rejections) {
      const refreshed = await getInvoices();
      setInvoices(
        refreshed.sort(
          (a: Invoice, b: Invoice) =>
            new Date(b.deposit_date ? b.deposit_date : "").getTime() -
            new Date(a.deposit_date ? a.deposit_date : "").getTime()
        )
      );
      // Met aussi à jour le détail si modal ouvert
      if (invoiceForDetails) {
        const found = refreshed.find(
          (inv: Invoice) => inv.id === invoiceForDetails.id
        );
        if (found) setInvoiceForDetails(found);
      }
    } else {
      setInvoices((prev: Invoice[]) =>
        prev.map((inv: Invoice) =>
          inv.id === updatedInvoice.id ? updatedInvoice : inv
        )
      );
      if (invoiceForDetails?.id === updatedInvoice.id) {
        setInvoiceForDetails(updatedInvoice);
      }
    }
  };

  const handleExport = async (format: "excel" | "pdf") => {
    try {
      setServerPdfLoading(true);
      const headers = [
        "Numéro",
        "Prestataire",
        "Courtier",
        "Compagnie",
        "Date Dépôt",
        "Mois",
        "Montant",
        "Payé",
        "Rejeté",
        "Reste",
        "Statut",
      ];

      const invoicesToExport = invoices.filter((inv: Invoice) => {
        const entityMatch =
          !filters.Broker ||
          inv.Broker?.name === filters.Broker ||
          inv.Company?.name === filters.Broker;
        const totalPaid = (inv.payments || []).reduce(
          (sum, p: any) => sum + Number(p.amount || 0),
          0
        );
        const totalRejected = (inv.rejections || []).reduce(
          (sum, r: any) => sum + Number(r.rejected_amount ?? r.amount ?? 0),
          0
        );
        const outstanding = Number(inv.billed_amount || 0) - totalPaid - totalRejected;
        const statusText = outstanding <= 0 ? "Payé" : totalRejected > 0 ? "Rejeté" : totalPaid > 0 ? "Partiel" : "En attente";
        const statusMatch = !filters.status || statusText === filters.status;
        const date = inv.deposit_date || "";
        const dateMinMatch = !filters.dateMin || date >= filters.dateMin;
        const dateMaxMatch = !filters.dateMax || date <= filters.dateMax;
        const amountMinMatch = !filters.amountMin || Number(inv.billed_amount) >= Number(filters.amountMin);
        const amountMaxMatch = !filters.amountMax || Number(inv.billed_amount) <= Number(filters.amountMax);
        const searchMatch =
          !search ||
          Object.values(inv).some((v) =>
            v?.toString().toLowerCase().includes(search.toLowerCase())
          );
        return (
          entityMatch &&
          statusMatch &&
          dateMinMatch &&
          dateMaxMatch &&
          amountMinMatch &&
          amountMaxMatch &&
          searchMatch
        );
      });

      const rows = invoicesToExport.map((inv) => {
        const paid = (inv.payments || []).reduce((s, p: any) => s + Number(p.amount || 0), 0);
        const rejected = (inv.rejections || []).reduce((s, r: any) => s + Number(r.rejected_amount ?? r.amount ?? 0), 0);
        const remaining = Number(inv.billed_amount || 0) - paid - rejected;
        return [
          inv.invoice_number,
          inv.provider?.name || "N/A",
          inv.Broker?.name || "",
          inv.Company?.name || "",
          inv.deposit_date || "",
          inv.invoice_month || "",
          Number(inv.billed_amount) || 0,
          paid,
          rejected,
          remaining,
          inv.status,
        ];
      });

      // choose sheet based on whether a Broker filter is active
      const sheet = filters.Broker ? 'courtier' : 'compagnie';

      if (format === "excel") {
        // Build an actual Excel file (XLSX) client-side using SheetJS so layout matches templates
        try {
          // dynamic import; TS may not have types in this workspace
          // @ts-ignore
          const XLSX = (await import('xlsx')) as any;

          const buildSheetAOA = (list: any[], type: 'compagnie' | 'courtier') => {
            const aoa: any[][] = [];
            const title = type === 'compagnie' ? `État de facturation - Compagnies (${selectedYear})` : `État de facturation - Courtiers (${selectedYear})`;
            // Header metadata rows (match image)
            aoa.push([`Prestataire :`, invoicesToExport[0]?.provider?.name || '']);
            aoa.push([`Type d'état :`, type === 'compagnie' ? 'État de facturation par compagnie' : 'État de facturation par courtier']);
            aoa.push([type === 'compagnie' ? 'Compagnie :' : 'Courtier :', filters.Broker || 'Toutes']);
            aoa.push([`Période :`, `${filters.dateMin || ''} - ${filters.dateMax || ''}`]);
            aoa.push([`Édité le :`, new Date().toLocaleString()]);
            aoa.push([]);

            // Totals box
            const totalsForList: any = {
              billed: list.reduce((s: number, inv: any) => s + Number(inv.billed_amount || 0), 0),
              paid: list.reduce((s: number, inv: any) => s + (inv.payments || []).reduce((ss: number, p: any) => ss + Number(p.amount || 0), 0), 0),
              rejected: list.reduce((s: number, inv: any) => s + (inv.rejections || []).reduce((ss: number, r: any) => ss + Number(r.rejected_amount ?? r.amount ?? 0), 0), 0),
            };
            totalsForList['balance'] = totalsForList.billed - totalsForList.paid - totalsForList.rejected;
            aoa.push(['Indicateur', 'Montant']);
            aoa.push(['Montant total facturé', totalsForList.billed]);
            aoa.push(['Montant total payé', totalsForList.paid]);
            aoa.push(['Montant total rejeté', totalsForList.rejected]);
            aoa.push(['Solde à percevoir', totalsForList.balance]);
            aoa.push([]);

            // Table header
            const headersRow = type === 'compagnie' ? [
              'N° facture','Date dépôt','Mois facture','Compagnie','Montant facturé','Montant payé','Montant rejeté','Date(s) paiements','Solde à percevoir','Dernier statut','Motif rejet'
            ] : [
              'N° facture','Date dépôt','Mois facture','Courtier','Sous-compagnie','Montant facturé','Montant payé','Montant rejeté','Date(s) paiements','Solde à percevoir','Dernier statut','Motif rejet'
            ];
            aoa.push(headersRow);

            // Rows
            list.forEach((inv: any) => {
              const paidValues = (inv.payments || []).map((p: any) => Number(p.amount || 0).toFixed(2)).join('\n');
              const paidDates = (inv.payments || []).map((p: any) => p.date || p.payment_date || '').join('\n');
              const rejectedValues = (inv.rejections || []).map((r: any) => Number(r.rejected_amount ?? r.amount ?? 0).toFixed(2)).join('\n');
              const rejectReasons = (inv.rejections || []).map((r: any) => r.reason || r.rejection_reason || '').filter(Boolean).join(', ');
              const paidNum = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
              const rejectedNum = (inv.rejections || []).reduce((s: number, r: any) => s + Number(r.rejected_amount ?? r.amount ?? 0), 0);
              const remaining = Number(inv.billed_amount || 0) - paidNum - rejectedNum;
              if (type === 'compagnie') {
                aoa.push([
                  inv.invoice_number || '',
                  inv.deposit_date || '',
                  inv.invoice_month || '',
                  inv.Company?.name || (inv.company?.name || ''),
                  Number(inv.billed_amount || 0).toFixed(2),
                  paidValues,
                  rejectedValues,
                  paidDates,
                  remaining.toFixed(2),
                  inv.status || '',
                  rejectReasons,
                ]);
              } else {
                aoa.push([
                  inv.invoice_number || '',
                  inv.deposit_date || '',
                  inv.invoice_month || '',
                  inv.Broker?.name || (inv.broker?.name || ''),
                  inv.Company?.name || (inv.company?.name || ''),
                  Number(inv.billed_amount || 0).toFixed(2),
                  paidValues,
                  rejectedValues,
                  paidDates,
                  remaining.toFixed(2),
                  inv.status || '',
                  rejectReasons,
                ]);
              }
            });

            return { aoa, title };
          };

          const workbook = XLSX.utils.book_new();

          if (filters.Broker) {
            // single sheet (courtier or compagnie depending on filter type)
            const t = sheet === 'courtier' ? 'courtier' : 'compagnie';
            const { aoa } = buildSheetAOA(invoicesToExport, t as any);
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            XLSX.utils.book_append_sheet(workbook, ws, t === 'courtier' ? 'Courtiers' : 'Compagnies');
          } else {
            // two sheets
            const companySheet = buildSheetAOA(invoicesToExport, 'compagnie');
            const ws1 = XLSX.utils.aoa_to_sheet(companySheet.aoa);
            XLSX.utils.book_append_sheet(workbook, ws1, 'Compagnies');

            const brokerSheet = buildSheetAOA(invoicesToExport, 'courtier');
            const ws2 = XLSX.utils.aoa_to_sheet(brokerSheet.aoa);
            XLSX.utils.book_append_sheet(workbook, ws2, 'Courtiers');
          }

          const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          saveAs(blob, `enregistrements_${selectedYear}.xlsx`);
        } catch (err) {
          console.error('Erreur export Excel (XLSX):', err);
        }
      } else if (format === "pdf") {
        // Use server-side PDF (preferred) — Compagnie by default; if you need courtier use param
        const params: Record<string, string | number> = {};
        if (filters.Broker) params.Broker = filters.Broker;
        if (filters.status) params.status = filters.status;
        if (filters.dateMin) params.date_min = filters.dateMin;
        if (filters.dateMax) params.date_max = filters.dateMax;
        if (filters.amountMin) params.amount_min = Number(filters.amountMin);
        if (filters.amountMax) params.amount_max = Number(filters.amountMax);
        if (search) params.search = search;
        try {
          setServerPdfLoading(true);
          // If an entity filter is present (Broker used as entity filter), delegate to server
          const entityFilter = !!filters.Broker && String(filters.Broker).trim() !== "";
          if (entityFilter) {
            params.target = sheet;
            const blob = await (await import('../services/api')).exportInvoices('pdf', params);
            saveAs(blob, `enregistrements_${selectedYear}.pdf`);
          } else {
            // No entity filter -> generate a two-page PDF client-side: companies then brokers
            const doc = new jsPDF({ orientation: "landscape" });

            const makeRowLines = (inv: any) => {
              const paidList = (inv.payments || []).map((p: any) => Number(p.amount || p));
              const paidAmounts = paidList.map((n: number) => n.toFixed(2)).join('\n');
              const rejectedList = (inv.rejections || []).map((r: any) => Number(r.rejected_amount ?? r.amount ?? r));
              const rejectedAmounts = rejectedList.map((n: number) => n.toFixed(2)).join('\n');
              const paidDates = (inv.payments || []).map((p: any) => p.date || p.payment_date || '').join('\n');
              const rejectReasons = (inv.rejections || []).map((r: any) => r.reason || r.rejection_reason || '').filter(Boolean).join(', ');
              const paid = paidAmounts;
              const rejected = rejectedAmounts;
              return { paid, rejected, paidDates, rejectReasons };
            };

            // Common headers that approximate the templates
            const headersCompany = [
              'N° facture',
              'Date dépôt',
              'Mois facture',
              'Compagnie',
              'Montant facturé',
              'Montant payé',
              'Montant rejeté',
              'Date(s) paiements',
              'Solde à percevoir',
              'Dernier statut',
              'Motif rejet',
            ];

            const headersBroker = [
              'N° facture',
              'Date dépôt',
              'Mois facture',
              'Courtier',
              'Sous-compagnie',
              'Montant facturé',
              'Montant payé',
              'Montant rejeté',
              'Date(s) paiements',
              'Solde à percevoir',
              'Dernier statut',
              'Motif rejet',
            ];

            const rowsCompany: any[] = invoicesToExport.map((inv: any) => {
              const { paid, rejected, paidDates, rejectReasons } = makeRowLines(inv);
              const paidNum = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
              const rejectedNum = (inv.rejections || []).reduce((s: number, r: any) => s + Number(r.rejected_amount ?? r.amount ?? 0), 0);
              const remaining = Number(inv.billed_amount || 0) - paidNum - rejectedNum;
              return [
                inv.invoice_number || '',
                inv.deposit_date || '',
                inv.invoice_month || '',
                inv.Company?.name || (inv.company?.name || ''),
                Number(inv.billed_amount || 0).toFixed(2),
                paid,
                rejected,
                paidDates,
                remaining.toFixed(2),
                inv.status || '',
                rejectReasons,
              ];
            });

            const rowsBroker: any[] = invoicesToExport.map((inv: any) => {
              const { paid, rejected, paidDates, rejectReasons } = makeRowLines(inv);
              const paidNum = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
              const rejectedNum = (inv.rejections || []).reduce((s: number, r: any) => s + Number(r.rejected_amount ?? r.amount ?? 0), 0);
              const remaining = Number(inv.billed_amount || 0) - paidNum - rejectedNum;
              return [
                inv.invoice_number || '',
                inv.deposit_date || '',
                inv.invoice_month || '',
                inv.Broker?.name || (inv.broker?.name || ''),
                inv.Company?.name || (inv.company?.name || ''),
                Number(inv.billed_amount || 0).toFixed(2),
                paid,
                rejected,
                paidDates,
                remaining.toFixed(2),
                inv.status || '',
                rejectReasons,
              ];
            });

            // Page 1: Companies
            doc.setFontSize(14);
            doc.text(`État de facturation - Compagnies (${selectedYear})`, 14, 16);
            autoTable(doc, {
              head: [headersCompany],
              body: rowsCompany,
              startY: 22,
              styles: { fontSize: 8, cellPadding: 3 },
              headStyles: { fillColor: [59, 130, 246] },
              columnStyles: { 5: { cellWidth: 'wrap' } },
            });

            // Page 2: Brokers
            doc.addPage();
            doc.setFontSize(14);
            doc.text(`État de facturation - Courtiers (${selectedYear})`, 14, 16);
            autoTable(doc, {
              head: [headersBroker],
              body: rowsBroker,
              startY: 22,
              styles: { fontSize: 8, cellPadding: 3 },
              headStyles: { fillColor: [59, 130, 246] },
            });

            doc.save(`enregistrements_${selectedYear}.pdf`);
          }
        } catch (err) {
          console.error('Erreur export PDF (server or client):', err);
          // fallback single-table pdf using existing rows
          try {
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.setFontSize(14);
            doc.text(`Export Enregistrements - ${selectedYear}`, 14, 16);
            autoTable(doc, {
              head: [headers],
              body: rows,
              startY: 22,
              styles: { fontSize: 8 },
              headStyles: { fillColor: [59, 130, 246] },
            });
            doc.save(`enregistrements_${selectedYear}.pdf`);
          } catch (e2) {
            console.error('Fallback PDF generation failed:', e2);
          }
        } finally {
          setServerPdfLoading(false);
        }
      }
    } catch (e) {
      console.error('Erreur export:', e);
    } finally {
      setServerPdfLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      await call(() => importInvoices(files[0]), "Import réussi !");
      window.location.reload();
    } catch (e: any) {}
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await call(
        () => downloadImportTemplate(),
        "Template téléchargé"
      );
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "template_import.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {}
  };

  const handleFilterChange = (
    key: keyof RegistrationFilters,
    value: string | number
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      Broker: "",
      status: "",
      dateMin: "",
      dateMax: "",
      amountMin: "",
      amountMax: "",
    });
  };

  return {
    invoices,
    companies,
    Companys,
    resetFilters,
    BrokerMap,
    CompanyMap,
    loading,
    serverPdfLoading,
    invoiceForReminder,
    setInvoiceForReminder,
    invoiceForDetails,
    setInvoiceForDetails,
    search,
    partners,
    setSearch,
    filters,
    setFilters,
    handleAddInvoice,
    handleUpdateInvoice,
    handleExport,
    handleImport,
    handleDownloadTemplate,
    handleFilterChange,
  };
}
