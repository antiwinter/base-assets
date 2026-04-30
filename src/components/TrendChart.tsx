import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { CAT_COLORS } from '../types';
import { fmtCurrency, useSettingStore } from '../settingStore';
import type { Snapshot } from '../types';

interface Props {
  snapshots: Snapshot[];
  rate: number;
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
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

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#64748b',
  textDecoration: 'none',
  cursor: 'pointer',
};

const linkDisabledStyle: React.CSSProperties = {
  ...linkStyle,
  color: '#cbd5e1',
  cursor: 'default',
};

export default function TrendChart({ snapshots, rate, selectedIndex, onSelectIndex }: Props) {
  const showFixed = useSettingStore((s) => s.showFixed);
  if (snapshots.length === 0) return null;

  const data = snapshots.map((s) => ({
    ts: s.date,
    fiat: Math.round(s.fiatUsd * rate),
    digital: Math.round(s.digitalUsd * rate),
    stock: Math.round(s.stockUsd * rate),
    fixed: showFixed ? Math.round(s.fixedUsd * rate) : 0,
    debt: Math.round(Math.abs(s.debtUsd) * rate),
  }));

  const monthlyTicks = getMonthlyTicks(data);
  const isFirst = selectedIndex <= 0;
  const isLast = selectedIndex >= snapshots.length - 1;
  const selectedTs = snapshots[selectedIndex]?.date;

  const handleChartClick = (state: any) => {
    if (!state?.activeLabel) return;
    const clickedTs = Number(state.activeLabel);
    // Find nearest snapshot
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < snapshots.length; i++) {
      const dist = Math.abs(snapshots[i].date - clickedTs);
      if (dist < minDist) { minDist = dist; nearest = i; }
    }
    onSelectIndex(nearest);
  };

  return (
    <div className="chart-container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 4 }}>
        <a
          href="#"
          style={isFirst ? linkDisabledStyle : linkStyle}
          onClick={(e) => { e.preventDefault(); if (!isFirst) onSelectIndex(selectedIndex - 1); }}
        >← prev</a>
        <a
          href="#"
          style={isLast ? linkDisabledStyle : linkStyle}
          onClick={(e) => { e.preventDefault(); if (!isLast) onSelectIndex(selectedIndex + 1); }}
        >next →</a>
        <a
          href="#"
          style={isLast ? linkDisabledStyle : linkStyle}
          onClick={(e) => { e.preventDefault(); if (!isLast) onSelectIndex(snapshots.length - 1); }}
        >latest</a>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} onClick={handleChartClick}>
          {data.map((d) => (
            <ReferenceLine
              key={d.ts}
              x={d.ts}
              stroke={d.ts === selectedTs ? '#f88' : '#e2e8f0'}
              strokeDasharray={d.ts === selectedTs ? undefined : '3 3'}
              strokeWidth={d.ts === selectedTs ? 2 : 1}
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
            tickFormatter={(v) => fmtCurrency({ v })}
          />
          <Tooltip
            labelFormatter={(ts: number) => fmtAxisDate(ts)}
            formatter={(v: number) => fmtCurrency({ v })}
            itemSorter={(item: any) => {
              const order: Record<string, number> = { Fiat: 0, Stock: 1, Digital: 2, Fixed: 3, Debt: 4 };
              return order[item.name] ?? 5;
            }}
          />
          <Legend />
          {showFixed && (
            <Area
              type="monotone"
              dataKey="fixed"
              name="Fixed"
              stackId="1"
              fill={CAT_COLORS.Fixed}
              stroke={CAT_COLORS.Fixed}
              fillOpacity={1}
            />
          )}
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
