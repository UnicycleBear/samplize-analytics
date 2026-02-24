import { NextResponse } from "next/server";

const API_VERSION = "2024-01";

function getDomain(): string {
  const url = process.env.SAMPLIZE_STORE_URL;
  if (!url) throw new Error("SAMPLIZE_STORE_URL is required");
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
  if (!token) throw new Error("SAMPLIZE_API_KEY is required");
  return token;
}

export async function POST() {
  try {
    const domain = getDomain();
    const token = getToken();
    const url = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;

    const queryRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: `
          query {
            currentBulkOperation {
              id
              status
            }
          }
        `,
      }),
      cache: "no-store",
    });
    if (!queryRes.ok) {
      return NextResponse.json(
        { error: `GraphQL request failed: ${queryRes.status}`, body: await queryRes.text() },
        { status: 502 }
      );
    }
    const current = await queryRes.json();
    const op = current?.data?.currentBulkOperation;
    if (!op) {
      return NextResponse.json({ message: "No current bulk op", raw: current });
    }

    const cancelRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: `
          mutation bulkOperationCancel($id: ID!) {
            bulkOperationCancel(id: $id) {
              bulkOperation { id status }
              userErrors { message }
            }
          }
        `,
        variables: { id: op.id },
      }),
      cache: "no-store",
    });
    if (!cancelRes.ok) {
      return NextResponse.json(
        { error: `Cancel request failed: ${cancelRes.status}`, body: await cancelRes.text() },
        { status: 502 }
      );
    }
    const cancel = await cancelRes.json();
    return NextResponse.json({ cancelled: op.id, statusWas: op.status, result: cancel?.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
