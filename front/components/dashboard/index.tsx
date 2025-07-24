
export const Trend: React.FC<{current: number, previous: number}> = ({ current, previous }) => {
  if (previous === 0) return null;
  const diff = current - previous;
  const percent = ((diff) / Math.abs(previous)) * 100;
  if (Math.abs(percent) < 0.1) return null;
  return (
    <span className={"ml-2 text-xs font-semibold inline-flex items-center " + (diff > 0 ? 'text-green-600' : 'text-red-600')} aria-label={diff > 0 ? 'En hausse' : 'En baisse'}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(percent).toFixed(1)}%
    </span>
  );
};

export const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; tooltip: string; trend?: React.ReactNode }> = ({ title, value, icon, tooltip, trend }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm flex items-center relative group" tabIndex={0} aria-label={title}>
    <div className="bg-slate-100 rounded-full p-3 mr-4">
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-800 flex items-center">{value} {trend}</p>
    </div>
    <div className="absolute top-0 right-0 mt-2 mr-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none group-focus:pointer-events-auto z-10">
      <span className="bg-slate-700 text-white text-xs rounded px-2 py-1 shadow-lg">{tooltip}</span>
    </div>
  </div>
);
