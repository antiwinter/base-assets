import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Snapshot } from '../types';
import { fmtCurrency } from '../currencyStore';

interface Props {
  snapshot: Snapshot | undefined;
  rate: number;
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#c0392b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b',
  '#a855f7', '#0ea5e9', '#84cc16',
];

export default function AllocationChart({ snapshot, rate }: Props) {
  if (!snapshot) return null;

  const data = snapshot.accounts
    .filter((a) => a.valueUsd > 0)
    .map((a) => ({ name: `${a.platform}${a.account ? '/' + a.account : ''} (${a.unit})`, value: Math.round(a.valueUsd * rate * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) return <div className="chart-empty">No positive assets</div>;

  return (
    <div className="chart-container">
      <h3>Asset Allocation</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => fmtCurrency(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
