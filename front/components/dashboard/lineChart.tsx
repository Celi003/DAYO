import { Suspense } from "react";
import {
  Line,
  LineChart as RechartsLineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { formatCurrency } from "../../utils/helpers";

const CustomLineTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded shadow-lg border text-sm min-w-[180px]">
        <div className="font-bold mb-1">{label}</div>
        <div className="flex justify-between items-center mb-1">
          <span>Chiffre d'affaires</span>
          <span className="font-mono">{formatCurrency(payload[0].value)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const LineChart: React.FC<{ data: Array<{ month: string; revenue: number }>; }> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Aucune donnée disponible
      </div>
    );
  }
  
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-slate-500">
          Chargement des graphiques...
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="month" 
            tick={{ fill: "#64748b" }} 
            fontSize={12} 
          />
          <YAxis
            tick={{ fill: "#64748b" }}
            fontSize={12}
            tickFormatter={(value) =>
              new Intl.NumberFormat("fr-FR", {
                notation: "compact",
              }).format(value as number)
            }
          />
          <Tooltip content={<CustomLineTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={3}
            fill="#3b82f6"
            fillOpacity={0.3}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2, fill: "#ffffff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Suspense>
  );
};
