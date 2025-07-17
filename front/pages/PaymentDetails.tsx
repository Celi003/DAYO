import React, { useState } from 'react';
import { getPaymentDetails } from '../services/api';
import { useNotification } from '../components/NotificationContext';

const PaymentDetails: React.FC = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()+1);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{year?: string; month?: string}>({});
  const { notify } = useNotification();
  const handleFetch = async () => {
    const errs: {year?: string; month?: string} = {};
    if (!year || year < 2000 || year > 2100) errs.year = 'Année invalide (2000-2100)';
    if (!month || month < 1 || month > 12) errs.month = 'Mois invalide (1-12)';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const data = await getPaymentDetails(year, month);
      setPayments(data.payments||[]);
    } catch (e: any) {
      notify(e.message || 'Erreur lors de la récupération des paiements', 'error');
    }
    setLoading(false);
  };
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Détails des paiements</h1>
      <div className="flex gap-4 mb-4">
        <div className="flex flex-col">
          <input type="number" value={year} onChange={e=>setYear(Number(e.target.value))} min={2000} max={2100} className="border p-2" />
          {errors.year && <span className="text-red-600 text-xs">{errors.year}</span>}
        </div>
        <div className="flex flex-col">
          <select value={month} onChange={e=>setMonth(Number(e.target.value))} className="border p-2">
            {[...Array(12)].map((_,i)=>(<option key={i+1} value={i+1}>{i+1}</option>))}
          </select>
          {errors.month && <span className="text-red-600 text-xs">{errors.month}</span>}
        </div>
        <button onClick={handleFetch} className="bg-blue-600 text-white px-4 py-2 rounded">Rechercher</button>
      </div>
      {loading && <div>Chargement...</div>}
      {!loading && payments.length>0 && (
        <table className="min-w-full">
          <thead><tr><th>Facture</th><th>Date paiement</th><th>Montant</th><th>Méthode</th></tr></thead>
          <tbody>
            {payments.map((p:any)=>(
              <tr key={p.id}>
                <td>{p.invoice_number}</td>
                <td>{p.payment_date}</td>
                <td>{p.amount}</td>
                <td>{p.payment_method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && payments.length===0 && <div>Aucun paiement trouvé pour cette période.</div>}
    </div>
  );
};

export default PaymentDetails; 