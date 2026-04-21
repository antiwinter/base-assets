import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList, Rectangle,
} from 'recharts';
import { fmtHuman } from '../types';
import type { CashFlowItem } from '../types';
import {
  buildDriversWithRates,
  splitTop3,
  INCOME_COLORS,
  EXPENSE_COLORS,
  findTopmostPositiveKey,
  findBottommostNegativeKey,
} from './cashflowChartShared';

interface Props {
  items: CashFlowItem[];
  rate: number;   // currency conversion rate (1 for USD, cnyRate for CNY)
  symbol: string; // '¥' or '$'
  prices: Map<string, number>; // symbol → USD price (e.g. CNY→0.15, USD→1)
  year: number;
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
  incomeTop1: number;
  incomeTop2: number;
  incomeTop3: number;
  incomeOthers: number;
  expenseTop1: number;
  expenseTop2: number;
  expenseTop3: number;
  expenseOthers: number;
}

const INCOME_RENDER_ORDER = ['incomeTop3', 'incomeTop2', 'incomeTop1', 'incomeOthers'] as const;
const EXPENSE_RENDER_ORDER = ['expenseTop3', 'expenseTop2', 'expenseTop1', 'expenseOthers'] as const;

export default function CashFlowChart({ items, rate, symbol, prices, year }: Props) {
  const data = useMemo(() => {
    const drivers = buildDriversWithRates(items, rate, prices);

    let cumulative = 0;
    const result: MonthData[] = [];

    for (let m = 1; m <= 12; m++) {
      let income = 0;
      let expense = 0;
      const details: { name: string; value: number }[] = [];
      const incomeItems: { name: string; value: number }[] = [];
      const expenseItems: { name: string; value: number }[] = [];

      for (const driver of drivers) {
        const raw = driver.getMonthValue(year, m);
        const value = Math.round(raw * driver.convRate);
        if (value > 0) {
          income += value;
          incomeItems.push({ name: driver.itemName, value });
        } else if (value < 0) {
          expense += value;
          expenseItems.push({ name: driver.itemName, value });
        }
        if (value !== 0) {
          details.push({ name: driver.itemName, value });
        }
      }

      const topIncome = splitTop3(incomeItems, false);
      const topExpense = splitTop3(expenseItems, true);

      cumulative += income + expense;
      result.push({
        month: MONTHS[m - 1],
        income,
        expense,
        net: income + expense,
        cumulative,
        details,
        incomeTop1: topIncome.top1,
        incomeTop2: topIncome.top2,
        incomeTop3: topIncome.top3,
        incomeOthers: topIncome.others,
        expenseTop1: topExpense.top1,
        expenseTop2: topExpense.top2,
        expenseTop3: topExpense.top3,
        expenseOthers: topExpense.others,
      });
    }
    return result;
  }, [items, rate, prices, year]);

  if (items.length === 0) {
    return <div className="chart-empty">No cashflow items</div>;
  }

  return (
    <div className="chart-container">
      <h3>Monthly Cashflow — {year}</h3>
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
          <Bar
            dataKey="incomeTop3"
            name="Income Top3"
            stackId="income"
            fill={INCOME_COLORS[0]}
            shape={(props: any) => {
              const topKey = findTopmostPositiveKey(props.payload as Record<string, number>, INCOME_RENDER_ORDER);
              return <Rectangle {...props} radius={topKey === 'incomeTop3' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="incomeTop2"
            name="Income Top2"
            stackId="income"
            fill={INCOME_COLORS[1]}
            shape={(props: any) => {
              const topKey = findTopmostPositiveKey(props.payload as Record<string, number>, INCOME_RENDER_ORDER);
              return <Rectangle {...props} radius={topKey === 'incomeTop2' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="incomeTop1"
            name="Income Top1"
            stackId="income"
            fill={INCOME_COLORS[2]}
            shape={(props: any) => {
              const topKey = findTopmostPositiveKey(props.payload as Record<string, number>, INCOME_RENDER_ORDER);
              return <Rectangle {...props} radius={topKey === 'incomeTop1' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="incomeOthers"
            name="Income Others"
            stackId="income"
            fill={INCOME_COLORS[3]}
            shape={(props: any) => {
              const topKey = findTopmostPositiveKey(props.payload as Record<string, number>, INCOME_RENDER_ORDER);
              return <Rectangle {...props} radius={topKey === 'incomeOthers' ? [3, 3, 0, 0] : 0} />;
            }}
          >
            <LabelList
              dataKey="net"
              position="top"
              formatter={(v: number) => `${v >= 0 ? '+' : ''}${fmtHuman(v)}`}
              style={{ fontSize: 11, fontWeight: 600 }}
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

          <Bar
            dataKey="expenseTop3"
            name="Expense Top3"
            stackId="expense"
            fill={EXPENSE_COLORS[0]}
            shape={(props: any) => {
              const bottomKey = findBottommostNegativeKey(props.payload as Record<string, number>, EXPENSE_RENDER_ORDER);
              return <Rectangle {...props} radius={bottomKey === 'expenseTop3' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="expenseTop2"
            name="Expense Top2"
            stackId="expense"
            fill={EXPENSE_COLORS[1]}
            shape={(props: any) => {
              const bottomKey = findBottommostNegativeKey(props.payload as Record<string, number>, EXPENSE_RENDER_ORDER);
              return <Rectangle {...props} radius={bottomKey === 'expenseTop2' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="expenseTop1"
            name="Expense Top1"
            stackId="expense"
            fill={EXPENSE_COLORS[2]}
            shape={(props: any) => {
              const bottomKey = findBottommostNegativeKey(props.payload as Record<string, number>, EXPENSE_RENDER_ORDER);
              return <Rectangle {...props} radius={bottomKey === 'expenseTop1' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="expenseOthers"
            name="Expense Others"
            stackId="expense"
            fill={EXPENSE_COLORS[3]}
            shape={(props: any) => {
              const bottomKey = findBottommostNegativeKey(props.payload as Record<string, number>, EXPENSE_RENDER_ORDER);
              return <Rectangle {...props} radius={bottomKey === 'expenseOthers' ? [3, 3, 0, 0] : 0} />;
            }}
          />
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
