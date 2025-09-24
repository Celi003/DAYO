import { Invoice } from "@/types";
import { formatCurrency, formatDate } from "../../utils/helpers";
import React from "react";

const RevenueDetailsModalContent: React.FC<{
  data: Invoice[];
  partnerMap: Map<string, string>;
  userRole: string;
}> = ({ data, partnerMap, userRole }) => {
  return (
    <table className="w-full text-left">
      <thead className="bg-slate-50 border-b">
        <tr>
          <th className="p-3 text-sm font-semibold text-slate-600">
            {userRole === 'admin' ? 'Prestataire' : 'Entité'}
          </th>
          <th className="p-3 text-sm font-semibold text-slate-600">
            Mois Facture
          </th>
          <th className="p-3 text-sm font-semibold text-slate-600">
            Date Dépôt
          </th>
          <th className="p-3 text-sm font-semibold text-slate-600 text-right">
            Montant
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((inv) => (
          <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50">
            <td className="p-3 font-medium">
              {userRole === 'admin'
                ? (partnerMap.get(String(inv.provider.id)) || inv.provider.id)
                : (inv.Broker?.name || inv.Company?.name || 'Inconnu')}
            </td>
            <td className="p-3 text-slate-600">{inv.invoice_month}</td>
            <td className="p-3 text-slate-600">
              {formatDate(inv.deposit_date)}
            </td>
            <td className="p-3 text-slate-600 text-right font-mono">
              {formatCurrency(inv.billed_amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const DistributionDetailsModalContent: React.FC<{
  data: { name: string; value: number }[];
}> = ({ data }) => (
  <table className="w-full text-left">
    <thead className="bg-slate-50 border-b">
      <tr>
        <th className="p-3 text-sm font-semibold text-slate-600">Partenaire</th>
        <th className="p-3 text-sm font-semibold text-slate-600 text-right">
          Chiffre d'affaires
        </th>
      </tr>
    </thead>
    <tbody>
      {[...data]
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <tr key={p.name} className="border-b last:border-0 hover:bg-slate-50">
            <td className="p-3 font-medium">{p.name}</td>
            <td className="p-3 text-slate-600 text-right font-mono">
              {formatCurrency(p.value)}
            </td>
          </tr>
        ))}
    </tbody>
  </table>
);

const StatusDetailsModalContent: React.FC<{
  data: {
    name: string;
    total: number;
    paid: number;
    outstanding: number;
    rejected: number;
  }[];
}> = ({ data }) => (
  <table className="w-full text-left">
    <thead className="bg-slate-50 border-b">
      <tr>
        <th className="p-3 text-sm font-semibold text-slate-600">Partenaire</th>
        <th className="p-3 text-sm font-semibold text-slate-600 text-right">
          Total Facturé
        </th>
        <th className="p-3 text-sm font-semibold text-slate-600 text-right">
          Payé
        </th>
        <th className="p-3 text-sm font-semibold text-slate-600 text-right">
          En attente
        </th>
        <th className="p-3 text-sm font-semibold text-slate-600 text-right">
          Rejeté
        </th>
      </tr>
    </thead>
    <tbody>
      {[...data]
        .sort((a, b) => b.total - a.total)
        .map((p) => (
          <tr key={p.name} className="border-b last:border-0 hover:bg-slate-50">
            <td className="p-3 font-medium">{p.name}</td>
            <td className="p-3 text-slate-600 text-right font-mono">
              {formatCurrency(p.total)}
            </td>
            <td className="p-3 text-green-600 text-right font-mono">
              {formatCurrency(p.paid)}
            </td>
            <td className="p-3 text-orange-600 text-right font-mono">
              {formatCurrency(p.outstanding)}
            </td>
            <td className="p-3 text-red-600 text-right font-mono">
              {formatCurrency(p.rejected)}
            </td>
          </tr>
        ))}
    </tbody>
  </table>
);

export {
  RevenueDetailsModalContent,
  DistributionDetailsModalContent,
  StatusDetailsModalContent,
};
