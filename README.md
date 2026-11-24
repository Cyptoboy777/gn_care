# GN Personal Hygiene and Skin Care

A static installable web app (PWA) with ad slots, legal pages and content guides. No build step. Deploys to Vercel as is.

## What is in the folder

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | The app |
| `label.js`, `ondevice.js`, `facescan.js` | On-device label scan, on-device AI coach, and on-device face scan |
| `api/` | Server functions: AI coach and feedback |
| `config.js` | Your AdSense publisher ID and ad unit IDs |
| `ads.js` | Ad loading and the consent banner |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installable app and offline support |
| `guides/` | Three articles that bring search traffic and help AdSense approval |
| `privacy.html`, `terms.html`, `about.html` | Pages AdSense requires |
| `ads.txt`, `robots.txt`, `sitemap.xml` | Ad verification and search engines |
| `vercel.json` | Headers and caching |
| `set-domain.sh` | Fills in your domain, email and name everywhere |

## 1. Fill in your details

```bash
./set-domain.sh yourdomain.com you@yourdomain.com "Your Name"
```

Run it once, before deploying. Read `privacy.html` and `terms.html` afterwards. They are templates, so have them checked for your situation.

## 2. Deploy to Vercel

**Option A, GitHub (recommended):**
1. Create a new GitHub repository and upload everything in this folder.
2. On vercel.com choose Add New > Project, import the repository.
3. Leave Framework as Other, leave Build Command and Output Directory empty, then Deploy.

**Option B, command line:**
```bash
npm i -g vercel
vercel --prod
```

## 3. Connect a custom domain

Buy a domain (a `.in` or `.com` is usually under ₹1,000 a year). In Vercel go to Project > Settings > Domains, add it and copy the DNS records to your registrar. AdSense generally does not approve sites that live only on a shared `vercel.app` address, so do this before applying.

## 4. Apply for Google AdSense

1. Sign up at adsense.google.com with your domain.
2. Add the site and follow the verification step. Your `ads.txt` and the ad code are already in place, so verification is usually quick.
3. Approval needs real, original content and a working site. This project includes three guides, a privacy policy, terms and an about page. Add more guides over time (2 to 4 a month is a good pace). Thin sites are the most common reason for rejection.
4. Approval can take from a few days to a few weeks.

## 5. Turn ads on after approval

1. In `config.js` set `ADSENSE_CLIENT` to your publisher ID, for example `ca-pub-1234567890123456`.
2. In AdSense go to Ads > By ad unit > Display ads and create two units. Paste their numeric IDs into `SLOTS.app` and `SLOTS.guide`.
3. In `ads.txt` uncomment the line and put your publisher ID in it, digits only.
4. Commit and redeploy.

Until `ADSENSE_CLIENT` is filled in, nothing ad-related appears. After you fill it in, visitors see a consent banner, and ads load only after they choose.

If you would rather let Google place ads, set `AUTO_ADS: true` and turn on Auto ads in the AdSense dashboard.

If you use Google's own Privacy & messaging banner (needed for visitors in the EEA, UK and Switzerland), set `OWN_CONSENT_BANNER: false`.

## 6. Get visitors

Ads earn nothing without traffic, and the app alone will not rank in search. The guides do.
1. Add the site to Google Search Console and submit `https://yourdomain.com/sitemap.xml`.
2. Write more guides in `guides/` (copy an existing one, then add it to `guides/index.html` and `sitemap.xml`). Pick questions people really search for.
3. Share the install link on Instagram, WhatsApp and YouTube. Installed users come back daily, which raises ad views.

## AdSense rules to follow

- Never click your own ads or ask others to. This gets accounts banned.
- Do not place ads over buttons or near them in a way that causes accidental taps. The app shows one ad under the screens and never on the Routine, Scan or Timer screens.
- Do not tell people to click ads.
- Keep the privacy policy and consent choice working.

## 7. Turn on the AI Coach

The Coach tab has three layers, cheapest first.

**1. Label decoder.** Reads an ingredient list on the visitor's device. Free at any scale.

**2. On-device AI (WebLLM).** An optional toggle runs an open-source model inside the visitor's browser using WebGPU. It costs you nothing at any number of users, and the question never leaves the phone. The model files are downloaded once and cached. Things to know:
- It needs WebGPU, so it only shows on browsers that have it, and falls back to the online coach if the model fails to load.
- The download is large (roughly 1 GB), small models give simpler answers, and low-end phones will be slow. Test on a real phone.
- The code tries `Qwen2.5-1.5B-Instruct` first, then `Llama-3.2-1B-Instruct`. Check each model's licence before you ship. Llama's community licence has its own conditions, such as a "Built with Llama" notice. WebLLM itself is Apache-2.0.
- I could not run a real model here. I tested the flow (offering the toggle, progress, answers, one-time load, fallback) against a stand-in library. Please try it on your own phone before launch.

**3. Online AI through your server (`api/ai.js`).** For everyone whose device cannot run a model. Pick providers with `AI_PROVIDERS`. They are tried in order, so a second one backs up the first.

| Provider | Free allowance (as listed in their docs) | After that |
|---|---|---|
| Cloudflare Workers AI (default) | 10,000 neurons a day. The default model uses about 10 neurons per answer, so roughly 900 answers a day (my estimate). | $0.011 per 1,000 neurons, about $0.12 per 1,000 answers. Cloudflare says it does not train on your content. The pricing page does not say whether the free allowance may be used commercially, so check Cloudflare's terms. |
| Groq (set as `openai`) | The docs list 30 requests per minute and 1,000 per day for open models such as `openai/gpt-oss-20b`. Check your account, the page is unclear which plan those numbers belong to. | Paid developer plans. |
| OpenRouter free models (set as `openai`) | 20 per minute, and 50 per day (1,000 per day once you have bought at least 10 credits). | Paid models. |
| Google Gemini | Small free allowance per project. Google may use free-tier content to improve its products, and its terms do not allow the free tier for users in the EEA, UK and Switzerland or in apps likely to be used by under-18s. The code skips free Gemini for EEA, UK and Swiss visitors. | `gemini-3.5-flash-lite` (default for /api/ai, no Search grounding). Free tier: no charge, Google caps requests per minute and per day; the Shop shows a rule-based explanation when AI is unavailable. |

Setup for Cloudflare: create an account, open Workers AI, create an API token with Workers AI permission, and copy your Account ID. Put them in Vercel as `CF_ACCOUNT_ID` and `CF_API_TOKEN`. For Groq or OpenRouter set `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` and `AI_PROVIDERS=openai`. A chain looks like `AI_PROVIDERS=cloudflare,openai`.

**Can free tiers handle 100,000 users? No hosted API can.** Every provider limits per account, not per visitor. What makes the site hold up:
- The label decoder and on-device AI take the load off your server for visitors with capable phones.
- Per visitor limits, a per-minute cap, a daily cap and a 24 hour answer cache protect your quota. Set `AI_DAILY_CAP` and `AI_RPM` just under the real limits.
- When a cap is reached, visitors see a friendly message and everything else keeps working.
- Eventually you will pay a small amount. At the numbers above, 1,000 online answers cost roughly ten rupees, so a share of your ad income can cover it.

If you use free Gemini, change the AI section of `privacy.html` to name Google, because Google may use free-tier content to improve its products.

## 8. Ratings and feedback

Ratings go to a Google Sheet that you own, for free.
1. Create a Google Sheet, open Extensions > Apps Script and paste `docs/feedback-apps-script.gs`.
2. Change `SECRET`, then Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
3. In Vercel add `FEEDBACK_WEBHOOK_URL` (the web app URL) and `FEEDBACK_SECRET` (same text as `SECRET`). Redeploy.

Visitors can rate from Settings > Rate, and the Home screen asks once after two days of use (and again after a week if they tap Not now). Thumbs under AI answers are also recorded. If you want a star count on Google search results or an app store listing, you need real reviews on a platform that supports it. This in-app rating is for your own insight.

## 9. Shop tab (affiliate products)

The Shop tab builds a cleanser, moisturizer and sunscreen kit from the skin type and budget, with add-ons for women and men. The catalog is `public/catalog.json` (loaded by `public/products.js`). Edit the JSON file to add, re-price or flag deal items. Prices are estimates from 2026 reviews, not live store prices. Shop also shows a curated Today's best deals section with typical MRP vs typical price, labelled as approximate.

### Product photos

Add an optional `image` URL per product, plus `imageAlt`, `imageSource`, `imageLicense`, `imagePage` and `imageCheckedOn`. The app lazy-loads the photo in a fixed square so the layout does not jump; if there is no image it shows a category placeholder. **Only use photos you have the right to use:** Open Beauty Facts (ODbL, link the product page) or a brand's official asset. Do not hotlink or scrape Amazon or Flipkart images. A few catalog items already have verified Open Beauty Facts photos; the rest are left blank on purpose.

`img-src` in `vercel.json` and `public/_headers` allows `https://images.openbeautyfacts.org` and, because AdSense also needs images, a general `https:` fallback.

### Coupons and offers (owner)

Optional per product:

```json
"coupon": {
  "code": "OFFICIALCODE",
  "discountType": "percent",
  "value": 10,
  "minOrder": 499,
  "store": "Amazon",
  "expires": "2026-12-31",
  "sourceUrl": "https://official.example/offer"
},
"offerNote": "Short official offer text"
```

`discountType` is `percent` or `flat`. The Shop card shows “Coupon CODE: save ₹X → approx ₹Y”, a copy button, the expiry, and “verify at checkout”. Expired or badly dated coupons are hidden. **Do not invent codes.** Only add a code you have opened on an official brand or store page, and drop it when it expires. This catalog currently has no coupons, because none were independently verified at the time of writing. `offerNote` can be used for a non-code official offer.

### Fashion deals

Shop has a Fashion deals block with Women / Men tabs. These are **category search links** to Amazon.in and Flipkart (under ₹499 and ₹999) with your affiliate tags. There are no made-up fashion products or prices.

### Telegram deals channel

The app will not create a Telegram channel. When you have one, set `TELEGRAM_URL` in `public/config.js` (for example `https://t.me/yourchannel`) to show a “Join our Telegram deals” button. Setup, a post script, and a disabled GitHub Action are in `docs/telegram-deals.md` and `scripts/post-telegram-deals.mjs`.

### Refreshing catalog facts with Gemini (free, offline)

Product blurbs (“Why this suits you”, “How to use”, “What to avoid”, plus short Hinglish and Tenglish lines) are generated offline with Free-tier `gemini-3.5-flash-lite` and **no Search grounding**: `node scripts/gen-content.mjs`. The script resumes if it hits a rate limit. It will not invent prices, coupons, or medical claims. Shop can switch English / Hinglish / Tenglish when those fields exist.

Flipkart live listings are refreshed offline with the official Affiliate API (`node scripts/sync-flipkart.mjs`, headers `Fk-Affiliate-Id` / `Fk-Affiliate-Token`). Only exact size and variant matches are saved. Shop uses the Flipkart image and product URL only for those matches; Amazon-only products never show a Flipkart photo. Typical catalog prices stay in `price`/`mrp`; live values are in `fkPrice` / `fkMrp` with `fkCheckedOn`.

Do not call Google from the live app to update prices. Use `scripts/refresh-catalog.mjs` by hand (or a disabled Action) with a Free-tier `GEMINI_API_KEY`. It uses `gemini-2.5-flash-lite` plus Grounding with Google Search, stores `sourceUrl` and `checkedOn` for accepted facts, and marks the rest unknown. Coupons are never auto-applied. Official free-tier quotas, why Custom Search JSON API is not used, and the 1 December 2026 `gemini-2.5-flash` billing warning are in `docs/catalog-refresh.md`.

1. Amazon Associates India tracking ID goes in `AFFILIATE_TAG` in `public/config.js` (now `gncare-21`). Flipkart affid goes in `FLIPKART_AFFID` (now `thisisnarenda`).
2. Shop and kit cards show Amazon and Flipkart buttons. Until those IDs are set, the search links still work but earn nothing.
3. Read the Associates Program rules before you go live. Check what they say about showing prices and about disclosure. I did not verify them, and the app shows prices as estimates only. Remove the price chips if the rules do not allow them.
4. Amazon usually needs a few qualifying sales within 180 days of joining, so share your site first.

## 10. Check that everything works

Open `/status.html` on your live site. It shows whether the AdSense ID, ad unit, `ads.txt`, affiliate ID, AI provider and feedback storage are set. Ads need a custom domain and AdSense approval before they appear. The AI coach and the "Explain my kit" button work as soon as one provider is set in step 7.

## Cloudflare Pages (alternative to Vercel)

The `functions/` folder and `wrangler.toml` let the same code run on Cloudflare Pages: connect the repo, leave the build command empty and set the output directory to `public`. Add the same environment variables. This adapter is not tested on a real Cloudflare deploy yet, so try it on a preview first. Check Cloudflare's current terms for commercial use on the free plan.

## Check before you switch ads on

- **Vercel plan:** Vercel's free Hobby plan has been described as for personal, non-commercial use. I could not confirm the current wording in the pages I read, and ads are commercial. Read Vercel's Terms of Service (Fair Use section) and pricing page. The Pro plan lists at $20 per user per month. If you do not want that cost, a static host with a free commercial tier, such as Cloudflare Pages, can serve the static files, though the `api/` functions would need porting.
- **AdSense approval** needs a custom domain and enough original content, as above.
- **Privacy and Terms** pages are templates. Have them checked.

## Face Scan

Face Scan is four short steps: an optional selfie, an optional note, a budget, then a kit and a one-tap AM/PM routine. You need a selfie or a note (or both). The note is parsed on the device with simple keyword matching (English plus common Hinglish and Tenglish words) and does not need an AI key. If you add a selfie, [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) loads from a CDN the first time, runs only in the browser, and never uploads the photo. It estimates shine, redness, evenness and under-eye darkness in the T-zone, cheeks and chin, then combines those scores with the note. This is a cosmetic estimate, not a medical diagnosis, and lighting affects the result. If the model cannot load, no face is found, or the photo is too dark or too bright, the app asks you to retake or continue with a note. The photo stays in the session unless you tap Save photo on this device. "Set this routine" writes the suggested morning and night steps into the Routine tab.

## Tests

```bash
npm test
```

Runs 95 checks on the AI endpoint (providers, fallback, limits, caching, region rule, origin check, prompt injection, errors), the feedback endpoint, the label scanner, the shop kit builder, and the face-scan metrics, concern parser, routine builder and budget kit mapping, using mocks, so it costs nothing.

## Other income options

- Affiliate links to products on your shelf and guides (Amazon Associates India, Nykaa and others). Label them clearly and read each programme's rules.
- A paid version without ads or with extra features.

## Local test

```bash
npx serve .
```

Open the address it prints. The service worker only works on `localhost` or HTTPS.

## Notes

- Visitor data is stored in each browser only. There is no server or database.
- When you change app files, increase `VERSION` in `sw.js` so installed copies update.


## Hosting, scale and a custom domain

The app is a static PWA plus three small `/api` routes, so pages and assets can be served from a CDN. API use stays low: the Coach has a 24-hour answer cache, per-IP and site-wide caps, and on-device WebLLM (Qwen2.5 0.5B by default) for visitors who turn it on.

**Vercel Hobby is not licensed for commercial use.** If GN Care starts earning from ads or affiliates, move the production site to a commercial-friendly free host. A Cloudflare Pages adapter already lives in `functions/` and `wrangler.toml`. Upstash Redis (free tier) is recommended for durable rate limits once traffic grows; without it, limits are only in memory on each instance.

Notifications are local (Notification API and, where supported, Notification Triggers or periodic background sync). Web Push with VAPID was not added: it needs a stored subscription and a server, and is not required for AM/PM reminders.

After you buy a custom domain, add it in Vercel or Cloudflare, run `./set-domain.sh`, and only then apply for AdSense and paste your publisher ID into `ADSENSE_CLIENT` in `public/config.js`.
