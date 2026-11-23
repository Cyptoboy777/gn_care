'use strict';
/* Shared helpers for the serverless functions. Files starting with "_" are not exposed as routes. */
const crypto = require('crypto');

/* Environment is read on every call, because some hosts (Cloudflare) provide it per request. */
const env = () => (typeof process !== 'undefined' && process.env) || {};
const redisUrl = () => env().UPSTASH_REDIS_REST_URL || '';
const redisToken = () => env().UPSTASH_REDIS_REST_TOKEN || '';
const salt = () => env().RATE_SALT || 'gn-care';
const mem = new Map();

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/* One-way hash of the visitor's IP. The raw IP is never stored. */
function clientId(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xff || (req.socket && req.socket.remoteAddress) || 'unknown';
  return hash(salt() + '|' + ip).slice(0, 20);
}

function country(req) {
  return String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

/* Browsers always send Origin on a POST. Only accept our own site (or ALLOWED_ORIGINS). */
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return false;
  try {
    const host = new URL(o).host;
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    return host === req.headers.host || allowed.includes(o) || allowed.includes(host);
  } catch (e) {
    return false;
  }
}

function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch (e) { return null; }
  }
  if (!b || typeof b !== 'object') return null;
  if (JSON.stringify(b).length > 6000) return null;
  return b;
}

const clean = (s, max) =>
  String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const ptDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

/* ---- storage: Upstash Redis when configured, otherwise best-effort memory of this instance ---- */
const useRedis = () => !!(redisUrl() && redisToken());

async function redis(cmds) {
  const r = await fetch(redisUrl().replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + redisToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const j = await r.json();
  if (j.some((x) => x && x.error)) throw new Error('redis command failed');
  return j.map((x) => x.result);
}

function memIncr(key, ttl) {
  const now = Date.now();
  const e = mem.get(key);
  if (e && e.x > now) { e.v += 1; return e.v; }
  if (mem.size > 5000) mem.clear();
  mem.set(key, { v: 1, x: now + ttl * 1000 });
  return 1;
}

async function incr(key, ttl) {
  if (useRedis()) {
    try {
      const r = await redis([['INCR', key], ['EXPIRE', key, ttl, 'NX']]);
      return Number(r[0]);
    } catch (e) { /* fall back to memory */ }
  }
  return memIncr(key, ttl);
}

async function cacheGet(key) {
  if (useRedis()) {
    try { const r = await redis([['GET', key]]); return r[0] ? JSON.parse(r[0]) : null; } catch (e) { /* fall through */ }
  }
  const e = mem.get('c:' + key);
  return e && e.x > Date.now() ? e.v : null;
}

async function cacheSet(key, val, ttl) {
  if (useRedis()) {
    try { await redis([['SET', key, JSON.stringify(val), 'EX', ttl]]); return; } catch (e) { /* fall through */ }
  }
  if (mem.size > 5000) mem.clear();
  mem.set('c:' + key, { v: val, x: Date.now() + ttl * 1000 });
}

async function listPush(key, val, max) {
  if (!useRedis()) return false;
  try {
    await redis([['LPUSH', key, JSON.stringify(val)], ['LTRIM', key, 0, max - 1]]);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { hash, clientId, country, send, sameOrigin, parseBody, clean, ptDate, incr, cacheGet, cacheSet, listPush };
