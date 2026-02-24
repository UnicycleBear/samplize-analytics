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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val);
    case "percent":
      return `${val.toFixed(1)}%`;
    case "decimal":
      return val.toFixed(2);
    default:
      return new Intl.NumberFormat("en-US").format(val);
  }
}

function ArrowUp() {
  return (
    <svg className="w-3.5 h-3.5 inline-block mr-0.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg className="w-3.5 h-3.5 inline-block mr-0.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
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
  const isPositive = comparison ? comparison.changePercent > 0 : false;
  const isNegative = comparison ? comparison.changePercent < 0 : false;
  const isNeutral = comparison ? comparison.changePercent === 0 : true;

  const badgeClass =
    isPositive
      ? "bg-analytics-positive/15 text-analytics-positive"
      : isNegative
        ? "bg-analytics-negative/15 text-analytics-negative"
        : "bg-analytics-gray-text/10 text-analytics-gray-text";

  return (
    <div className="card p-5 border-l-4 border-l-analytics-teal-accent">
      <p className="text-xs font-medium text-analytics-gray-text uppercase tracking-widest">
        {title}
      </p>
      <p className="mt-2 text-analytics-navy-primary font-bold text-[2.5rem] tabular-nums leading-tight">
        {displayValue}
      </p>
      {comparison != null && (
        <div className={`mt-2 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium tabular-nums ${badgeClass}`}>
          {isPositive && <ArrowUp />}
          {isNegative && <ArrowDown />}
          {isPositive && "+"}
          {comparison.changePercent.toFixed(1)}% {comparisonLabel}
        </div>
      )}
    </div>
  );
}
