
import React, { useState, useEffect, useMemo } from 'react';
import { getInvoices, getCompanies, getCompanys, exportInvoices } from '../services/api';
import { Invoice, Broker, Company, User } from '../types';
import { Eye, FileSpreadsheet, FileText } from 'lucide-react';
import saveAs from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;

interface PartnersProps {
    user: User;
}

interface PartnerDetail {
    id: number;
    name: string;
    type: 'Courtier' | 'Compagnie';
    totalInvoiced: number;
    totalPaid: number;
    totalRejected: number;
    outstanding: number;
}

const Partners: React.FC<PartnersProps> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Broker[]>([]);
  const [Companys, setCompanys] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<PartnerDetail | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOnlyWithInvoices, setShowOnlyWithInvoices] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
      const [invoicesData, companiesData, CompanysData] = await Promise.all([
        getInvoices(),
        getCompanies(),
        getCompanys()
      ]);
        
      setInvoices(invoicesData);
      setCompanies(companiesData);
      setCompanys(CompanysData);
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
    
    // Ajouter les Courtiers
    if (Array.isArray(companies)) {
      companies.forEach(Broker => {
        if (Broker && Broker.id && Broker.name) {
          partners.push({
            id: Broker.id,
            name: Broker.name,
            type: 'Courtier',
            totalInvoiced: 0,
            totalPaid: 0,
            totalRejected: 0,
            outstanding: 0
          });
        }
      });
    }
    
    // Ajouter les Compagnies
    if (Array.isArray(Companys)) {
      Companys.forEach(Company => {
        if (Company && Company.id && Company.name) {
          partners.push({
            id: Company.id,
            name: Company.name,
            type: 'Compagnie',
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
        
        // Factures où le partenaire est la Courtier
        if (invoice.Broker?.id) {
          const BrokerPartner = partners.find(p => p.id === invoice.Broker!.id && p.type === 'Courtier');
          if (BrokerPartner) {
            const paid = Array.isArray(invoice.payments) ? invoice.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) : 0;
            const rejected = Array.isArray(invoice.rejections) ? invoice.rejections.reduce((sum, r) => sum + Number(r.amount || 0), 0) : 0;
            BrokerPartner.totalInvoiced += invoiceAmount;
            BrokerPartner.totalPaid += paid;
            BrokerPartner.totalRejected += rejected;
          }
        }
        
        // Factures où le partenaire est le Compagnie
        if (invoice.Company?.id) {
          const CompanyPartner = partners.find(p => p.id === invoice.Company!.id && p.type === 'Compagnie');
          if (CompanyPartner) {
            const paid = Array.isArray(invoice.payments) ? invoice.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) : 0;
            const rejected = Array.isArray(invoice.rejections) ? invoice.rejections.reduce((sum, r) => sum + Number(r.amount || 0), 0) : 0;
            CompanyPartner.totalInvoiced += invoiceAmount;
            CompanyPartner.totalPaid += paid;
            CompanyPartner.totalRejected += rejected;
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
  }, [invoices, companies, Companys, showOnlyWithInvoices]);
  
  const filteredPartners = useMemo(() => {
      return partnerStats.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [partnerStats, searchTerm, showOnlyWithInvoices]);

  const handleShowDetails = (partner: PartnerDetail) => {
    setSelectedPartner(partner);
    setShowDetails(true);
  };

  const handleExportPartner = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!selectedPartner) return;
    const invoicesToExport = getPartnerInvoices(selectedPartner.id, selectedPartner.type);
    const headers = [
      'Numéro', 'Prestataire', 'Courtier', 'Compagnie', 'Date Dépôt', 'Mois', 'Montant', 'Payé', 'Rejeté', 'Reste', 'Statut'
    ];
    const rows = invoicesToExport.map((inv) => {
      const paid = inv.payments?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0;
      const rejected = inv.rejections?.reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
      const remaining = Number(inv.billed_amount) - paid - rejected;
      return [
        inv.invoice_number,
        inv.provider?.name || 'N/A',
        inv.Broker?.name || '',
        inv.Company?.name || '',
        inv.deposit_date || '',
        inv.invoice_month || '',
        Number(inv.billed_amount) || 0,
        paid,
        rejected,
        remaining,
        inv.status,
      ];
    });
    if (format === 'excel') {
      const content = [headers, ...rows].map((row) => row.join('\t')).join('\n');
      const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
      saveAs(blob, `partenaire_${selectedPartner.name}.xls`);
    } else if (format === 'csv') {
      const content = [headers, ...rows]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `partenaire_${selectedPartner.name}.csv`);
    } else if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text(`Détails - ${selectedPartner.name} (${selectedPartner.type})`, 14, 16);
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 22,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      doc.save(`partenaire_${selectedPartner.name}.pdf`);
    }
  };

  const getPartnerInvoices = (partnerId: number, partnerType: 'Courtier' | 'Compagnie') => {
    return invoices.filter(invoice => {
      if (partnerType === 'Courtier') {
        return invoice.Broker?.id === partnerId;
      } else {
        return invoice.Company?.id === partnerId;
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
                       'Aucun partenaire trouvé. Vérifiez que des Courtiers et Compagnies existent dans le système.'}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPartner('excel')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                  title="Exporter Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={() => handleExportPartner('csv')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                  title="Exporter CSV"
                >
                  <FileText className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={() => handleExportPartner('pdf')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                  title="Exporter PDF"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-slate-500 hover:text-slate-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
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
                      {selectedPartner.type === 'Compagnie' && (
                        <th className="p-3 text-sm font-semibold text-slate-600">Courtier</th>
                      )}
                      {selectedPartner.type === 'Courtier' && (
                        <th className="p-3 text-sm font-semibold text-slate-600">Compagnie</th>
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
                          {selectedPartner.type === 'Compagnie' && (
                            <td className="p-3">{invoice.Broker?.name || 'N/A'}</td>
                          )}
                          {selectedPartner.type === 'Courtier' && (
                            <td className="p-3">{invoice.Company?.name || 'N/A'}</td>
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
