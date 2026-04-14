import type { Snapshot } from '../types';

interface Props {
  snapshots: Snapshot[];
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

function fmtUsd(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DetailTable({ snapshots }: Props) {
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
            <th>Debt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.date}>
              <td>{fmtDate(s.date)}</td>
              <td>{fmtUsd(s.totalUsd)}</td>
              <td>{fmtUsd(s.fiatUsd)}</td>
              <td>{fmtUsd(s.digitalUsd)}</td>
              <td className="debt-cell">{fmtUsd(s.debtUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
