#!/usr/bin/env node
/**
 * Offline catalog refresh using the Gemini API Free tier with Google Search grounding.
 * Never called from the PWA or /api routes. You run it locally or from GitHub Actions.
 *
 *   GEMINI_API_KEY=... node scripts/refresh-catalog.mjs
 *   GEMINI_API_KEY=... node scripts/refresh-catalog.mjs --apply --limit 10
 *
 * Reads GEMINI_API_KEY from the environment (or .env if present, without printing it).
 * Writes a review file to scripts/out/catalog-refresh-YYYY-MM-DD.json.
 * --apply copies only sourced fields into public/catalog.json. Unknown stays unknown.
 * Coupons are never auto-applied; they are listed in the report for you to verify.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(join(ROOT, '.env'));

const ALLOWED_MODELS = new Set(['gemini-2.5-flash-lite']);
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const BLOCKED_IMAGE_HOSTS = /(amazon\.|flipkart\.|fkcdn|media-amazon|ssl-images-amazon)/i;
const OK_IMAGE_HOSTS = /^(https:\/\/images\.openbeautyfacts\.org\/)/i;

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || m[2] === undefined) continue;
    if (process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) process.env[m[1]] = v;
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('-')) return true;
  return v;
}

function todayISO() {
  const d = new Date();
  const z = d.getTime() + (5.5 * 60 * 60 * 1000); // report dates in Asia/Calcutta
  return new Date(z).toISOString().slice(0, 10);
}

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

const key = (process.env.GEMINI_API_KEY || '').trim();
if (!key) {
  die(`Missing GEMINI_API_KEY.

Create a Free-tier key (no credit card required) at:
  https://aistudio.google.com/apikey

Then run:
  GEMINI_API_KEY=your_key node scripts/refresh-catalog.mjs --limit 5

See docs/catalog-refresh.md for official free-tier quotas and why Custom Search JSON API is not used.`);
}

const model = (arg('--model', process.env.GEMINI_REFRESH_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL) || DEFAULT_MODEL).trim();
if (!ALLOWED_MODELS.has(model)) {
  die(`Refusing model "${model}".

This script only allows gemini-2.5-flash-lite on the Gemini API Free tier, where official pricing lists Grounding with Google Search as "Free of charge, up to 500 RPD (limit shared with Flash RPD)":
  https://ai.google.dev/gemini-api/docs/pricing

Do not use gemini-2.5-flash: Google says that from 1 December 2026, requests to it are routed to gemini-3.5-flash-lite and billed at that model's rates.

Do not use Gemini 3 or 4 models for this job on the Free tier: official pricing marks Grounding with Google Search as "Not available" on the Free tier for those models (paid tier required).

If Google later retires gemini-2.5-flash-lite from the Free tier, stop running this script rather than switching to a billed model.`);
}

const limit = Math.max(1, Math.min(40, Number(arg('--limit', process.env.CATALOG_REFRESH_LIMIT || 15)) || 15));
const apply = process.argv.includes('--apply');
const idsArg = arg('--ids', '');
const sleepMs = Math.max(1500, Number(arg('--sleep-ms', 4000)) || 4000);
const dry = process.argv.includes('--dry-run');

const catalogPath = join(ROOT, 'public/catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
let products = catalog.products || [];
if (idsArg && idsArg !== true) {
  const want = new Set(String(idsArg).split(',').map((s) => s.trim()).filter(Boolean));
  products = products.filter((p) => want.has(p.id));
}
products = products.slice(0, limit);

function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

function citationUrls(data) {
  const urls = [];
  const cands = (data && data.candidates) || [];
  for (const c of cands) {
    const meta = c.groundingMetadata || c.grounding_metadata || {};
    const chunks = meta.groundingChunks || meta.grounding_chunks || [];
    for (const ch of chunks) {
      const u = (ch.web && (ch.web.uri || ch.web.url)) || '';
      if (/^https?:\/\//i.test(u)) urls.push(u);
    }
    const atts = (c.citationMetadata && c.citationMetadata.citationSources) || [];
    for (const a of atts) {
      if (/^https?:\/\//i.test(a.uri || '')) urls.push(a.uri);
    }
  }
  return [...new Set(urls)];
}

function firstHttp(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  if (v && typeof v === 'object' && /^https?:\/\//i.test(v.url || v.sourceUrl || '')) return v.url || v.sourceUrl;
  return '';
}

async function queryProduct(p) {
  const prompt = `You are updating a public skincare product catalog for India. Be strictly honest.

Product:
- id: ${p.id}
- brand: ${p.brand}
- name: ${p.name}
- size: ${p.size || 'unknown'}
- current typical price (INR, may be stale): ${p.price == null ? 'unknown' : p.price}
- current typical MRP (INR, may be stale): ${p.mrp == null ? 'unknown' : p.mrp}

Use Google Search. Only state a fact when you can cite a specific public page for it.
If you cannot verify a field, set it to null and set the matching sourceUrl to null. Never guess, invent, or reuse another product's data.
Do not invent coupon codes. A coupon is only allowed if a clearly official brand or store page currently publishes that exact code and an expiry date. Otherwise coupon must be null.
Do not return Amazon or Flipkart product image URLs (those are not licensed for our catalog). Image URLs may only be official brand/site images or Open Beauty Facts (images.openbeautyfacts.org) with the OBF product page.

Return ONLY JSON with this shape:
{
  "id": "${p.id}",
  "matched": true or false,
  "price": number or null,
  "priceSourceUrl": string or null,
  "mrp": number or null,
  "mrpSourceUrl": string or null,
  "offerNote": string or null,
  "offerSourceUrl": string or null,
  "coupon": null or { "code": "", "discountType": "percent" or "flat", "value": number, "minOrder": number or null, "store": "", "expires": "YYYY-MM-DD" or null, "sourceUrl": "" },
  "image": string or null,
  "imagePage": string or null,
  "imageSource": string or null,
  "notes": "short reason if anything is unknown"
}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  };
  const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  if (!res.ok) {
    const msg = (data.error && data.error.message) || text.slice(0, 400);
    const err = new Error(`Gemini HTTP ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  const parts = ((((data.candidates || [])[0] || {}).content || {}).parts || []).map((x) => x.text || '').join('');
  const parsed = extractJson(parts);
  const grounding = citationUrls(data);
  return { parsed, grounding, text: parts, finishReason: (data.candidates || [])[0]?.finishReason || '' };
}

function sourced(value, url, grounding) {
  const src = firstHttp(url);
  if (value == null || value === '' || !src) return { value: null, sourceUrl: null, ok: false };
  // Require the model-cited URL to appear in grounding chunks when any grounding exists.
  if (grounding.length) {
    const ok = grounding.some((g) => g === src || g.replace(/\/$/, '') === src.replace(/\/$/, ''));
    if (!ok) return { value: null, sourceUrl: null, ok: false, reason: 'sourceUrl was not in grounding citations' };
  }
  return { value, sourceUrl: src, ok: true };
}

function reviewItem(p, result) {
  const checkedOn = todayISO();
  const out = { id: p.id, brand: p.brand, name: p.name, checkedOn, status: 'unknown', fields: {}, warnings: [] };
  if (!result || !result.parsed) {
    out.warnings.push('No parseable JSON, or the request failed. Left unchanged.');
    return out;
  }
  const r = result.parsed;
  const g = result.grounding || [];
  if (!g.length) out.warnings.push('Response had no grounding citations; facts were not accepted.');

  const price = sourced(typeof r.price === 'number' ? r.price : null, r.priceSourceUrl, g);
  if (price.ok && price.value > 0 && price.value < 100000) {
    out.fields.price = { value: Math.round(price.value), sourceUrl: price.sourceUrl, checkedOn };
  } else out.fields.price = { value: null, status: 'unknown', reason: price.reason || 'unverified' };

  const mrp = sourced(typeof r.mrp === 'number' ? r.mrp : null, r.mrpSourceUrl, g);
  if (mrp.ok && mrp.value > 0 && mrp.value < 100000) {
    out.fields.mrp = { value: Math.round(mrp.value), sourceUrl: mrp.sourceUrl, checkedOn };
  } else out.fields.mrp = { value: null, status: 'unknown', reason: mrp.reason || 'unverified' };

  const offer = sourced(typeof r.offerNote === 'string' ? r.offerNote.trim() : null, r.offerSourceUrl, g);
  if (offer.ok) out.fields.offerNote = { value: offer.value.slice(0, 200), sourceUrl: offer.sourceUrl, checkedOn };
  else out.fields.offerNote = { value: null, status: 'unknown' };

  if (r.image && OK_IMAGE_HOSTS.test(r.image) && firstHttp(r.imagePage)) {
    const img = sourced(r.image, r.imagePage, g.length ? g.concat([r.imagePage, r.image]) : []);
    // For OBF images, the product page is the required source; grounding may cite the same host.
    out.fields.image = {
      value: r.image,
      imagePage: firstHttp(r.imagePage),
      imageSource: r.imageSource || 'Open Beauty Facts',
      imageLicense: 'ODbL',
      checkedOn,
      status: 'proposed',
    };
  } else if (r.image && BLOCKED_IMAGE_HOSTS.test(r.image)) {
    out.warnings.push('Rejected an Amazon/Flipkart image URL.');
    out.fields.image = { value: null, status: 'unknown' };
  } else if (r.image && firstHttp(r.image)) {
    out.fields.image = { value: r.image, imagePage: firstHttp(r.imagePage), imageSource: r.imageSource || 'official?', checkedOn, status: 'review-only', note: 'Not auto-applied. Confirm the URL is a legally reusable official or ODbL image, then add it by hand.' };
  } else {
    out.fields.image = { value: null, status: 'unknown' };
  }

  if (r.coupon && r.coupon.code && firstHttp(r.coupon.sourceUrl)) {
    out.fields.coupon = { ...r.coupon, sourceUrl: firstHttp(r.coupon.sourceUrl), checkedOn, status: 'review-only', note: 'Never auto-applied. Open the sourceUrl, confirm the code and expiry yourself, then add it to catalog.json.' };
  } else {
    out.fields.coupon = { value: null, status: 'unknown' };
  }

  out.grounding = g;
  out.modelNotes = r.notes || '';
  out.status = Object.values(out.fields).some((f) => f && (f.status === 'proposed' || f.value != null) && f.status !== 'unknown' && f.status !== 'review-only') || (out.fields.image && out.fields.image.status === 'proposed') ? 'sourced' : 'unknown';
  return out;
}

function applyReview(catalog, reviews) {
  const byId = new Map((catalog.products || []).map((p) => [p.id, p]));
  let changed = 0;
  for (const rev of reviews) {
    const p = byId.get(rev.id);
    if (!p) continue;
    const f = rev.fields || {};
    if (f.price && f.price.sourceUrl && f.price.value > 0) {
      p.price = f.price.value;
      p.priceSourceUrl = f.price.sourceUrl;
      p.priceCheckedOn = f.price.checkedOn;
      changed++;
    }
    if (f.mrp && f.mrp.sourceUrl && f.mrp.value > 0) {
      p.mrp = f.mrp.value;
      p.mrpSourceUrl = f.mrp.sourceUrl;
      p.mrpCheckedOn = f.mrp.checkedOn;
      changed++;
    }
    if (f.offerNote && f.offerNote.sourceUrl && f.offerNote.value) {
      p.offerNote = f.offerNote.value;
      p.offerSourceUrl = f.offerNote.sourceUrl;
      p.offerCheckedOn = f.offerNote.checkedOn;
      changed++;
    }
    if (f.image && f.image.status === 'proposed' && f.image.value && OK_IMAGE_HOSTS.test(f.image.value)) {
      p.image = f.image.value;
      p.imagePage = f.image.imagePage;
      p.imageSource = f.image.imageSource;
      p.imageLicense = 'ODbL';
      p.imageCheckedOn = f.image.checkedOn;
      if (!p.imageAlt) p.imageAlt = `${p.brand} ${p.name}`;
      changed++;
    }
    // coupons and non-ODbL images: never auto-applied
    p.checkedOn = rev.checkedOn;
  }
  catalog.updated = todayISO();
  return changed;
}

async function main() {
  console.log(`Catalog refresh using ${model} + Google Search grounding`);
  console.log(`Products this run: ${products.length} (limit ${limit}). Sleep ${sleepMs}ms between calls.`);
  console.log('Facts without a grounding source URL will be marked unknown. Coupons are never auto-applied.');
  if (dry) {
    products.forEach((p) => console.log(' would query', p.id, p.brand, p.name));
    return;
  }
  const reviews = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    process.stdout.write(`[${i + 1}/${products.length}] ${p.id} ${p.brand} … `);
    try {
      const result = await queryProduct(p);
      const rev = reviewItem(p, result);
      reviews.push(rev);
      console.log(rev.status, (rev.warnings[0] || rev.modelNotes || '').slice(0, 80));
    } catch (err) {
      const rev = { id: p.id, brand: p.brand, name: p.name, checkedOn: todayISO(), status: 'error', fields: {}, warnings: [err.message] };
      reviews.push(rev);
      console.log('ERROR', err.message);
      if (err.status === 429) {
        console.error('Hit a rate limit (429). Stopping to stay on the free quota. Try again after midnight Pacific Time, or lower --limit.');
        break;
      }
      if (err.status === 400 || err.status === 403 || err.status === 401) {
        console.error('Stopping: API rejected the request. Check the key, model, and that the project is still on the Free tier.');
        break;
      }
    }
    if (i < products.length - 1) await new Promise((r) => setTimeout(r, sleepMs));
  }

  const outDir = join(ROOT, 'scripts/out');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `catalog-refresh-${todayISO()}.json`);
  const report = {
    checkedOn: todayISO(),
    model,
    zone: 'Asia/Calcutta',
    apply: false,
    productsQueried: reviews.length,
    reviews,
  };
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  writeFileSync(join(ROOT, 'scripts/catalog-refresh-last.json'), JSON.stringify(report, null, 2));
  console.log('Wrote', outFile);

  if (apply) {
    const changed = applyReview(catalog, reviews);
    writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
    report.apply = true;
    writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log(`Applied ${changed} sourced field updates to public/catalog.json. Review the diff, then commit. Coupons and non-ODbL images were left for manual review.`);
  } else {
    console.log('Dry apply: review the JSON, then re-run with --apply to copy sourced prices/MRP/ODbL images only.');
  }
}

main().catch((e) => die(e.stack || e.message));
