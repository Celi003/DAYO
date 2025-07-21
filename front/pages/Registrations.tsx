
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { addInvoice, getInvoices, getCompanies, getBrokers, getProviders, getUsers, exportInvoices, importInvoices, downloadImportTemplate, generateReclamationLetter } from '../services/api';
import { Invoice, Company, Broker, User } from '../types';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import * as api from '../services/api';
import { useNotification } from '../components/NotificationContext';
import { useApi } from '../services/api';

const formatCurrency = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getInvoiceStatus = (invoice: Invoice): { text: string; color: string } => {
    const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const totalRejected = (invoice.rejections || []).reduce((sum, r) => sum + r.amount, 0);
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


const AddInvoiceForm: React.FC<{ companies: Company[], brokers: Broker[], providerId: string | null, onAddInvoice: (invoice: Invoice) => void, user: User }> = ({ companies, brokers, providerId, onAddInvoice, user }) => {
  const [companyId, setCompanyId] = useState('');
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key:string]:string}>({});
  const { notify } = useNotification();
  const { call } = useApi();

  const availableBrokers = useMemo(() => {
    if (!companyId) return [];
    return brokers.filter(b => b.companyId === companyId);
  }, [companyId, brokers]);

  const validate = () => {
    const errs: {[key:string]:string} = {};
    if (!companyId) errs.companyId = 'Compagnie requise';
    if (!invoiceMonth) errs.invoiceMonth = 'Mois requis';
    if (!depositDate) errs.depositDate = 'Date requise';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) errs.amount = 'Montant valide requis';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const parseMonthYearToDate = (label: string) => {
    const [mois, annee] = label.split(' ');
    const moisMap: Record<string, string> = {
      janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
      juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12'
    };
    const moisNum = moisMap[mois.toLowerCase()];
    return moisNum && annee ? `${annee}-${moisNum}-01` : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!providerId) {
      notify("Impossible de trouver votre compte prestataire. Contactez l'administrateur.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const invoiceNumber = `INV-${Date.now()}`;
      const payload: any = {
        provider_id: providerId,
        company_id: companyId,
        invoice_number: invoiceNumber,
        invoice_month: parseMonthYearToDate(invoiceMonth),
        billed_amount: parseFloat(amount),
        deposit_date: depositDate || undefined,
      };
      if (brokerId) payload.broker_id = brokerId;
      const newInvoice = await call(() => addInvoice(payload), 'Facture ajoutée');
      if (newInvoice) {
        onAddInvoice(newInvoice);
        setCompanyId('');
        setBrokerId(null);
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
          <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">Compagnie</label>
          <select id="company" value={companyId} onChange={e => setCompanyId(e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="">Choisir...</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.companyId && <p className="text-red-500 text-xs mt-1">{errors.companyId}</p>}
        </div>
        <div>
          <label htmlFor="broker" className="block text-sm font-medium text-slate-700 mb-1">Courtier (Optionnel)</label>
          <select id="broker" value={brokerId || ''} onChange={e => setBrokerId(e.target.value || null)} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" disabled={!companyId}>
            <option value="">Aucun</option>
            {availableBrokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
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
          <input type="date" id="depositDate" value={depositDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDepositDate((e.target.value || '') as string)} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
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

const ReminderModal: React.FC<{ invoice: Invoice; company: Company; broker?: Broker | null; onClose: () => void }> = ({ invoice, company, broker, onClose }) => {
  const [letter, setLetter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { notify } = useNotification();

  useEffect(() => {
    const fetchLetter = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await generateReclamationLetter(invoice.id);
        setLetter(data.letter);
      } catch (e: any) {
        setError(e.message || 'Erreur lors de la génération de la lettre.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLetter();
  }, [invoice]);

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

const InvoiceTable: React.FC<{invoices: Invoice[], companies: Company[], brokers: Broker[], user: User, userMap: Map<string,string>, onDetails: (inv: Invoice) => void, onReminder: (inv: Invoice) => void, loading: boolean,
    search: string, setSearch: (search: string) => void,
    filterCompany: string, setFilterCompany: (company: string) => void,
    filterStatus: string, setFilterStatus: (status: string) => void,
    filterDateMin: string, setFilterDateMin: (date: string) => void,
    filterDateMax: string, setFilterDateMax: (date: string) => void,
    filterAmountMin: string, setFilterAmountMin: (amount: string) => void,
    filterAmountMax: string, setFilterAmountMax: (amount: string) => void}> = ({invoices, companies, brokers, user, userMap, onDetails, onReminder, loading,
    search, setSearch,
    filterCompany, setFilterCompany,
    filterStatus, setFilterStatus,
    filterDateMin, setFilterDateMin,
    filterDateMax, setFilterDateMax,
    filterAmountMin, setFilterAmountMin,
    filterAmountMax, setFilterAmountMax}) => {
  const [page, setPage] = useState<number>(1);
  const filtered = useMemo(() => invoices.filter((inv: Invoice) => {
    const companyMatch = !filterCompany || inv.companyId === filterCompany;
    const status = getInvoiceStatus(inv).text;
    const statusMatch = !filterStatus || status === filterStatus;
    const date = inv.depositDate ? inv.depositDate : '';
    const dateMinMatch = !filterDateMin || date >= filterDateMin;
    const dateMaxMatch = !filterDateMax || date <= filterDateMax;
    const amountMinMatch = !filterAmountMin || inv.totalAmount >= Number(filterAmountMin);
    const amountMaxMatch = !filterAmountMax || inv.totalAmount <= Number(filterAmountMax);
    const searchMatch = !search || Object.values(inv).some(v => v && v.toString().toLowerCase().includes(search.toLowerCase()));
    return companyMatch && statusMatch && dateMinMatch && dateMaxMatch && amountMinMatch && amountMaxMatch && searchMatch;
  }), [invoices, filterCompany, filterStatus, filterDateMin, filterDateMax, filterAmountMin, filterAmountMax, search]);

  const sorted = [...filtered].sort((a: Invoice, b: Invoice) => {
    if(a.id===b.id) return 0;
    if(a.id==null) return 1;
    if(b.id==null) return -1;
    return (a.id.toString().localeCompare(b.id.toString(),undefined,{numeric:true})) * 1;
  });
  const totalPages = Math.ceil(sorted.length/10)||1;
  const paged = sorted.slice((page-1)*10, page*10);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2 items-center bg-slate-50 p-2 rounded">
        <input placeholder="Recherche..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} className="border p-1" />
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value as string)} className="border p-1">
          <option value="">Toutes les compagnies</option>
          {companies.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)} className="border p-1">
          <option value="">Tous statuts</option>
          <option value="Payé">Payé</option>
          <option value="Rejeté">Rejeté</option>
          <option value="Partiel">Partiel</option>
          <option value="En attente">En attente</option>
        </select>
        <input type="date" value={filterDateMin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterDateMin(e.target.value)} className="border p-1" placeholder="Date min" />
        <input type="date" value={filterDateMax} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterDateMax(e.target.value)} className="border p-1" placeholder="Date max" />
        <input type="number" value={filterAmountMin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterAmountMin(e.target.value)} className="border p-1" placeholder="Montant min" />
        <input type="number" value={filterAmountMax} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterAmountMax(e.target.value)} className="border p-1" placeholder="Montant max" />
        {(filterCompany || filterStatus || filterDateMin || filterDateMax || filterAmountMin || filterAmountMax) && (
          <button onClick={()=>{setFilterCompany('');setFilterStatus('');setFilterDateMin('');setFilterDateMax('');setFilterAmountMin('');setFilterAmountMax('');}} className="ml-2 px-2 py-1 bg-slate-200 rounded">Réinitialiser</button>
        )}
        <span className="text-sm text-slate-500 ml-2">{sorted.length} résultat(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="cursor-pointer" onClick={()=>{}}>ID</th>
              <th className="cursor-pointer" onClick={()=>{}}>Compagnie</th>
              <th className="cursor-pointer" onClick={()=>{}}>Courtier</th>
              <th className="cursor-pointer" onClick={()=>{}}>Date dépôt</th>
              <th className="cursor-pointer" onClick={()=>{}}>Mois</th>
              <th className="cursor-pointer" onClick={()=>{}}>Montant</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((invoice: Invoice) => {
              const company = companies.find((c: Company) => c.id === invoice.companyId);
              const broker = brokers.find((b: Broker) => b.id === invoice.brokerId);
              const status = getInvoiceStatus(invoice);
              const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
              const totalRejected = (invoice.rejections || []).reduce((sum, r) => sum + r.amount, 0);
              const outstanding = invoice.totalAmount - totalPaid - totalRejected;
              const providerName = userMap.get(invoice.providerId) || 'Inconnu';
              return (
                <tr key={invoice.id}>
                  <td>{invoice.id}</td>
                  <td>{company?.name || invoice.companyId}</td>
                  <td>{broker?.name || 'N/A'}</td>
                  <td>{formatDate(invoice.depositDate ? invoice.depositDate : '')}</td>
                  <td>{formatInvoiceMonth(invoice.invoiceMonth)}</td>
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
              <tr><td colSpan={8} className="text-center p-8 text-slate-500">Aucune facture trouvée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-center my-2">
        <button disabled={page<=1} onClick={()=>setPage(page-1)} className="px-2 py-1 border rounded disabled:opacity-50">Préc.</button>
        <span>Page {page} / {totalPages}</span>
        <button disabled={page>=totalPages} onClick={()=>setPage(page+1)} className="px-2 py-1 border rounded disabled:opacity-50">Suiv.</button>
      </div>
    </div>
  );
};

const Registrations: React.FC<RegistrationsProps> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceForReminder, setInvoiceForReminder] = useState<Invoice | null>(null);
  const [invoiceForDetails, setInvoiceForDetails] = useState<Invoice | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [providerId, setProviderId] = useState<string | null>(null);
  const { notify } = useNotification();
  const { call } = useApi();
  // Filtres globaux
  const [search, setSearch] = useState<string>('');
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateMin, setFilterDateMin] = useState<string>('');
  const [filterDateMax, setFilterDateMax] = useState<string>('');
  const [filterAmountMin, setFilterAmountMin] = useState<string>('');
  const [filterAmountMax, setFilterAmountMax] = useState<string>('');

  // Correction ultime pour le filtre compagnie
  const safeSetFilterCompany = (v: string | undefined) => setFilterCompany(v ?? '');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [invoicesData, companiesData, brokersData, providersData, usersData] = await Promise.all([
        getInvoices(),
        getCompanies(),
        getBrokers(),
        getProviders(),
        user.role === 'admin' ? getUsers() : Promise.resolve([])
      ]);
      setInvoices(invoicesData.sort((a: Invoice, b: Invoice) => new Date(b.depositDate ? b.depositDate : '').getTime() - new Date(a.depositDate ? a.depositDate : '').getTime()));
      setCompanies(companiesData);
      setBrokers(brokersData);
      // Trouver le provider lié à l'utilisateur connecté
      if (user.role === 'provider') {
        console.log('DEBUG providersData:', providersData);
        console.log('DEBUG user:', user);
        const found = providersData.find((p: any) => p.user?.id == user.id || p.user?.username == user.username);
        console.log('DEBUG provider trouvé:', found);
        setProviderId(found ? found.id : null);
      }
      if (user.role === 'admin') {
        setUserMap(new Map(usersData.map((u: User) => [u.id, u.username])));
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleAddInvoice = (newInvoice: Invoice) => {
    setInvoices((prev: Invoice[]) => [newInvoice, ...prev].sort((a: Invoice, b: Invoice) => new Date(b.depositDate ? b.depositDate : '').getTime() - new Date(a.depositDate ? a.depositDate : '').getTime()));
  };
  
  const companyMap = new Map(companies.map((c: Company) => [c.id, c]));
  const brokerMap = new Map(brokers.map((b: Broker) => [b.id, b]));

  const handleUpdateInvoice = async (updatedInvoice: Invoice) => {
    // Si la facture reçue n'a pas de payments/rejections, on refetch la liste complète
    if (!updatedInvoice.payments || !updatedInvoice.rejections) {
      const refreshed = await getInvoices();
      setInvoices(refreshed.sort((a: Invoice, b: Invoice) => new Date(b.depositDate ? b.depositDate : '').getTime() - new Date(a.depositDate ? a.depositDate : '').getTime()));
      // Met aussi à jour le détail si modal ouvert
      if (invoiceForDetails) {
        const found = refreshed.find((inv: Invoice) => inv.id === invoiceForDetails.id);
        if (found) setInvoiceForDetails(found);
      }
    } else {
      setInvoices((prev: Invoice[]) => prev.map((inv: Invoice) => inv.id === updatedInvoice.id ? updatedInvoice : inv));
      if (invoiceForDetails?.id === updatedInvoice.id) {
        setInvoiceForDetails(updatedInvoice);
      }
    }
  };
  
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params: Record<string, string | number> = {};
      if (filterCompany) params.company = filterCompany;
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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      await call(() => importInvoices(files[0]), 'Import réussi !');
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
      {user.role === 'provider' && <AddInvoiceForm companies={companies} brokers={brokers} providerId={providerId} onAddInvoice={handleAddInvoice} user={user} />}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Liste des factures</h2>
        </div>
        <InvoiceTable
          invoices={invoices}
          companies={companies}
          brokers={brokers}
          user={user}
          userMap={userMap}
          onDetails={setInvoiceForDetails}
          onReminder={setInvoiceForReminder}
          loading={loading}
          // Filtres synchronisés
          search={search} setSearch={setSearch}
          filterCompany={filterCompany} setFilterCompany={setFilterCompany}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          filterDateMin={filterDateMin} setFilterDateMin={setFilterDateMin}
          filterDateMax={filterDateMax} setFilterDateMax={setFilterDateMax}
          filterAmountMin={filterAmountMin} setFilterAmountMin={setFilterAmountMin}
          filterAmountMax={filterAmountMax} setFilterAmountMax={setFilterAmountMax}
        />
      </div>
       {invoiceForReminder && companyMap.get(invoiceForReminder.companyId) && (
        <ReminderModal 
          invoice={invoiceForReminder} 
          company={companyMap.get(invoiceForReminder.companyId)!} 
          broker={invoiceForReminder.brokerId ? brokerMap.get(invoiceForReminder.brokerId) || null : null}
          onClose={() => setInvoiceForReminder(null)} 
        />
      )}
       {invoiceForDetails && companyMap.get(invoiceForDetails.companyId) && (
        <InvoiceDetailModal 
          invoice={invoiceForDetails} 
          company={companyMap.get(invoiceForDetails.companyId)!}
          broker={invoiceForDetails.brokerId ? brokerMap.get(invoiceForDetails.brokerId) || null : null}
          onClose={() => setInvoiceForDetails(null)}
          onUpdate={handleUpdateInvoice}
        />
      )}
    </div>
  );
};

export default Registrations;

function formatInvoiceMonth(month: string) {
  if (!month) return '';
  // Si c'est déjà un label (ex: Janvier 2025)
  if (isNaN(Date.parse(month))) return month;
  // Sinon, formatte YYYY-MM ou YYYY-MM-DD
  const d = new Date(month);
  return d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
}
