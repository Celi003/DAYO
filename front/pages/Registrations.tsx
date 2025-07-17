
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { addInvoice, getInvoices, getProviders, getUsers, exportInvoices, importInvoices, downloadImportTemplate } from '../services/api';
import { Invoice, Partner, User } from '../types';
import { GoogleGenAI } from "@google/genai";
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import * as api from '../services/api';
import { useNotification } from '../components/NotificationContext';
import { useApi } from '../services/api';

const formatCurrency = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getInvoiceStatus = (invoice: Invoice): { text: string; color: string } => {
    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const totalRejected = invoice.rejections.reduce((sum, r) => sum + r.amount, 0);
    const outstanding = invoice.totalAmount - totalPaid - totalRejected;

    if (outstanding <= 0 && invoice.totalAmount > 0) {
        if (totalPaid >= invoice.totalAmount) return { text: 'Payé', color: 'green' };
        return { text: 'Rejeté', color: 'red' };
    }
    if (totalPaid > 0 || totalRejected > 0) {
        return { text: 'Partiel', color: 'orange' };
    }
    return { text: 'En attente', color: 'blue' };
};

const InvoiceStatusBadge: React.FC<{ status: { text: string; color: string } }> = ({ status }) => {
    const colorClasses: { [key: string]: string } = {
        green: 'bg-green-100 text-green-800',
        orange: 'bg-orange-100 text-orange-800',
        blue: 'bg-blue-100 text-blue-800',
        red: 'bg-red-100 text-red-800',
    };
    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClasses[status.color]}`}>
            {status.text}
        </span>
    );
};


const AddInvoiceForm: React.FC<{ partners: Partner[], onAddInvoice: (invoice: Invoice) => void, user: User }> = ({ partners, onAddInvoice, user }) => {
  const [partnerId, setPartnerId] = useState('');
  const [invoiceMonth, setInvoiceMonth] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key:string]:string}>({});
  const { notify } = useNotification();
  const { call } = useApi();

  const validate = () => {
    const errs: {[key:string]:string} = {};
    if (!partnerId) errs.partnerId = 'Partenaire requis';
    if (!invoiceMonth) errs.invoiceMonth = 'Mois requis';
    if (!depositDate) errs.depositDate = 'Date requise';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) errs.amount = 'Montant valide requis';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const newInvoice = await call(() => addInvoice({
        partnerId,
        invoiceMonth,
        depositDate,
        totalAmount: parseFloat(amount)
      }, user.id), 'Facture ajoutée');
      if (newInvoice) {
      onAddInvoice(newInvoice);
      setPartnerId('');
      setInvoiceMonth('');
      setDepositDate('');
      setAmount('');
        setErrors({});
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1);
    return d.toLocaleString('fr-FR', { month: 'long' }) + ` ${new Date().getFullYear()}`;
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
      <h2 className="text-xl font-bold mb-4">Ajouter une facture</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div>
          <label htmlFor="partner" className="block text-sm font-medium text-slate-700 mb-1">Partenaire</label>
          <select id="partner" value={partnerId} onChange={e => setPartnerId(e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="">Choisir...</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.partnerId && <p className="text-red-500 text-xs mt-1">{errors.partnerId}</p>}
        </div>
        <div>
          <label htmlFor="invoiceMonth" className="block text-sm font-medium text-slate-700 mb-1">Mois de la facture</label>
          <select id="invoiceMonth" value={invoiceMonth} onChange={e => setInvoiceMonth(e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="">Choisir...</option>
            {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {errors.invoiceMonth && <p className="text-red-500 text-xs mt-1">{errors.invoiceMonth}</p>}
        </div>
        <div>
          <label htmlFor="depositDate" className="block text-sm font-medium text-slate-700 mb-1">Date de dépôt</label>
          <input type="date" id="depositDate" value={depositDate} onChange={e => setDepositDate(e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          {errors.depositDate && <p className="text-red-500 text-xs mt-1">{errors.depositDate}</p>}
        </div>
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">Montant</label>
          <input type="number" id="amount" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
        </div>
        <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400">
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
};

const ReminderModal: React.FC<{ invoice: Invoice; partner: Partner; onClose: () => void }> = ({ invoice, partner, onClose }) => {
  const [letter, setLetter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { notify } = useNotification();

  const generateLetter = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      if (!process.env.API_KEY) {
        setLetter("La fonctionnalité de génération de lettre est désactivée car la clé API n'est pas configurée.");
        setIsLoading(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const amountRejected = invoice.rejections.reduce((sum, r) => sum + r.amount, 0);
      const outstandingAmount = invoice.totalAmount - amountPaid - amountRejected;

      const prompt = `
        Tu es un assistant expert en comptabilité et communication professionnelle. Ta tâche est de rédiger une lettre de relance formelle et polie en français.

        Voici les détails de la facture :
        - Nom du partenaire : ${partner.name}
        - Mois de la facture : ${invoice.invoiceMonth}
        - Montant total de la facture : ${invoice.totalAmount.toLocaleString('fr-FR')} FCFA
        - Montant déjà payé : ${amountPaid.toLocaleString('fr-FR')} FCFA
        - Montant rejeté : ${amountRejected.toLocaleString('fr-FR')} FCFA
        - Reste à régler : ${outstandingAmount.toLocaleString('fr-FR')} FCFA

        Instructions pour la lettre :
        1.  Utilise un ton professionnel, respectueux mais ferme.
        2.  Mentionne clairement le mois de la facture concernée.
        3.  Récapitule les montants (total, payé, rejeté, reste à régler).
        4.  Demande la régularisation du montant restant dû dans les plus brefs délais.
        5.  S'il y a un montant rejeté, demande des clarifications sur les raisons du rejet.
        6.  Termine par une formule de politesse standard.
        7.  Ne génère que le corps de la lettre, sans l'en-tête (adresse, date, etc.). Commence par "Objet : ...".
        8.  La lettre doit être concise et aller droit au but.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      setLetter(response.text);
    } catch (e) {
      console.error(e);
      setError("Une erreur est survenue lors de la génération de la lettre. Vérifiez la configuration de l'API.");
    } finally {
      setIsLoading(false);
    }
  }, [invoice, partner]);

  useEffect(() => {
    generateLetter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(letter);
    notify("Lettre copiée dans le presse-papiers !", 'success');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-xl font-bold mb-4">Générer une lettre de relance</h2>
        <div className="flex-grow overflow-y-auto border p-4 rounded-md bg-slate-50 min-h-[200px]">
          {isLoading && <p>Génération en cours...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && <pre className="whitespace-pre-wrap font-sans text-sm">{letter}</pre>}
        </div>
        <div className="mt-6 flex justify-end space-x-4">
          <button onClick={copyToClipboard} disabled={isLoading || !!error} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-400">Copier</button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Fermer</button>
        </div>
      </div>
    </div>
  );
};

interface RegistrationsProps {
    user: User;
}

const InvoiceTable: React.FC<{invoices: Invoice[], partners: Partner[], user: User, userMap: Map<string,string>, onDetails: (inv: Invoice) => void, onReminder: (inv: Invoice) => void, loading: boolean,
    search: string, setSearch: (search: string) => void,
    filterPartner: string, setFilterPartner: (partner: string) => void,
    filterStatus: string, setFilterStatus: (status: string) => void,
    filterDateMin: string, setFilterDateMin: (date: string) => void,
    filterDateMax: string, setFilterDateMax: (date: string) => void,
    filterAmountMin: string, setFilterAmountMin: (amount: string) => void,
    filterAmountMax: string, setFilterAmountMax: (amount: string) => void}> = ({invoices, partners, user, userMap, onDetails, onReminder, loading,
    search, setSearch,
    filterPartner, setFilterPartner,
    filterStatus, setFilterStatus,
    filterDateMin, setFilterDateMin,
    filterDateMax, setFilterDateMax,
    filterAmountMin, setFilterAmountMin,
    filterAmountMax, setFilterAmountMax}) => {
  const filtered = useMemo(() => invoices.filter(inv => {
    const partnerMatch = !filterPartner || inv.partnerId === filterPartner;
    const status = getInvoiceStatus(inv).text;
    const statusMatch = !filterStatus || status === filterStatus;
    const date = inv.depositDate;
    const dateMinMatch = !filterDateMin || date >= filterDateMin;
    const dateMaxMatch = !filterDateMax || date <= filterDateMax;
    const amountMinMatch = !filterAmountMin || inv.totalAmount >= Number(filterAmountMin);
    const amountMaxMatch = !filterAmountMax || inv.totalAmount <= Number(filterAmountMax);
    const searchMatch = !search || Object.values(inv).some(v => v && v.toString().toLowerCase().includes(search.toLowerCase()));
    return partnerMatch && statusMatch && dateMinMatch && dateMaxMatch && amountMinMatch && amountMaxMatch && searchMatch;
  }), [invoices, filterPartner, filterStatus, filterDateMin, filterDateMax, filterAmountMin, filterAmountMax, search]);

  const sorted = [...filtered].sort((a,b)=>{
    if(a.id===b.id) return 0;
    if(a.id==null) return 1;
    if(b.id==null) return -1;
    return (a.id.toString().localeCompare(b.id.toString(),undefined,{numeric:true})) * 1;
  });
  const totalPages = Math.ceil(sorted.length/10)||1;
  const paged = sorted.slice(0, 10);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2 items-center bg-slate-50 p-2 rounded">
        <input placeholder="Recherche..." value={search} onChange={e=>{setSearch(e.target.value);}} className="border p-1" />
        <select value={filterPartner} onChange={e=>setFilterPartner(e.target.value)} className="border p-1">
          <option value="">Tous les partenaires</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border p-1">
          <option value="">Tous statuts</option>
          <option value="Payé">Payé</option>
          <option value="Rejeté">Rejeté</option>
          <option value="Partiel">Partiel</option>
          <option value="En attente">En attente</option>
        </select>
        <input type="date" value={filterDateMin} onChange={e=>setFilterDateMin(e.target.value)} className="border p-1" placeholder="Date min" />
        <input type="date" value={filterDateMax} onChange={e=>setFilterDateMax(e.target.value)} className="border p-1" placeholder="Date max" />
        <input type="number" value={filterAmountMin} onChange={e=>setFilterAmountMin(e.target.value)} className="border p-1" placeholder="Montant min" />
        <input type="number" value={filterAmountMax} onChange={e=>setFilterAmountMax(e.target.value)} className="border p-1" placeholder="Montant max" />
        {(filterPartner || filterStatus || filterDateMin || filterDateMax || filterAmountMin || filterAmountMax) && (
          <button onClick={()=>{setFilterPartner('');setFilterStatus('');setFilterDateMin('');setFilterDateMax('');setFilterAmountMin('');setFilterAmountMax('');}} className="ml-2 px-2 py-1 bg-slate-200 rounded">Réinitialiser</button>
        )}
        <span className="text-sm text-slate-500 ml-2">{sorted.length} résultat(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="cursor-pointer" onClick={()=>{}}>ID</th>
              <th className="cursor-pointer" onClick={()=>{}}>Partenaire</th>
              <th className="cursor-pointer" onClick={()=>{}}>Date dépôt</th>
              <th className="cursor-pointer" onClick={()=>{}}>Mois</th>
              <th className="cursor-pointer" onClick={()=>{}}>Montant</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(invoice => {
              const partner = partners.find(p => p.id === invoice.partnerId);
              const status = getInvoiceStatus(invoice);
              const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
              const totalRejected = invoice.rejections.reduce((sum, r) => sum + r.amount, 0);
              const outstanding = invoice.totalAmount - totalPaid - totalRejected;
              const providerName = userMap.get(invoice.userId) || 'Inconnu';
              return (
                <tr key={invoice.id}>
                  <td>{invoice.id}</td>
                  <td>{partner?.name || invoice.partnerId}</td>
                  <td>{formatDate(invoice.depositDate)}</td>
                  <td>{invoice.invoiceMonth}</td>
                  <td>{invoice.totalAmount}</td>
                  <td>{status.text}</td>
                  <td>
                    <button onClick={()=>onDetails(invoice)} className="text-xs bg-slate-100 text-slate-600 font-semibold py-1 px-3 rounded-full hover:bg-slate-200">Détails</button>
                    {user.role === 'provider' && (
                      <button onClick={()=>onReminder(invoice)} className="text-xs bg-orange-100 text-orange-600 font-semibold py-1 px-3 rounded-full hover:bg-orange-200 ml-2">Relance</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center p-8 text-slate-500">Aucune facture trouvée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-center my-2">
        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-2 py-1 border rounded disabled:opacity-50">Préc.</button>
        <span>Page {page} / {totalPages}</span>
        <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 border rounded disabled:opacity-50">Suiv.</button>
      </div>
    </div>
  );
};

const Registrations: React.FC<RegistrationsProps> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceForReminder, setInvoiceForReminder] = useState<Invoice | null>(null);
  const [invoiceForDetails, setInvoiceForDetails] = useState<Invoice | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const { notify } = useNotification();
  const { call } = useApi();
  // Filtres globaux
  const [search, setSearch] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateMin, setFilterDateMin] = useState('');
  const [filterDateMax, setFilterDateMax] = useState('');
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [invoicesData, partnersData, usersData] = await Promise.all([
        getInvoices(),
        getProviders(),
        user.role === 'admin' ? getUsers() : Promise.resolve([])
      ]);
      setInvoices(invoicesData.sort((a,b) => new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime()));
      setPartners(partnersData);
      if (user.role === 'admin') {
        setUserMap(new Map(usersData.map(u => [u.id, u.username])));
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleAddInvoice = (newInvoice: Invoice) => {
    setInvoices(prev => [newInvoice, ...prev].sort((a,b) => new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime()));
  };
  
  const partnerMap = new Map(partners.map(p => [p.id, p]));

  const handleUpdateInvoice = (updatedInvoice: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
    // Keep the details modal open with the updated data
    if (invoiceForDetails?.id === updatedInvoice.id) {
        setInvoiceForDetails(updatedInvoice);
    }
  };
  
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params: Record<string, string | number> = {};
      if (filterPartner) params.partner = filterPartner;
      if (filterStatus) params.status = filterStatus;
      if (filterDateMin) params.date_min = filterDateMin;
      if (filterDateMax) params.date_max = filterDateMax;
      if (filterAmountMin) params.amount_min = filterAmountMin;
      if (filterAmountMax) params.amount_max = filterAmountMax;
      if (search) params.search = search;
      const blob = await call(() => exportInvoices(format, params), 'Export réussi');
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'excel' ? 'factures.xlsx' : 'factures.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {}
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      await call(() => importInvoices(e.target.files[0]), 'Import réussi !');
      window.location.reload();
    } catch (e: any) {}
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await call(() => downloadImportTemplate(), 'Template téléchargé');
      if (!blob) return;
      const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
      link.href = url;
      link.download = 'template_import.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    } catch (e) {}
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Enregistrements</h1>
      <div className="flex gap-4 mb-4">
        <button onClick={() => handleExport('excel')} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 text-sm">Exporter Excel</button>
        <button onClick={() => handleExport('pdf')} className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-purple-700 text-sm">Exporter PDF</button>
        <button onClick={handleDownloadTemplate} className="bg-slate-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-slate-700 text-sm">Télécharger template import</button>
        <label className="bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 text-sm cursor-pointer">
          Importer Excel
          <input type="file" accept=".xlsx" onChange={handleImport} style={{ display: 'none' }} />
        </label>
      </div>
      {user.role === 'provider' && <AddInvoiceForm partners={partners} onAddInvoice={handleAddInvoice} user={user} />}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Liste des factures</h2>
        </div>
        <InvoiceTable
          invoices={invoices}
          partners={partners}
          user={user}
          userMap={userMap}
          onDetails={setInvoiceForDetails}
          onReminder={setInvoiceForReminder}
          loading={loading}
          // Filtres synchronisés
          search={search} setSearch={setSearch}
          filterPartner={filterPartner} setFilterPartner={setFilterPartner}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          filterDateMin={filterDateMin} setFilterDateMin={setFilterDateMin}
          filterDateMax={filterDateMax} setFilterDateMax={setFilterDateMax}
          filterAmountMin={filterAmountMin} setFilterAmountMin={setFilterAmountMin}
          filterAmountMax={filterAmountMax} setFilterAmountMax={setFilterAmountMax}
        />
      </div>
       {invoiceForReminder && partnerMap.get(invoiceForReminder.partnerId) && (
        <ReminderModal 
          invoice={invoiceForReminder} 
          partner={partnerMap.get(invoiceForReminder.partnerId)!} 
          onClose={() => setInvoiceForReminder(null)} 
        />
      )}
       {invoiceForDetails && partnerMap.get(invoiceForDetails.partnerId) && (
        <InvoiceDetailModal 
          invoice={invoiceForDetails} 
          partner={partnerMap.get(invoiceForDetails.partnerId)!} 
          onClose={() => setInvoiceForDetails(null)}
          onUpdate={handleUpdateInvoice}
        />
      )}
    </div>
  );
};

export default Registrations;
