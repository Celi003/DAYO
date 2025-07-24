import React from "react";
import { User } from "../types";
import InvoiceDetailModal from "../components/InvoiceDetailModal";
import useRegistrations from "@/hooks/useRegistrations";
import { AddInvoiceForm } from "@/components/registrations/form";
import { InvoiceTable } from "@/components/registrations/table";
import { ReminderModal } from "@/components/registrations/modals";
import { Download, FileSpreadsheet, FileText, Upload } from "lucide-react";

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
    brokers,
    companyMap,
    brokerMap,
    handleAddInvoice,
    handleUpdateInvoice,
    invoiceForReminder,
    setInvoiceForReminder,
    search,
    filters,
    handleFilterChange,
    loading,
    setSearch,
    setInvoiceForDetails,
    resetFilters,
  } = useRegistrations(selectedYear);

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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter PDF</span>
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
          brokers={brokers}
          providerId={user.id}
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
          brokers={brokers}
          user={user}
          onDetails={setInvoiceForDetails}
          onReminder={setInvoiceForReminder}
          loading={loading}
          // Filtres synchronisés
          search={search}
          setSearch={setSearch}
          filters={filters}
          handleFilterChange={handleFilterChange}
          resetFilters={resetFilters}
        />
      </div>
      {invoiceForReminder && companyMap.get(invoiceForReminder.company.id) && (
        <ReminderModal
          invoice={invoiceForReminder}
          company={companyMap.get(invoiceForReminder.company.id)!}
          broker={
            invoiceForReminder.broker?.id
              ? brokerMap.get(invoiceForReminder.broker.id) || null
              : null
          }
          onClose={() => setInvoiceForReminder(null)}
        />
      )}
      {invoiceForDetails && companyMap.get(invoiceForDetails.company.id) && (
        <InvoiceDetailModal
          invoice={invoiceForDetails}
          company={companyMap.get(invoiceForDetails.company.id)!}
          broker={
            invoiceForDetails.broker?.id
              ? brokerMap.get(invoiceForDetails.broker.id) || null
              : null
          }
          onClose={() => setInvoiceForDetails(null)}
          onUpdate={handleUpdateInvoice}
        />
      )}
    </React.Fragment>
  );
};

export default Registrations;
