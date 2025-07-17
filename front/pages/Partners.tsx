
import React, { useState, useEffect, useMemo } from 'react';
import { getInvoices, getProviders } from '../services/api';
import { Invoice, Partner, User } from '../types';

const formatCurrency = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;

interface PartnersProps {
    user: User;
}

const Partners: React.FC<PartnersProps> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [invoicesData, partnersData] = await Promise.all([
        getInvoices(),
        getProviders()
      ]);
      setInvoices(invoicesData);
      setPartners(partnersData);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const partnerStats = useMemo(() => {
    const statsMap = new Map<string, { totalInvoiced: number; totalPaid: number; totalRejected: number; outstanding: number }>();

    invoices.forEach(invoice => {
      let stats = statsMap.get(invoice.partnerId);
      if (!stats) {
        stats = { totalInvoiced: 0, totalPaid: 0, totalRejected: 0, outstanding: 0 };
      }
      const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const rejected = invoice.rejections.reduce((sum, r) => sum + r.amount, 0);

      stats.totalInvoiced += invoice.totalAmount;
      stats.totalPaid += paid;
      stats.totalRejected += rejected;
      
      statsMap.set(invoice.partnerId, stats);
    });

    statsMap.forEach((stats) => {
        stats.outstanding = stats.totalInvoiced - stats.totalPaid - stats.totalRejected;
    });

    return partners.map(partner => ({
        ...partner,
        stats: statsMap.get(partner.id) || { totalInvoiced: 0, totalPaid: 0, totalRejected: 0, outstanding: 0 }
    })).filter(p => p.stats.totalInvoiced > 0); // Only show partners with invoices for the current user
  }, [invoices, partners]);
  
  const filteredPartners = useMemo(() => {
      return partnerStats.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [partnerStats, searchTerm]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div></div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Gestion des Partenaires</h1>
      
      <div className="mb-6">
        <input
          type="text"
          placeholder="Rechercher un partenaire..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-sm p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-600">Partenaire</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Total Facturé</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Total Payé</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Total Rejeté</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Reste à Régler</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4 text-slate-600 text-right font-mono">{formatCurrency(p.stats.totalInvoiced)}</td>
                  <td className="p-4 text-green-600 text-right font-mono">{formatCurrency(p.stats.totalPaid)}</td>
                  <td className="p-4 text-red-600 text-right font-mono">{formatCurrency(p.stats.totalRejected)}</td>
                  <td className="p-4 text-orange-600 text-right font-mono">{formatCurrency(p.stats.outstanding)}</td>
                </tr>
              ))}
               {filteredPartners.length === 0 && (
                <tr>
                    <td colSpan={5} className="text-center p-8 text-slate-500">
                      {searchTerm ? 'Aucun partenaire ne correspond à votre recherche.' : 'Aucun partenaire avec des factures à afficher.'}
                    </td>
                </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Partners;
