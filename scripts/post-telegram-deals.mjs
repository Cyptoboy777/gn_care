#!/usr/bin/env node
/**
 * Post today's catalog deals to a Telegram channel you already created.
 * This script does not create a channel, bot, or posts unless you run it
 * with TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL set.
 *
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHANNEL=@yourchannel node scripts/post-telegram-deals.mjs
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHANNEL=@yourchannel node scripts/post-telegram-deals.mjs --dry-run
 *
 * See docs/telegram-deals.md for setup. Affiliate disclosure is always included.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(join(ROOT, '.env'));

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

const require = createRequire(import.meta.url);
const picks = require(join(ROOT, 'public/picks.js'));
const catalog = JSON.parse(readFileSync(join(ROOT, 'public/catalog.json'), 'utf8'));
const configSrc = readFileSync(join(ROOT, 'public/config.js'), 'utf8');
const tag = (configSrc.match(/AFFILIATE_TAG:\s*'([^']*)'/) || [])[1] || '';
const affid = (configSrc.match(/FLIPKART_AFFID:\s*'([^']*)'/) || [])[1] || '';
const site = (configSrc.match(/SITE_URL:\s*'([^']*)'/) || [])[1] || 'https://gncare.xyz';

// Load products into the picks module the same way the browser does
const g = globalThis;
g.GN_PRODUCTS = catalog.products;
g.GN_DEALS = catalog.deals || [];

const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const channel = (process.env.TELEGRAM_CHANNEL || '').trim();
const dry = process.argv.includes('--dry-run');

function die(msg) { console.error(msg); process.exit(1); }

if (!dry && (!token || !channel)) {
  die('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL. See docs/telegram-deals.md. Use --dry-run to print the message without sending.');
}

function todayISO() {
  const z = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(z).toISOString().slice(0, 10);
}

const deals = (typeof picks.deals === 'function' ? picks.deals(catalog.deals || []) : []).slice(0, 6);
if (!deals.length) die('No curated deals in catalog.json (need products listed in "deals" with mrp > price).');

const lines = [];
lines.push(`GN Care — today's typical deals (${todayISO()})`);
lines.push('Prices are approximate, from our catalog. Check the store for today\'s price.');
lines.push('');
for (const p of deals) {
  const off = picks.dealDiscount(p);
  const price = p.price != null ? `₹${Math.round(p.price)}` : 'price varies';
  const mrp = p.mrp != null ? ` (typical MRP ₹${Math.round(p.mrp)})` : '';
  const disc = off != null ? ` · ~${off}% off typ.` : '';
  lines.push(`• ${p.brand} ${p.name}${p.size ? ' · ' + p.size : ''}`);
  lines.push(`  ${price}${mrp}${disc}`);
  if (picks.couponLive && picks.couponLive(p.coupon)) {
    lines.push(`  Coupon ${p.coupon.code} — verify at checkout${p.coupon.expires ? ', expires ' + p.coupon.expires : ''}`);
  }
  const amz = picks.buyURL(p, tag);
  const fk = picks.flipkartURL(p, affid);
  if (amz) lines.push(`  Amazon: ${amz}`);
  if (fk) lines.push(`  Flipkart: ${fk}`);
  lines.push('');
}
lines.push('Shop the full list: ' + site.replace(/\/$/, '') + '/#picks');
lines.push('As an Amazon Associate and Flipkart affiliate, GN Care earns from qualifying purchases.');
const text = lines.join('\n');

if (dry) {
  console.log(text);
  process.exit(0);
}

const api = `https://api.telegram.org/bot${token}/sendMessage`;
const res = await fetch(api, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: channel,
    text,
    disable_web_page_preview: true,
  }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) {
  die('Telegram API error: ' + (data.description || res.status));
}
console.log('Posted to', channel, 'message_id', data.result && data.result.message_id);
