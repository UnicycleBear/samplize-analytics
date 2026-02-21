type MetricComparison = {
  current: number;
  previous: number;
  changePercent: number;
};

type Props = {
  title: string;
  value: string | number;
  comparison?: MetricComparison | null;
  comparisonLabel?: string;
  format?: "currency" | "number" | "percent" | "decimal";
};

function formatValue(
  val: number,
  fmt: "currency" | "number" | "percent" | "decimal"
): string {
  switch (fmt) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val);
    case "percent":
      return `${val.toFixed(1)}%`;
    case "decimal":
      return val.toFixed(2);
    default:
      return new Intl.NumberFormat("en-US").format(val);
  }
}

export function MetricCard({
  title,
  value,
  comparison,
  comparisonLabel = "vs prior period",
  format: fmt = "number",
}: Props) {
  const displayValue =
    typeof value === "string" ? value : formatValue(Number(value), fmt);
  const isPositive = comparison
    ? comparison.changePercent > 0
    : false;
  const isNegative = comparison
    ? comparison.changePercent < 0
    : false;

  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{displayValue}</p>
      {comparison != null && (
        <p
          className={`mt-1 text-sm tabular-nums ${
            isPositive
              ? "text-emerald-400"
              : isNegative
                ? "text-rose-400"
                : "text-ink-muted"
          }`}
        >
          {isPositive && "+"}
          {comparison.changePercent.toFixed(1)}% {comparisonLabel}
        </p>
      )}
    </div>
  );
}
