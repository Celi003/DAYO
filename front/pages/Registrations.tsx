import React from "react";
import { User, Invoice } from "../types";
import InvoiceDetailModal from "../components/InvoiceDetailModal";
import useRegistrations from "@/hooks/useRegistrations";
import { AddInvoiceForm } from "@/components/registrations/form";
import { InvoiceTable } from "@/components/registrations/table";
import { ReminderModal } from "@/components/registrations/modals";
import { Download, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { deleteInvoice, useApi } from "@/services/api";

interface RegistrationsProps {
  user: User;
  selectedYear?: number;
}

const Registrations: React.FC<RegistrationsProps> = ({
  user,
  selectedYear = new Date().getFullYear(),
}) => {

  const {
    invoices,
    invoiceForDetails,
    handleExport,
    handleDownloadTemplate,
    handleImport,
    companies,
    Companys,
    handleAddInvoice,
    handleUpdateInvoice,
    invoiceForReminder,
    setInvoiceForReminder,
    search,
    partners,
    filters,
    handleFilterChange,
    loading,
    serverPdfLoading,
    setSearch,
    setInvoiceForDetails,
    resetFilters,
  } = useRegistrations(selectedYear);

  const { call } = useApi();
  
  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la facture ${invoice.invoice_number} ?`)) {
      try {
        console.log('Attempting to delete invoice:', invoice.id);
        const result = await call(() => deleteInvoice(String(invoice.id)), "Facture supprimée");
        console.log('Delete result:', result);
        if (result && result.success) {
          // Recharger les factures après suppression
          window.location.reload();
        }
      } catch (error) {
        console.error('Error deleting invoice:', error);
      }
    }
  };

  const partnerId = partners.find((p) => p.user.id === user.id)?.id ?? null;
  return (
    <React.Fragment>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Enregistrements
            </h1>
            <p className="mt-2 text-gray-600">
              Gérez vos factures et suivez leur statut
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleExport("excel")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter Excel</span>
            </button>

            <button
              onClick={() => handleExport("pdf")}
              disabled={serverPdfLoading}
              className={`inline-flex items-center gap-2 px-4 py-2.5 ${serverPdfLoading ? 'bg-red-400 cursor-wait' : 'bg-red-600 hover:bg-red-700'} text-white font-medium rounded-lg transition-colors shadow-sm`}
            >
              {serverPdfLoading ? (
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{serverPdfLoading ? 'Génération PDF...' : 'Exporter PDF'}</span>
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Template</span>
            </button>

            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importer</span>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {user.role === "provider" && (
        <AddInvoiceForm
          companies={companies}
          Companys={Companys}
          providerId={partnerId}
          onAddInvoice={handleAddInvoice}
          user={user}
        />
      )}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Liste des factures</h2>
        </div>
        <InvoiceTable
          invoices={invoices}
          companies={companies}
          Companys={Companys}
          user={user}
          onDetails={setInvoiceForDetails}
          onReminder={setInvoiceForReminder}
          onDelete={handleDeleteInvoice}
          loading={loading}
          // Filtres synchronisés
          search={search}
          setSearch={setSearch}
          filters={filters}
          handleFilterChange={handleFilterChange}
          resetFilters={resetFilters}
        />
      </div>
      {invoiceForReminder && (
        <ReminderModal
          invoice={invoiceForReminder}
          onClose={() => setInvoiceForReminder(null)}
        />
      )}
      {invoiceForDetails && (
        <InvoiceDetailModal
          invoice={invoiceForDetails}
          onClose={() => setInvoiceForDetails(null)}
          onUpdate={handleUpdateInvoice}
          userRole={user.role}
        />
      )}
    </React.Fragment>
  );
};

export default Registrations;
