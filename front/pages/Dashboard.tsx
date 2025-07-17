
import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { getInvoices, getProviders, getInvoiceStatistics } from '../services/api';
import { Invoice, Partner, User } from '../types';
import { saveAs } from 'file-saver';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import Modal from '../components/Modal';

const formatCurrency = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getPreviousYearStats = (invoices: Invoice[], year: number) => {
  const prev = invoices.filter(inv => new Date(inv.depositDate).getFullYear() === year - 1);
  const totalInvoiced = prev.reduce((a: number, inv: Invoice) => a + inv.totalAmount, 0);
  const totalPaid = prev.reduce((a: number, inv: Invoice) => a + inv.payments.reduce((s: number, p) => s + p.amount, 0), 0);
  const totalRejected = prev.reduce((a: number, inv: Invoice) => a + inv.rejections.reduce((s: number, r) => s + r.amount, 0), 0);
  const outstanding = totalInvoiced - totalPaid - totalRejected;
  return { totalInvoiced, totalPaid, totalRejected, outstanding };
};

const Trend: React.FC<{current: number, previous: number}> = ({ current, previous }) => {
  if (previous === 0) return null;
  const diff = current - previous;
  const percent = ((diff) / Math.abs(previous)) * 100;
  if (Math.abs(percent) < 0.1) return null;
  return (
    <span className={"ml-2 text-xs font-semibold inline-flex items-center " + (diff > 0 ? 'text-green-600' : 'text-red-600')} aria-label={diff > 0 ? 'En hausse' : 'En baisse'}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(percent).toFixed(1)}%
    </span>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; tooltip: string; trend?: React.ReactNode }> = ({ title, value, icon, tooltip, trend }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm flex items-center relative group" tabIndex={0} aria-label={title}>
    <div className="bg-slate-100 rounded-full p-3 mr-4">
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-800 flex items-center">{value} {trend}</p>
    </div>
    <div className="absolute top-0 right-0 mt-2 mr-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none group-focus:pointer-events-auto z-10">
      <span className="bg-slate-700 text-white text-xs rounded px-2 py-1 shadow-lg">{tooltip}</span>
    </div>
  </div>
);

interface DashboardProps {
    user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalInvoiced: 0, totalPaid: 0, totalRejected: 0, outstanding: 0 });
  const [filterPartner, setFilterPartner] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [filterQuarter, setFilterQuarter] = useState<number | null>(null);
  const monthNames = ["Janv.", "Févr.", "Mars", "Avril", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [invoicesData, partnersData, statsData] = await Promise.all([
        getInvoices(),
        getProviders(),
        getInvoiceStatistics({ year: selectedYear })
      ]);
      setInvoices(invoicesData);
      setPartners(partnersData);
      setStats({
        totalInvoiced: statsData.monthly_stats.reduce((a: number, s: any) => a + s.total_billed, 0),
        totalPaid: statsData.monthly_stats.reduce((a: number, s: any) => a + s.total_paid, 0),
        totalRejected: statsData.monthly_stats.reduce((a: number, s: any) => a + s.total_rejected, 0),
        outstanding: statsData.monthly_stats.reduce((a: number, s: any) => a + s.total_remaining, 0),
      });
      setLoading(false);
    };
    fetchData();
  }, [selectedYear]);

  // Filtres dynamiques sur les factures de l'année sélectionnée
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const yearMatch = new Date(inv.depositDate).getFullYear() === selectedYear;
      const partnerMatch = !filterPartner || inv.partnerId === filterPartner;
      let typeMatch = true;
      if (filterType === 'Paiement') typeMatch = inv.payments && inv.payments.length > 0;
      if (filterType === 'Rejet') typeMatch = inv.rejections && inv.rejections.length > 0;
      let statusMatch = true;
      if (filterStatus === 'payé') {
        const paid = inv.payments.reduce((sum: number, p) => sum + p.amount, 0);
        const rejected = inv.rejections.reduce((sum: number, r) => sum + r.amount, 0);
        statusMatch = inv.totalAmount - paid - rejected <= 0;
      }
      if (filterStatus === 'enAttente') {
        const paid = inv.payments.reduce((sum: number, p) => sum + p.amount, 0);
        const rejected = inv.rejections.reduce((sum: number, r) => sum + r.amount, 0);
        statusMatch = inv.totalAmount - paid - rejected > 0;
      }
      if (filterStatus === 'rejeté') {
        statusMatch = inv.rejections && inv.rejections.length > 0;
      }
      let monthMatch = true;
      if (filterMonth !== null) {
        monthMatch = new Date(inv.depositDate).getMonth() === filterMonth;
      }
      let quarterMatch = true;
      if (filterQuarter !== null) {
        const m = new Date(inv.depositDate).getMonth();
        quarterMatch = Math.floor(m / 3) === filterQuarter;
      }
      return yearMatch && partnerMatch && typeMatch && statusMatch && monthMatch && quarterMatch;
    });
  }, [invoices, selectedYear, filterPartner, filterType, filterStatus, filterMonth, filterQuarter]);

  const availableYears = useMemo(() => {
    if (invoices.length === 0) return [new Date().getFullYear()];
    const years = new Set(invoices.map(inv => new Date(inv.depositDate).getFullYear()));
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [invoices]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const lineChartData = useMemo(() => {
    const monthlyData: { [key: number]: number } = {}; // Use month index 0-11
    filteredInvoices.forEach(inv => {
        const monthIndex = new Date(inv.depositDate).getMonth(); // 0-11
        monthlyData[monthIndex] = (monthlyData[monthIndex] || 0) + inv.totalAmount;
      });

    const monthOrder = ["Janv.", "Févr.", "Mars", "Avril", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
    return monthOrder.map((name, index) => ({
      name,
      "Chiffre d'affaires": monthlyData[index] || 0,
    }));
  }, [filteredInvoices, selectedYear]);

  const partnerRevenueData = useMemo(() => {
    const data: { [key: string]: number } = {};
    filteredInvoices.forEach(inv => {
        const partner = partners.find(p => p.id === inv.partnerId);
        if (partner) {
            data[partner.name] = (data[partner.name] || 0) + inv.totalAmount;
        }
    });
    return Object.entries(data).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [filteredInvoices, partners, selectedYear]);

  const partnerPaymentStatusData = useMemo(() => {
      const partnerData: { [key: string]: { name: string, total: number, paid: number, rejected: number, outstanding: number} } = {};

      filteredInvoices.forEach(invoice => {
          const partnerName = partners.find(p => p.id === invoice.partnerId)?.name || 'Inconnu';
          if (!partnerData[partnerName]) {
              partnerData[partnerName] = { name: partnerName, total: 0, paid: 0, rejected: 0, outstanding: 0 };
          }
          const paid = invoice.payments.reduce((sum: number, p) => sum + p.amount, 0);
          const rejected = invoice.rejections.reduce((sum: number, r) => sum + r.amount, 0);
          
          partnerData[partnerName].total += invoice.totalAmount;
          partnerData[partnerName].paid += paid;
          partnerData[partnerName].rejected += rejected;
          partnerData[partnerName].outstanding += invoice.totalAmount - paid - rejected;
      });
      return Object.values(partnerData).filter(p => p.total > 0).map(p => ({
          ...p,
          paidPercent: (p.paid / p.total) * 100,
          rejectedPercent: (p.rejected / p.total) * 100,
          outstandingPercent: (p.outstanding / p.total) * 100,
      }));
  }, [filteredInvoices, partners, selectedYear]);

  // Nouveau : données pour barres empilées par statut/mois
  const stackedBarData = useMemo(() => {
    const monthly: Record<number, {month: string, facturé: number, payé: number, rejeté: number, enAttente: number}> = {};
    filteredInvoices.forEach(inv => {
      const m = new Date(inv.depositDate).getMonth();
      if (!monthly[m]) monthly[m] = {month: ["Janv.", "Févr.", "Mars", "Avril", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."][m], facturé:0, payé:0, rejeté:0, enAttente:0};
      monthly[m].facturé += inv.totalAmount;
      const paid = inv.payments.reduce((s: number, p) => s + p.amount, 0);
      const rejected = inv.rejections.reduce((s: number, r) => s + r.amount, 0);
      monthly[m].payé += paid;
      monthly[m].rejeté += rejected;
      monthly[m].enAttente += inv.totalAmount - paid - rejected;
    });
    return Object.values(monthly);
  }, [filteredInvoices, selectedYear]);


  const PIE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#8b5cf6'];

  const partnerMap = useMemo(() => new Map(partners.map(p => [p.id, p.name])), [partners]);

  const filteredInvoicesForYear = useMemo(() => {
    return filteredInvoices
        .sort((a, b) => new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime());
  }, [filteredInvoices, selectedYear]);

  const RevenueDetailsModalContent = () => (
    <table className="w-full text-left">
        <thead className="bg-slate-50 border-b">
            <tr>
                <th className="p-3 text-sm font-semibold text-slate-600">Partenaire</th>
                <th className="p-3 text-sm font-semibold text-slate-600">Mois Facture</th>
                <th className="p-3 text-sm font-semibold text-slate-600">Date Dépôt</th>
                <th className="p-3 text-sm font-semibold text-slate-600 text-right">Montant</th>
            </tr>
        </thead>
        <tbody>
            {filteredInvoicesForYear.map(inv => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="p-3 font-medium">{partnerMap.get(inv.partnerId) || inv.partnerId}</td>
                    <td className="p-3 text-slate-600">{inv.invoiceMonth}</td>
                    <td className="p-3 text-slate-600">{formatDate(inv.depositDate)}</td>
                    <td className="p-3 text-slate-600 text-right font-mono">{formatCurrency(inv.totalAmount)}</td>
                </tr>
            ))}
        </tbody>
    </table>
  );

  const DistributionDetailsModalContent = () => (
      <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
              <tr>
                  <th className="p-3 text-sm font-semibold text-slate-600">Partenaire</th>
                  <th className="p-3 text-sm font-semibold text-slate-600 text-right">Chiffre d'affaires</th>
              </tr>
          </thead>
          <tbody>
              {[...partnerRevenueData].sort((a, b) => b.value - a.value).map(p => (
                  <tr key={p.name} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-slate-600 text-right font-mono">{formatCurrency(p.value)}</td>
                  </tr>
              ))}
          </tbody>
      </table>
  );

  const StatusDetailsModalContent = () => (
      <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
              <tr>
                  <th className="p-3 text-sm font-semibold text-slate-600">Partenaire</th>
                  <th className="p-3 text-sm font-semibold text-slate-600 text-right">Total Facturé</th>
                  <th className="p-3 text-sm font-semibold text-slate-600 text-right">Payé</th>
                  <th className="p-3 text-sm font-semibold text-slate-600 text-right">En attente</th>
                  <th className="p-3 text-sm font-semibold text-slate-600 text-right">Rejeté</th>
              </tr>
          </thead>
          <tbody>
              {[...partnerPaymentStatusData].sort((a,b) => b.total - a.total).map(p => (
                  <tr key={p.name} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-slate-600 text-right font-mono">{formatCurrency(p.total)}</td>
                      <td className="p-3 text-green-600 text-right font-mono">{formatCurrency(p.paid)}</td>
                      <td className="p-3 text-orange-600 text-right font-mono">{formatCurrency(p.outstanding)}</td>
                      <td className="p-3 text-red-600 text-right font-mono">{formatCurrency(p.rejected)}</td>
                  </tr>
              ))}
          </tbody>
      </table>
  );

  const exportDashboardData = (format: 'csv' | 'excel') => {
    const headers = ['Partenaire', 'Mois', 'Date dépôt', 'Montant', 'Payé', 'Rejeté', 'Reste à régler', 'Statut'];
    const rows = filteredInvoicesForYear.map(inv => {
      const partner = partnerMap.get(inv.partnerId) || inv.partnerId;
      const paid = inv.payments.reduce((sum: number, p) => sum + p.amount, 0);
      const rejected = inv.rejections.reduce((sum: number, r) => sum + r.amount, 0);
      const outstanding = inv.totalAmount - paid - rejected;
      let statut = 'En attente';
      if (outstanding <= 0) statut = 'Payée';
      if (inv.rejections && inv.rejections.length > 0) statut = 'Rejetée';
      return [
        partner,
        inv.invoiceMonth,
        formatDate(inv.depositDate),
        inv.totalAmount,
        paid,
        rejected,
        outstanding,
        statut
      ];
    });
    let content = '';
    if (format === 'csv') {
      content = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, 'dashboard.csv');
    } else {
      // Excel: simple xlsx (compatible) via tabulation
      content = [headers, ...rows].map(row => row.join('\t')).join('\n');
      const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
      saveAs(blob, 'dashboard.xls');
    }
  };

  const prevStats = useMemo(() => getPreviousYearStats(invoices, selectedYear), [invoices, selectedYear]);

  // Tooltip personnalisé pour BarChart (évolution mensuelle)
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded shadow-lg border text-sm min-w-[180px]">
          <div className="font-bold mb-1">{label}</div>
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex justify-between items-center mb-1">
              <span className="inline-flex items-center">
                <span className="w-2 h-2 rounded-full mr-2" style={{background: entry.color}}></span>
                {entry.name}
              </span>
              <span className="font-mono">{formatCurrency(entry.value)}</span>
            </div>
          ))}
          <div className="mt-1 text-xs text-slate-500">Cliquez sur une barre pour filtrer par mois</div>
        </div>
      );
    }
    return null;
  };

  // Tooltip personnalisé pour PieChart (répartition partenaires)
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const percent = entry.payload && entry.payload.value && entry.payload.payload && entry.payload.payload.total
        ? ((entry.payload.value / entry.payload.payload.total) * 100).toFixed(1) : null;
      return (
        <div className="bg-white p-3 rounded shadow-lg border text-sm min-w-[180px]">
          <div className="font-bold mb-1">{entry.name}</div>
          <div className="flex justify-between items-center mb-1">
            <span>Chiffre d'affaires</span>
            <span className="font-mono">{formatCurrency(entry.value)}</span>
          </div>
          {percent && <div className="text-xs text-slate-500">{percent}% du total</div>}
          <div className="mt-1 text-xs text-slate-500">Cliquez sur une part pour filtrer par partenaire</div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div></div>;
  }
  
  return (
    <div className="p-4 sm:p-8 bg-slate-100">
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <h1 className="text-3xl font-bold text-slate-800 mr-8">Tableau de bord</h1>
        {availableYears.length > 0 && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            aria-label="Sélectionner une année"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        )}
          <select
            value={filterPartner}
            onChange={e => setFilterPartner(e.target.value)}
            className="p-2 border border-slate-300 rounded-md shadow-sm bg-white"
            aria-label="Filtrer par partenaire"
          >
            <option value="">Tous les partenaires</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="p-2 border border-slate-300 rounded-md shadow-sm bg-white"
            aria-label="Filtrer par type"
          >
            <option value="">Tous types</option>
            <option value="Paiement">Avec paiements</option>
            <option value="Rejet">Avec rejets</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="p-2 border border-slate-300 rounded-md shadow-sm bg-white"
            aria-label="Filtrer par statut"
          >
            <option value="">Tous statuts</option>
            <option value="payé">Payé</option>
            <option value="enAttente">En attente</option>
            <option value="rejeté">Rejeté</option>
          </select>
          <select
            value={filterMonth !== null ? filterMonth : ''}
            onChange={e => setFilterMonth(e.target.value === '' ? null : Number(e.target.value))}
            className="p-2 border border-slate-300 rounded-md shadow-sm bg-white"
            aria-label="Filtrer par mois"
          >
            <option value="">Tous les mois</option>
            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={filterQuarter !== null ? filterQuarter : ''}
            onChange={e => setFilterQuarter(e.target.value === '' ? null : Number(e.target.value))}
            className="p-2 border border-slate-300 rounded-md shadow-sm bg-white"
            aria-label="Filtrer par trimestre"
          >
            <option value="">Tous les trimestres</option>
            <option value={0}>T1 (Janv.-Mars)</option>
            <option value={1}>T2 (Avr.-Juin)</option>
            <option value={2}>T3 (Juil.-Sept.)</option>
            <option value={3}>T4 (Oct.-Déc.)</option>
          </select>
          {(filterPartner || filterType || filterStatus || filterMonth !== null || filterQuarter !== null) && (
            <button
              className="ml-4 px-3 py-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-700"
              onClick={() => { setFilterPartner(''); setFilterType(''); setFilterStatus(''); setFilterMonth(null); setFilterQuarter(null); }}
              aria-label="Réinitialiser tous les filtres"
            >
              Voir tout
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportDashboardData('csv')} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" aria-label="Exporter CSV">Exporter ce que je vois (CSV)</button>
          <button onClick={() => exportDashboardData('excel')} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700" aria-label="Exporter Excel">Exporter ce que je vois (Excel)</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total facturé"
          value={formatCurrency(stats.totalInvoiced)}
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>}
          tooltip="Somme totale des factures émises pour l'année et les filtres sélectionnés."
          trend={<Trend current={stats.totalInvoiced} previous={prevStats.totalInvoiced} />}
        />
        <StatCard
          title="Total payé"
          value={formatCurrency(stats.totalPaid)}
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
          tooltip="Montant total payé sur les factures pour l'année et les filtres sélectionnés."
          trend={<Trend current={stats.totalPaid} previous={prevStats.totalPaid} />}
        />
        <StatCard
          title="Total rejeté"
          value={formatCurrency(stats.totalRejected)}
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>}
          tooltip="Montant total rejeté sur les factures pour l'année et les filtres sélectionnés."
          trend={<Trend current={stats.totalRejected} previous={prevStats.totalRejected} />}
        />
        <StatCard
          title="Reste à régler"
          value={formatCurrency(stats.outstanding)}
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}
          tooltip="Montant restant à régler sur les factures pour l'année et les filtres sélectionnés."
          trend={<Trend current={stats.outstanding} previous={prevStats.outstanding} />}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Évolution mensuelle par statut ({selectedYear}) <span className='ml-2 text-slate-400' title="Montants facturés, payés, rejetés et en attente par mois.">?</span></h2>
          <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500">Chargement des graphiques...</div>}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stackedBarData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" tick={{ fill: '#64748b' }} fontSize={12} />
                <YAxis tick={{ fill: '#64748b' }} fontSize={12} tickFormatter={(value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value as number)} />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend />
                <Bar dataKey="payé" stackId="a" fill="#10b981" name="Payé" onClick={(_, idx) => setFilterMonth(idx)} cursor="pointer" aria-label="Filtrer sur le mois" />
                <Bar dataKey="rejeté" stackId="a" fill="#ef4444" name="Rejeté" onClick={(_, idx) => setFilterMonth(idx)} cursor="pointer" aria-label="Filtrer sur le mois" />
                <Bar dataKey="enAttente" stackId="a" fill="#f59e0b" name="En attente" onClick={(_, idx) => setFilterMonth(idx)} cursor="pointer" aria-label="Filtrer sur le mois" />
              </BarChart>
            </ResponsiveContainer>
          </Suspense>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Top partenaires ({selectedYear}) <span className='ml-2 text-slate-400' title="Partenaires ayant généré le plus de chiffre d'affaires.">?</span></h2>
             {[...partnerRevenueData].sort((a, b) => b.value - a.value).slice(0, 5).length > 0 ? (
                <ul className="space-y-3">
              {[...partnerRevenueData].sort((a, b) => b.value - a.value).slice(0, 5).map(p => {
                const partnerObj = partners.find(pt => pt.name === p.name);
                return (
                        <li key={p.name} className="flex justify-between items-center">
                    <button
                      className="text-sm font-medium text-slate-700 hover:underline"
                      onClick={() => partnerObj && setFilterPartner(partnerObj.id)}
                      aria-label={`Filtrer sur le partenaire ${p.name}`}
                    >
                      {p.name}
                    </button>
                            <span className="text-sm font-semibold bg-slate-100 px-2 py-1 rounded">{formatCurrency(p.value)}</span>
                        </li>
                );
              })}
                </ul>
              ) : <div className="flex items-center justify-center h-full text-slate-500">Aucune donnée pour cette année.</div>}
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-lg font-semibold mb-4">Répartition par partenaire ({selectedYear}) <span className='ml-2 text-slate-400' title="Répartition du chiffre d'affaires par partenaire.">?</span></h2>
        <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500">Chargement des graphiques...</div>}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={partnerRevenueData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label
                onClick={(_, idx) => {
                  const entry = partnerRevenueData[idx];
                  if (entry) {
                    const partnerObj = partners.find(pt => pt.name === entry.name);
                    if (partnerObj) setFilterPartner(partnerObj.id);
                  }
                }}
                cursor="pointer"
                aria-label="Filtrer sur le partenaire"
              >
                {partnerRevenueData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Suspense>
      </div>

      <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500">Chargement de la modale...</div>}>
        <Modal
          isOpen={openModal === 'revenue'}
          onClose={() => setOpenModal(null)}
          title={`Détail du chiffre d'affaires pour ${selectedYear}`}
        >
          <RevenueDetailsModalContent />
        </Modal>
      </Suspense>
      <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500">Chargement de la modale...</div>}>
        <Modal
          isOpen={openModal === 'distribution'}
          onClose={() => setOpenModal(null)}
          title={`Détail de la répartition par partenaire (${selectedYear})`}
        >
          <DistributionDetailsModalContent />
        </Modal>
      </Suspense>
      <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500">Chargement de la modale...</div>}>
        <Modal
          isOpen={openModal === 'status'}
          onClose={() => setOpenModal(null)}
          title={`Détail de l'état des paiements par partenaire (${selectedYear})`}
        >
          <StatusDetailsModalContent />
        </Modal>
      </Suspense>
    </div>
  );
};

export default Dashboard;
