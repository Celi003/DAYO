import { useApi, addInvoice, getProviders } from "@/services/api";
import { Broker, Company, Invoice, User } from "@/types";
import { useState, useMemo, useEffect } from "react";

export const AddInvoiceForm: React.FC<{
  companies: Broker[];
  Companys: Company[];
  providerId: number | null;
  onAddInvoice: (invoice: Invoice) => void;
  user: User;
}> = ({ companies, Companys, providerId, onAddInvoice, user }) => {
  const [BrokerId, setBrokerId] = useState<number | null>(null);
  const [CompanyId, setCompanyId] = useState<number | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { call } = useApi();

  // If the parent didn't supply providerId yet (partners still loading after login),
  // try to resolve it by fetching providers and matching current user.
  const [resolvedProviderId, setResolvedProviderId] = useState<number | null>(providerId);
  useEffect(() => {
    setResolvedProviderId(providerId);
  }, [providerId]);

  useEffect(() => {
    const tryResolve = async () => {
      if ((resolvedProviderId === null || resolvedProviderId === undefined) && user) {
        try {
          const provs = await call(() => getProviders());
          if (Array.isArray(provs)) {
            const found = provs.find((p: any) => p.user && p.user.id === user.id);
            if (found) setResolvedProviderId(found.id);
          }
        } catch (e) {
          // ignore
        }
      }
    };
    tryResolve();
  }, [resolvedProviderId, user, call]);

  // Filtrer les Compagnies selon la Courtier sélectionnée
  const filteredCompanys = useMemo(() => {
    if (!BrokerId) {
      // Si aucune Courtier n'est sélectionnée, afficher tous les Compagnies
      return Companys;
    }
    
    // Si une Courtier est sélectionnée, afficher seulement ses Compagnies
    const selectedBroker = companies.find(c => c.id === BrokerId);
    if (!selectedBroker || !selectedBroker.Companys) {
      return [];
    }
    
    return selectedBroker.Companys;
  }, [BrokerId, companies, Companys]);

  // Réinitialiser le Compagnie sélectionné quand la Courtier change
  const handleBrokerChange = (newBrokerId: number | null) => {
    setBrokerId(newBrokerId);
    setCompanyId(null); // Réinitialiser le Compagnie
  };



  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!BrokerId && !CompanyId) errs.BrokerId = "Courtier ou Compagnie requis";
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
    // Ne bloque pas si l'id prestataire n'est pas encore résolu côté client.
    // Le backend infèrera le prestataire via l'utilisateur connecté.
    setIsSubmitting(true);
    try {
      const invoiceNumber = `INV-${Date.now()}`;
      const payload: any = {
        // provider_id laissé vide si non résolu; backend le déduira
        ...(resolvedProviderId ? { provider_id: resolvedProviderId } : {}),
        invoice_number: invoiceNumber,
        invoice_month: parseMonthYearToDate(invoiceMonth),
        billed_amount: parseFloat(amount),
        deposit_date: depositDate || undefined,
      };

  if (BrokerId) payload.broker_id = BrokerId;
  if (CompanyId) payload.company_id = CompanyId;

      const newInvoice = await call(
        () => addInvoice(payload),
        "Facture ajoutée"
      );
      if (newInvoice) {
        onAddInvoice(newInvoice);
        setBrokerId(null);
        setCompanyId(null);
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
            htmlFor="Broker"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Courtier (Optionnel)
          </label>
          <select
            id="Broker"
            value={BrokerId ?? ""}
            onChange={(e) =>
              handleBrokerChange(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Aucune</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.BrokerId && (
            <p className="text-red-500 text-xs mt-1">{errors.BrokerId}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="Company"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Compagnie (Optionnel)
          </label>
          <select
            id="Company"
            value={CompanyId || ""}
            onChange={(e) =>
              setCompanyId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Aucun</option>
            {filteredCompanys.map((b) => (
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
