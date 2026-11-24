#!/usr/bin/env node
/**
 * Post Flipkart store deals to Telegram, with photos when the listing has a real image.
 * Price-drop alerts (genuine new lows or >=5% drops vs our history) are sent first.
 * Daily top-discount posts run at 08:00 IST and on --daily / workflow_dispatch.
 *
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHANNEL=@Gncarestore node scripts/post-telegram-store-deals.mjs
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHANNEL=@Gncarestore node scripts/post-telegram-store-deals.mjs --drops-only
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHANNEL=@Gncarestore node scripts/post-telegram-store-deals.mjs --dry-run
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(join(ROOT, '.env'));
const require = createRequire(import.meta.url);
const lib = require('./deals-lib.js');

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

function die(msg, code = 1) { console.error(redact(msg)); process.exit(code); }

function nowIST() {
  const z = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(z).toISOString().replace('Z', '+05:30');
}

function todayISO() { return nowIST().slice(0, 10); }

function istHour() {
  const z = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(z).getUTCHours();
}

function redact(s) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  s = String(s || '');
  if (token) s = s.split(token).join('[redacted]');
  return s.replace(/bot[0-9]{6,}:[A-Za-z0-9_-]+/g, 'bot[redacted]').slice(0, 400);
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

const dry = process.argv.includes('--dry-run');
const dropsOnly = process.argv.includes('--drops-only');
const dailyFlag = process.argv.includes('--daily') || process.env.POST_DAILY === '1';
const wantDaily = !dropsOnly && (dailyFlag || istHour() === 8);
const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const channel = (process.env.TELEGRAM_CHANNEL || process.env.TELEGRAM_CHAT_ID || '@Gncarestore').trim();
const dealsPath = join(ROOT, 'public/deals.json');
const postedPath = join(ROOT, 'scripts/telegram-deals-posted.json');
const historyPath = join(ROOT, 'scripts/price-history.json');

if (!existsSync(dealsPath)) {
  if (dry) { console.log('No public/deals.json yet.'); process.exit(0); }
  die('Missing public/deals.json. Run scripts/sync-deals.mjs first.');
}

const deals = JSON.parse(readFileSync(dealsPath, 'utf8'));
let posted = readJson(postedPath, { ids: {}, photos: {}, drops: {}, lastPosted: '' });
const prevHistory = readJson(historyPath, { updatedAt: '', items: {} });
const applied = lib.applyPriceHistory(prevHistory, deals, deals.fetchedAt || nowIST());
const history = applied.history;
const dropPicks = lib.pickPriceDrops(applied.alerts, posted, 5);
const skipIds = Object.create(null);
dropPicks.forEach((it) => { skipIds[it.id] = true; });
const dailyPicks = wantDaily
  ? lib.pickTelegramDeals(deals, posted, todayISO(), 5, { skipIds, photoBackfill: true })
  : [];

if (!dry) writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');

if (!dropPicks.length && !dailyPicks.length) {
  console.log('No new price-drop alerts or daily deals to post.');
  if (!dry) writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');
  process.exit(0);
}

if (dry) {
  if (dropPicks.length) {
    console.log('--- price drop alerts (' + dropPicks.length + ') ---');
    dropPicks.forEach((p) => console.log(lib.dealCaption(p, 'drop'), p.image ? '\n[photo]' : '\n[text fallback: no image]', '\n'));
  }
  if (dailyPicks.length) {
    console.log('--- daily deals (' + dailyPicks.length + ') ---');
    dailyPicks.forEach((p) => console.log(lib.dealCaption(p, 'daily'), p.image && lib.isHttpsImage(p.image) ? '\n[photo]' : '\n[text fallback: no image]', '\n'));
  }
  console.log(lib.footerText());
  console.log('\n(dry-run, not sent)');
  process.exit(0);
}

if (!token || !channel) {
  console.log('Skipping Telegram post: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL. See docs/deals.md.');
  process.exit(0);
}

const base = 'https://api.telegram.org/bot' + token;
async function api(method, body) {
  const res = await fetch(base + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429 || data.error_code === 429) {
    const wait = Number((data.parameters && data.parameters.retry_after) || 30);
    console.error('Telegram rate-limited. Waiting', wait, 'seconds, then retrying once.');
    await new Promise((r) => setTimeout(r, Math.min(120, Math.max(1, wait)) * 1000));
    const res2 = await fetch(base + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data2 = await res2.json().catch(() => ({}));
    return { res: res2, data: data2 };
  }
  return { res, data };
}

async function sendText(text) {
  const { res, data } = await api('sendMessage', { chat_id: channel, text, disable_web_page_preview: true });
  if (!res.ok || !data.ok) throw new Error('sendMessage: ' + (data.description || res.status));
  return data.result && data.result.message_id;
}

async function sendDeal(item, kind) {
  const caption = lib.dealCaption(item, kind);
  const photo = item && item.image && lib.isHttpsImage(item.image) ? item.image : '';
  if (photo) {
    const { res, data } = await api('sendPhoto', { chat_id: channel, photo, caption });
    if (res.ok && data.ok) {
      const id = data.result && data.result.message_id;
      console.log('photo message_id', id, item.id, kind);
      return { message_id: id, photo: true };
    }
    console.error('sendPhoto failed for', item.id, redact(data.description || res.status), '— falling back to text.');
  }
  const id = await sendText(caption);
  console.log('text message_id', id, item.id, kind, photo ? 'photo-fallback' : 'no-image');
  return { message_id: id, photo: false };
}

let postedNow = posted;
const results = [];
try {
  for (const item of dropPicks) {
    results.push(await sendDeal(item, 'drop'));
    await new Promise((r) => setTimeout(r, 400));
  }
  if (dropPicks.length) postedNow = lib.markDrops(postedNow, dropPicks, nowIST());
  for (const item of dailyPicks) {
    results.push(await sendDeal(item, 'daily'));
    await new Promise((r) => setTimeout(r, 400));
  }
  if (dailyPicks.length) postedNow = lib.markPosted(postedNow, dailyPicks, todayISO(), { photos: true });
  if (results.length) {
    const footerId = await sendText(lib.footerText());
    console.log('footer message_id', footerId);
  }
} catch (err) {
  writeFileSync(postedPath, JSON.stringify(postedNow, null, 2) + '\n');
  writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');
  die(err.stack || err.message);
}

writeFileSync(postedPath, JSON.stringify(postedNow, null, 2) + '\n');
writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');
const photos = results.filter((r) => r.photo).length;
console.log('Posted to', channel, 'drops', dropPicks.length, 'daily', dailyPicks.length, 'photos', photos, 'text_fallback', results.length - photos);
