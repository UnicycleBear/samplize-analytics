import type { SalesChannelRow } from "@/lib/analytics";

type Props = {
  rows: SalesChannelRow[];
};

export function SalesChannelTable({ rows }: Props) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h3 className="font-semibold">Revenue by sales channel (MoM)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-white/10">
              <th className="px-5 py-3 font-medium">Channel</th>
              <th className="px-5 py-3 font-medium text-right">Revenue</th>
              <th className="px-5 py-3 font-medium text-right">Prev month</th>
              <th className="px-5 py-3 font-medium text-right">MoM %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.channel}
                className="border-b border-white/5 hover:bg-white/5"
              >
                <td className="px-5 py-3 font-medium">{row.channel}</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {formatCurrency(row.revenue)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-ink-muted">
                  {formatCurrency(row.revenuePrevMonth)}
                </td>
                <td
                  className={`px-5 py-3 text-right tabular-nums ${
                    row.momChangePercent > 0
                      ? "text-emerald-400"
                      : row.momChangePercent < 0
                        ? "text-rose-400"
                        : "text-ink-muted"
                  }`}
                >
                  {row.momChangePercent > 0 ? "+" : ""}
                  {row.momChangePercent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
