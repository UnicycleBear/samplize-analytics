/**
 * Shopify REST Admin API client.
 * Uses Admin API access token (store in SAMPLIZE_API_KEY).
 */

import type { RecentOrder } from "./bulkOperations";
import { startOfMonth, subYears, format } from "date-fns";

const API_VERSION = "2024-01";
const LIMIT = 250;
const FETCH_TIMEOUT_MS = 30000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Shopify request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type ShopifyConfig = {
  storeUrl: string;
  accessToken: string;
};

export function getShopifyConfig(): ShopifyConfig | null {
  const url = process.env.SAMPLIZE_STORE_URL;
  const token = process.env.SAMPLIZE_API_KEY;
  if (!url || !token) return null;
  return { storeUrl: url, accessToken: token };
}

const MTD_LY_FIELDS =
  "id,created_at,current_total_price,line_items,shipping_address,source_name,financial_status";

const RECENT_ORDER_FIELDS =
  "id,created_at,current_total_price,line_items,shipping_address,source_name,financial_status,cancel_reason,customer,refunds";

function shopifyOrderToRecent(o: ShopifyOrder): RecentOrder {
  const totalPrice = parseFloat(String(o.current_total_price || "0").replace(/[^0-9.-]/g, "")) || 0;
  const lineItems = (o.line_items || []).map((li) => {
    const title = (li.title ?? "Unknown").trim() || "Unknown";
    const qty = li.quantity ?? 0;
    const unitPrice = parseFloat(String(li.price || "0").replace(/[^0-9.-]/g, "")) || 0;
    return {
      title,
      quantity: qty,
      unitPrice,
      productId: null,
      productTitle: title,
      lineRevenue: qty * unitPrice,
    };
  });
  return {
    id: String(o.id),
    createdAt: o.created_at ?? "",
    totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0,
    lineItems,
    shippingCountryCode: (o.shipping_address?.country_code ?? "").toUpperCase(),
    sourceName: (o.source_name ?? "").trim() || "",
    financialStatus: (o.financial_status ?? "").toLowerCase(),
    cancelReason: o.cancel_reason ?? null,
    customerId: o.customer ? String(o.customer.id) : null,
    hasRefund: Array.isArray(o.refunds) && o.refunds.length > 0,
  };
}

export async function fetchMtdLyOrdersViaRest(config: ShopifyConfig): Promise<RecentOrder[]> {
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const monthStartLy = startOfMonth(subYears(today, 1));
  const sameDayLy = subYears(today, 1);
  const min = format(monthStartLy, "yyyy-MM-dd'T'00:00:00'Z'");
  const max = format(sameDayLy, "yyyy-MM-dd'T'23:59:59'Z'");
  console.log("[shopify] MTD LY REST date range (UTC)", { created_at_min: min, created_at_max: max });
  const orders = await fetchAllOrders(config, min, max, MTD_LY_FIELDS);
  return orders.map(shopifyOrderToRecent);
}

export async function fetchRecentOrdersViaRest(): Promise<RecentOrder[]> {
  const config = getShopifyConfig();
  if (!config) throw new Error("Shopify config missing (SAMPLIZE_STORE_URL / SAMPLIZE_API_KEY)");

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 65);
  const min = start.toISOString().split("T")[0] + "T00:00:00Z";
  const max = today.toISOString().split("T")[0] + "T23:59:59Z";

  console.log("[shopify] fetchRecentOrdersViaRest date range:", { min, max });
  const orders = await fetchAllOrders(config, min, max, RECENT_ORDER_FIELDS);
  return orders.map(shopifyOrderToRecent);
}

export type ShopifyOrder = {
  id: number;
  created_at: string;
  current_total_price: string;
  total_price: string;
  currency: string;
  source_name: string | null;
  billing_address: { country_code: string } | null;
  shipping_address: { country_code: string } | null;
  financial_status: string | null;
  cancel_reason?: string | null;
  line_items: Array<{
    quantity: number;
    title?: string;
    price?: string;
  }>;
  customer?: { id: number } | null;
  refunds?: Array<{ id: number }>;
};

export type ShopifyCustomer = {
  id: number;
  created_at: string;
};

function normalizeStoreUrl(storeUrl: string): string {
  const u = storeUrl.trim().toLowerCase();
  if (u.startsWith("http://") || u.startsWith("https://")) {
    try {
      const url = new URL(u);
      return url.hostname.replace(/\.myshopify\.com$/, "");
    } catch {
      return u.replace(/^https?:\/\//, "").replace(/\.myshopify\.com.*$/, "");
    }
  }
  return u.replace(/\.myshopify\.com.*$/, "");
}

export function shopifyBaseUrl(storeUrl: string): string {
  const host = normalizeStoreUrl(storeUrl);
  return `https://${host}.myshopify.com/admin/api/${API_VERSION}`;
}

const RATE_LIMIT_RETRY_MS = 500;

async function fetchShopify<T>(
  config: ShopifyConfig,
  path: string,
  params: Record<string, string> = {}
): Promise<{ data: T; nextPageInfo?: string }> {
  const base = shopifyBaseUrl(config.storeUrl);
  const search = new URLSearchParams({ limit: String(LIMIT), ...params });
  const url = `${base}${path}?${search}`;
  console.log("[shopify] fetchShopify request:", path, Object.keys(params));
  const opts: RequestInit = {
    headers: {
      "X-Shopify-Access-Token": config.accessToken,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  };
  let res = await fetchWithTimeout(url, opts, FETCH_TIMEOUT_MS);
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_MS));
    res = await fetchWithTimeout(url, opts, FETCH_TIMEOUT_MS);
  }
  console.log("[shopify] fetchShopify response:", path, res.status);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }
  const data = await res.json();
  const link = res.headers.get("Link");
  let nextPageInfo: string | undefined;
  if (link) {
    const nextMatch = link.match(/<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/);
    if (nextMatch) nextPageInfo = nextMatch[1];
  }
  return { data, nextPageInfo };
}

const ORDER_FIELDS =
  "id,created_at,current_total_price,total_price,line_items,billing_address,shipping_address,source_name,financial_status,customer";

export async function fetchOrders(
  config: ShopifyConfig,
  createdAtMin: string,
  createdAtMax: string,
  pageInfo?: string,
  fields?: string
): Promise<{ orders: ShopifyOrder[]; nextPageInfo?: string }> {
  const params: Record<string, string> = pageInfo
    ? { page_info: pageInfo }
    : {
        status: "any",
        created_at_min: createdAtMin,
        created_at_max: createdAtMax,
        fields: fields ?? ORDER_FIELDS,
      };
  const { data, nextPageInfo } = await fetchShopify<{ orders: ShopifyOrder[] }>(
    config,
    "/orders.json",
    params
  );
  return { orders: data.orders || [], nextPageInfo };
}

export async function fetchAllOrders(
  config: ShopifyConfig,
  createdAtMin: string,
  createdAtMax: string,
  fields?: string
): Promise<ShopifyOrder[]> {
  const all: ShopifyOrder[] = [];
  let nextPageInfo: string | undefined;
  do {
    const result = await fetchOrders(
      config,
      createdAtMin,
      createdAtMax,
      nextPageInfo,
      fields
    );
    const page = result.orders;
    const lastOrder = page[page.length - 1];
    if (lastOrder && lastOrder.created_at < createdAtMin) {
      all.push(...page.filter((o) => o.created_at >= createdAtMin));
      break;
    }
    all.push(...page);
    nextPageInfo = result.nextPageInfo;
  } while (nextPageInfo);
  console.log("[shopify] fetchAllOrders response count:", all.length, "raw first order:", JSON.stringify(all[0]));
  return all;
}

export async function fetchCustomersCreatedInRange(
  config: ShopifyConfig,
  createdAtMin: string,
  createdAtMax: string
): Promise<number> {
  const base = shopifyBaseUrl(config.storeUrl);
  console.log("[shopify] fetchCustomersCreatedInRange start", config.storeUrl, { created_at_min: createdAtMin, created_at_max: createdAtMax });
  const opts: RequestInit = {
    headers: {
      "X-Shopify-Access-Token": config.accessToken,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  };
  let count = 0;
  let page = 0;
  let nextUrl: string | null = null;
  do {
    page++;
    console.log("[shopify] fetchCustomersCreatedInRange page", page);
    const url =
      nextUrl ??
      `${base}/customers.json?${new URLSearchParams({
        limit: "250",
        created_at_min: createdAtMin,
        created_at_max: createdAtMax,
        fields: "id,created_at",
      }).toString()}`;
    nextUrl = null;
    let res = await fetchWithTimeout(url, opts, FETCH_TIMEOUT_MS);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_MS));
      res = await fetchWithTimeout(url, opts, FETCH_TIMEOUT_MS);
    }
    console.log("[shopify] fetchCustomersCreatedInRange page", page, "response", res.status);
    if (!res.ok) break;
    const data = await res.json();
    const customers: ShopifyCustomer[] = data.customers || [];
    count += customers.length;
    const link = res.headers.get("Link");
    if (link && link.includes('rel="next"')) {
      const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) nextUrl = nextMatch[1].trim();
    }
  } while (nextUrl);
  console.log("[shopify] fetchCustomersCreatedInRange done", config.storeUrl, "count", count);
  return count;
}
