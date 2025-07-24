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
import { Partner } from "../../types";

const PIE_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#6366f1",
  "#8b5cf6",
];
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    const percent =
      entry.payload &&
      entry.payload.value &&
      entry.payload.payload &&
      entry.payload.payload.total
        ? ((entry.payload.value / entry.payload.payload.total) * 100).toFixed(1)
        : null;
    return (
      <div className="bg-white p-3 rounded shadow-lg border text-sm min-w-[180px]">
        <div className="font-bold mb-1">{entry.name}</div>
        <div className="flex justify-between items-center mb-1">
          <span>Chiffre d'affaires</span>
          <span className="font-mono">{formatCurrency(entry.value)}</span>
        </div>
        {percent && (
          <div className="text-xs text-slate-500">{percent}% du total</div>
        )}
        <div className="mt-1 text-xs text-slate-500">
          Cliquez sur une part pour filtrer par partenaire
        </div>
      </div>
    );
  }
  return null;
};

export const DPieChart: React.FC<{
  data: any[];
  setFilterPartner: (id: string) => void;
  partners: Partner[];
}> = ({ data, setFilterPartner, partners }) => {
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
            outerRadius={100}
            label
            onClick={(_, idx) => {
              const entry = data[idx];
              if (entry) {
                const partnerObj = partners.find(
                  (pt) => pt.name === entry.name
                );
                if (partnerObj) setFilterPartner(partnerObj.id);
              }
            }}
            cursor="pointer"
            aria-label="Filtrer sur le partenaire"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomPieTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Suspense>
  );
};
