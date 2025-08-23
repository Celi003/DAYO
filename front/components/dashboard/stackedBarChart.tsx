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

const CustomStackedBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded shadow-lg border text-sm min-w-[200px]">
        <div className="font-bold mb-2">{label}</div>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex justify-between items-center mb-1">
            <span className="inline-flex items-center">
              <span
                className="w-3 h-3 rounded mr-2"
                style={{ background: entry.color }}
              ></span>
              {entry.name}
            </span>
            <span className="font-mono">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const StackedBarChart: React.FC<{
  data: Array<{
    partner: string;
    total: number;
    paid: number;
    pending: number;
    rejected: number;
  }>;
}> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Aucune donnée disponible
      </div>
    );
  }
  
  const chartData = data.map(item => ({
    partner: item.partner,
    Payé: Number(item.paid) || 0,
    "En attente": Number(item.pending) || 0,
    Rejeté: Number(item.rejected) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barSize={30}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="partner" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="Payé" stackId="a" fill="#10b981" />
        <Bar dataKey="En attente" stackId="a" fill="#f59e0b" />
        <Bar dataKey="Rejeté" stackId="a" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
};
