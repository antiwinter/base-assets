import type { Snapshot } from '../types';

interface Props {
  snapshots: Snapshot[];
  rate: number;
  symbol: string;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

function fmtVal(v: number, sym: string): string {
  return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DetailTable({ snapshots, rate, symbol }: Props) {
  if (snapshots.length === 0) return null;

  const rows = [...snapshots].reverse();

  return (
    <div className="detail-table-container">
      <h3>Snapshot History</h3>
      <table className="detail-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Net Worth</th>
            <th>Fiat</th>
            <th>Digital</th>
            <th>Stock</th>
            <th>Debt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.date}>
              <td>{fmtDate(s.date)}</td>
              <td>{fmtVal(s.totalUsd * rate, symbol)}</td>
              <td>{fmtVal(s.fiatUsd * rate, symbol)}</td>
              <td>{fmtVal(s.digitalUsd * rate, symbol)}</td>
              <td>{fmtVal(s.stockUsd * rate, symbol)}</td>
              <td className="debt-cell">{fmtVal(s.debtUsd * rate, symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
