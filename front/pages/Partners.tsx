
import React, { useState, useEffect, useMemo } from 'react';
import { getInvoices, getCompanies, getBrokers } from '../services/api';
import { Invoice, Company, Broker, User } from '../types';
import { Eye } from 'lucide-react';

const formatCurrency = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;

interface PartnersProps {
    user: User;
}

interface PartnerDetail {
    id: number;
    name: string;
    type: 'Compagnie' | 'Courtier';
    totalInvoiced: number;
    totalPaid: number;
    totalRejected: number;
    outstanding: number;
}

const Partners: React.FC<PartnersProps> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<PartnerDetail | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOnlyWithInvoices, setShowOnlyWithInvoices] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
      const [invoicesData, companiesData, brokersData] = await Promise.all([
        getInvoices(),
        getCompanies(),
        getBrokers()
      ]);
        
      setInvoices(invoicesData);
      setCompanies(companiesData);
      setBrokers(brokersData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
      setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const partnerStats = useMemo(() => {
    const partners: PartnerDetail[] = [];
    
    // Ajouter les compagnies
    if (Array.isArray(companies)) {
      companies.forEach(company => {
        if (company && company.id && company.name) {
          partners.push({
            id: company.id,
            name: company.name,
            type: 'Compagnie',
            totalInvoiced: 0,
            totalPaid: 0,
            totalRejected: 0,
            outstanding: 0
          });
        }
      });
    }
    
    // Ajouter les courtiers
    if (Array.isArray(brokers)) {
      brokers.forEach(broker => {
        if (broker && broker.id && broker.name) {
          partners.push({
            id: broker.id,
            name: broker.name,
            type: 'Courtier',
            totalInvoiced: 0,
            totalPaid: 0,
            totalRejected: 0,
            outstanding: 0
          });
        }
      });
    }

    // Créer une Map pour les calculs
    const statsMap = new Map<number, PartnerDetail>();
    partners.forEach(partner => {
      statsMap.set(partner.id, partner);
    });

    // Calculer les statistiques pour chaque partenaire
    if (Array.isArray(invoices)) {
    invoices.forEach(invoice => {
        if (!invoice || !invoice.id) return;
        
        const invoiceAmount = Number(invoice.billed_amount) || 0;
        
        // Factures où le partenaire est la compagnie
        if (invoice.company?.id) {
          const companyPartner = partners.find(p => p.id === invoice.company!.id && p.type === 'Compagnie');
          if (companyPartner) {
            const paid = Array.isArray(invoice.payments) ? invoice.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) : 0;
            const rejected = Array.isArray(invoice.rejections) ? invoice.rejections.reduce((sum, r) => sum + Number(r.amount || 0), 0) : 0;
            companyPartner.totalInvoiced += invoiceAmount;
            companyPartner.totalPaid += paid;
            companyPartner.totalRejected += rejected;
          }
        }
        
        // Factures où le partenaire est le courtier
        if (invoice.broker?.id) {
          const brokerPartner = partners.find(p => p.id === invoice.broker!.id && p.type === 'Courtier');
          if (brokerPartner) {
            const paid = Array.isArray(invoice.payments) ? invoice.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) : 0;
            const rejected = Array.isArray(invoice.rejections) ? invoice.rejections.reduce((sum, r) => sum + Number(r.amount || 0), 0) : 0;
            brokerPartner.totalInvoiced += invoiceAmount;
            brokerPartner.totalPaid += paid;
            brokerPartner.totalRejected += rejected;
          }
      }
    });
    }

    // Calculer le reste à régler
    partners.forEach((partner) => {
      partner.outstanding = partner.totalInvoiced - partner.totalPaid - partner.totalRejected;
    });

    // Par défaut, afficher tous les partenaires, même ceux sans factures
    let result = partners;
    
    // Si l'option est cochée, filtrer seulement ceux avec des factures
    if (showOnlyWithInvoices) {
      result = partners.filter(p => p.totalInvoiced > 0);
    }
    
    return result;
  }, [invoices, companies, brokers, showOnlyWithInvoices]);
  
  const filteredPartners = useMemo(() => {
      return partnerStats.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [partnerStats, searchTerm, showOnlyWithInvoices]);

  const handleShowDetails = (partner: PartnerDetail) => {
    setSelectedPartner(partner);
    setShowDetails(true);
  };

  const getPartnerInvoices = (partnerId: number, partnerType: 'Compagnie' | 'Courtier') => {
    return invoices.filter(invoice => {
      if (partnerType === 'Compagnie') {
        return invoice.company?.id === partnerId;
      } else {
        return invoice.broker?.id === partnerId;
      }
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div></div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Gestion des Partenaires</h1>
      
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <input
          type="text"
          placeholder="Rechercher un partenaire..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-sm p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showOnlyWithInvoices}
            onChange={(e) => setShowOnlyWithInvoices(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Afficher seulement les partenaires avec des factures
        </label>
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
                <th className="p-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-medium">{p.name} <span className="text-xs text-slate-500">({p.type})</span></td>
                  <td className="p-4 text-slate-600 text-right font-mono">{formatCurrency(p.totalInvoiced)}</td>
                  <td className="p-4 text-green-600 text-right font-mono">{formatCurrency(p.totalPaid)}</td>
                  <td className="p-4 text-red-600 text-right font-mono">{formatCurrency(p.totalRejected)}</td>
                  <td className="p-4 text-orange-600 text-right font-mono">{formatCurrency(p.outstanding)}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleShowDetails(p)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
               {filteredPartners.length === 0 && (
                <tr>
                    <td colSpan={6} className="text-center p-8 text-slate-500">
                      {searchTerm ? 'Aucun partenaire ne correspond à votre recherche.' : 
                       showOnlyWithInvoices ? 'Aucun partenaire avec des factures à afficher.' : 
                       'Aucun partenaire trouvé. Vérifiez que des compagnies et courtiers existent dans le système.'}
                    </td>
                </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de détails */}
      {showDetails && selectedPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-slate-800">
                Détails de {selectedPartner.name} ({selectedPartner.type})
              </h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-slate-600">Total Facturé</div>
                  <div className="text-xl font-bold text-slate-800">{formatCurrency(selectedPartner.totalInvoiced)}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600">Total Payé</div>
                  <div className="text-xl font-bold text-green-800">{formatCurrency(selectedPartner.totalPaid)}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-red-600">Total Rejeté</div>
                  <div className="text-xl font-bold text-red-800">{formatCurrency(selectedPartner.totalRejected)}</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-sm text-orange-600">Reste à Régler</div>
                  <div className="text-xl font-bold text-orange-800">{formatCurrency(selectedPartner.outstanding)}</div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mb-4">Factures</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-3 text-sm font-semibold text-slate-600">Numéro</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Prestataire</th>
                      {selectedPartner.type === 'Courtier' && (
                        <th className="p-3 text-sm font-semibold text-slate-600">Compagnie</th>
                      )}
                      {selectedPartner.type === 'Compagnie' && (
                        <th className="p-3 text-sm font-semibold text-slate-600">Courtier</th>
                      )}
                      <th className="p-3 text-sm font-semibold text-slate-600">Date Dépôt</th>
                      <th className="p-3 text-sm font-semibold text-slate-600 text-right">Montant</th>
                      <th className="p-3 text-sm font-semibold text-slate-600 text-right">Payé</th>
                      <th className="p-3 text-sm font-semibold text-slate-600 text-right">Rejeté</th>
                      <th className="p-3 text-sm font-semibold text-slate-600 text-right">Reste</th>
                      <th className="p-3 text-sm font-semibold text-slate-600 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                                         {getPartnerInvoices(selectedPartner.id, selectedPartner.type).map(invoice => {
                       const totalPaid = invoice.payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
                       const totalRejected = invoice.rejections?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;
                       const remaining = Number(invoice.billed_amount) - totalPaid - totalRejected;
                      
                      return (
                        <tr key={invoice.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-medium">{invoice.invoice_number}</td>
                          <td className="p-3">{invoice.provider?.name || 'N/A'}</td>
                          {selectedPartner.type === 'Courtier' && (
                            <td className="p-3">{invoice.company?.name || 'N/A'}</td>
                          )}
                          {selectedPartner.type === 'Compagnie' && (
                            <td className="p-3">{invoice.broker?.name || 'N/A'}</td>
                          )}
                          <td className="p-3">{invoice.deposit_date}</td>
                          <td className="p-3 text-right font-mono">{formatCurrency(invoice.billed_amount)}</td>
                          <td className="p-3 text-right font-mono text-green-600">{formatCurrency(totalPaid)}</td>
                          <td className="p-3 text-right font-mono text-red-600">{formatCurrency(totalRejected)}</td>
                          <td className="p-3 text-right font-mono text-orange-600">{formatCurrency(remaining)}</td>
                                                     <td className="p-3 text-center">
                             <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                               invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                               invoice.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                               invoice.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                               'bg-slate-100 text-slate-800'
                             }`}>
                               {invoice.status}
                             </span>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Partners;
