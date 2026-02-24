/**
 * Shopify GraphQL Bulk Operations for fetching 53 weeks of order data.
 * Uses SAMPLIZE_STORE_URL and SAMPLIZE_API_KEY from env (main Samplize store).
 */

const API_VERSION = "2024-01";
const POLL_INTERVAL_MS = 5000;

function getDomain(): string {
  const url = process.env.SAMPLIZE_STORE_URL;
  if (!url) throw new Error("SAMPLIZE_STORE_URL is required for bulk operations");
  const u = url.trim().toLowerCase();
  if (u.startsWith("http://") || u.startsWith("https://")) {
    try {
      return new URL(u).hostname;
    } catch {
      return u.replace(/^https?:\/\//, "").replace(/\.myshopify\.com.*$/, "") + ".myshopify.com";
    }
  }
  const host = u.replace(/\.myshopify\.com.*$/, "");
  return host.includes(".") ? host : `${host}.myshopify.com`;
}

function getToken(): string {
  const token = process.env.SAMPLIZE_API_KEY;
  if (!token) throw new Error("SAMPLIZE_API_KEY is required for bulk operations");
  return token;
}

export type BulkOrderRow = {
  id: string;
  createdAt: string;
  totalPrice: number;
};

/** Order shape returned by fetchRecentOrdersViaBulk / fetchMtdLastYearViaBulk for fast metrics. */
export type RecentOrder = {
  id: string;
  createdAt: string;
  totalPrice: number;
  lineItems: {
    title: string;
    quantity: number;
    unitPrice: number;
    productId: string | null;
    productTitle: string | null;
    lineRevenue: number;
  }[];
  shippingCountryCode: string;
  sourceName: string;
  financialStatus: string;
  customerId: string | null;
  hasRefund: boolean;
};

export type WeeklyRevenue = {
  weekStart: string;
  revenue: number;
};

/**
 * Sends a GraphQL mutation to start a bulk query for orders in the date range.
 * Returns the bulk operation id (for polling by id in newer API) or we use currentBulkOperation.
 */
export async function startBulkOperation(
  startDate: string,
  endDate: string
): Promise<string> {
  const domain = getDomain();
  const token = getToken();
  const query = `
    mutation {
      bulkOperationRunQuery(
        query: """
        {
          orders(query: "created_at:>=${startDate} AND created_at:<=${endDate} AND financial_status:paid", sortKey: CREATED_AT) {
            edges {
              node {
                id
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
              }
            }
          }
        }
        """
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Bulk operation start failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const errs = json?.data?.bulkOperationRunQuery?.userErrors;
  if (errs?.length) {
    throw new Error(`Bulk operation userErrors: ${JSON.stringify(errs)}`);
  }
  const id = json?.data?.bulkOperationRunQuery?.bulkOperation?.id;
  if (!id) {
    throw new Error(`Bulk operation did not return id: ${JSON.stringify(json)}`);
  }
  return id;
}

/**
 * Returns the current bulk operation (if any). Includes url and query for staleness check.
 */
async function getCurrentBulkOperation(): Promise<{
  id: string | null;
  status: string | null;
  url: string | null;
  query: string | null;
}> {
  const domain = getDomain();
  const token = getToken();
  const query = `
    query {
      currentBulkOperation {
        id
        status
        url
        query
      }
    }
  `;
  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Current bulk op query failed: ${res.status}`);
  }
  const json = await res.json();
  const op = json?.data?.currentBulkOperation;
  if (!op) return { id: null, status: null, url: null, query: null };
  return {
    id: op.id ?? null,
    status: op.status ?? null,
    url: op.url ?? null,
    query: op.query ?? null,
  };
}

/** Normalize query string for comparison (collapse whitespace). */
function normalizeQuery(q: string | null): string {
  if (q == null || typeof q !== "string") return "";
  return q.replace(/\s+/g, " ").trim();
}

/**
 * Cancels a bulk operation by ID. Used when existing op's query doesn't match current query.
 */
async function cancelBulkOperation(id: string): Promise<void> {
  const domain = getDomain();
  const token = getToken();
  const mutation = `
    mutation bulkOperationCancel($id: ID!) {
      bulkOperationCancel(id: $id) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
  `;
  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query: mutation, variables: { id } }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Bulk operation cancel failed: ${res.status}`);
  }
  const json = await res.json();
  const errs = json?.data?.bulkOperationCancel?.userErrors;
  if (errs?.length) {
    console.warn("[bulk] cancel userErrors:", errs);
  }
}

const CANCEL_POLL_MS = 2000;
const CANCEL_TIMEOUT_MS = 30000;

/** Wait for bulk op to reach a terminal state (CANCELED, COMPLETED, or FAILED) or timeout. */
async function waitForBulkOpTerminal(): Promise<void> {
  const deadline = Date.now() + CANCEL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const current = await getCurrentBulkOperation();
    const terminal = ["CANCELED", "COMPLETED", "FAILED"].includes(current.status ?? "");
    if (!current.id || terminal) return;
    await new Promise((r) => setTimeout(r, CANCEL_POLL_MS));
  }
}

/** Cancel the current bulk op if it is cancelable (RUNNING, CREATED, CANCELING). No-op if COMPLETED or none. */
async function cancelCurrentBulkOp(): Promise<void> {
  const current = await getCurrentBulkOperation();
  const status = current.status ?? "";
  if (!current.id || !["RUNNING", "CREATED", "CANCELING"].includes(status)) return;
  await cancelBulkOperation(current.id);
  await waitForBulkOpTerminal();
}

/**
 * Returns the exact query string sent for recent-orders bulk op (for comparison with currentBulkOperation.query).
 */
function getRecentOrdersBulkQueryString(startDate: string, endDate: string): string {
  return `
        {
          orders(query: "created_at:>=${startDate} AND created_at:<=${endDate}") {
            edges {
              node {
                id
                createdAt
                sourceName
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                shippingAddress {
                  countryCodeV2
                }
                lineItems(first: 250) {
                  edges {
                    node {
                      quantity
                      title
                      originalTotalSet {
                        shopMoney {
                          amount
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        `;
}

/**
 * Starts a bulk query for recent orders (all financial statuses) with full fields for fast metrics.
 * Filter: created_at range only — no financial_status so we can compute refund rate.
 */
export async function startRecentOrdersBulkOperation(
  startDate: string,
  endDate: string
): Promise<string> {
  const domain = getDomain();
  const token = getToken();
  const queryBody = getRecentOrdersBulkQueryString(startDate, endDate);
  const query = `
    mutation {
      bulkOperationRunQuery(
        query: """${queryBody}"""
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  console.log("[bulk] sending query to Shopify:", queryBody);
  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Bulk operation start failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const errs = json?.data?.bulkOperationRunQuery?.userErrors;
  if (errs?.length) {
    throw new Error(`Bulk operation userErrors: ${JSON.stringify(errs)}`);
  }
  const id = json?.data?.bulkOperationRunQuery?.bulkOperation?.id;
  if (!id) {
    throw new Error(`Bulk operation did not return id: ${JSON.stringify(json)}`);
  }
  return id;
}

/**
 * Polls the bulk operation status every 5 seconds.
 * Uses currentBulkOperation (2024-01) to get the running operation.
 * COMPLETED → returns download url (or "" if none). CANCELED → returns "" so caller can start fresh.
 * RUNNING, CREATED, CANCELING → keeps polling. FAILED → throws.
 */
export async function pollBulkOperation(): Promise<string> {
  const domain = getDomain();
  const token = getToken();
  const query = `
    query {
      currentBulkOperation {
        id
        status
        url
        errorCode
      }
    }
  `;
  const url = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
  for (;;) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Poll failed: ${res.status}`);
    }
    const json = await res.json();
    const op = json?.data?.currentBulkOperation;
    if (!op) {
      throw new Error(`No currentBulkOperation in response`);
    }
    const status = op.status;
    if (status === "COMPLETED") {
      const downloadUrl = op.url;
      if (!downloadUrl) {
        return ""; // no results
      }
      return downloadUrl;
    }
    if (status === "FAILED") {
      throw new Error(`Bulk operation FAILED: ${op.errorCode ?? ""}`);
    }
    if (status === "CANCELED") {
      return ""; // terminal; caller can start a fresh bulk op
    }
    // RUNNING, CREATED, CANCELING: keep polling
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

/**
 * Downloads the JSONL file and parses each line as JSON.
 * Returns array of { id, createdAt, totalPrice: number }.
 */
export async function downloadAndParseJSONL(downloadUrl: string): Promise<BulkOrderRow[]> {
  const token = getToken();
  const res = await fetch(downloadUrl, {
    headers: {
      "X-Shopify-Access-Token": token,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const text = await res.text();
  const rows: BulkOrderRow[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      const node = obj.node ?? obj;
      const id = node.id ?? "";
      const createdAt = node.createdAt ?? "";
      const amount = node.totalPriceSet?.shopMoney?.amount;
      const totalPrice = amount != null ? parseFloat(String(amount)) : 0;
      if (id && (createdAt || totalPrice >= 0)) {
        rows.push({ id, createdAt, totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0 });
      }
    } catch {
      // skip malformed lines
    }
  }
  return rows;
}

function parseFloatSafe(value: unknown): number {
  if (value == null) return 0;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parses a single line item node (from bulk op child line with __parentId).
 * Uses originalTotalSet for revenue; unitPrice derived from lineRevenue/quantity when needed.
 */
function parseLineItemNode(n: Record<string, unknown>): RecentOrder["lineItems"][0] {
  const qty = Number(n.quantity) || 0;
  const lineTotal = parseFloatSafe((n.originalTotalSet as { shopMoney?: { amount?: unknown } })?.shopMoney?.amount);
  const lineRevenue = Number.isFinite(lineTotal) && lineTotal > 0 ? lineTotal : 0;
  const unitPriceFromSet = parseFloatSafe((n.originalUnitPriceSet as { shopMoney?: { amount?: unknown } })?.shopMoney?.amount);
  const unitPrice = unitPriceFromSet > 0 ? unitPriceFromSet : (qty > 0 && lineRevenue > 0 ? lineRevenue / qty : 0);
  const product = n.product as { id?: string; title?: string } | undefined;
  const productId = product?.id != null ? String(product.id) : null;
  const productTitle = (product?.title ?? n.title ?? "Unknown").toString().trim() || "Unknown";
  const title = (n.title ?? "Unknown").toString().trim() || "Unknown";
  return {
    title,
    quantity: qty,
    unitPrice,
    productId,
    productTitle,
    lineRevenue,
  };
}

/**
 * Downloads and parses JSONL from a recent-orders bulk op into RecentOrder[].
 * Shopify bulk ops return child nodes (e.g. line items) as separate JSONL lines with __parentId
 * linking to the order; we join them by collecting children first, then attaching to orders.
 */
export async function downloadAndParseRecentOrdersJSONL(
  downloadUrl: string
): Promise<RecentOrder[]> {
  const token = getToken();
  const res = await fetch(downloadUrl, {
    headers: {
      "X-Shopify-Access-Token": token,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const text = await res.text();
  const orderNodes: Record<string, unknown>[] = [];
  const childrenByParentId: Record<string, Record<string, unknown>[]> = {};
  let loggedFirst = false;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      const node = (obj.node ?? obj) as Record<string, unknown>;
      const parentId = node.__parentId as string | undefined;

      if (!loggedFirst) {
        console.log("[bulk] first raw node (for debugging):", JSON.stringify(node, null, 2));
        loggedFirst = true;
      }

      if (parentId != null && parentId !== "") {
        if (!childrenByParentId[parentId]) childrenByParentId[parentId] = [];
        childrenByParentId[parentId].push(node);
        continue;
      }

      if (node.totalPriceSet != null || (node.id != null && String(node.id).includes("Order"))) {
        orderNodes.push(node);
      }
    } catch {
      // skip malformed lines
    }
  }

  const rows: RecentOrder[] = [];
  for (const node of orderNodes) {
    const id = (node.id ?? "").toString();
    const createdAt = (node.createdAt ?? "").toString();
    const amount = (node.totalPriceSet as { shopMoney?: { amount?: unknown } })?.shopMoney?.amount;
    const totalPrice = parseFloatSafe(amount);

    const childNodes = childrenByParentId[id] ?? [];
    const lineItems = childNodes
      .filter((n) => n.quantity != null || n.title != null)
      .map((n) => parseLineItemNode(n as Record<string, unknown>));

    const addr = node.shippingAddress as { countryCodeV2?: string } | undefined;
    const shippingCountryCode = (addr?.countryCodeV2 ?? "").toString().toUpperCase().trim() || "";
    const sourceName = (node.sourceName ?? node.source_name ?? "").toString().trim() || "";
    const financialStatus = (node.displayFinancialStatus ?? node.financialStatus ?? "").toString().toLowerCase();
    const customer = node.customer as { id?: unknown } | undefined;
    const customerId = customer?.id != null ? String(customer.id) : null;
    const hasRefund = (node.refunds?.length ?? 0) > 0;

    rows.push({
      id,
      createdAt,
      totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0,
      lineItems,
      shippingCountryCode,
      sourceName,
      financialStatus,
      customerId,
      hasRefund,
    });
  }
  return rows;
}

/**
 * Orchestrates: start bulk op, poll until COMPLETED, download and parse JSONL,
 * then aggregate into 53 weekly buckets (ISO week). Returns WeeklyRevenue[].
 */
export async function fetchWeeklyRevenueViaBulk(): Promise<WeeklyRevenue[]> {
  console.log("[bulk] Using bulk operation for 53-week data");
  const { startOfWeek, subWeeks, format } = await import("date-fns");
  const now = new Date();
  const endDate = format(now, "yyyy-MM-dd");
  const startDate = format(subWeeks(now, 53), "yyyy-MM-dd");

  console.log("[bulk] Starting bulk operation...");
  await startBulkOperation(startDate, endDate);
  const downloadUrl = await pollBulkOperation();
  if (!downloadUrl) {
    return [];
  }
  const rows = await downloadAndParseJSONL(downloadUrl);

  const weekBuckets: Record<string, number> = {};
  for (const row of rows) {
    if (!row.createdAt) continue;
    const d = new Date(row.createdAt);
    const weekStart = startOfWeek(d, { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    weekBuckets[key] = (weekBuckets[key] ?? 0) + row.totalPrice;
  }

  const weekly: WeeklyRevenue[] = Object.entries(weekBuckets).map(([weekStart, revenue]) => ({
    weekStart,
    revenue,
  }));
  weekly.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return weekly;
}

/**
 * Fetches orders for the last 65 days. Delegates to REST (shopify.fetchRecentOrdersViaRest).
 */
export async function fetchRecentOrdersViaBulk(_recursed = false): Promise<RecentOrder[]> {
  const { fetchRecentOrdersViaRest } = await import("./shopify");
  console.log("[bulkPoller] fetchRecentOrdersViaBulk → delegating to REST");
  return fetchRecentOrdersViaRest();
}

/**
 * Fetches orders for the same calendar month last year, 1st through today's day (e.g. Feb 1–23 2025).
 * Small range, fast. Used for MTD LY comparison.
 */
export async function fetchMtdLastYearViaBulk(): Promise<RecentOrder[]> {
  const { startOfMonth, subYears, format } = await import("date-fns");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStartLy = startOfMonth(subYears(today, 1));
  const endLy = subYears(today, 1); // same day last year
  const startDate = format(monthStartLy, "yyyy-MM-dd");
  const endDate = format(endLy, "yyyy-MM-dd");

  await startRecentOrdersBulkOperation(startDate, endDate);
  const downloadUrl = await pollBulkOperation();
  if (!downloadUrl) {
    return [];
  }
  return downloadAndParseRecentOrdersJSONL(downloadUrl);
}
