import { Suspense } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../../utils/helpers";

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded shadow-lg border text-sm min-w-[180px]">
        <div className="font-bold mb-1">{label}</div>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex justify-between items-center mb-1">
            <span className="inline-flex items-center">
              <span
                className="w-2 h-2 rounded-full mr-2"
                style={{ background: entry.color }}
              ></span>
              {entry.name}
            </span>
            <span className="font-mono">{formatCurrency(entry.value)}</span>
          </div>
        ))}
        <div className="mt-1 text-xs text-slate-500">
          Cliquez sur une barre pour filtrer par mois
        </div>
      </div>
    );
  }
  return null;
};
export const DBarChart: React.FC<{
  selectedYear: number;
  data: any[];
  setFilterMonth: (monthIndex: number) => void;
}> = ({ selectedYear, data, setFilterMonth }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-lg font-semibold mb-4">
        Évolution mensuelle par statut ({selectedYear}){" "}
        <span
          className="ml-2 text-slate-400"
          title="Montants facturés, payés, rejetés et en attente par mois."
        >
          ?
        </span>
      </h2>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full text-slate-500">
            Chargement des graphiques...
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="month" tick={{ fill: "#64748b" }} fontSize={12} />
            <YAxis
              tick={{ fill: "#64748b" }}
              fontSize={12}
              tickFormatter={(value) =>
                new Intl.NumberFormat("fr-FR", {
                  notation: "compact",
                }).format(value as number)
              }
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Legend />
            <Bar
              dataKey="payé"
              stackId="a"
              fill="#10b981"
              name="Payé"
              onClick={(_, idx) => setFilterMonth(idx)}
              cursor="pointer"
              aria-label="Filtrer sur le mois"
            />
            <Bar
              dataKey="rejeté"
              stackId="a"
              fill="#ef4444"
              name="Rejeté"
              onClick={(_, idx) => setFilterMonth(idx)}
              cursor="pointer"
              aria-label="Filtrer sur le mois"
            />
            <Bar
              dataKey="enAttente"
              stackId="a"
              fill="#f59e0b"
              name="En attente"
              onClick={(_, idx) => setFilterMonth(idx)}
              cursor="pointer"
              aria-label="Filtrer sur le mois"
            />
          </BarChart>
        </ResponsiveContainer>
      </Suspense>
    </div>
  );
};
