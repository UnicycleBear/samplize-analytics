import type { TopProductRow } from "@/lib/analytics";

type Props = { rows: TopProductRow[] };

export function TopProductsTable({ rows }: Props) {
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
                #
              </th>
              <th className="px-5 py-3 font-medium uppercase tracking-wider text-left">
                Product
              </th>
              <th className="px-5 py-3 font-medium uppercase tracking-wider text-right">
                Units sold
              </th>
              <th className="px-5 py-3 font-medium uppercase tracking-wider text-right">
                Revenue
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.title}-${i}`}
                className={`border-b border-analytics-border-light hover:bg-analytics-teal-light/10 ${
                  i % 2 === 1 ? "bg-analytics-table-stripe" : "bg-white"
                }`}
              >
                <td className="px-5 py-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-analytics-teal-accent text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-analytics-navy-primary truncate max-w-[200px]" title={row.title}>
                  {row.title}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-analytics-gray-text">
                  {row.unitsSold}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-bold text-analytics-navy-primary">
                  {formatCurrency(row.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
