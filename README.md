# Samplize Analytics

Next.js analytics dashboard that pulls data from two Shopify stores (Samplize and Samplize Retail), combines them, and shows key metrics with Tailwind CSS.

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Shopify credentials:

```bash
cp .env.example .env.local
```

2. In `.env.local`, set:

- **Samplize:** `SAMPLIZE_API_KEY` (Admin API access token), `SAMPLIZE_API_SECRET`, `SAMPLIZE_STORE_URL` (e.g. `https://your-store.myshopify.com` or `your-store`)
- **Samplize Retail:** `SAMPLIZE_RETAIL_API_KEY`, `SAMPLIZE_RETAIL_API_SECRET`, `SAMPLIZE_RETAIL_STORE_URL`

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Shopify access

- Create a custom app in each store’s Shopify admin (Settings → Apps and sales channels → Develop apps) and assign **Admin API** scopes: `read_orders`, `read_customers`. Use the **Admin API access token** as `SAMPLIZE_API_KEY` / `SAMPLIZE_RETAIL_API_KEY`.
- For orders older than 60 days (e.g. YoY and LY comparisons), request **Read all orders** and use the `read_all_orders` scope if your app supports it.

## Dashboard

- **Store selector:** Combined, Samplize, or Samplize Retail.
- **Metrics:** Total sales MTD vs same period LY, total sales yesterday vs same day last week, orders MTD and yesterday with same comparisons, AOV MTD and yesterday, units per order MTD, new customers MTD, % Canada sales MTD.
- **Revenue by sales channel:** Table with revenue and MoM % change.
- **30-day trailing:** Daily sales line chart.
- **YoY weekly sales:** Line chart comparing 2024, 2025, and 2026 by week.
