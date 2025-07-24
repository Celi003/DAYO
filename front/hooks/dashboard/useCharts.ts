import { useMemo } from "react";
import { Invoice } from "@/types";

export function useDashboardCharts(
  filteredInvoices: Invoice[],
) {
  const lineChartData = useMemo(() => {
    const monthlyData: { [key: number]: number } = {};
    filteredInvoices.forEach((inv) => {
      const monthIndex = new Date(inv.deposit_date).getMonth();
      monthlyData[monthIndex] =
        (monthlyData[monthIndex] || 0) + inv.billed_amount;
    });
    const monthOrder = [
      "Janv.",
      "Févr.",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juil.",
      "Août",
      "Sept.",
      "Oct.",
      "Nov.",
      "Déc.",
    ];
    return monthOrder.map((name, index) => ({
      name,
      "Chiffre d'affaires": monthlyData[index] || 0,
    }));
  }, [filteredInvoices]);

  const stackedBarData = useMemo(() => {
    const monthly: Record<number, any> = {};
    filteredInvoices.forEach((inv) => {
      const m = new Date(inv.deposit_date).getMonth();
      if (!monthly[m]) {
        monthly[m] = {
          month: [
            "Janv.",
            "Févr.",
            "Mars",
            "Avril",
            "Mai",
            "Juin",
            "Juil.",
            "Août",
            "Sept.",
            "Oct.",
            "Nov.",
            "Déc.",
          ][m],
          facturé: 0,
          payé: 0,
          rejeté: 0,
          enAttente: 0,
        };
      }
      const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
      const rejected =
        inv.rejections?.reduce((s, r) => s + r.rejected_amount, 0) || 0;
      monthly[m].facturé += inv.billed_amount;
      monthly[m].payé += paid;
      monthly[m].rejeté += rejected;
      monthly[m].enAttente += inv.billed_amount - paid - rejected;
    });
    return Object.values(monthly);
  }, [filteredInvoices]);

  return {
    lineChartData,
    stackedBarData,
  };
}
