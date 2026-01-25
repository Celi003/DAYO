import React, { useEffect, useState, Suspense, useMemo } from "react";
import { User } from "../types";
import { RevenueDetailsModalContent, DistributionDetailsModalContent, StatusDetailsModalContent } from "../components/dashboard/modals";
import Modal from "../components/Modal";
import { useDashboard } from "@/hooks/dashboard/useDashboard";
import { StatCard, Trend } from "@/components/dashboard";
import { formatCurrency } from "@/utils/helpers";
import { useDashboardCharts } from "../hooks/dashboard/useCharts";
import { DBarChart } from "../components/dashboard/barChart";
import { DPieChart } from "../components/dashboard/pieChart";
import { LineChart } from "../components/dashboard/lineChart";
import { DonutChart } from "../components/dashboard/donutChart";
import { StackedBarChart } from "../components/dashboard/stackedBarChart";

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
    "Jan.",
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
  } = useDashboard(selectedYear, filterPartner, filterStatus, filterMonth, user.role);

  const { stackedBarData } = useDashboardCharts(
    filteredInvoices
  )

  // Génération des données d'évolution du chiffre d'affaires basées sur les vraies données
  const revenueEvolutionData = useMemo(() => {
    const monthlyData = new Array(12).fill(0).map((_, index) => ({
      month: monthNames[index],
      revenue: 0
    }));

    filteredInvoicesForYear.forEach(invoice => {
      const month = new Date(invoice.deposit_date).getMonth();
      monthlyData[month].revenue += Number(invoice.billed_amount) || 0;
    });

    return monthlyData;
  }, [filteredInvoicesForYear, monthNames]);

  // Génération des données de répartition par partenaire basées sur les vraies données
  const partnerDistributionData = useMemo(() => {
    if (partnerRevenueData.length === 0) return [];
    
    const total = partnerRevenueData.reduce((sum, item) => sum + item.value, 0);
    const colors = ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#6366f1"];
    
    const result = partnerRevenueData
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((item, index) => ({
        name: item.name,
        value: Math.round((item.value / total) * 100),
        color: colors[index % colors.length]
      }));
    
    return result;
  }, [partnerRevenueData]);

  // Génération des données des meilleurs partenaires basées sur les vraies données
  const topPartnersData = useMemo(() => {
    if (partnerRevenueData.length === 0) return [];
    
    const maxAmount = Math.max(...partnerRevenueData.map(p => p.value));
    const colors = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"];
    
    const result = partnerRevenueData
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
      .map((item, index) => ({
        name: item.name,
        amount: item.value,
        color: colors[index % colors.length]
      }));
    
    return result;
  }, [partnerRevenueData]);

  // Génération des données d'état des paiements basées sur les vraies données
  const paymentStatusData = useMemo(() => {
    if (partnerPaymentStatusData.length === 0) return [];
    
    const result = partnerPaymentStatusData
      .slice(0, 3)
      .map(item => ({
        partner: item.name,
        total: item.total || 0,
        paid: item.paid || 0,
        pending: item.outstanding || 0,
        rejected: item.rejected || 0
      }));
    
    return result;
  }, [partnerPaymentStatusData]);

  // Génération de la deuxième liste des meilleurs partenaires basée sur les vraies données
  const topPartnersData2 = useMemo(() => {
    if (partnerRevenueData.length === 0) return [];
    
    const result = partnerRevenueData
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
      .map(item => ({
        name: item.name,
        amount: item.value
      }));
    
    return result;
  }, [partnerRevenueData]);

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

      {/* KPIs - Première rangée */}
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
          extraIcon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute top-2 right-2"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          }
        />
      </div>

      {/* Filtres */}
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
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {(filterPartner ||
              filterType ||
              filterStatus) && (
              <button
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md"
                onClick={() => {
                  setFilterPartner("");
                  setFilterType("");
                  setFilterStatus("");
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
            <button
              onClick={() => exportDashboardData("pdf")}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Exporter PDF
            </button>
          </div>
        </div>
      </div>

      

      {/* Deuxième rangée - Graphiques et Top partenaires */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Évolution du chiffre d'affaires */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            Évolution du chiffre d'affaires
          </h2>
          {revenueEvolutionData.length > 0 ? (
            <>
              <LineChart data={revenueEvolutionData} />
              <div className="mt-4 text-center">
                <button
                  onClick={() => setOpenModal("revenue")}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Voir détails
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-500">
              Aucune donnée disponible pour l'évolution du chiffre d'affaires
            </div>
          )}
        </div>

        {/* Répartition du chiffre d'affaires par partenaire */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            Répartition du chiffre d'affaires par partenaire
          </h2>
          {partnerDistributionData.length > 0 ? (
            <>
              <DonutChart data={partnerDistributionData} />
              <div className="mt-4 text-center">
                <button
                  onClick={() => setOpenModal("distribution")}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Voir détails
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-500">
              Aucune donnée disponible pour la répartition par partenaire
            </div>
          )}
        </div>
      </div>

      {/* Troisième rangée - Top partenaires avec barres */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Meilleurs partenaires
        </h2>
        {topPartnersData.length > 0 ? (
          <>
            <div className="space-y-3">
              {topPartnersData.map((partner, index) => (
                <div key={partner.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{partner.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full"
                        style={{ 
                          width: `${(partner.amount / Math.max(...topPartnersData.map(p => p.amount))) * 100}%`,
                          backgroundColor: partner.color 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold bg-slate-100 px-2 py-1 rounded">
                      {formatCurrency(partner.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={() => setOpenModal("partners")}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Voir détails
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-500">
            Aucune donnée disponible pour les meilleurs partenaires
          </div>
        )}
      </div>

      {/* Quatrième rangée - État des paiements et Top partenaires */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* État des paiements par partenaire */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            État des paiements par partenaire
          </h2>
          {paymentStatusData.length > 0 ? (
            <>
              <StackedBarChart data={paymentStatusData} />
              <div className="mt-4 text-center">
                <button
                  onClick={() => setOpenModal("status")}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Voir détails
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-500">
              Aucune donnée disponible pour l'état des paiements
            </div>
          )}
        </div>

        {/* Deuxième liste des meilleurs partenaires */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            Meilleurs partenaires
          </h2>
          {topPartnersData2.length > 0 ? (
            <>
              <div className="space-y-3">
                {topPartnersData2.map((partner) => (
                  <div key={partner.name} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">{partner.name}</span>
                    <span className="text-sm font-semibold bg-slate-100 px-2 py-1 rounded">
                      {formatCurrency(partner.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={() => setOpenModal("partners2")}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Voir détails
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-500">
              Aucune donnée disponible pour les meilleurs partenaires
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
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
          title="Détail de l'évolution du chiffre d'affaires"
        >
          <RevenueDetailsModalContent
            data={filteredInvoicesForYear}
            partnerMap={partnerMap}
            userRole={user.role}
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
          title="Détail de la répartition par partenaire"
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
          title="Détail de l'état des paiements par partenaire"
        >
          <StatusDetailsModalContent data={partnerPaymentStatusData} />
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
          isOpen={openModal === "partners"}
          onClose={() => setOpenModal(null)}
          title="Détail des meilleurs partenaires"
        >
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Top partenaires par chiffre d'affaires</h3>
            <div className="space-y-3">
              {topPartnersData.map((partner) => (
                <div key={partner.name} className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="font-medium">{partner.name}</span>
                  <span className="font-semibold">{formatCurrency(partner.amount)}</span>
                </div>
              ))}
            </div>
          </div>
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
          isOpen={openModal === "partners2"}
          onClose={() => setOpenModal(null)}
          title="Détail des meilleurs partenaires"
        >
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Top partenaires par performance</h3>
            <div className="space-y-3">
              {topPartnersData2.map((partner) => (
                <div key={partner.name} className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="font-medium">{partner.name}</span>
                  <span className="font-semibold">{formatCurrency(partner.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      </Suspense>
    </div>
  );
};

export default Dashboard;
