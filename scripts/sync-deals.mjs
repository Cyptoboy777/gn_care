#!/usr/bin/env node
/**
 * Offline Flipkart Affiliate API sync for the Deals tab. Never called from the PWA.
 *
 *   FLIPKART_AFFILIATE_TOKEN=... node scripts/sync-deals.mjs
 *   FLIPKART_AFFILIATE_TOKEN=... node scripts/sync-deals.mjs --dry-run
 *
 * Headers: Fk-Affiliate-Id (thisisnarenda) and Fk-Affiliate-Token.
 * Writes public/deals.json with real title, image, price, MRP, computed discount,
 * affiliate URL and fetched timestamp. Drops listings without a real price.
 * Does not invent prices, ratings or coupons.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(join(ROOT, '.env'));
const require = createRequire(import.meta.url);
const match = require('./flipkart-match.js');
const lib = require('./deals-lib.js');

const AFFID = process.env.FLIPKART_AFFILIATE_ID || 'thisisnarenda';
const SEARCH = 'https://affiliate-api.flipkart.net/affiliate/1.0/search.json';
const PRODUCT = 'https://affiliate-api.flipkart.net/affiliate/1.0/product.json';
const DOTD = 'https://affiliate-api.flipkart.net/affiliate/offers/v1/dotd/json';
const ALL_OFFERS = 'https://affiliate-api.flipkart.net/affiliate/offers/v1/all/json';
const PER_CATEGORY = 20;

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

function nowIST() {
  const z = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(z).toISOString().replace('Z', '+05:30');
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

const sleepMs = Math.max(400, Number(arg('--sleep-ms', 800)) || 800);
const dry = process.argv.includes('--dry-run');
const helpers = { withAffid: match.withAffid, isFlipkartImageHost: match.isFlipkartImageHost };

async function fkGet(url) {
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
  return data;
}

async function search(q) {
  const url = SEARCH + '?query=' + encodeURIComponent(q) + '&resultCount=10';
  const data = await fkGet(url);
  return Array.isArray(data && data.products) ? data.products.map(lib.flattenProduct) : [];
}

async function productById(pid) {
  const data = await fkGet(PRODUCT + '?id=' + encodeURIComponent(pid));
  const raw = data && (data.productBaseInfoV1 ? data : (Array.isArray(data.products) ? data.products[0] : data));
  return raw ? lib.flattenProduct(raw) : null;
}

function toItem(listing, category, fetchedAt) {
  return lib.toDealItem(listing, category, fetchedAt, AFFID, helpers);
}

async function main() {
  const fetchedAt = nowIST();
  console.log('Flipkart deals sync.', fetchedAt, 'Affid', AFFID + '. Token not logged.');
  let calls = 0;
  let stopped = '';

  async function safe(label, fn) {
    if (stopped) return null;
    try {
      calls++;
      const out = await fn();
      await new Promise((r) => setTimeout(r, sleepMs));
      return out;
    } catch (err) {
      console.error(label, redact(err.message));
      if (err.status === 401 || err.status === 403) {
        console.error('Stopping: affiliate API rejected the request (auth). Token not logged.');
        stopped = String(err.status);
      } else if (err.status === 429) {
        console.error('Stopping: rate limited (429). Re-run later.');
        stopped = '429';
      }
      return null;
    }
  }

  const offerItems = [];
  const dotd = await safe('DOTD', () => fkGet(DOTD));
  const offers = await safe('All offers', () => fkGet(ALL_OFFERS));
  const offerRows = []
    .concat((dotd && dotd.dotdList) || [])
    .concat((offers && offers.allOffersList) || []);
  console.log('Offer feeds: DOTD', ((dotd && dotd.dotdList) || []).length, 'all', ((offers && offers.allOffersList) || []).length);
  const pids = [];
  const seenPid = Object.create(null);
  for (const row of offerRows) {
    const pid = lib.extractPid(row && row.url);
    if (pid && !seenPid[pid]) { seenPid[pid] = true; pids.push(pid); }
  }
  for (const pid of pids.slice(0, 15)) {
    const listing = await safe('product ' + pid, () => productById(pid));
    const item = listing ? toItem(listing, 'offers', fetchedAt) : null;
    if (item) offerItems.push(item);
  }

  const categories = [];
  for (const cat of lib.CATEGORIES) {
    const collected = [];
    if (cat.id === 'beauty' || cat.id === 'laptops') {
      offerItems.forEach((it) => {
        const path = (it.title || '').toLowerCase();
        if (cat.id === 'laptops' && /laptop|notebook/.test(path)) collected.push(Object.assign({}, it, { category: cat.id }));
        if (cat.id === 'beauty' && /sunscreen|serum|moisturizer|face wash|shampoo|cream/.test(path)) collected.push(Object.assign({}, it, { category: cat.id }));
      });
    }
    for (const q of cat.queries) {
      const listings = await safe('search ' + q, () => search(q));
      (listings || []).forEach((listing) => {
        const item = toItem(listing, cat.id, fetchedAt);
        if (item) collected.push(item);
      });
    }
    const items = lib.selectCategoryItems(collected, PER_CATEGORY);
    categories.push({ id: cat.id, label: cat.label, items });
    console.log(cat.id, items.length, 'priced items');
  }

  const counts = {};
  categories.forEach((c) => { counts[c.id] = c.items.length; });
  const deals = {
    fetchedAt,
    source: 'Flipkart Affiliate API',
    disclaimer: 'Prices are Flipkart listings as of the fetched date. Check the store at checkout. No ratings or coupons are invented.',
    offersResolved: offerItems.length,
    categories
  };

  if (dry) {
    console.log('Dry run. Would write public/deals.json', counts, 'API calls', calls);
    return;
  }
  const outPath = join(ROOT, 'public/deals.json');
  writeFileSync(outPath, JSON.stringify(deals, null, 2) + '\n');
  console.log('Wrote public/deals.json', counts, 'API calls', calls + (stopped ? ' stopped=' + stopped : '.'));
}

main().catch((e) => die(e.stack || e.message));
