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

GitHub Actions: **Flipkart deals sync** runs daily at 08:00 IST (`cron: 30 2 * * *`) and on `workflow_dispatch`. Enable with repository variable `ENABLE_FLIPKART_DEALS=true`.

Add these Actions secrets (Settings → Secrets and variables → Actions) if they are missing:

- `FLIPKART_AFFILIATE_TOKEN` — required for the Flipkart sync
- `TELEGRAM_BOT_TOKEN` — required to post to @Gncarestore

Set `TELEGRAM_CHANNEL` as a repository variable (`@Gncarestore`). The workflow commits `public/deals.json` and, after a successful post, `scripts/telegram-deals-posted.json` so the same items are not reposted for 7 days. The Telegram message includes the Myntra under-₹399 link in the footer.
