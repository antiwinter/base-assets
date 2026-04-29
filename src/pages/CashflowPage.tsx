import CashFlowChart from '../components/CashFlowChart';
import YearlyCashFlowChart from '../components/YearlyCashFlowChart';
import { useSettingStore } from '../settingStore';
import type { AppPageContext } from '../App';

export default function CashflowPage({ ctx }: { ctx: AppPageContext }) {
  const { cfItems, cfPrices, rate, snapshots } = ctx;
  const { currentYear, setCurrentYear } = useSettingStore();

  return (
    <>
      <h2 className="section-title">Cashflow</h2>
      <CashFlowChart
        items={cfItems}
        snapshots={snapshots}
        rate={rate}
        prices={cfPrices}
        year={currentYear}
      />
      <YearlyCashFlowChart
        items={cfItems}
        snapshots={snapshots}
        rate={rate}
        prices={cfPrices}
        selectedYear={currentYear}
        onSelectYear={setCurrentYear}
      />
    </>
  );
}
