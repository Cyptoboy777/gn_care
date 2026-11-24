# Flipkart + Myntra deals

The Deals tab (`/#deals`) shows live Flipkart listings from `public/deals.json`, plus two fixed EarnKaro Myntra links. Prices, MRP and discount come only from Flipkart Affiliate API fields. Items without a real price are dropped. No ratings or coupons are invented.

Myntra buttons open:

- [Shop Myntra fashion](https://myntr.it/zHNk6zz)
- [Myntra deals under ₹399](https://myntr.it/afrMHGG)

These are tracked EarnKaro links. The app does not show a Myntra price or image for them.

## Refresh deals

Local (token in `.env` or env var, never committed):

    FLIPKART_AFFILIATE_TOKEN=... npm run sync-deals
    node scripts/post-telegram-store-deals.mjs --dry-run

GitHub Actions: **Flipkart deals sync** runs every 2 hours at 06:00, 08:00, 10:00 … IST (`cron: 30 */2 * * *`) and on `workflow_dispatch`. Each run refreshes Flipkart prices and `scripts/price-history.json`. Genuine new lows (an all-time low since we started tracking, or a drop of at least 5% vs the last stored price) are posted first to @Gncarestore, max 5 per run, with no repeat of the same price. The regular top-deals post still goes out at 08:00 IST and on manual dispatch.

Each deal is posted with `sendPhoto` when the Flipkart image URL is present; otherwise the bot falls back to text. Captions include the title, live price, MRP, real % off, “price as of” IST time, and the tagged Flipkart link. Enable with repository variable `ENABLE_FLIPKART_DEALS=true`.

Add these Actions secrets (Settings → Secrets and variables → Actions) if they are missing:

- `FLIPKART_AFFILIATE_TOKEN` — required for the Flipkart sync
- `TELEGRAM_BOT_TOKEN` — required to post to @Gncarestore

Set `TELEGRAM_CHANNEL` as a repository variable (`@Gncarestore`). The workflow commits `public/deals.json`, `scripts/price-history.json`, and `scripts/telegram-deals-posted.json`. The Myntra under-₹399 link stays in the footer.
