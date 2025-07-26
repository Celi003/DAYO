import { useApi, addInvoice } from "@/services/api";
import { Company, Broker, Invoice, User } from "@/types";
import { useState, useMemo } from "react";
import { useNotification } from "../NotificationContext";

export const AddInvoiceForm: React.FC<{
  companies: Company[];
  brokers: Broker[];
  providerId: number | null;
  onAddInvoice: (invoice: Invoice) => void;
  user: User;
}> = ({ companies, brokers, providerId, onAddInvoice }) => {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [brokerId, setBrokerId] = useState<number | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { notify } = useNotification();
  const { call } = useApi();

  const availableBrokers = useMemo(() => {
    if (!companyId) return [];
    return brokers.filter((b) => b.companyId === companyId);
  }, [companyId, brokers]);

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!companyId) errs.companyId = "Compagnie requise";
    if (!invoiceMonth) errs.invoiceMonth = "Mois requis";
    if (!depositDate) errs.depositDate = "Date requise";
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      errs.amount = "Montant valide requis";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const parseMonthYearToDate = (label: string) => {
    const [mois, annee] = label.split(" ");
    const moisMap: Record<string, string> = {
      janvier: "01",
      février: "02",
      mars: "03",
      avril: "04",
      mai: "05",
      juin: "06",
      juillet: "07",
      août: "08",
      septembre: "09",
      octobre: "10",
      novembre: "11",
      décembre: "12",
    };
    const moisNum = moisMap[mois.toLowerCase()];
    return moisNum && annee ? `${annee}-${moisNum}-01` : "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!providerId) {
      notify(
        "Impossible de trouver votre compte prestataire. Contactez l'administrateur.",
        "error"
      );
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

      const newInvoice = await call(
        () => addInvoice(payload),
        "Facture ajoutée"
      );
      if (newInvoice) {
        onAddInvoice(newInvoice);
        setCompanyId(null);
        setBrokerId(null);
        setInvoiceMonth("");
        setDepositDate("");
        setAmount("");
        setErrors({});
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1);
    return (
      d.toLocaleString("fr-FR", { month: "long" }) +
      ` ${new Date().getFullYear()}`
    );
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
      <h2 className="text-xl font-bold mb-4">Ajouter une facture</h2>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
      >
        <div>
          <label
            htmlFor="company"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Compagnie
          </label>
          <select
            id="company"
            value={companyId ?? ""}
            onChange={(e) =>
              setCompanyId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Choisir...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.companyId && (
            <p className="text-red-500 text-xs mt-1">{errors.companyId}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="broker"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Courtier (Optionnel)
          </label>
          <select
            id="broker"
            value={brokerId || ""}
            onChange={(e) =>
              setBrokerId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={!companyId}
          >
            <option value="">Aucun</option>
            {availableBrokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="invoiceMonth"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Mois de la facture
          </label>
          <select
            id="invoiceMonth"
            value={invoiceMonth}
            onChange={(e) => setInvoiceMonth(e.target.value)}
            className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Choisir...</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.invoiceMonth && (
            <p className="text-red-500 text-xs mt-1">{errors.invoiceMonth}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="depositDate"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Date de dépôt
          </label>
          <input
            type="date"
            id="depositDate"
            value={depositDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDepositDate((e.target.value || "") as string)
            }
            className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.depositDate && (
            <p className="text-red-500 text-xs mt-1">{errors.depositDate}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Montant
          </label>
          <input
            type="number"
            id="amount"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.amount && (
            <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400"
        >
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
};
