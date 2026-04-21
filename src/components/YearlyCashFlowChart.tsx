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
  expenseTop1: number;
  expenseTop2: number;
  expenseTop3: number;
  expenseOthers: number;
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
      const incomeItems: { value: number }[] = [];
      const expenseItems: { value: number }[] = [];

      for (let m = 1; m <= 12; m++) {
        for (const driver of drivers) {
          const raw = driver.getMonthValue(y, m);
          const value = Math.round(raw * driver.convRate);
          if (value > 0) {
            income += value;
            incomeItems.push({ value });
          } else if (value < 0) {
            expense += value;
            expenseItems.push({ value });
          }
        }
      }

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
        expenseTop1: topExpense.top1,
        expenseTop2: topExpense.top2,
        expenseTop3: topExpense.top3,
        expenseOthers: topExpense.others,
      });
    }
    return result;
  }, [items, rate, prices, startYear, selectedYear]);

  if (items.length === 0) return null;

  const handleClick = (state: any) => {
    if (state?.activeLabel != null) {
      onSelectYear(Number(state.activeLabel));
    }
  };

  return (
    <div className="chart-container">
      <h3>Yearly Cashflow — {startYear}–{startYear + YEAR_COUNT - 1}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={0} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => String(v).slice(2)}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${symbol}${fmtHuman(v)}`}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          <Tooltip
            formatter={(v: number, name: string) => [`${symbol}${fmtHuman(v)}`, name]}
            labelFormatter={(label: string) => String(label)}
          />
          <ReferenceArea
            x1={selectedYear - 0.4}
            x2={selectedYear + 0.4}
            fill="#6366f1"
            fillOpacity={0.08}
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
