import {
  startOfMonth,
  endOfMonth,
  subYears,
  subDays,
  subWeeks,
  format,
  parseISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  getWeek,
  isWithinInterval,
} from "date-fns";
import type { ShopifyOrder } from "./shopify";

export type StoreKey = "samplize" | "samplize_retail" | "combined";

export type MetricComparison = {
  current: number;
  previous: number;
  changePercent: number;
};

export type SalesChannelRow = {
  channel: string;
  revenue: number;
  revenuePrevMonth: number;
  momChangePercent: number;
};

export type StoreMetrics = {
  store: StoreKey;
  label: string;

  totalSalesMtd: MetricComparison;
  totalSalesYesterday: MetricComparison;
  ordersMtd: MetricComparison;
  ordersYesterday: MetricComparison;
  aovMtd: number;
  aovMtdPrev: number;
  aovYesterday: number;
  aovYesterdayPrev: number;
  unitsPerOrderMtd: number;
  newCustomersMtd: number;
  canadaSalesPercent: number;
  salesByChannel: SalesChannelRow[];
  dailySales: { date: string; total: number }[];
  weeklySalesByYear: { year: number; weekLabel: string; total: number }[];
};

function toNum(s: string | undefined): number {
  if (s == null || s === "") return 0;
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function orderTotal(order: ShopifyOrder): number {
  return toNum(order.current_total_price ?? order.total_price);
}

function orderDate(order: ShopifyOrder): Date {
  return parseISO(order.created_at);
}

function orderCountry(order: ShopifyOrder): string {
  const code = order.billing_address?.country_code;
  return code ? String(code).toUpperCase() : "";
}

function orderSource(order: ShopifyOrder): string {
  const s = order.source_name;
  return s && String(s).trim() ? String(s).trim() : "Other";
}

function orderUnits(order: ShopifyOrder): number {
  return (order.line_items || []).reduce((sum, li) => sum + (li.quantity || 0), 0);
}

export function computeStoreMetrics(
  orders: ShopifyOrder[],
  newCustomersCount: number,
  store: StoreKey,
  label: string,
  now: Date = new Date()
): StoreMetrics {
  const today = startOfDay(now);
  const yesterday = subDays(today, 1);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd = endOfDay(yesterday);
  const sameDayLastWeek = subWeeks(yesterday, 1);
  const sameDayLastWeekStart = startOfDay(sameDayLastWeek);
  const sameDayLastWeekEnd = endOfDay(sameDayLastWeek);

  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const lastYearMonthStart = startOfMonth(subYears(today, 1));
  const lastYearMonthEnd = endOfMonth(subYears(today, 1));

  const ordersYesterday = orders.filter((o) => {
    const d = orderDate(o);
    return d >= yesterdayStart && d <= yesterdayEnd;
  });
  const ordersSameDayLastWeek = orders.filter((o) => {
    const d = orderDate(o);
    return d >= sameDayLastWeekStart && d <= sameDayLastWeekEnd;
  });
  const ordersMtd = orders.filter((o) => {
    const d = orderDate(o);
    return d >= monthStart && d <= monthEnd;
  });
  const ordersMtdLy = orders.filter((o) => {
    const d = orderDate(o);
    return d >= lastYearMonthStart && d <= lastYearMonthEnd;
  });

  const salesYesterday = ordersYesterday.reduce((s, o) => s + orderTotal(o), 0);
  const salesSameDayLastWeek = ordersSameDayLastWeek.reduce(
    (s, o) => s + orderTotal(o),
    0
  );
  const salesMtd = ordersMtd.reduce((s, o) => s + orderTotal(o), 0);
  const salesMtdLy = ordersMtdLy.reduce((s, o) => s + orderTotal(o), 0);

  const prevMonthStart = startOfMonth(subDays(monthStart, 1));
  const prevMonthEnd = endOfMonth(subDays(monthStart, 1));
  const ordersPrevMonth = orders.filter((o) => {
    const d = orderDate(o);
    return d >= prevMonthStart && d <= prevMonthEnd;
  });

  const channelRevenueThisMonth: Record<string, number> = {};
  const channelRevenuePrevMonth: Record<string, number> = {};
  ordersMtd.forEach((o) => {
    const ch = orderSource(o);
    channelRevenueThisMonth[ch] = (channelRevenueThisMonth[ch] || 0) + orderTotal(o);
  });
  ordersPrevMonth.forEach((o) => {
    const ch = orderSource(o);
    channelRevenuePrevMonth[ch] = (channelRevenuePrevMonth[ch] || 0) + orderTotal(o);
  });
  const allChannels = new Set([
    ...Object.keys(channelRevenueThisMonth),
    ...Object.keys(channelRevenuePrevMonth),
  ]);
  const salesByChannel: SalesChannelRow[] = Array.from(allChannels).map(
    (channel) => {
      const revenue = channelRevenueThisMonth[channel] || 0;
      const revenuePrevMonth = channelRevenuePrevMonth[channel] || 0;
      const momChangePercent =
        revenuePrevMonth > 0
          ? ((revenue - revenuePrevMonth) / revenuePrevMonth) * 100
          : (revenue > 0 ? 100 : 0);
      return { channel, revenue, revenuePrevMonth, momChangePercent };
    }
  );
  salesByChannel.sort((a, b) => b.revenue - a.revenue);

  const totalSalesCanadaMtd = ordersMtd.filter(
    (o) => orderCountry(o) === "CA"
  ).reduce((s, o) => s + orderTotal(o), 0);
  const canadaSalesPercent =
    salesMtd > 0 ? (totalSalesCanadaMtd / salesMtd) * 100 : 0;

  const unitsMtd = ordersMtd.reduce((s, o) => s + orderUnits(o), 0);
  const unitsPerOrderMtd =
    ordersMtd.length > 0 ? unitsMtd / ordersMtd.length : 0;

  const aovMtd = ordersMtd.length > 0 ? salesMtd / ordersMtd.length : 0;
  const aovMtdPrev =
    ordersMtdLy.length > 0
      ? salesMtdLy / ordersMtdLy.length
      : 0;
  const aovYesterday =
    ordersYesterday.length > 0 ? salesYesterday / ordersYesterday.length : 0;
  const aovYesterdayPrev =
    ordersSameDayLastWeek.length > 0
      ? salesSameDayLastWeek / ordersSameDayLastWeek.length
      : 0;

  const change = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

  const trailingStart = subDays(today, 30);
  const dailySalesMap: Record<string, number> = {};
  eachDayOfInterval({ start: trailingStart, end: yesterday }).forEach((d) => {
    dailySalesMap[format(d, "yyyy-MM-dd")] = 0;
  });
  orders.forEach((o) => {
    const d = orderDate(o);
    if (d >= trailingStart && d <= yesterday) {
      const key = format(d, "yyyy-MM-dd");
      dailySalesMap[key] = (dailySalesMap[key] || 0) + orderTotal(o);
    }
  });
  const dailySales = Object.entries(dailySalesMap)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const years = [2024, 2025, 2026];
  const byYearWeekNum: Record<number, Record<number, number>> = {};
  years.forEach((y) => {
    byYearWeekNum[y] = {};
  });
  orders.forEach((o) => {
    const d = orderDate(o);
    const y = d.getFullYear();
    if (!years.includes(y)) return;
    const w = getWeek(d, { weekStartsOn: 0 });
    byYearWeekNum[y][w] = (byYearWeekNum[y][w] || 0) + orderTotal(o);
  });
  const allWeekNums = new Set<number>();
  years.forEach((y) => {
    Object.keys(byYearWeekNum[y]).forEach((k) => allWeekNums.add(Number(k)));
  });
  const sortedWeekNums = Array.from(allWeekNums).sort((a, b) => a - b);
  const weeklySalesByYearNormalized: { year: number; weekLabel: string; total: number }[] = [];
  sortedWeekNums.forEach((weekNum) => {
    const weekLabel = `W${weekNum}`;
    years.forEach((year) => {
      weeklySalesByYearNormalized.push({
        year,
        weekLabel,
        total: byYearWeekNum[year][weekNum] || 0,
      });
    });
  });

  return {
    store,
    label,
    totalSalesMtd: {
      current: salesMtd,
      previous: salesMtdLy,
      changePercent: change(salesMtd, salesMtdLy),
    },
    totalSalesYesterday: {
      current: salesYesterday,
      previous: salesSameDayLastWeek,
      changePercent: change(salesYesterday, salesSameDayLastWeek),
    },
    ordersMtd: {
      current: ordersMtd.length,
      previous: ordersMtdLy.length,
      changePercent: change(ordersMtd.length, ordersMtdLy.length),
    },
    ordersYesterday: {
      current: ordersYesterday.length,
      previous: ordersSameDayLastWeek.length,
      changePercent: change(
        ordersYesterday.length,
        ordersSameDayLastWeek.length
      ),
    },
    aovMtd,
    aovMtdPrev,
    aovYesterday,
    aovYesterdayPrev,
    unitsPerOrderMtd,
    newCustomersMtd: newCustomersCount,
    canadaSalesPercent,
    salesByChannel,
    dailySales,
    weeklySalesByYear: weeklySalesByYearNormalized,
  };
}

export function combineStoreMetrics(
  samplize: StoreMetrics,
  retail: StoreMetrics
): StoreMetrics {
  const sum = (a: number, b: number) => a + b;
  const sumComp = (
    c: MetricComparison,
    d: MetricComparison
  ): MetricComparison => ({
    current: c.current + d.current,
    previous: c.previous + d.previous,
    changePercent:
      c.previous + d.previous > 0
        ? ((c.current + d.current - (c.previous + d.previous)) /
            (c.previous + d.previous)) *
          100
        : c.current + d.current > 0
          ? 100
          : 0,
  });

  const channelMap: Record<string, SalesChannelRow> = {};
  [...samplize.salesByChannel, ...retail.salesByChannel].forEach((row) => {
    if (!channelMap[row.channel]) {
      channelMap[row.channel] = {
        channel: row.channel,
        revenue: 0,
        revenuePrevMonth: 0,
        momChangePercent: 0,
      };
    }
    channelMap[row.channel].revenue += row.revenue;
    channelMap[row.channel].revenuePrevMonth += row.revenuePrevMonth;
  });
  Object.values(channelMap).forEach((row) => {
    row.momChangePercent =
      row.revenuePrevMonth > 0
        ? ((row.revenue - row.revenuePrevMonth) / row.revenuePrevMonth) * 100
        : row.revenue > 0 ? 100 : 0;
  });
  const salesByChannel = Object.values(channelMap).sort(
    (a, b) => b.revenue - a.revenue
  );

  const dailyMap: Record<string, number> = {};
  samplize.dailySales.forEach(({ date, total }) => {
    dailyMap[date] = (dailyMap[date] || 0) + total;
  });
  retail.dailySales.forEach(({ date, total }) => {
    dailyMap[date] = (dailyMap[date] || 0) + total;
  });
  const dailySales = Object.entries(dailyMap)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekMap: Record<string, Record<number, number>> = {};
  [...samplize.weeklySalesByYear, ...retail.weeklySalesByYear].forEach(
    ({ year, weekLabel, total }) => {
      if (!weekMap[weekLabel]) weekMap[weekLabel] = {};
      weekMap[weekLabel][year] = (weekMap[weekLabel][year] || 0) + total;
    }
  );
  const weeklySalesByYear: { year: number; weekLabel: string; total: number }[] = [];
  [2024, 2025, 2026].forEach((year) => {
    Object.entries(weekMap).forEach(([weekLabel, byYear]) => {
      weeklySalesByYear.push({
        year,
        weekLabel,
        total: byYear[year] || 0,
      });
    });
  });

  const totalMtd =
    samplize.totalSalesMtd.current + retail.totalSalesMtd.current;
  const totalMtdLy =
    samplize.totalSalesMtd.previous + retail.totalSalesMtd.previous;
  const canadaMtd =
    (samplize.canadaSalesPercent / 100) * samplize.totalSalesMtd.current +
    (retail.canadaSalesPercent / 100) * retail.totalSalesMtd.current;
  const canadaSalesPercent = totalMtd > 0 ? (canadaMtd / totalMtd) * 100 : 0;

  const ordersMtdCombined = samplize.ordersMtd.current + retail.ordersMtd.current;
  const ordersMtdLyCombined =
    samplize.ordersMtd.previous + retail.ordersMtd.previous;
  const aovMtdCombined =
    ordersMtdCombined > 0 ? totalMtd / ordersMtdCombined : 0;
  const aovMtdLyCombined =
    ordersMtdLyCombined > 0 ? totalMtdLy / ordersMtdLyCombined : 0;
  const unitsMtd =
    samplize.unitsPerOrderMtd * samplize.ordersMtd.current +
    retail.unitsPerOrderMtd * retail.ordersMtd.current;
  const unitsPerOrderMtd =
    ordersMtdCombined > 0 ? unitsMtd / ordersMtdCombined : 0;

  return {
    store: "combined",
    label: "Combined",
    totalSalesMtd: sumComp(samplize.totalSalesMtd, retail.totalSalesMtd),
    totalSalesYesterday: sumComp(
      samplize.totalSalesYesterday,
      retail.totalSalesYesterday
    ),
    ordersMtd: sumComp(samplize.ordersMtd, retail.ordersMtd),
    ordersYesterday: sumComp(samplize.ordersYesterday, retail.ordersYesterday),
    aovMtd: aovMtdCombined,
    aovMtdPrev: aovMtdLyCombined,
    aovYesterday:
      samplize.ordersYesterday.current + retail.ordersYesterday.current > 0
        ? (samplize.totalSalesYesterday.current +
            retail.totalSalesYesterday.current) /
          (samplize.ordersYesterday.current + retail.ordersYesterday.current)
        : 0,
    aovYesterdayPrev:
      samplize.ordersYesterday.previous + retail.ordersYesterday.previous > 0
        ? (samplize.totalSalesYesterday.previous +
            retail.totalSalesYesterday.previous) /
          (samplize.ordersYesterday.previous + retail.ordersYesterday.previous)
        : 0,
    unitsPerOrderMtd,
    newCustomersMtd: samplize.newCustomersMtd + retail.newCustomersMtd,
    canadaSalesPercent,
    salesByChannel,
    dailySales,
    weeklySalesByYear,
  };
}
