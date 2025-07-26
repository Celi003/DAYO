import React, { useEffect, useState, Suspense } from "react";
import { User } from "../types";
import { RevenueDetailsModalContent, DistributionDetailsModalContent, StatusDetailsModalContent } from "../components/dashboard/modals";
import Modal from "../components/Modal";
import { useDashboard } from "@/hooks/dashboard/useDashboard";
import { StatCard, Trend } from "@/components/dashboard";
import { formatCurrency } from "@/utils/helpers";
import { useDashboardCharts } from "../hooks/dashboard/useCharts";
import { DBarChart } from "../components/dashboard/barChart";
import { DPieChart } from "../components/dashboard/pieChart";

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [filterPartner, setFilterPartner] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [filterQuarter, setFilterQuarter] = useState<number | null>(null);
  const monthNames = [
    "Janv.",
    "Févr.",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juil.",
    "Août",
    "Sept.",
    "Oct.",
    "Nov.",
    "Déc.",
  ];

  const {
    filteredInvoicesForYear,
    partners,
    loading,
    stats,
    availableYears,
    exportDashboardData,
    partnerMap,
    prevStats,
    filteredInvoices,
    partnerPaymentStatusData,
    partnerRevenueData
  } = useDashboard(selectedYear, filterPartner, filterStatus, filterMonth);

  const { stackedBarData } = useDashboardCharts(
    filteredInvoices
  )
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-slate-100">
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <h1 className="text-3xl font-bold text-slate-800 mr-8">
            Tableau de bord
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total facturé"
          value={formatCurrency(stats.totalInvoiced)}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" x2="12" y1="2" y2="22"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          }
          tooltip="Somme totale des factures émises pour l'année et les filtres sélectionnés."
          trend={
            <Trend
              current={stats.totalInvoiced}
              previous={prevStats.totalInvoiced}
            />
          }
        />
        <StatCard
          title="Total payé"
          value={formatCurrency(stats.totalPaid)}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          }
          tooltip="Montant total payé sur les factures pour l'année et les filtres sélectionnés."
          trend={
            <Trend current={stats.totalPaid} previous={prevStats.totalPaid} />
          }
        />
        <StatCard
          title="Total rejeté"
          value={formatCurrency(stats.totalRejected)}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" x2="12" y1="8" y2="12"></line>
              <line x1="12" x2="12.01" y1="16" y2="16"></line>
            </svg>
          }
          tooltip="Montant total rejeté sur les factures pour l'année et les filtres sélectionnés."
          trend={
            <Trend
              current={stats.totalRejected}
              previous={prevStats.totalRejected}
            />
          }
        />
        <StatCard
          title="Reste à régler"
          value={formatCurrency(stats.outstanding)}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          }
          tooltip="Montant restant à régler sur les factures pour l'année et les filtres sélectionnés."
          trend={
            <Trend
              current={stats.outstanding}
              previous={prevStats.outstanding}
            />
          }
        />
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={filterPartner}
            onChange={(e) => setFilterPartner(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          >
            <option value="">Tous les partenaires</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          >
            <option value="">Tous types</option>
            <option value="Paiement">Avec paiements</option>
            <option value="Rejet">Avec rejets</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          >
            <option value="">Tous statuts</option>
            <option value="payé">Payé</option>
            <option value="enAttente">En attente</option>
            <option value="rejeté">Rejeté</option>
          </select>
          <select
            value={filterMonth !== null ? filterMonth : ""}
            onChange={(e) =>
              setFilterMonth(
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          >
            <option value="">Tous les mois</option>
            {monthNames.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={filterQuarter !== null ? filterQuarter : ""}
            onChange={(e) =>
              setFilterQuarter(
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white"
          >
            <option value="">Tous les trimestres</option>
            <option value={0}>T1 (Janv.-Mars)</option>
            <option value={1}>T2 (Avr.-Juin)</option>
            <option value={2}>T3 (Juil.-Sept.)</option>
            <option value={3}>T4 (Oct.-Déc.)</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {(filterPartner ||
              filterType ||
              filterStatus ||
              filterMonth !== null ||
              filterQuarter !== null) && (
              <button
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md"
                onClick={() => {
                  setFilterPartner("");
                  setFilterType("");
                  setFilterStatus("");
                  setFilterMonth(null);
                  setFilterQuarter(null);
                }}
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportDashboardData("csv")}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Exporter CSV
            </button>
            <button
              onClick={() => exportDashboardData("excel")}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Exporter Excel
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <DBarChart
          data={stackedBarData}
          selectedYear={selectedYear}
          setFilterMonth={setFilterMonth}
        />
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            Top partenaires ({selectedYear}){" "}
            <span
              className="ml-2 text-slate-400"
              title="Partenaires ayant généré le plus de chiffre d'affaires."
            >
              ?
            </span>
          </h2>
          {[...partnerRevenueData].sort((a, b) => b.value - a.value).slice(0, 5)
            .length > 0 ? (
            <ul className="space-y-3">
              {[...partnerRevenueData]
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
                .map((p) => {
                  const partnerObj = partners.find((pt) => pt.name === p.name);
                  return (
                    <li
                      key={p.name}
                      className="flex justify-between items-center"
                    >
                      <button
                        className="text-sm font-medium text-slate-700 hover:underline"
                        onClick={() =>
                          partnerObj && setFilterPartner(String(partnerObj.id))
                        }
                        aria-label={`Filtrer sur le partenaire ${p.name}`}
                      >
                        {p.name}
                      </button>
                      <span className="text-sm font-semibold bg-slate-100 px-2 py-1 rounded">
                        {formatCurrency(p.value)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Aucune donnée pour cette année.
            </div>
          )}
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Répartition par partenaire ({selectedYear}){" "}
          <span
            className="ml-2 text-slate-400"
            title="Répartition du chiffre d'affaires par partenaire."
          >
            ?
          </span>
        </h2>
        <DPieChart
          data={partnerRevenueData}
          setFilterPartner={setFilterPartner}
          partners={partners}
        />
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full text-slate-500">
            Chargement de la modale...
          </div>
        }
      >
        <Modal
          isOpen={openModal === "revenue"}
          onClose={() => setOpenModal(null)}
          title={`Détail du chiffre d'affaires pour ${selectedYear}`}
        >
          <RevenueDetailsModalContent
            data={filteredInvoicesForYear}
            partnerMap={partnerMap}
          />
        </Modal>
      </Suspense>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full text-slate-500">
            Chargement de la modale...
          </div>
        }
      >
        <Modal
          isOpen={openModal === "distribution"}
          onClose={() => setOpenModal(null)}
          title={`Détail de la répartition par partenaire (${selectedYear})`}
        >
          <DistributionDetailsModalContent data={partnerRevenueData} />
        </Modal>
      </Suspense>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full text-slate-500">
            Chargement de la modale...
          </div>
        }
      >
        <Modal
          isOpen={openModal === "status"}
          onClose={() => setOpenModal(null)}
          title={`Détail de l'état des paiements par partenaire (${selectedYear})`}
        >
          <StatusDetailsModalContent data={partnerPaymentStatusData} />
        </Modal>
      </Suspense>
    </div>
  );
};

export default Dashboard;
