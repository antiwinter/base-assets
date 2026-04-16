import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { CAT_COLORS } from '../types';
import type { Snapshot } from '../types';

interface Props {
  snapshots: Snapshot[];
  rate: number;
  symbol: string;
}

function fmtAxisDate(ts: number): string {
  const d = new Date(ts);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}/${mm}`;
}

function getMonthlyTicks(data: { ts: number }[]): number[] {
  if (data.length === 0) return [];
  const min = data[0].ts;
  const max = data[data.length - 1].ts;
  const ticks: number[] = [];
  const d = new Date(min);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() < min) d.setMonth(d.getMonth() + 1);
  while (d.getTime() <= max) {
    ticks.push(d.getTime());
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}

export default function TrendChart({ snapshots, rate, symbol }: Props) {
  if (snapshots.length === 0) return null;

  const data = snapshots.map((s) => ({
    ts: s.date,
    fiat: Math.round(s.fiatUsd * rate),
    digital: Math.round(s.digitalUsd * rate),
    stock: Math.round(s.stockUsd * rate),
    debt: Math.round(Math.abs(s.debtUsd) * rate),
  }));

  const monthlyTicks = getMonthlyTicks(data);

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          {data.map((d) => (
            <ReferenceLine
              key={d.ts}
              x={d.ts}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
          ))}
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={monthlyTicks}
            tickFormatter={fmtAxisDate}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${symbol}${(v / 1_000_000).toFixed(1)}m`}
          />
          <Tooltip
            labelFormatter={(ts: number) => fmtAxisDate(ts)}
            formatter={(v: number) => {
              const abs = Math.abs(v);
              if (abs >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(2)}m`;
              if (abs >= 1_000) return `${symbol}${(v / 1_000).toFixed(1)}k`;
              return `${symbol}${v.toFixed(0)}`;
            }}
            itemSorter={(item: any) => {
              const order: Record<string, number> = { Fiat: 0, Stock: 1, Digital: 2, Debt: 3 };
              return order[item.name] ?? 4;
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="digital"
            name="Digital"
            stackId="1"
            fill={CAT_COLORS.Digital}
            stroke={CAT_COLORS.Digital}
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="stock"
            name="Stock"
            stackId="1"
            fill={CAT_COLORS.Stock}
            stroke={CAT_COLORS.Stock}
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="fiat"
            name="Fiat"
            stackId="1"
            fill={CAT_COLORS.Fiat}
            stroke={CAT_COLORS.Fiat}
            fillOpacity={1}
          />
          <Line
            type="monotone"
            dataKey="debt"
            name="Debt"
            stroke={CAT_COLORS.Debt}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
