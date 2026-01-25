import React, { useEffect, useState } from "react";
import {
  User,
  TransactionType,
} from "../types";
import { formatCurrency, formatDate } from "@/utils/helpers";
import { FilterConfig, usePayments } from "@/hooks/usePayments";
import { Search } from "lucide-react";

interface PaymentsProps {
  user: User;
  selectedYear?: number;
}

const Payments: React.FC<PaymentsProps> = ({
  user,
  selectedYear = new Date().getFullYear(),
}) => {
  const [filters, setFilters] = useState<FilterConfig>({
    partner: "",
    type: "" as TransactionType,
    status: "",
    dateMin: "",
    dateMax: "",
    amountMin: 0,
    amountMax: 0,
    search: "",
  });

  const [pageByMonth, setPageByMonth] = useState<{ [month: string]: number }>(
    {}
  );
  const pageSize = 10;

  const {
    loading: paymentsLoading,
    handleSort,
    sort,
    transactions,
    monthlyTransactions,
    companies,
    groupedTransactions,
    Companys,
    BrokerMap,
  } = usePayments(selectedYear, filters);



  const handlePageChange = (monthKey: string, newPage: number) => {
    setPageByMonth((prev) => ({ ...prev, [monthKey]: newPage }));
  };

  const handleFilterChange = (key: keyof FilterConfig, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      partner: "",
      type: "Paiement",
      status: "",
      dateMin: "",
      dateMax: "",
      amountMin: 0,
      amountMax: 0,
      search: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((value) => value !== "");

  const loading = paymentsLoading;
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div>
      </div>
    );
  }


  return (
    <React.Fragment>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">
          Suivi des Paiements et Rejets
        </h1>
        <div>
          <div className="relative flex-1 mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher un paiement..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded transition-all"
            />
          </div>
          <div className="flex w-full gap-4 mb-6">
            <select
              value={filters.partner}
              onChange={(e) => handleFilterChange("partner", e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
            >
              <option value="">Tous les partenaires</option>
              {companies.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              {Companys.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange("type", e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
            >
              <option value="">Tous les types</option>
              <option value="Paiement">Paiements</option>
              <option value="Rejet">Rejets</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
            >
              <option value="">Tous statuts</option>
              <option value="Payée">Payée</option>
              <option value="Rejetée">Rejetée</option>
            </select>
            <input
              type="date"
              value={filters.dateMin}
              onChange={(e) => handleFilterChange("dateMin", e.target.value)}
              className="border p-2 rounded-md"
              placeholder="Date min"
            />
            <input
              type="date"
              value={filters.dateMax}
              onChange={(e) => handleFilterChange("dateMax", e.target.value)}
              className="border p-2 rounded-md"
              placeholder="Date max"
            />
            <input
              type="number"
              value={filters.amountMin}
              onChange={(e) => handleFilterChange("amountMin", e.target.value)}
              className="border p-2 rounded-md"
              placeholder="Montant min"
            />
            <input
              type="number"
              value={filters.amountMax}
              onChange={(e) => handleFilterChange("amountMax", e.target.value)}
              className="border p-2 rounded-md"
              placeholder="Montant max"
            />
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="w-full px-2 py-1 bg-slate-200 rounded"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        <div className="space-y-8 mt-6">
          {groupedTransactions.sortedMonthKeys.length > 0 ? (
            groupedTransactions.sortedMonthKeys.map((monthKey) => {
              const transactionsInMonth = groupedTransactions.groups[monthKey];
              const page = pageByMonth[monthKey] || 1;
              const totalPages =
                Math.ceil(transactionsInMonth.length / pageSize) || 1;
              const paged = transactionsInMonth.slice(
                (page - 1) * pageSize,
                page * pageSize
              );
              const dateForTitle = new Date(monthKey + "-02T00:00:00");
              const monthTitle = dateForTitle.toLocaleString("fr-FR", {
                month: "long",
                year: "numeric",
              });
              const capitalizedMonthTitle =
                monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
              return (
                <div
                  key={monthKey}
                  className="bg-white p-6 rounded-lg shadow-sm"
                >
                  <h2 className="text-xl font-bold mb-4 text-slate-700">
                    {capitalizedMonthTitle}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th
                            className="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none"
                            onClick={() => handleSort("date")}
                          >
                            Date{" "}
                            {sort.col === "date" ? (sort.asc ? "▲" : "▼") : ""}
                          </th>
                          {user.role === "admin" && (
                            <th className="p-4 text-sm font-semibold text-slate-600">
                              Prestataire
                            </th>
                          )}
                          <th
                            className="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none"
                            onClick={() => handleSort("partnerName")}
                          >
                            Partenaire{" "}
                            {sort.col === "partnerName"
                              ? sort.asc
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                          <th
                            className="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none"
                            onClick={() => handleSort("invoiceMonth")}
                          >
                            Mois Facture{" "}
                            {sort.col === "invoiceMonth"
                              ? sort.asc
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                          <th
                            className="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none"
                            onClick={() => handleSort("type")}
                          >
                            Type{" "}
                            {sort.col === "type" ? (sort.asc ? "▲" : "▼") : ""}
                          </th>
                          <th
                            className="p-4 text-sm font-semibold text-slate-600 text-right cursor-pointer select-none"
                            onClick={() => handleSort("amount")}
                          >
                            Montant{" "}
                            {sort.col === "amount"
                              ? sort.asc
                                ? "▲"
                                : "▼"
                              : ""}
                          </th>
                          <th className="p-4 text-sm font-semibold text-slate-600">
                            Motif du Rejet
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((t) => (
                          <tr
                            key={t.id}
                            className="border-b last:border-b-0 hover:bg-slate-50"
                          >
                            <td className="p-4 text-slate-600">
                              {formatDate(t.date)}
                            </td>
                            {user.role === "admin" && (
                              <td className="p-4 font-medium">
                                {t.providerName}
                              </td>
                            )}
                            <td className="p-4 font-medium">
                              {t.partnerName}
                              {t.BrokerName && t.CompanyName && (
                                <span className="text-sm text-slate-500 ml-1">
                                  ({t.BrokerName} - {t.CompanyName})
                                </span>
                              )}
                              {t.BrokerName && !t.CompanyName && (
                                <span className="text-sm text-slate-500 ml-1">
                                  ({t.BrokerName})
                                </span>
                              )}
                              {!t.BrokerName && t.CompanyName && (
                                <span className="text-sm text-slate-500 ml-1">
                                  ({t.CompanyName})
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-slate-600">
                              {t.invoiceMonth}
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  t.type === "Paiement"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td
                              className={`p-4 text-right font-mono ${
                                t.type === "Paiement"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(t.amount)}
                            </td>
                            <td className="p-4 text-slate-600 text-sm">
                              {t.reason || "-"}
                            </td>
                          </tr>
                        ))}
                        {paged.length === 0 && (
                          <tr>
                            <td
                              colSpan={user.role === "admin" ? 7 : 6}
                              className="text-center p-8 text-slate-500"
                            >
                              Aucune transaction trouvée.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 items-center my-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => handlePageChange(monthKey, page - 1)}
                      className="px-2 py-1 border rounded disabled:opacity-50"
                    >
                      Préc.
                    </button>
                    <span>
                      Page {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => handlePageChange(monthKey, page + 1)}
                      className="px-2 py-1 border rounded disabled:opacity-50"
                    >
                      Suiv.
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-center p-8 text-slate-500">
                Aucune transaction trouvée pour les filtres sélectionnés.
              </div>
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  );
};

export default Payments;
