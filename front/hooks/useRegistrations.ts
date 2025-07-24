import { useState } from "react";
import { useBillingData } from "./useApi";
import { Invoice } from "../types";
import {
  downloadImportTemplate,
  exportInvoices,
  getInvoices,
  importInvoices,
  useApi,
} from "../services/api";

export type RegistrationFilters = {
  search: string;
  company: string;
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
    brokers,
    loading,
    companyMap,
    brokerMap,
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
    company: "",
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
      const params: Record<string, string | number> = {};
      if (filters.company) params.company = filters.company;
      if (filters.status) params.status = filters.status;
      if (filters.dateMin) params.date_min = filters.dateMin;
      if (filters.dateMax) params.date_max = filters.dateMax;
      if (filters.amountMin) params.amount_min = filters.amountMin;
      if (filters.amountMax) params.amount_max = filters.amountMax;
      if (search) params.search = search;
      const blob = await call(
        () => exportInvoices(format, params),
        "Export réussi"
      );
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = format === "excel" ? "factures.xlsx" : "factures.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
      company: "",
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
    brokers,
    resetFilters,
    companyMap,
    brokerMap,
    loading,
    invoiceForReminder,
    setInvoiceForReminder,
    invoiceForDetails,
    setInvoiceForDetails,
    search,
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
