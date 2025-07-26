
import React, { useState, useMemo } from 'react';
import { Invoice, Company, Broker } from '../types';
import { addPayment, addRejection, generateReclamationLetter } from '../services/api';
import Modal from './Modal';
import { useApi } from '../services/api';
import { formatCurrency } from '../utils/helpers';

interface InvoiceDetailModalProps {
    invoice: Invoice;
    company: Company;
    broker: Broker | null;
    onClose: () => void;
    onUpdate: (updatedInvoice: Invoice) => void;
}

const TransactionForm: React.FC<{ invoiceId: number; onUpdate: (updatedInvoice: Invoice) => void; isSettled?: boolean }> = ({ invoiceId, onUpdate, isSettled }) => {
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [rejectionAmount, setRejectionAmount] = useState('');
    const [rejectionDate, setRejectionDate] = useState(new Date().toISOString().split('T')[0]);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);
    const [errors, setErrors] = useState<{[key:string]:string}>({});
    const { call } = useApi();

    const validatePayment = () => {
        const errs: {[key:string]:string} = {};
        if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) errs.paymentAmount = 'Montant valide requis';
        if (!paymentDate) errs.paymentDate = 'Date requise';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };
    const validateRejection = () => {
        const errs: {[key:string]:string} = {};
        if (!rejectionAmount || isNaN(Number(rejectionAmount)) || Number(rejectionAmount) <= 0) errs.rejectionAmount = 'Montant valide requis';
        if (!rejectionDate) errs.rejectionDate = 'Date requise';
        if (!rejectionReason) errs.rejectionReason = 'Motif requis';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePayment()) return;
        setIsSubmittingPayment(true);
        try {
            const updatedInvoice = await call(() => addPayment(String(invoiceId), {
                invoice: invoiceId,
                amount: parseFloat(paymentAmount),
                payment_date: paymentDate,
                payment_method: 'VIREMENT',
            }), 'Paiement ajouté');
            if (updatedInvoice) {   
            onUpdate(updatedInvoice);
            setPaymentAmount('');
                setErrors({});
            }
        } finally {
            setIsSubmittingPayment(false);
        }
    };
    
    const handleAddRejection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateRejection()) return;
        setIsSubmittingRejection(true);
        try {
            const updatedInvoice = await call(() => addRejection(String(invoiceId), {
                invoice: invoiceId,
                rejected_amount: parseFloat(rejectionAmount),
                rejection_reason: rejectionReason,
                rejection_date: rejectionDate
            }), 'Rejet ajouté');
            if (updatedInvoice) {
            onUpdate(updatedInvoice);
            setRejectionAmount('');
            setRejectionReason('');
                setErrors({});
            }
        } finally {
            setIsSubmittingRejection(false);
        }
    };

    if (isSettled) {
        return (
            <div className="col-span-2 text-center text-green-700 font-semibold py-8">
                Cette facture est totalement réglée. Aucun paiement ou rejet supplémentaire n'est possible.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-6 pt-6 border-t">
            {/* Payment Form */}
            <form onSubmit={handleAddPayment} className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700">Ajouter un paiement</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="paymentAmount" className="block text-sm font-medium text-slate-600 mb-1">Montant</label>
                        <input type="number" id="paymentAmount" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm"/>
                        {errors.paymentAmount && <p className="text-red-500 text-xs mt-1">{errors.paymentAmount}</p>}
                    </div>
                    <div>
                        <label htmlFor="paymentDate" className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                        <input type="date" id="paymentDate" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm"/>
                        {errors.paymentDate && <p className="text-red-500 text-xs mt-1">{errors.paymentDate}</p>}
                    </div>
                </div>
                 <button type="submit" disabled={isSubmittingPayment} className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                    {isSubmittingPayment ? 'Enregistrement...' : 'Enregistrer le paiement'}
                </button>
            </form>
            
            {/* Rejection Form */}
            <form onSubmit={handleAddRejection} className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700">Ajouter un rejet</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="rejectionAmount" className="block text-sm font-medium text-slate-600 mb-1">Montant</label>
                        <input type="number" id="rejectionAmount" value={rejectionAmount} onChange={e => setRejectionAmount(e.target.value)} required className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm"/>
                        {errors.rejectionAmount && <p className="text-red-500 text-xs mt-1">{errors.rejectionAmount}</p>}
                    </div>
                     <div>
                        <label htmlFor="rejectionDate" className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                        <input type="date" id="rejectionDate" value={rejectionDate} onChange={e => setRejectionDate(e.target.value)} required className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm"/>
                        {errors.rejectionDate && <p className="text-red-500 text-xs mt-1">{errors.rejectionDate}</p>}
                    </div>
                </div>
                 <div>
                    <label htmlFor="rejectionReason" className="block text-sm font-medium text-slate-600 mb-1">Motif</label>
                    <input type="text" id="rejectionReason" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} required className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm"/>
                    {errors.rejectionReason && <p className="text-red-500 text-xs mt-1">{errors.rejectionReason}</p>}
                </div>
                <button type="submit" disabled={isSubmittingRejection} className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-red-400">
                    {isSubmittingRejection ? 'Enregistrement...' : 'Enregistrer le rejet'}
                </button>
            </form>
        </div>
    )
}


const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, company, broker, onClose, onUpdate }) => {
    
    const stats = useMemo(() => {
        const totalPaid = invoice.payments!.reduce((sum, p) => sum + p.amount, 0);
        const totalRejected = invoice.rejections!.reduce((sum, r) => sum + r.rejected_amount, 0);
        const outstanding = invoice.billed_amount - totalPaid - totalRejected;
        return { totalPaid, totalRejected, outstanding };
    }, [invoice]);

    const title = `Détails de la facture #${String(invoice.id).toUpperCase()}`;
    
    const [reclamationLetter, setReclamationLetter] = useState<string | null>(null);
    const [isLoadingLetter, setIsLoadingLetter] = useState(false);
    const handleGenerateLetter = async () => {
        setIsLoadingLetter(true);
        setReclamationLetter(null);
        try {
            const data = await generateReclamationLetter(String(invoice.id));
            setReclamationLetter(data.letter);
        } catch (e: any) {
            setReclamationLetter(e.message || 'Erreur lors de la génération de la lettre.');
        } finally {
            setIsLoadingLetter(false);
        }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose} title={title}>
            {/* Summary */}
            <div className="bg-slate-50 p-4 rounded-lg mb-6">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-slate-600">Compagnie:</p>
                    <p className="font-bold text-lg">{company.name}</p>
                </div>
                {broker &&
                  <div className="flex justify-between items-center mb-2">
                      <p className="text-slate-600">Courtier:</p>
                      <p className="font-semibold">{broker.name}</p>
                  </div>
                }
                 <div className="flex justify-between items-center mb-4">
                    <p className="text-slate-600">Mois de la facture:</p>
                    <p className="font-semibold">{invoice.invoice_month}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-sm text-slate-500">Total Facturé</p>
                        <p className="text-xl font-bold text-slate-800">{formatCurrency(invoice.billed_amount)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Total Payé</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Total Rejeté</p>
                        <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalRejected)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Reste à Régler</p>
                        <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.outstanding)}</p>
                    </div>
                </div>
            </div>

            {/* Transactions */}
            <TransactionForm invoiceId={invoice.id} onUpdate={onUpdate} isSettled={stats.totalPaid + stats.totalRejected >= invoice.billed_amount} />

            <div className="mt-6">
                <button onClick={handleGenerateLetter} className="bg-orange-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-orange-700 text-sm">
                    Générer lettre de relance
                </button>
                {isLoadingLetter && <div className="mt-2 text-slate-500">Génération en cours...</div>}
                {reclamationLetter && <pre className="mt-2 bg-slate-100 p-4 rounded text-sm whitespace-pre-wrap">{reclamationLetter}</pre>}
            </div>
        </Modal>
    );
};

export default InvoiceDetailModal;