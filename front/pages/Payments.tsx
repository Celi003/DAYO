
import React, { useState, useEffect, useMemo } from 'react';
import { getInvoices, getProviders, getUsers, getCompanies, getBrokers } from '../services/api';
import { Invoice, Company, Broker, User } from '../types';

const formatCurrency = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

type TransactionType = 'Paiement' | 'Rejet';
interface Transaction {
    id: string;
    date: string;
    partnerName: string;
    invoiceMonth: string;
    type: TransactionType;
    amount: number;
    reason?: string;
    providerName?: string;
}

interface PaymentsProps {
    user: User;
}

const PaymentTable: React.FC<{invoices: Invoice[], partners: Partner[], user: User, userMap: Map<string,string>, loading: boolean}> = ({invoices, partners, user, userMap, loading}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{col:string, asc:boolean}>({col:'',asc:true});
  const pageSize = 10;

  // Si tu veux garder une recherche globale sur les invoices :
  const filtered = invoices.filter((inv: Invoice) =>
    [inv.id, inv.companyId, inv.brokerId, inv.depositDate, inv.invoiceMonth, inv.totalAmount]
      .some(v => v && v.toString().toLowerCase().includes(search.toLowerCase()))
  );
  // Tri uniquement sur les colonnes existantes
  const sortKeys: { [key: string]: (inv: Invoice) => string | number | undefined } = {
    id: (inv: Invoice) => inv.id,
    companyId: (inv: Invoice) => companyMap.get(inv.companyId),
    brokerId: (inv: Invoice) => brokerMap.get(inv.brokerId || ''),
    depositDate: (inv: Invoice) => inv.depositDate,
    invoiceMonth: (inv: Invoice) => inv.invoiceMonth,
    totalAmount: (inv: Invoice) => inv.totalAmount,
  };
  const sorted = sort.col && sortKeys[sort.col] ? [...filtered].sort((a: Invoice, b: Invoice) => {
    const aVal = sortKeys[sort.col](a);
    const bVal = sortKeys[sort.col](b);
    if (aVal === bVal) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * (sort.asc ? 1 : -1);
    return aVal?.toString().localeCompare(bVal?.toString(), undefined, { numeric: true }) * (sort.asc ? 1 : -1);
  }) : filtered;
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (col:string) => {
    setSort(s => s.col===col ? {col,asc:!s.asc} : {col,asc:true});
  };

  return (
    <div>
      <div className="flex gap-2 mb-2 items-center">
        <input placeholder="Recherche..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="border p-1" />
        <span className="text-sm text-slate-500">{sorted.length} résultat(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="cursor-pointer" onClick={()=>handleSort('id')}>ID {sort.col==='id'?(sort.asc?'▲':'▼'):''}</th>
              <th className="cursor-pointer" onClick={()=>handleSort('partnerId')}>Partenaire {sort.col==='partnerId'?(sort.asc?'▲':'▼'):''}</th>
              <th className="cursor-pointer" onClick={()=>handleSort('depositDate')}>Date dépôt {sort.col==='depositDate'?(sort.asc?'▲':'▼'):''}</th>
              <th className="cursor-pointer" onClick={()=>handleSort('invoiceMonth')}>Mois {sort.col==='invoiceMonth'?(sort.asc?'▲':'▼'):''}</th>
              <th className="cursor-pointer" onClick={()=>handleSort('totalAmount')}>Montant {sort.col==='totalAmount'?(sort.asc?'▲':'▼'):''}</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((invoice: Invoice) => {
              const partnerName = companyMap.get(invoice.companyId) || (invoice.brokerId ? brokerMap.get(invoice.brokerId) : undefined) || 'N/A';
              const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
              const totalRejected = (invoice.rejections || []).reduce((sum, r) => sum + r.amount, 0);
              const outstanding = invoice.totalAmount - totalPaid - totalRejected;
              return (
                <tr key={invoice.id}>
                  <td>{invoice.id}</td>
                  <td>{partnerName}</td>
                  <td>{formatDate(invoice.depositDate || '')}</td>
                  <td>{formatInvoiceMonth(invoice.invoiceMonth)}</td>
                  <td>{invoice.totalAmount}</td>
                  <td>{outstanding <= 0 ? 'Payée' : 'En attente'}</td>
                </tr>
              );
            })}
            {paged.length === 0 && !loading && (
              <tr><td colSpan={6} className="text-center p-8 text-slate-500">Aucun paiement trouvé.</td></tr>
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

const Payments: React.FC<PaymentsProps> = ({ user }) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterPartner, setFilterPartner] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDateMin, setFilterDateMin] = useState('');
    const [filterDateMax, setFilterDateMax] = useState('');
    const [filterAmountMin, setFilterAmountMin] = useState('');
    const [filterAmountMax, setFilterAmountMax] = useState('');
    const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<{col:string, asc:boolean}>({col:'date',asc:false});
    const [pageByMonth, setPageByMonth] = useState<{[month: string]: number}>({});
    const pageSize = 10;
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [invoicesData, companiesData, brokersData, usersData] = await Promise.all([
                getInvoices(),
                getCompanies(),
                getBrokers(),
                user.role === 'admin' ? getUsers() : Promise.resolve([])
            ]);
            setInvoices(invoicesData);
            setCompanies(companiesData);
            setBrokers(brokersData);
            if (user.role === 'admin') {
                setUserMap(new Map((usersData as User[]).map((u: User) => [u.id, u.username])));
            }
            setLoading(false);
        };
        fetchData();
    }, [user]);

    const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);
    const brokerMap = useMemo(() => new Map(brokers.map(b => [b.id, b.name])), [brokers]);

    const transactions = useMemo(() => {
        const allTransactions: Transaction[] = [];
        invoices.forEach((invoice: Invoice) => {
            const partnerName = companyMap.get(invoice.companyId) || (invoice.brokerId ? brokerMap.get(invoice.brokerId) : undefined) || 'Inconnu';
            // Pas de userId sur Invoice, donc providerName non affiché

            invoice.payments.forEach(p => {
                allTransactions.push({
                    id: `p-${invoice.id}-${p.id}`,
                    date: p.date,
                    partnerName,
                    invoiceMonth: invoice.invoiceMonth,
                    type: 'Paiement',
                    amount: p.amount
                });
            });
            invoice.rejections.forEach(r => {
                allTransactions.push({
                    id: `r-${invoice.id}-${r.id}`,
                    date: r.date,
                    partnerName,
                    invoiceMonth: invoice.invoiceMonth,
                    type: 'Rejet',
                    amount: r.amount,
                    reason: r.reason
                });
            });
        });
        return allTransactions;
    }, [invoices, companyMap, brokerMap]);
    
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const partnerMatch = !filterPartner || t.partnerName === companyMap.get(filterPartner) || t.partnerName === brokerMap.get(filterPartner);
            const typeMatch = !filterType || t.type === filterType;
            const statusMatch = !filterStatus || (
                (filterStatus === 'Payée' && t.type === 'Paiement') ||
                (filterStatus === 'Rejetée' && t.type === 'Rejet') ||
                (filterStatus === 'En attente' && t.type === 'Paiement' && t.amount > 0) ||
                (filterStatus === 'Partielle' && t.type === 'Paiement' && t.amount > 0) // à adapter selon logique métier
            );
            const dateMatch = (!filterDateMin || t.date >= filterDateMin) && (!filterDateMax || t.date <= filterDateMax);
            const amountMatch = (!filterAmountMin || t.amount >= Number(filterAmountMin)) && (!filterAmountMax || t.amount <= Number(filterAmountMax));
            const searchMatch = !search || Object.values(t).some(v => v && v.toString().toLowerCase().includes(search.toLowerCase()));
            return partnerMatch && typeMatch && statusMatch && dateMatch && amountMatch && searchMatch;
        });
    }, [transactions, filterPartner, filterType, filterStatus, filterDateMin, filterDateMax, filterAmountMin, filterAmountMax, search, companyMap, brokerMap]);

    const sortedTransactions = useMemo(() => {
        if (!sort.col) return filteredTransactions;
        return [...filteredTransactions].sort((a: Transaction, b: Transaction) => {
            if (sort.col === 'amount') {
                return (a.amount - b.amount) * (sort.asc ? 1 : -1);
            }
            if (sort.col === 'date') {
                return (new Date(a.date).getTime() - new Date(b.date).getTime()) * (sort.asc ? 1 : -1);
            }
            // Pour partnerName, invoiceMonth, type, reason
            const aVal = (a as any)[sort.col];
            const bVal = (b as any)[sort.col];
            if (aVal === bVal) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            return aVal.toString().localeCompare(bVal.toString(), undefined, { numeric: true }) * (sort.asc ? 1 : -1);
        });
    }, [filteredTransactions, sort]);

    // Regroupement par mois
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        sortedTransactions.forEach(t => {
            const date = new Date(t.date);
            const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(t);
        });
        const sortedMonthKeys = Object.keys(groups).sort().reverse();
        return { groups, sortedMonthKeys };
    }, [sortedTransactions]);

    const handleSort = (col: string) => {
        setSort(s => s.col === col ? { col, asc: !s.asc } : { col, asc: true });
    };

    const handlePageChange = (monthKey: string, newPage: number) => {
        setPageByMonth(prev => ({ ...prev, [monthKey]: newPage }));
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-500"></div></div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-8">Suivi des Paiements et Rejets</h1>
            <div className="flex flex-wrap gap-4 mb-6">
                 <select 
                    value={filterPartner} 
                    onChange={e => setFilterPartner(e.target.value)} 
                    className="p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                    <option value="">Tous les partenaires</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select 
                    value={filterType} 
                    onChange={e => setFilterType(e.target.value)}
                    className="p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                    <option value="">Tous les types</option>
                    <option value="Paiement">Paiements</option>
                    <option value="Rejet">Rejets</option>
                </select>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="p-2 border border-slate-300 rounded-md shadow-sm bg-white"
                >
                    <option value="">Tous statuts</option>
                    <option value="Payée">Payée</option>
                    <option value="Rejetée">Rejetée</option>
                    <option value="En attente">En attente</option>
                    <option value="Partielle">Partielle</option>
                </select>
                <input type="date" value={filterDateMin} onChange={e=>setFilterDateMin(e.target.value)} className="border p-2 rounded-md" placeholder="Date min" />
                <input type="date" value={filterDateMax} onChange={e=>setFilterDateMax(e.target.value)} className="border p-2 rounded-md" placeholder="Date max" />
                <input type="number" value={filterAmountMin} onChange={e=>setFilterAmountMin(e.target.value)} className="border p-2 rounded-md" placeholder="Montant min" />
                <input type="number" value={filterAmountMax} onChange={e=>setFilterAmountMax(e.target.value)} className="border p-2 rounded-md" placeholder="Montant max" />
                <input
                    placeholder="Recherche..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); }}
                    className="border p-2 rounded-md"
                    style={{ minWidth: 200 }}
                />
                {(filterPartner || filterType || filterStatus || filterDateMin || filterDateMax || filterAmountMin || filterAmountMax || search) && (
                  <button onClick={()=>{setFilterPartner('');setFilterType('');setFilterStatus('');setFilterDateMin('');setFilterDateMax('');setFilterAmountMin('');setFilterAmountMax('');setSearch('');}} className="ml-2 px-2 py-1 bg-slate-200 rounded">Réinitialiser</button>
                )}
            </div>
            <div className="space-y-8 mt-6">
                {groupedTransactions.sortedMonthKeys.length > 0 ? (
                    groupedTransactions.sortedMonthKeys.map(monthKey => {
                        const transactionsInMonth = groupedTransactions.groups[monthKey];
                        const page = pageByMonth[monthKey] || 1;
                        const totalPages = Math.ceil(transactionsInMonth.length / pageSize) || 1;
                        const paged = transactionsInMonth.slice((page - 1) * pageSize, page * pageSize);
                        const dateForTitle = new Date(monthKey + '-02T00:00:00');
                        const monthTitle = dateForTitle.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
                        const capitalizedMonthTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
                        return (
                            <div key={monthKey} className="bg-white p-6 rounded-lg shadow-sm">
                                <h2 className="text-xl font-bold mb-4 text-slate-700">{capitalizedMonthTitle}</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none" onClick={() => handleSort('date')}>Date {sort.col === 'date' ? (sort.asc ? '▲' : '▼') : ''}</th>
                                                {user.role === 'admin' && <th className="p-4 text-sm font-semibold text-slate-600">Prestataire</th>}
                                                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none" onClick={() => handleSort('partnerName')}>Partenaire {sort.col === 'partnerName' ? (sort.asc ? '▲' : '▼') : ''}</th>
                                                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none" onClick={() => handleSort('invoiceMonth')}>Mois Facture {sort.col === 'invoiceMonth' ? (sort.asc ? '▲' : '▼') : ''}</th>
                                                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none" onClick={() => handleSort('type')}>Type {sort.col === 'type' ? (sort.asc ? '▲' : '▼') : ''}</th>
                                                <th className="p-4 text-sm font-semibold text-slate-600 text-right cursor-pointer select-none" onClick={() => handleSort('amount')}>Montant {sort.col === 'amount' ? (sort.asc ? '▲' : '▼') : ''}</th>
                                                <th className="p-4 text-sm font-semibold text-slate-600">Motif du Rejet</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paged.map(t => (
                                                <tr key={t.id} className="border-b last:border-b-0 hover:bg-slate-50">
                                                    <td className="p-4 text-slate-600">{formatDate(t.date)}</td>
                                                    {user.role === 'admin' && <td className="p-4 font-medium">{t.providerName}</td>}
                                                    <td className="p-4 font-medium">{t.partnerName}</td>
                                                    <td className="p-4 text-slate-600">{t.invoiceMonth}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${t.type === 'Paiement' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{t.type}</span>
                                                    </td>
                                                    <td className={`p-4 text-right font-mono ${t.type === 'Paiement' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</td>
                                                    <td className="p-4 text-slate-600 text-sm">{t.reason || '-'}</td>
                                                </tr>
                                            ))}
                                            {paged.length === 0 && (
                                                <tr><td colSpan={user.role === 'admin' ? 7 : 6} className="text-center p-8 text-slate-500">Aucune transaction trouvée.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-2 items-center my-2">
                                    <button disabled={page <= 1} onClick={() => handlePageChange(monthKey, page - 1)} className="px-2 py-1 border rounded disabled:opacity-50">Préc.</button>
                                    <span>Page {page} / {totalPages}</span>
                                    <button disabled={page >= totalPages} onClick={() => handlePageChange(monthKey, page + 1)} className="px-2 py-1 border rounded disabled:opacity-50">Suiv.</button>
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
    );
};

export default Payments;

function formatInvoiceMonth(month: string) {
  if (!month) return '';
  // Si c'est déjà un label (ex: Janvier 2025)
  if (isNaN(Date.parse(month))) return month;
  // Sinon, formatte YYYY-MM ou YYYY-MM-DD
  const d = new Date(month);
  return d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
}
