import { generateReclamationLetter } from "@/services/api";
import { Invoice, Company, Broker } from "@/types";
import { useState, useEffect } from "react";
import { useNotification } from "../NotificationContext";

export const ReminderModal: React.FC<{
  invoice: Invoice;
  company: Company;
  broker?: Broker | null;
  onClose: () => void;
}> = ({ invoice, onClose }) => {
  const [letter, setLetter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { notify } = useNotification();

  useEffect(() => {
    const fetchLetter = async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await generateReclamationLetter(String(invoice.id));
        setLetter(data.letter);
      } catch (e: any) {
        setError(e.message || "Erreur lors de la génération de la lettre.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchLetter();
  }, [invoice]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(letter);
    notify("Lettre copiée dans le presse-papiers !", "success");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-xl font-bold mb-4">
          Générer une lettre de relance
        </h2>
        <div className="flex-grow overflow-y-auto border p-4 rounded-md bg-slate-50 min-h-[200px]">
          {isLoading && <p>Génération en cours...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && (
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {letter}
            </pre>
          )}
        </div>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={copyToClipboard}
            disabled={isLoading || !!error}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-400"
          >
            Copier
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
