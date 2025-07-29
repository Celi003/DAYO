import { RegistrationFilters } from "@/hooks/useRegistrations";
import { Broker, Company, Invoice, User } from "@/types";
import {
  formatCurrency,
  formatDate,
  getInvoiceStatus,
  getStatusColor,
  getStatusText,
} from "@/utils/helpers";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Search,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";

export const InvoiceTable: React.FC<{
  invoices: Invoice[];
  companies: Company[];
  brokers: Broker[];
  user: User;
  onDetails: (inv: Invoice) => void;
  onReminder: (inv: Invoice) => void;
  loading: boolean;
  search: string;
  setSearch: (search: string) => void;
  filters: RegistrationFilters;
  handleFilterChange: (
    key: keyof RegistrationFilters,
    value: string | number
  ) => void;
  resetFilters: () => void;
}> = ({
  invoices,
  companies,
  brokers,
  user,
  onDetails,
  onReminder,
  loading,
  search,
  setSearch,
  filters,
  handleFilterChange,
  resetFilters,
}) => {
  const [page, setPage] = useState<number>(1);
  const filtered = useMemo(() => {
    return invoices.filter((inv: Invoice) => {
      const companyMatch =
        !filters.company || inv.company?.name === filters.company;
      const status = getInvoiceStatus(inv).text;
      const statusMatch = !filters.status || status === filters.status;
      const date = inv.deposit_date || "";
      const dateMinMatch = !filters.dateMin || date >= filters.dateMin;
      const dateMaxMatch = !filters.dateMax || date <= filters.dateMax;
      const amountMinMatch =
        !filters.amountMin || inv.billed_amount >= Number(filters.amountMin);
      const amountMaxMatch =
        !filters.amountMax || inv.billed_amount <= Number(filters.amountMax);
      const searchMatch =
        !search ||
        Object.values(inv).some((v) =>
          v?.toString().toLowerCase().includes(search.toLowerCase())
        );
      return (
        companyMatch &&
        statusMatch &&
        dateMinMatch &&
        dateMaxMatch &&
        amountMinMatch &&
        amountMaxMatch &&
        searchMatch
      );
    });
  }, [invoices, filters, search]);

  const sorted = [...filtered].sort((a: Invoice, b: Invoice) => {
    if (a.id === b.id) return 0;
    if (a.id == null) return 1;
    if (b.id == null) return -1;
    return (
      a.id
        .toString()
        .localeCompare(b.id.toString(), undefined, { numeric: true }) * 1
    );
  });
  const totalPages = Math.ceil(sorted.length / 10) || 1;
  const paged = sorted.slice((page - 1) * 10, page * 10);

  useEffect(() => {
    console.log("Filtered invoices:", filtered);
  }, [filtered]);
  const hasActiveFilters = Object.values(filters).some((value) => value !== "");
  return (
    <div className="p-4">
      <div className="relative flex-1 mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Rechercher une facture..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded transition-all"
        />
      </div>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
        <select
          value={filters.company}
          onChange={(e) => handleFilterChange("company", e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
        >
          <option value="">Toutes les compagnies</option>
          {companies.map((c: Company) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            handleFilterChange("status", e.target.value)
          }
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
        >
          <option value="">Tous statuts</option>
          <option value="Payé">Payé</option>
          <option value="Rejeté">Rejeté</option>
          <option value="Partiel">Partiel</option>
          <option value="En attente">En attente</option>
        </select>
        <input
          type="date"
          value={filters.dateMin}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleFilterChange("dateMin", e.target.value)
          }
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          placeholder="Date min"
        />
        <input
          type="date"
          value={filters.dateMax}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleFilterChange("dateMax", e.target.value)
          }
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          placeholder="Date max"
        />
        <input
          type="number"
          value={filters.amountMin}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleFilterChange("amountMin", e.target.value)
          }
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          placeholder="Montant min"
        />
        <input
          type="number"
          value={filters.amountMax}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleFilterChange("amountMax", e.target.value)
          }
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          placeholder="Montant max"
        />
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-2 px-2 py-1 bg-slate-200 rounded"
          >
            Réinitialiser
          </button>
        )}
        <span className="text-sm text-slate-500 ml-2">
          {sorted.length} résultat(s)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID Facture
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Compagnie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Courtier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                Date dépôt
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Montant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paged.map((invoice) => {
              const company = companies.find(
                (c) => c.id === invoice.company?.id
              );
              const broker = brokers.find((b) => b.id === invoice.broker?.id);

              return (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {company?.name || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                    {broker?.name || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                    {formatDate(invoice.deposit_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.billed_amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${getStatusColor(
                        invoice.status
                      )}`}
                    >
                      {getStatusText(invoice.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onDetails(invoice)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Eye className="w-3 h-3 md:hidden" />
                        <span className="hidden md:inline">Détails</span>
                      </button>
                      {user.role === "provider" && (
                        <button
                          onClick={() => onReminder(invoice)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors"
                        >
                          <Bell className="w-3 h-3 md:hidden" />
                          <span className="hidden md:inline">Relance</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">
              <FileText className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500">Aucune facture trouvée</p>
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Affichage de {(page - 1) * 10 + 1} à{" "}
              {Math.min(page * 10, sorted.length)} sur {sorted.length} résultats
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Précédent</span>
              </button>
              <span className="text-sm text-gray-700">
                Page {page} sur {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="hidden sm:inline">Suivant</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
