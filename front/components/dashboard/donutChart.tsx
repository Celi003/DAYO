import { Suspense } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatCurrency } from "../../utils/helpers";

const CustomDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="bg-white p-3 rounded shadow-lg border text-sm min-w-[180px]">
        <div className="font-bold mb-1">{entry.name}</div>
        <div className="flex justify-between items-center mb-1">
          <span>Pourcentage</span>
          <span className="font-mono">{entry.value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

export const DonutChart: React.FC<{ data: Array<{ name: string; value: number; color: string }>; }> = ({ data }) => {
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
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            label={({ name, value }) => `${name}: ${value}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomDonutTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry: any) => (
              <span style={{ color: entry.color }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </Suspense>
  );
};
