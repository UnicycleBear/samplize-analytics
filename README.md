# Samplize Analytics

Next.js analytics dashboard for the **Samplize main store** (single store). Uses Tailwind CSS, in-memory cache for fast data, Vercel KV (or in-memory fallback) for 53-week YoY data, and optional Shopify Bulk Operations.

## Environment variables

Set these in `.env.local` (local) or in Vercel Project Settings → Environment Variables (production):

| Variable | Description |
|----------|-------------|
| `SAMPLIZE_STORE_URL` | Store URL, e.g. `https://your-store.myshopify.com` or `your-store` |
| `SAMPLIZE_API_KEY` | Shopify Admin API access token (custom app) |
| `KV_REST_API_URL` | Vercel KV REST API URL (from Vercel KV dashboard). Omit locally to use in-memory weekly cache. |
| `KV_REST_API_TOKEN` | Vercel KV REST API token. Omit locally to use in-memory weekly cache. |

No retail or second-store variables are used.

## Local setup

1. Copy `.env.example` to `.env.local` and set the variables above.

2. Install and run:

```bash
npm install
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

## Shopify access

- In Shopify admin: **Settings → Apps and sales channels → Develop apps** → create a custom app.
- Grant **Admin API** scopes: `read_orders`, `read_customers`.
- Use the **Admin API access token** as `SAMPLIZE_API_KEY`.
- For 53-week and older order data, request **Read all orders** (`read_all_orders`) if needed.

## API endpoints

- **GET /api/analytics/fast** — MTD, MTD LY, last 30 days, MoM channel data. Cached in memory for 30 minutes. Target &lt; 30s.
- **GET /api/analytics/weekly** — 53-week YoY data. Served from Vercel KV (or in-memory fallback) when present and &lt; 24hr old; otherwise runs a bulk operation and streams progress via Server-Sent Events.
- **POST /api/refresh-cache** — Clears in-memory order cache and refreshes weekly cache (runs bulk op, writes to KV), then returns `{ success, updatedAt }`.

## Deploy to Vercel

1. Push the repo to GitHub (or connect your Git provider in Vercel).

2. In [Vercel](https://vercel.com): **Add New Project** → import the repo.

3. Create a KV store and link it to the project:
   - In the project: **Storage** tab → **Create Database** → choose **KV** (or **Redis**, depending on Vercel’s current offering).
   - Create the store, then **Connect to Project** and select this project. Vercel will add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the project’s environment variables.

4. Set any remaining environment variables:
   - **Settings → Environment Variables**
   - Add `SAMPLIZE_STORE_URL` and `SAMPLIZE_API_KEY` for Production (and Preview if you want). KV vars are usually auto-populated when you link the store.

5. Deploy. The dashboard will be available at `https://your-project.vercel.app`.

### Cron (daily refresh)

The project includes a Vercel Cron that calls the refresh endpoint daily at 6:00 UTC:

- **Path:** `/api/refresh-cache`
- **Schedule:** `0 6 * * *` (6am UTC)

To enable it:

- In the Vercel project: **Settings → Cron Jobs** (or ensure `vercel.json` is in the repo and redeploy).
- Vercel will run the cron on the configured schedule; no extra setup if the repo has `vercel.json` with the `crons` entry.

### Function timeouts

- `/api/analytics/fast`: `maxDuration` 60s.
- `/api/analytics/weekly`: `maxDuration` 300s (for bulk op when cache is cold).

These are set in `vercel.json` under `functions`.

## Dashboard features

- **Key metrics:** Total sales MTD (vs LY), sales yesterday (vs same day last week), orders MTD/yesterday, AOV, units per order, new customers MTD, % Canada (shipping), refund rate, repeat customer rate, orders per day (MTD avg), gross vs net revenue MTD.
- **Revenue by sales channel** with MoM %.
- **Top 10 products by revenue** (MTD) from line items.
- **30-day trailing** daily sales chart.
- **YoY weekly sales** chart (from cache or bulk op).
- **Refresh Data** button and **Last updated** text.
- **Status bar:** cache age for order and weekly data with color (green &lt; 1hr, yellow &lt; 24hr, red &gt; 24hr).
- **Download PDF** triggers `window.print()`; print CSS hides refresh/PDF controls and adjusts layout.

## Caching

- **Orders (fast):** In-memory, 30-minute TTL. Cleared on **Refresh Data** or POST to `/api/refresh-cache`.
- **Weekly (YoY):** Vercel KV with 24-hour TTL when `KV_REST_API_URL` is set (production). If not set (e.g. local dev), an in-memory fallback is used so the weekly endpoint and refresh still work without KV.
