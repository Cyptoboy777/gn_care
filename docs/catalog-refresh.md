# Keep the catalog honest with the Gemini API (free, no card)

This is an **offline** script. The live app never calls Google to refresh prices, images, or offers for a visitor. You run it by hand, or you can turn on a GitHub Action later. Every fact that gets written needs a `sourceUrl` and a `checkedOn` date. If a fact cannot be cited, it is marked **unknown** and left unchanged. The script will not invent coupon codes, and it will not auto-apply coupons.

## Which Google option we use, and which we skipped

Checked on official pages on 24 November 2026 (Asia/Calcutta).

### Custom Search JSON API — skipped (closed to new customers)

Official page: [Custom Search JSON API overview](https://developers.google.com/custom-search/v1/overview) (last updated 19 November 2026).

Google states:

- “The Custom Search JSON API is closed to new customers.”
- Existing customers have until 1 January 2027 to move to something else.
- For those existing customers only: “Custom Search JSON API provides 100 search queries per day for free.” Further queries need billing in the API Console, at **$5 per 1,000 queries**, up to 10,000 queries per day.

GN Care would be a new customer, so this API is not available. Do not create `GOOGLE_API_KEY` / `GOOGLE_CSE_ID` for this project; the script does not read them. Vertex AI Search, the alternative Google names on that page, is a paid Cloud product and is also skipped.

### Gemini API Free tier + Grounding with Google Search — wired

Official pages:

- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Billing / usage tiers](https://ai.google.dev/gemini-api/docs/billing)

What those pages say (as of the pricing page content checked 24 November 2026):

- The **Free** tier is for developers getting started: limited models, free input and output tokens, Google AI Studio access. Content may be used to improve Google’s products. You can create a key at [Google AI Studio](https://aistudio.google.com/apikey). A credit card is **not** required to stay on the Free tier. Linking a billing account (and, on current paid plans, prepaying) is how you move to a paid tier.
- **`gemini-2.5-flash-lite`**: Grounding with Google Search is “Free of charge, up to **500 RPD** (limit shared with Flash RPD)” on the Free tier. Paid tier: 1,500 RPD free (shared with Flash), then **$35 / 1,000 grounded prompts**.
- **`gemini-2.5-flash`**: the same 500 RPD free grounding cap, **but it is deprecated**. Official warning: from **1 December 2026**, API requests to `gemini-2.5-flash` automatically route to `gemini-3.5-flash-lite` and are **billed** at that model’s rates. This script refuses that model id so a later run cannot silently start billing.
- **Gemini 3 and newer** (including `gemini-3.5-flash-lite`): tokens can be free of charge on the Free tier, but Grounding with Google Search is listed as **“Not available”** on the Free tier. On the paid tier it is “5,000 free search requests per month (shared across all Gemini 3 and newer models), then $14 per 1,000 requests,” with a default cap of 1,500 requests per day. Do not switch this script to a Gemini 3/4 model unless you have knowingly enabled billing.
- Rate limits (RPM, TPM, RPD) are per project, not per key, and **RPD resets at midnight Pacific Time**. The public rate-limits page does not list a single fixed RPM/RPD for every model; check **your** free-tier numbers in [AI Studio → Rate limits](https://aistudio.google.com/). Specified limits are not guaranteed. If you get HTTP 429, stop and wait.

YouTube Data API is not used.

## Create a free key

1. Open [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account.
2. Create an API key in a project that stays on the **Free** tier. Do not add a billing account if you want to be sure you cannot be charged.
3. Put the key in a local `.env` file as `GEMINI_API_KEY=...` (already gitignored) or export it in your shell. **Never commit the key.** The same variable is already used by the optional online Coach; this script only runs when you invoke it.

## Run it

```bash
# First run: a few products, review file only (nothing is written to catalog.json)
GEMINI_API_KEY=your_key node scripts/refresh-catalog.mjs --limit 5

# After you have read scripts/out/catalog-refresh-YYYY-MM-DD.json
GEMINI_API_KEY=your_key node scripts/refresh-catalog.mjs --limit 10 --apply
```

Defaults:

- Model: `gemini-2.5-flash-lite` only (override is rejected unless it is this id).
- `--limit` 15 (or `CATALOG_REFRESH_LIMIT`), well under the 500 RPD grounding cap. Stay under the model RPD shown in AI Studio as well.
- Sleeps 4 seconds between calls. Stops on 429 / auth errors.
- `--apply` copies only **sourced** `price`, `mrp`, `offerNote`, and Open Beauty Facts images, each with `sourceUrl` / `checkedOn`. Coupons and other image hosts are listed in the report for you to verify by hand and paste into `catalog.json` if they are real.

After `--apply`, read the git diff, run `node tests/run.js`, bump `sw.js` if you ship the catalog, then commit.

## GitHub Actions

`.github/workflows/catalog-refresh.yml` is **disabled** until you set the repository variable `ENABLE_CATALOG_REFRESH` to `true` and add the `GEMINI_API_KEY` Actions secret. The weekly cron is commented out. Even when enabled, the workflow only writes the review JSON as an artifact; it does not commit or push catalog changes. You review the artifact and apply locally.

## If the free grounding option goes away

Stop running the script. Do not point it at a billed model or at Vertex AI to “keep it going.” Update this doc when you next check the official pricing page.
