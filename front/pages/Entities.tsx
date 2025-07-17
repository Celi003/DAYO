import React, { useState, useEffect } from 'react';
import { getProviders, createProvider, updateProvider, deleteProvider, getBrokers, createBroker, updateBroker, deleteBroker, getCompanies, createCompany, updateCompany, deleteCompany } from '../services/api';
import { useNotification } from '../components/NotificationContext';
import { useApi } from '../services/api';

interface ConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message: string;
}
const ConfirmModal: React.FC<ConfirmModalProps> = ({open, onConfirm, onCancel, message}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg">
        <div className="mb-4">{message}</div>
        <div className="flex gap-4 justify-end">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-200 rounded">Annuler</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded">Confirmer</button>
        </div>
      </div>
    </div>
  );
};

const Entities: React.FC = () => {
  const [tab, setTab] = useState<'providers' | 'brokers' | 'companies'>('providers');
  const [providers, setProviders] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{open:boolean, onConfirm:()=>void, message:string}>({open:false,onConfirm:()=>{},message:''});
  const { notify } = useNotification();
  const { call } = useApi();

  // Providers
  useEffect(() => { if (tab === 'providers') fetchProviders(); }, [tab]);
  const fetchProviders = async () => { setLoading(true); const data = await call(() => getProviders()); if (data) setProviders(data); setLoading(false); };
  const handleAddProvider = async (data: any) => { await call(() => createProvider(data), 'Prestataire ajouté'); fetchProviders(); };
  const handleUpdateProvider = async (id: string, data: any) => { await call(() => updateProvider(id, data), 'Prestataire modifié'); fetchProviders(); };
  const handleDeleteProvider = (id: string) => {
    setConfirm({open:true, onConfirm: async()=>{await call(() => deleteProvider(id), 'Prestataire supprimé'); fetchProviders(); setConfirm({...confirm,open:false});}, message:'Confirmer la suppression de ce prestataire ?'});
  };

  // Brokers
  useEffect(() => { if (tab === 'brokers') fetchBrokers(); }, [tab]);
  const fetchBrokers = async () => { setLoading(true); const data = await call(() => getBrokers()); if (data) setBrokers(data); setLoading(false); };
  const handleAddBroker = async (data: any) => { await call(() => createBroker(data), 'Courtier ajouté'); fetchBrokers(); };
  const handleUpdateBroker = async (id: string, data: any) => { await call(() => updateBroker(id, data), 'Courtier modifié'); fetchBrokers(); };
  const handleDeleteBroker = (id: string) => {
    setConfirm({open:true, onConfirm: async()=>{await call(() => deleteBroker(id), 'Courtier supprimé'); fetchBrokers(); setConfirm({...confirm,open:false});}, message:'Confirmer la suppression de ce courtier ?'});
  };

  // Companies
  useEffect(() => { if (tab === 'companies') fetchCompanies(); }, [tab]);
  const fetchCompanies = async () => { setLoading(true); const data = await call(() => getCompanies()); if (data) setCompanies(data); setLoading(false); };
  const handleAddCompany = async (data: any) => { await call(() => createCompany(data), 'Compagnie ajoutée'); fetchCompanies(); };
  const handleUpdateCompany = async (id: string, data: any) => { await call(() => updateCompany(id, data), 'Compagnie modifiée'); fetchCompanies(); };
  const handleDeleteCompany = (id: string) => {
    setConfirm({open:true, onConfirm: async()=>{await call(() => deleteCompany(id), 'Compagnie supprimée'); fetchCompanies(); setConfirm({...confirm,open:false});}, message:'Confirmer la suppression de cette compagnie ?'});
  };

  return (
    <div className="p-8">
      <ConfirmModal open={confirm.open} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm({...confirm,open:false})} message={confirm.message} />
      <h1 className="text-3xl font-bold mb-6">Gestion des entités</h1>
      <div className="flex gap-4 mb-6">
        <button className={tab==='providers'?"bg-blue-600 text-white":"bg-slate-200"} onClick={()=>setTab('providers')}>Prestataires</button>
        <button className={tab==='brokers'?"bg-blue-600 text-white":"bg-slate-200"} onClick={()=>setTab('brokers')}>Courtiers</button>
        <button className={tab==='companies'?"bg-blue-600 text-white":"bg-slate-200"} onClick={()=>setTab('companies')}>Compagnies</button>
      </div>
      {loading && <div>Chargement...</div>}
      {!loading && tab==='providers' && <EntityTable data={providers} onAdd={handleAddProvider} onUpdate={handleUpdateProvider} onDelete={handleDeleteProvider} type="Prestataire" />}
      {!loading && tab==='brokers' && <EntityTable data={brokers} onAdd={handleAddBroker} onUpdate={handleUpdateBroker} onDelete={handleDeleteBroker} type="Courtier" />}
      {!loading && tab==='companies' && <EntityTable data={companies} onAdd={handleAddCompany} onUpdate={handleUpdateCompany} onDelete={handleDeleteCompany} type="Compagnie" />}
    </div>
  );
};

const EntityTable: React.FC<{data: any[], onAdd: (data:any)=>void, onUpdate: (id:string,data:any)=>void, onDelete:(id:string)=>void, type:string}> = ({data, onAdd, onUpdate, onDelete, type}) => {
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{col:string, asc:boolean}>({col:'',asc:true});
  const pageSize = 10;
  const { notify } = useNotification();

  const validate = () => {
    const errs: Record<string,string> = {};
    if (data[0]) {
      Object.keys(data[0]).forEach(k => {
        if (k !== 'id') {
          if (!form[k] || form[k].toString().trim() === '') {
            errs[k] = 'Ce champ est requis';
          }
          if (k.toLowerCase().includes('email') && form[k] && !/^\S+@\S+\.\S+$/.test(form[k])) {
            errs[k] = 'Format email invalide';
          }
        }
      });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (editId) onUpdate(editId, form); else onAdd(form);
    setEditId(null); setForm({}); setErrors({});
  };

  // Recherche
  const filtered = data.filter(item =>
    Object.values(item).some(v => v && v.toString().toLowerCase().includes(search.toLowerCase()))
  );
  // Tri
  const sorted = sort.col ? [...filtered].sort((a,b)=>{
    if(a[sort.col]===b[sort.col]) return 0;
    if(a[sort.col]==null) return 1;
    if(b[sort.col]==null) return -1;
    return (a[sort.col].toString().localeCompare(b[sort.col].toString(),undefined,{numeric:true})) * (sort.asc?1:-1);
  }) : filtered;
  // Pagination
  const totalPages = Math.ceil(sorted.length/pageSize)||1;
  const paged = sorted.slice((page-1)*pageSize, page*pageSize);

  const handleSort = (col:string) => {
    setSort(s => s.col===col ? {col,asc:!s.asc} : {col,asc:true});
  };

  return (
    <div>
      <div className="flex gap-2 mb-2 items-center">
        <input placeholder="Recherche..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="border p-1" />
        <span className="text-sm text-slate-500">{sorted.length} résultat(s)</span>
      </div>
      <table className="min-w-full mb-4">
        <thead><tr>{data[0] && Object.keys(data[0]).map(k=>(
          <th key={k} className="cursor-pointer select-none" onClick={()=>handleSort(k)}>
            {k} {sort.col===k?(sort.asc?'▲':'▼'):''}
          </th>
        ))}<th>Actions</th></tr></thead>
        <tbody>
          {paged.map((item:any)=>(
            <tr key={item.id}>
              {Object.keys(item).map(k=>(<td key={k}>{String(item[k])}</td>))}
              <td>
                <button onClick={()=>{setEditId(item.id);setForm(item);}}>Éditer</button>
                <button onClick={()=>onDelete(item.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 items-center mb-2">
        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-2 py-1 border rounded disabled:opacity-50">Préc.</button>
        <span>Page {page} / {totalPages}</span>
        <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 border rounded disabled:opacity-50">Suiv.</button>
      </div>
      <div className="mb-2 font-bold">{editId?'Éditer':'Ajouter'} {type}</div>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4 flex-wrap">
        {data[0] && Object.keys(data[0]).filter(k=>k!=='id').map(k=>(
          <div key={k} className="flex flex-col">
            <input placeholder={k} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} className={errors[k]?'border-red-500 border':''} />
            {errors[k] && <span className="text-red-600 text-xs">{errors[k]}</span>}
          </div>
        ))}
        <button type="submit">{editId?'Enregistrer':'Ajouter'}</button>
        {editId && <button type="button" onClick={()=>{setEditId(null);setForm({});setErrors({});}}>Annuler</button>}
      </form>
    </div>
  );
};

export default Entities; 