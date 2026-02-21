import {
  startOfMonth,
  endOfMonth,
  subYears,
  subDays,
  format,
} from "date-fns";
import {
  fetchAllOrders,
  fetchCustomersCreatedInRange,
  type ShopifyConfig,
} from "@/lib/shopify";
import {
  computeStoreMetrics,
  combineStoreMetrics,
  type StoreMetrics,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getConfig(): {
  samplize: ShopifyConfig;
  retail: ShopifyConfig;
 } | null {
  const samplizeUrl = process.env.SAMPLIZE_STORE_URL;
  const samplizeToken = process.env.SAMPLIZE_API_KEY;
  const retailUrl = process.env.SAMPLIZE_RETAIL_STORE_URL;
  const retailToken = process.env.SAMPLIZE_RETAIL_API_KEY;
  if (
    !samplizeUrl ||
    !samplizeToken ||
    !retailUrl ||
    !retailToken
  ) {
    return null;
  }
  return {
    samplize: { storeUrl: samplizeUrl, accessToken: samplizeToken },
    retail: { storeUrl: retailUrl, accessToken: retailToken },
  };
}

export async function GET() {
  const config = getConfig();
  if (!config) {
    return Response.json(
      {
        error:
          "Missing Shopify credentials. Set SAMPLIZE_STORE_URL, SAMPLIZE_API_KEY, SAMPLIZE_RETAIL_STORE_URL, SAMPLIZE_RETAIL_API_KEY in .env.local",
      },
      { status: 500 }
    );
  }

  console.error("[analytics] Store URLs:", {
    samplize: config.samplize.storeUrl,
    retail: config.retail.storeUrl,
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const twoYearsAgo = subYears(today, 2);
  const createdMin = format(twoYearsAgo, "yyyy-MM-dd'T'00:00:00xxx");
  const createdMax = format(monthEnd, "yyyy-MM-dd'T'23:59:59xxx");

  try {
    const [samplizeOrders, retailOrders, samplizeNewCustomers, retailNewCustomers] =
      await Promise.all([
        fetchAllOrders(config.samplize, createdMin, createdMax),
        fetchAllOrders(config.retail, createdMin, createdMax),
        fetchCustomersCreatedInRange(
          config.samplize,
          format(monthStart, "yyyy-MM-dd'T'00:00:00xxx"),
          format(monthEnd, "yyyy-MM-dd'T'23:59:59xxx")
        ),
        fetchCustomersCreatedInRange(
          config.retail,
          format(monthStart, "yyyy-MM-dd'T'00:00:00xxx"),
          format(monthEnd, "yyyy-MM-dd'T'23:59:59xxx")
        ),
      ]);

    const samplizeMetrics = computeStoreMetrics(
      samplizeOrders,
      samplizeNewCustomers,
      "samplize",
      "Samplize",
      now
    );
    const retailMetrics = computeStoreMetrics(
      retailOrders,
      retailNewCustomers,
      "samplize_retail",
      "Samplize Retail",
      now
    );
    const combinedMetrics = combineStoreMetrics(samplizeMetrics, retailMetrics);

    const response: {
      combined: StoreMetrics;
      samplize: StoreMetrics;
      samplizeRetail: StoreMetrics;
    } = {
      combined: combinedMetrics,
      samplize: samplizeMetrics,
      samplizeRetail: retailMetrics,
    };
    return Response.json(response);
  } catch (err) {
    console.error("[analytics] Shopify error:", err);
    console.error("[analytics] Store URLs:", {
      samplize: config.samplize.storeUrl,
      retail: config.retail.storeUrl,
    });
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: "Failed to fetch Shopify data", details: message },
      { status: 500 }
    );
  }
}
