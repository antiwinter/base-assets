import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import type { Snapshot } from '../types';

interface Props {
  snapshots: Snapshot[];
  rate: number;
  symbol: string;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function TrendChart({ snapshots, rate, symbol }: Props) {
  if (snapshots.length === 0) return null;

  const data = snapshots.map((s) => ({
    date: fmtDate(s.date),
    fiat: Math.round(s.fiatUsd * rate),
    digital: Math.round(s.digitalUsd * rate),
    stock: Math.round(s.stockUsd * rate),
    debt: Math.round(Math.abs(s.debtUsd) * rate),
  }));

  return (
    <div className="chart-container">
      <h3>Worth Trend</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}K`} />
          <Tooltip formatter={(v: number) => `${symbol}${v.toLocaleString()}`} />
          <Legend />
          <Area
            type="monotone"
            dataKey="fiat"
            name="Fiat"
            stackId="1"
            fill="#22c55e"
            fillOpacity={0.4}
            stroke="#22c55e"
          />
          <Area
            type="monotone"
            dataKey="digital"
            name="Digital"
            stackId="1"
            fill="#f59e0b"
            fillOpacity={0.4}
            stroke="#f59e0b"
          />
          <Area
            type="monotone"
            dataKey="stock"
            name="Stock"
            stackId="1"
            fill="#3b82f6"
            fillOpacity={0.4}
            stroke="#3b82f6"
          />
          <Line
            type="monotone"
            dataKey="debt"
            name="Debt"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
