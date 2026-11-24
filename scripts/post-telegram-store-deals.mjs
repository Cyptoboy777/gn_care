#!/usr/bin/env node
/**
 * Post the top Flipkart store deals (from public/deals.json) to the Telegram channel.
 * Skips items posted in the last 7 days. Does not invent prices.
 *
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHANNEL=@Gncarestore node scripts/post-telegram-store-deals.mjs
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

function die(msg, code = 1) { console.error(msg); process.exit(code); }

function todayISO() {
  const z = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(z).toISOString().slice(0, 10);
}

function redact(s) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  s = String(s || '');
  if (token) s = s.split(token).join('[redacted]');
  return s.replace(/bot[0-9]{6,}:[A-Za-z0-9_-]+/g, 'bot[redacted]').slice(0, 400);
}

const dry = process.argv.includes('--dry-run');
const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const channel = (process.env.TELEGRAM_CHANNEL || process.env.TELEGRAM_CHAT_ID || '@Gncarestore').trim();
const dealsPath = join(ROOT, 'public/deals.json');
const postedPath = join(ROOT, 'scripts/telegram-deals-posted.json');

if (!existsSync(dealsPath)) {
  if (dry) { console.log('No public/deals.json yet.'); process.exit(0); }
  die('Missing public/deals.json. Run scripts/sync-deals.mjs first.');
}

const deals = JSON.parse(readFileSync(dealsPath, 'utf8'));
let posted = { ids: {}, lastPosted: '' };
if (existsSync(postedPath)) {
  try { posted = JSON.parse(readFileSync(postedPath, 'utf8')); } catch { posted = { ids: {}, lastPosted: '' }; }
}

const today = todayISO();
const picks = lib.pickTelegramDeals(deals, posted, today, 5);

function buildMessage(items) {
  const checked = (deals.fetchedAt || today).slice(0, 10);
  const lines = [];
  lines.push('GN Care — today\'s Flipkart deals (' + checked + ')');
  lines.push('Live Flipkart listings. Prices as of ' + checked + '. Verify at checkout.');
  lines.push('');
  for (const p of items) {
    const title = [p.brand, p.title].filter(Boolean).join(' — ').slice(0, 140);
    lines.push('• ' + title);
    let price = lib.formatInr(p.price);
    if (p.mrp != null) price += ' (MRP ' + lib.formatInr(p.mrp) + ')';
    if (p.discount != null) price += ' · ' + p.discount + '% off';
    lines.push('  ' + price);
    lines.push('  ' + p.url);
    lines.push('');
  }
  const site = 'https://gncare.xyz/#deals';
  lines.push('Shop all deals: ' + site);
  lines.push(lib.MYNTRA.under399.label + ': ' + lib.MYNTRA.under399.url);
  lines.push('As an Amazon Associate, Flipkart affiliate, and via EarnKaro, GN Care may earn from qualifying purchases.');
  return lines.join('\n');
}

if (!picks.length) {
  console.log('No new Flipkart deals to post (all recent high-discount items were already sent, or none have a real discount).');
  process.exit(0);
}

const text = buildMessage(picks);
if (dry) {
  console.log(text);
  console.log('\n(dry-run, not sent; would post', picks.length, 'items)');
  process.exit(0);
}

if (!token || !channel) {
  console.log('Skipping Telegram post: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL. See docs/deals.md.');
  process.exit(0);
}

const api = 'https://api.telegram.org/bot' + token + '/sendMessage';
async function send() {
  const res = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: channel, text, disable_web_page_preview: true })
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

let { res, data } = await send();
if (res.status === 429 || data.error_code === 429) {
  const wait = Number((data.parameters && data.parameters.retry_after) || 30);
  console.error('Telegram rate-limited. Waiting', wait, 'seconds, then posting once more.');
  await new Promise((r) => setTimeout(r, Math.min(120, Math.max(1, wait)) * 1000));
  ({ res, data } = await send());
}
if (!res.ok || !data.ok) die('Telegram API error: ' + redact(data.description || res.status));

const next = lib.markPosted(posted, picks, today);
writeFileSync(postedPath, JSON.stringify(next, null, 2) + '\n');
console.log('Posted to', channel, 'message_id', data.result && data.result.message_id, 'items', picks.length);
