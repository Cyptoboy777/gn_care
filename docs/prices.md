# Prices: how they stay honest and fresh

- **Flipkart (live):** `fk*` fields in `public/catalog.json` come from the Flipkart Affiliate API via
  `scripts/sync-flipkart.mjs`. Each has `fkCheckedOn`. Only exact listings (same brand, name, size) are matched.
- **Amazon:** no price is shown until Amazon PA-API access (after 3 qualifying sales). Until then the app
  shows "Check price on Amazon" (search link with the `gncare-21` tag).
- **Lowest price badge:** shown only when two stores have a real price, each with a checked date no older
  than 7 days (`GNPicks.lowestOffer`). To add Amazon later, write per product:
  `amzPrice` (number, ₹), `amzCheckedOn` (YYYY-MM-DD), `amzSourceUrl` (https://www.amazon.in/...).
  The badge and "Buy on Amazon ₹X" buttons then appear automatically. Nothing is estimated.
- Catalog `price` values are typical prices and are always labelled "approx.".

## Re-run the Flipkart sync

Local (token in `.env` or env var, never committed):

    FLIPKART_AFFILIATE_TOKEN=... npm run sync-flipkart          # all products
    FLIPKART_AFFILIATE_TOKEN=... npm run sync-flipkart -- --dry-run

Then `npm test`, commit `public/catalog.json`, push. Vercel redeploys.

GitHub Actions (optional, free): add secret `FLIPKART_AFFILIATE_TOKEN`, set variable
`ENABLE_FLIPKART_SYNC=true`, run **Flipkart price sync (manual)** from the Actions tab, or uncomment its
daily schedule in `.github/workflows/flipkart-sync.yml`.
