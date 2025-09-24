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

      if (format === "excel") {
        const content = [headers, ...rows]
          .map((row) => row.join("\t"))
          .join("\n");
        const blob = new Blob([content], {
          type: "application/vnd.ms-excel",
        });
        saveAs(blob, "enregistrements.xls");
      } else if (format === "pdf") {
        const doc = new jsPDF({ orientation: "landscape" });
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
      }
    } catch (e) {}
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
