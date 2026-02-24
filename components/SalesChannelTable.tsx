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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-analytics-navy-primary text-white">
              <th className="px-5 py-3 font-medium uppercase tracking-wider text-left">
                Channel
              </th>
              <th className="px-5 py-3 font-medium uppercase tracking-wider text-right">
                Revenue
              </th>
              <th className="px-5 py-3 font-medium uppercase tracking-wider text-right">
                Prev month
              </th>
              <th className="px-5 py-3 font-medium uppercase tracking-wider text-right">
                MoM %
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.channel}
                className={`border-b border-analytics-border-light hover:bg-analytics-teal-light/10 ${
                  i % 2 === 1 ? "bg-analytics-table-stripe" : "bg-white"
                }`}
              >
                <td className="px-5 py-3 font-medium text-analytics-navy-primary">
                  {row.channel}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-bold text-analytics-navy-primary">
                  {formatCurrency(row.revenue)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-analytics-gray-text">
                  {formatCurrency(row.revenuePrevMonth)}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                      row.momChangePercent > 0
                        ? "bg-analytics-positive/15 text-analytics-positive"
                        : row.momChangePercent < 0
                          ? "bg-analytics-negative/15 text-analytics-negative"
                          : "bg-analytics-gray-text/10 text-analytics-gray-text"
                    }`}
                  >
                    {row.momChangePercent > 0 ? "+" : ""}
                    {row.momChangePercent.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
