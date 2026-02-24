import {
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  format,
  parseISO,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
} from "date-fns";
import type { RecentOrder } from "./bulkOperations";

export type WeeklyRevenue = { weekStart: string; revenue: number };

export type StoreKey = "samplize";

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

export type TopProductRow = {
  title: string;
  unitsSold: number;
  revenue: number;
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

  top10Products: TopProductRow[];
  refundRatePercent: number;
  repeatCustomerRatePercent: number;
  ordersPerDayMtd: number;
  grossRevenueMtd: number;
  netRevenueMtd: number;
};

/** Map Shopify source_name to display channel. */
function channelDisplayName(sourceName: string | null | undefined): string {
  if (!sourceName) return "Direct";
  const s = sourceName.toLowerCase();
  if (s === "web") return "Online Store";
  if (s.includes("android") || s.includes("ios")) return "Mobile App";
  if (s === "subscription_contract") return "Subscriptions";
  if (s === "pos") return "Retail/POS";
  if (!s || s === "") return "Direct";
  return "Other";
}

function isCancelledRecent(o: RecentOrder): boolean {
  const s = o.financialStatus.toLowerCase();
  return s === "cancelled" || s === "canceled";
}

function isRefundedRecent(o: RecentOrder): boolean {
  const s = o.financialStatus.toLowerCase();
  return s === "refunded" || s === "partially_refunded";
}

/**
 * Computes all fast metrics from a single flat array of recent orders (e.g. from bulk op).
 * MTD LY uses mtdLyOrders when provided; otherwise previous is 0.
 * weeklySalesByYear is left empty (weekly chart comes from /api/analytics/weekly).
 * New customers MTD: proxy = orders where customer has only 1 order in the dataset.
 */
export function computeMetricsFromRecentOrders(
  orders: RecentOrder[],
  mtdLyOrders: RecentOrder[] | null,
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
  const prevMonthStart = startOfMonth(subMonths(today, 1));
  const prevMonthEnd = endOfMonth(subMonths(today, 1));
  const trailing30Start = subDays(today, 30);

  const orderDate = (o: RecentOrder) => parseISO(o.createdAt);
  const effective = (o: RecentOrder) => !isCancelledRecent(o);

  const ordersMtd = orders.filter((o) => {
    const d = orderDate(o);
    return effective(o) && d >= monthStart && d <= monthEnd;
  });
  const ordersMtdLy = mtdLyOrders
    ? mtdLyOrders.filter((o) => effective(o))
    : [];
  const ordersLast30 = orders.filter((o) => {
    const d = orderDate(o);
    return effective(o) && d >= trailing30Start && d <= today;
  });
  const ordersYesterday = orders.filter((o) => {
    const d = orderDate(o);
    return effective(o) && d >= yesterdayStart && d <= yesterdayEnd;
  });
  const ordersSameDayLastWeek = orders.filter((o) => {
    const d = orderDate(o);
    return effective(o) && d >= sameDayLastWeekStart && d <= sameDayLastWeekEnd;
  });
  const ordersPrevMonth = orders.filter((o) => {
    const d = orderDate(o);
    return effective(o) && d >= prevMonthStart && d <= prevMonthEnd;
  });

  console.log("[analytics] first MTD order lineItems:", JSON.stringify(ordersMtd[0]?.lineItems));

  const salesMtd = ordersMtd.reduce((s, o) => s + o.totalPrice, 0);
  const salesMtdLy = ordersMtdLy.reduce((s, o) => s + o.totalPrice, 0);
  const salesYesterday = ordersYesterday.reduce((s, o) => s + o.totalPrice, 0);
  const salesSameDayLastWeek = ordersSameDayLastWeek.reduce((s, o) => s + o.totalPrice, 0);

  const channelRevenueThisMonth: Record<string, number> = {};
  const channelRevenuePrevMonth: Record<string, number> = {};
  ordersMtd.forEach((o) => {
    const ch = channelDisplayName(o.sourceName);
    channelRevenueThisMonth[ch] = (channelRevenueThisMonth[ch] || 0) + o.totalPrice;
  });
  ordersPrevMonth.forEach((o) => {
    const ch = channelDisplayName(o.sourceName);
    channelRevenuePrevMonth[ch] = (channelRevenuePrevMonth[ch] || 0) + o.totalPrice;
  });
  const allChannels = new Set([
    ...Object.keys(channelRevenueThisMonth),
    ...Object.keys(channelRevenuePrevMonth),
  ]);
  const salesByChannel: SalesChannelRow[] = Array.from(allChannels).map((channel) => {
    const revenue = channelRevenueThisMonth[channel] || 0;
    const revenuePrevMonth = channelRevenuePrevMonth[channel] || 0;
    const momChangePercent =
      revenuePrevMonth > 0
        ? ((revenue - revenuePrevMonth) / revenuePrevMonth) * 100
        : revenue > 0 ? 100 : 0;
    return { channel, revenue, revenuePrevMonth, momChangePercent };
  });
  salesByChannel.sort((a, b) => b.revenue - a.revenue);

  const totalSalesCanadaMtd = ordersMtd.filter((o) => o.shippingCountryCode === "CA").reduce((s, o) => s + o.totalPrice, 0);
  const canadaSalesPercent = salesMtd > 0 ? (totalSalesCanadaMtd / salesMtd) * 100 : 0;

  const totalUnitsMtd = ordersMtd.reduce((s, o) => s + o.lineItems.reduce((sum, li) => sum + li.quantity, 0), 0);
  const unitsPerOrderMtd = ordersMtd.length > 0 ? totalUnitsMtd / ordersMtd.length : 0;

  const aovMtd = ordersMtd.length > 0 ? salesMtd / ordersMtd.length : 0;
  const aovMtdPrev = ordersMtdLy.length > 0 ? salesMtdLy / ordersMtdLy.length : 0;
  const aovYesterday = ordersYesterday.length > 0 ? salesYesterday / ordersYesterday.length : 0;
  const aovYesterdayPrev = ordersSameDayLastWeek.length > 0 ? salesSameDayLastWeek / ordersSameDayLastWeek.length : 0;

  const change = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

  const grossRevenueMtd = ordersMtd.reduce((s, o) => s + o.totalPrice, 0);
  const netRevenueMtd = salesMtd;

  const refundedCountMtd = ordersMtd.filter((o) => o.hasRefund ?? isRefundedRecent(o)).length;
  const refundRatePercent = ordersMtd.length > 0 ? (refundedCountMtd / ordersMtd.length) * 100 : 0;

  // New vs repeat from within-dataset: first order date per customer (in our 65-day window)
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const firstOrderDateByCustomerId = new Map<string, string>();
  orders.forEach((o) => {
    if (!o.customerId) return;
    const d = format(orderDate(o), "yyyy-MM-dd");
    const existing = firstOrderDateByCustomerId.get(o.customerId);
    if (existing == null || d < existing) firstOrderDateByCustomerId.set(o.customerId, d);
  });
  const newCustomersMtdCount = ordersMtd.filter(
    (o) => o.customerId && (firstOrderDateByCustomerId.get(o.customerId) ?? "") >= monthStartStr
  ).length;
  const repeatOrdersMtdCount = ordersMtd.filter(
    (o) => o.customerId && (firstOrderDateByCustomerId.get(o.customerId) ?? "") < monthStartStr
  ).length;
  const repeatCustomerRatePercent = ordersMtd.length > 0 ? (repeatOrdersMtdCount / ordersMtd.length) * 100 : 0;

  const daysInPeriod = Math.max(1, Math.ceil((today.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)));
  const ordersPerDayMtd = ordersMtd.length / daysInPeriod;

  const productRevenue: Record<string, { title: string; units: number; revenue: number }> = {};
  ordersMtd.forEach((o) => {
    o.lineItems.forEach((li) => {
      const key = (li.title ?? "Unknown").trim() || "Unknown";
      const title = (li.title ?? "Unknown").trim() || "Unknown";
      const qty = li.quantity ?? 0;
      const revenue = li.lineRevenue > 0 ? li.lineRevenue : qty * (li.unitPrice ?? 0);
      if (!productRevenue[key]) productRevenue[key] = { title, units: 0, revenue: 0 };
      productRevenue[key].units += qty;
      productRevenue[key].revenue += revenue;
    });
  });
  const top10Products: TopProductRow[] = Object.values(productRevenue)
    .map(({ title, units, revenue }) => ({ title, unitsSold: units, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const dailySalesMap: Record<string, number> = {};
  eachDayOfInterval({ start: trailing30Start, end: yesterday }).forEach((d) => {
    dailySalesMap[format(d, "yyyy-MM-dd")] = 0;
  });
  ordersLast30.forEach((o) => {
    const d = orderDate(o);
    if (d >= trailing30Start && d <= yesterday) {
      const key = format(d, "yyyy-MM-dd");
      dailySalesMap[key] = (dailySalesMap[key] || 0) + o.totalPrice;
    }
  });
  const dailySales = Object.entries(dailySalesMap)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const newCustomersMtd = newCustomersMtdCount;

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
      changePercent: change(ordersYesterday.length, ordersSameDayLastWeek.length),
    },
    aovMtd,
    aovMtdPrev,
    aovYesterday,
    aovYesterdayPrev,
    unitsPerOrderMtd,
    newCustomersMtd: newCustomersMtd,
    canadaSalesPercent,
    salesByChannel,
    dailySales,
    weeklySalesByYear: [],
    top10Products,
    refundRatePercent,
    repeatCustomerRatePercent,
    ordersPerDayMtd,
    grossRevenueMtd,
    netRevenueMtd,
  };
}
