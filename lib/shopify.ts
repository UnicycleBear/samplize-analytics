/**
 * Shopify REST Admin API client.
 * Uses Admin API access token (store in SAMPLIZE_API_KEY / SAMPLIZE_RETAIL_API_KEY).
 */

const API_VERSION = "2024-01";
const LIMIT = 250;

export type ShopifyConfig = {
  storeUrl: string;
  accessToken: string;
};

export type ShopifyOrder = {
  id: number;
  created_at: string;
  current_total_price: string;
  total_price: string;
  currency: string;
  source_name: string | null;
  billing_address: { country_code: string } | null;
  line_items: Array< { quantity: number } >;
  customer?: { id: number } | null;
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

async function fetchShopify<T>(
  config: ShopifyConfig,
  path: string,
  params: Record<string, string> = {}
): Promise<{ data: T; nextPageInfo?: string }> {
  const base = shopifyBaseUrl(config.storeUrl);
  const search = new URLSearchParams({ limit: String(LIMIT), ...params });
  const url = `${base}${path}?${search}`;
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": config.accessToken,
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 },
  });
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

export async function fetchOrders(
  config: ShopifyConfig,
  createdAtMin: string,
  createdAtMax: string,
  pageInfo?: string
): Promise<{ orders: ShopifyOrder[]; nextPageInfo?: string }> {
  const params: Record<string, string> = {
    status: "any",
    created_at_min: createdAtMin,
    created_at_max: createdAtMax,
    fields:
      "id,created_at,current_total_price,total_price,currency,source_name,billing_address,line_items,customer",
  };
  if (pageInfo) params.page_info = pageInfo;
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
  createdAtMax: string
): Promise<ShopifyOrder[]> {
  const all: ShopifyOrder[] = [];
  let nextPageInfo: string | undefined;
  do {
    const result = await fetchOrders(
      config,
      createdAtMin,
      createdAtMax,
      nextPageInfo
    );
    all.push(...result.orders);
    nextPageInfo = result.nextPageInfo;
  } while (nextPageInfo);
  return all;
}

export async function fetchCustomersCreatedInRange(
  config: ShopifyConfig,
  createdAtMin: string,
  createdAtMax: string
): Promise<number> {
  const base = shopifyBaseUrl(config.storeUrl);
  const params = new URLSearchParams({
    limit: "250",
    created_at_min: createdAtMin,
    created_at_max: createdAtMax,
    fields: "id,created_at",
  });
  let count = 0;
  let pageInfo: string | undefined;
  do {
    const url = pageInfo
      ? `${base}/customers.json?limit=250&page_info=${encodeURIComponent(pageInfo)}&fields=id,created_at`
      : `${base}/customers.json?${params}`;
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": config.accessToken,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) break;
    const data = await res.json();
    const customers: ShopifyCustomer[] = data.customers || [];
    count += customers.length;
    const link = res.headers.get("Link");
    pageInfo = undefined;
    if (link && link.includes('rel="next"')) {
      const m = link.match(/page_info=([^>&"'\s]+)/);
      if (m) pageInfo = m[1];
    }
  } while (pageInfo);
  return count;
}
