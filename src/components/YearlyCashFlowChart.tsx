import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList, ReferenceArea, Rectangle,
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
  rate: number;
  symbol: string;
  prices: Map<string, number>;
  selectedYear: number;
  onSelectYear: (year: number) => void;
}

interface YearData {
  year: number;
  income: number;
  expense: number;
  net: number;
  selected: boolean;
  incomeTop1: number;
  incomeTop2: number;
  incomeTop3: number;
  incomeOthers: number;
  incomeTop1Name?: string;
  incomeTop2Name?: string;
  incomeTop3Name?: string;
  expenseTop1: number;
  expenseTop2: number;
  expenseTop3: number;
  expenseOthers: number;
  expenseTop1Name?: string;
  expenseTop2Name?: string;
  expenseTop3Name?: string;
}

const YEAR_COUNT = 20;
const INCOME_RENDER_ORDER = ['incomeTop3', 'incomeTop2', 'incomeTop1', 'incomeOthers'] as const;
const EXPENSE_RENDER_ORDER = ['expenseTop3', 'expenseTop2', 'expenseTop1', 'expenseOthers'] as const;

export default function YearlyCashFlowChart({ items, rate, symbol, prices, selectedYear, onSelectYear }: Props) {
  const startYear = new Date().getFullYear();

  const data = useMemo(() => {
    const drivers = buildDriversWithRates(items, rate, prices);

    const result: YearData[] = [];
    for (let yi = 0; yi < YEAR_COUNT; yi++) {
      const y = startYear + yi;
      let income = 0;
      let expense = 0;
      const incomeByDriver = new Map<string, number>();
      const expenseByDriver = new Map<string, number>();

      for (let m = 1; m <= 12; m++) {
        for (const driver of drivers) {
          const raw = driver.getMonthValue(y, m);
          const value = Math.round(raw * driver.convRate);
          if (value > 0) {
            income += value;
            incomeByDriver.set(driver.itemName, (incomeByDriver.get(driver.itemName) ?? 0) + value);
          } else if (value < 0) {
            expense += value;
            expenseByDriver.set(driver.itemName, (expenseByDriver.get(driver.itemName) ?? 0) + value);
          }
        }
      }

      const incomeItems = Array.from(incomeByDriver.entries()).map(([name, value]) => ({ name, value }));
      const expenseItems = Array.from(expenseByDriver.entries()).map(([name, value]) => ({ name, value }));
      const topIncome = splitTop3(incomeItems, false);
      const topExpense = splitTop3(expenseItems, true);

      result.push({
        year: y,
        income,
        expense,
        net: income + expense,
        selected: y === selectedYear,
        incomeTop1: topIncome.top1,
        incomeTop2: topIncome.top2,
        incomeTop3: topIncome.top3,
        incomeOthers: topIncome.others,
        incomeTop1Name: topIncome.top1Name,
        incomeTop2Name: topIncome.top2Name,
        incomeTop3Name: topIncome.top3Name,
        expenseTop1: topExpense.top1,
        expenseTop2: topExpense.top2,
        expenseTop3: topExpense.top3,
        expenseOthers: topExpense.others,
        expenseTop1Name: topExpense.top1Name,
        expenseTop2Name: topExpense.top2Name,
        expenseTop3Name: topExpense.top3Name,
      });
    }
    return result;
  }, [items, rate, prices, startYear, selectedYear]);

  if (items.length === 0) return null;

  const yMax = Math.max(...data.map(d => d.income)) * 1.2;
  const yMin = Math.min(...data.map(d => d.expense)) * 1.2;

  const handleClick = (state: any) => {
    if (state?.activeLabel != null) {
      onSelectYear(Number(state.activeLabel));
    }
  };

  return (
    <div className="chart-container">
      <h3>Yearly Cashflow — {startYear}–{startYear + YEAR_COUNT - 1}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          barGap={0}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => String(v).slice(2)}
            padding={{ left: 12, right: 4 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${symbol}${fmtHuman(v)}`}
            domain={[yMin, yMax]}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          <Tooltip
            cursor={{ fill: '#f36661', fillOpacity: 0.1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as YearData;
              const rows: { label: string; value: number; bold?: boolean }[] = [
                { label: 'Income', value: d.income, bold: true },
                { label: `  ${d.incomeTop1Name ?? 'Top1'}`, value: d.incomeTop1 },
                { label: `  ${d.incomeTop2Name ?? 'Top2'}`, value: d.incomeTop2 },
                { label: `  ${d.incomeTop3Name ?? 'Top3'}`, value: d.incomeTop3 },
                { label: '  Others', value: d.incomeOthers },
                { label: 'Expense', value: d.expense, bold: true },
                { label: `  ${d.expenseTop1Name ?? 'Top1'}`, value: d.expenseTop1 },
                { label: `  ${d.expenseTop2Name ?? 'Top2'}`, value: d.expenseTop2 },
                { label: `  ${d.expenseTop3Name ?? 'Top3'}`, value: d.expenseTop3 },
                { label: '  Others', value: d.expenseOthers },
              ].filter(r => r.value !== 0);
              return (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: '#f1f5f9' }}>{d.year}</div>
                  {rows.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, lineHeight: '1.6' }}>
                      <span style={{ color: r.bold ? '#f1f5f9' : '#94a3b8', fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                      <span style={{ color: '#f1f5f9', fontWeight: r.bold ? 700 : 400 }}>{symbol}{fmtHuman(r.value)}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <ReferenceArea
            x1={selectedYear}
            x2={selectedYear}
            fill="#f36661"
            fillOpacity={0.12}
            ifOverflow="visible"
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
              content={({ x, y, width, value }: any) => {
                const v = value as number;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={10}
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
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
