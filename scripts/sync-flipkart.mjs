#!/usr/bin/env node
/**
 * Offline Flipkart Affiliate API sync. Never called from the PWA.
 *
 *   FLIPKART_AFFILIATE_TOKEN=... node scripts/sync-flipkart.mjs
 *   FLIPKART_AFFILIATE_TOKEN=... node scripts/sync-flipkart.mjs --limit 5
 *
 * Headers: Fk-Affiliate-Id (thisisnarenda) and Fk-Affiliate-Token.
 * Matches only exact-enough listings (same brand, name, size; no combos or variant swaps).
 * Writes fk* fields + checkedOn. Does not invent prices. Does not change products with no match.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(join(ROOT, '.env'));
const require = createRequire(import.meta.url);
const match = require('./flipkart-match.js');

const AFFID = 'thisisnarenda';
const API = 'https://affiliate-api.flipkart.net/affiliate/1.0/search.json';
const FK_KEYS = ['fkProductId', 'fkTitle', 'fkPrice', 'fkMrp', 'fkDiscount', 'fkOfferNote', 'fkUrl', 'fkImage', 'fkSourceUrl', 'fkCheckedOn', 'fkInStock'];

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
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
  const z = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(z).toISOString().slice(0, 10);
}

function redact(s) {
  const token = (process.env.FLIPKART_AFFILIATE_TOKEN || '').trim();
  s = String(s || '');
  if (token) s = s.split(token).join('[redacted]');
  return s.replace(/Fk-Affiliate-Token["'\s:]*[^\s"',}]+/gi, 'Fk-Affiliate-Token:[redacted]').slice(0, 400);
}

function die(msg, code = 1) {
  console.error(redact(msg));
  process.exit(code);
}

const token = (process.env.FLIPKART_AFFILIATE_TOKEN || '').trim();
if (!token) die('Missing FLIPKART_AFFILIATE_TOKEN.');

const limit = Math.max(1, Math.min(80, Number(arg('--limit', 80)) || 80));
const sleepMs = Math.max(400, Number(arg('--sleep-ms', 1000)) || 1000);
const force = process.argv.includes('--force');
const dry = process.argv.includes('--dry-run');
const idsArg = arg('--ids', '');
const catalogPath = join(ROOT, 'public/catalog.json');

function loadCatalog() { return JSON.parse(readFileSync(catalogPath, 'utf8')); }
function saveCatalog(catalog) {
  catalog.updated = todayISO();
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
}

function flatten(raw) {
  const b = raw.productBaseInfoV1 || raw;
  const attrs = b.attributes || {};
  const imgs = b.imageUrls || {};
  const img = imgs['400x400'] || imgs['800x800'] || imgs['200x200'] || '';
  const sell = (b.flipkartSpecialPrice && b.flipkartSpecialPrice.amount) || (b.flipkartSellingPrice && b.flipkartSellingPrice.amount);
  const selling = (b.flipkartSellingPrice && b.flipkartSellingPrice.amount);
  const special = (b.flipkartSpecialPrice && b.flipkartSpecialPrice.amount);
  let price = null;
  const nums = [special, selling].filter((n) => typeof n === 'number' && n > 0);
  if (nums.length) price = Math.min.apply(null, nums);
  else if (typeof sell === 'number' && sell > 0) price = sell;
  const mrp = b.maximumRetailPrice && typeof b.maximumRetailPrice.amount === 'number' ? b.maximumRetailPrice.amount : null;
  return {
    productId: b.productId || '',
    title: b.title || '',
    brand: b.productBrand || '',
    categoryPath: b.categoryPath || '',
    size: attrs.size || '',
    inStock: !!b.inStock,
    price: price,
    mrp: mrp,
    productUrl: b.productUrl || '',
    image: img,
    offers: Array.isArray(b.offers) ? b.offers : []
  };
}

function productOfferNote(listing) {
  if (listing.mrp != null && listing.price != null && listing.mrp > listing.price) {
    return '₹' + Math.round(listing.mrp - listing.price) + ' off on Flipkart today';
  }
  return '';
}

function toFields(listing) {
  const url = match.withAffid(listing.productUrl, AFFID);
  if (!url || !listing.productId) return null;
  const img = listing.image && match.isFlipkartImageHost(listing.image) ? listing.image : '';
  const price = listing.price != null ? Math.round(listing.price) : null;
  const mrp = listing.mrp != null ? Math.round(listing.mrp) : null;
  let discount = null;
  if (price != null && mrp != null && mrp > price) discount = Math.round((1 - price / mrp) * 100);
  return {
    fkProductId: listing.productId,
    fkTitle: String(listing.title).slice(0, 180),
    fkPrice: price,
    fkMrp: mrp,
    fkDiscount: discount,
    fkOfferNote: productOfferNote(listing) || undefined,
    fkUrl: url,
    fkImage: img || undefined,
    fkSourceUrl: url,
    fkCheckedOn: todayISO(),
    fkInStock: !!listing.inStock
  };
}

function clearFk(p) {
  FK_KEYS.forEach((k) => { delete p[k]; });
}

function applyFk(p, fields) {
  clearFk(p);
  Object.keys(fields).forEach((k) => {
    if (fields[k] !== undefined) p[k] = fields[k];
  });
}

async function search(q) {
  const url = API + '?query=' + encodeURIComponent(q) + '&resultCount=10';
  const res = await fetch(url, {
    headers: {
      'Fk-Affiliate-Id': AFFID,
      'Fk-Affiliate-Token': token,
      'Accept': 'application/json'
    }
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) {
    const err = new Error('Flipkart HTTP ' + res.status + ': ' + redact((data && (data.error || data.message || data.errorMsg)) || text));
    err.status = res.status;
    throw err;
  }
  return Array.isArray(data && data.products) ? data.products.map(flatten) : [];
}

async function main() {
  const catalog = loadCatalog();
  let products = catalog.products || [];
  if (idsArg && idsArg !== true) {
    const want = new Set(String(idsArg).split(',').map((s) => s.trim()).filter(Boolean));
    products = products.filter((p) => want.has(p.id));
  }
  const pending = products.filter((p) => force || p.fkCheckedOn !== todayISO()).slice(0, limit);
  console.log('Flipkart affiliate sync. Pending', pending.length, 'sleep', sleepMs + 'ms. Affid', AFFID + '. Token not logged.');
  if (dry) {
    pending.forEach((p) => console.log(' would search', p.id, p.brand, p.name, p.size || '(no size)'));
    return;
  }
  let ok = 0, skipped = 0, failed = 0, calls = 0;
  const log = { checkedOn: todayISO(), affid: AFFID, calls: 0, ok: 0, skipped: 0, failed: 0, items: [] };

  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    const q = [p.brand, p.name, p.size].filter(Boolean).join(' ');
    process.stdout.write('[' + (i + 1) + '/' + pending.length + '] ' + p.id + ' … ');
    if (!match.parseSize(p.size || '')) {
      const live = loadCatalog();
      const target = (live.products || []).find((x) => x.id === p.id);
      if (target && force) { clearFk(target); saveCatalog(live); }
      skipped++;
      console.log('skip catalog-size-unknown');
      log.items.push({ id: p.id, status: 'skip', reason: 'catalog-size-unknown' });
      continue;
    }
    try {
      calls++;
      const listings = await search(q);
      const picked = match.pickMatch(p, listings);
      if (!picked.ok) {
        const q2 = '"' + [p.brand, p.name].filter(Boolean).join(' ') + '" ' + (p.size || '');
        if (q2.trim() !== q) {
          calls++;
          const more = await search(q2.trim());
          const seen = new Set(listings.map((x) => x.productId));
          more.forEach((x) => { if (!seen.has(x.productId)) listings.push(x); });
          const again = match.pickMatch(p, listings);
          if (again.ok) Object.assign(picked, again);
        }
      }
      if (picked.ok && p.price && picked.listing && picked.listing.mrp && picked.listing.mrp > p.price * 3) {
        picked.ok = false;
        picked.reason = 'mrp-outlier';
      }
      const live = loadCatalog();
      const target = (live.products || []).find((x) => x.id === p.id);
      if (!picked.ok) {
        if (target && force) { clearFk(target); saveCatalog(live); }
        skipped++;
        console.log('no match (' + picked.reason + ') from', listings.length, 'hits');
        log.items.push({ id: p.id, status: 'skip', reason: picked.reason, hits: listings.length });
      } else {
        const fields = toFields(picked.listing);
        if (!fields) {
          skipped++;
          console.log('rejected (url/image)');
          log.items.push({ id: p.id, status: 'skip', reason: 'bad-url' });
        } else if (target) {
          applyFk(target, fields);
          saveCatalog(live);
          ok++;
          console.log('ok', picked.listing.title.slice(0, 80), '₹' + fields.fkPrice);
          log.items.push({ id: p.id, status: 'ok', title: picked.listing.title, price: fields.fkPrice, mrp: fields.fkMrp, productId: fields.fkProductId });
        }
      }
    } catch (err) {
      failed++;
      console.log('ERROR', redact(err.message));
      log.items.push({ id: p.id, status: 'error', message: redact(err.message) });
      if (err.status === 401 || err.status === 403) {
        console.error('Stopping: affiliate API rejected the request (auth). Token not logged.');
        log.stopped = String(err.status);
        break;
      }
      if (err.status === 429) {
        console.error('Stopping: rate limited (429). Re-run later; already-saved matches are kept.');
        log.stopped = '429';
        break;
      }
    }
    if (i < pending.length - 1) await new Promise((r) => setTimeout(r, sleepMs));
  }

  log.calls = calls;
  log.ok = ok;
  log.skipped = skipped;
  log.failed = failed;
  const outDir = join(ROOT, 'scripts/out');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'sync-flipkart-log.json'), JSON.stringify(log, null, 2));
  console.log('Done. Matched', ok, 'skipped', skipped, 'failed', failed, 'API calls', calls + '.');
}

main().catch((e) => die(e.stack || e.message));
