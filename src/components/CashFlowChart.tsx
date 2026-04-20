import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Cell, LabelList,
} from 'recharts';
import { fmtHuman } from '../types';
import type { CashFlowItem } from '../types';
import { createDriver } from '../cf-drivers/driver';

interface Props {
  items: CashFlowItem[];
  rate: number;   // currency conversion rate (1 for USD, cnyRate for CNY)
  symbol: string; // '¥' or '$'
  prices: Map<string, number>; // symbol → USD price (e.g. CNY→0.15, USD→1)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthData {
  month: string;
  income: number;
  expense: number;
  net: number;
  cumulative: number;
  details: { name: string; value: number }[];
}

export default function CashFlowChart({ items, rate, symbol, prices }: Props) {
  const year = new Date().getFullYear();
  const cnyPriceUsd = prices.get('CNY') || 0.15;

  const data = useMemo(() => {
    const displayingCny = rate !== 1;
    const drivers = items.map((item) => {
      // Look up item's unit price in USD; no unit → CNY
      const unitPriceUsd = item.unit ? (prices.get(item.unit) ?? 1) : cnyPriceUsd;
      // Conversion: item's native value → display currency
      // displayCNY: value × (unitPriceUsd / cnyPriceUsd)
      // displayUSD: value × unitPriceUsd
      const convRate = displayingCny
        ? unitPriceUsd / cnyPriceUsd
        : unitPriceUsd;
      return { driver: createDriver(item), convRate };
    });

    let cumulative = 0;
    const result: MonthData[] = [];

    for (let m = 1; m <= 12; m++) {
      let income = 0;
      let expense = 0;
      const details: { name: string; value: number }[] = [];

      for (const { driver, convRate } of drivers) {
        const raw = driver.getMonthValue(year, m);
        const value = Math.round(raw * convRate);
        if (value > 0) income += value;
        else if (value < 0) expense += value;
        if (value !== 0) {
          details.push({ name: driver.item.item, value });
        }
      }

      cumulative += income + expense;
      result.push({
        month: MONTHS[m - 1],
        income,
        expense,
        net: income + expense,
        cumulative,
        details,
      });
    }
    return result;
  }, [items, rate, symbol, prices, cnyPriceUsd, year]);

  if (items.length === 0) {
    return <div className="chart-empty">No cash flow items</div>;
  }

  return (
    <div className="chart-container">
      <h3>Monthly Cash Flow — {year}</h3>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} barGap={0}>
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${symbol}${fmtHuman(v)}`}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          <Tooltip
            formatter={(v: number, name: string) => [`${symbol}${fmtHuman(v)}`, name]}
            labelFormatter={(label: string) => label}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as MonthData | undefined;
              if (!d) return null;
              return (
                <div style={{
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 6, padding: '8px 12px', fontSize: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ color: '#8dc77b' }}>Income: {symbol}{fmtHuman(d.income)}</div>
                  <div style={{ color: '#ff6262' }}>Expense: {symbol}{fmtHuman(d.expense)}</div>
                  <div style={{ color: '#334155', fontWeight: 500 }}>Net: {symbol}{fmtHuman(d.net)}</div>
                  <div style={{ color: '#6366f1', fontWeight: 500 }}>
                    Cumulative: {symbol}{fmtHuman(d.cumulative)}
                  </div>
                  {d.details.length > 0 && (
                    <>
                      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />
                      {d.details.map((det, i) => (
                        <div key={i} style={{ color: det.value > 0 ? '#8dc77b' : '#ff6262' }}>
                          {det.name}: {symbol}{fmtHuman(det.value)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            }}
          />
          <Legend />
          <Bar dataKey="income" name="Income" fill="#8dc77b" radius={[3, 3, 0, 0]}>
            <LabelList
              dataKey="net"
              position="top"
              formatter={(v: number) => `${v >= 0 ? '+' : ''}${fmtHuman(v)}`}
              style={{ fontSize: 11, fontWeight: 600 }}
              fill="" // overridden per-entry below
              content={({ x, y, width, value }: any) => {
                const v = value as number;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={v >= 0 ? '#8dc77b' : '#ff6262'}
                  >
                    {v >= 0 ? '+' : ''}{fmtHuman(v)}
                  </text>
                );
              }}
            />
          </Bar>
          <Bar dataKey="expense" name="Expense" radius={[0, 0, 3, 3]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#ff6262" />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="cumulative"
            name="Cumulative"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
