#!/usr/bin/env node
/**
 * Offline, Free-tier copy for catalog products.
 * Uses gemini-3.5-flash-lite with NO tools (no Google Search grounding).
 * Never called from the PWA or /api. Do not enable billing for this script.
 *
 *   GEMINI_API_KEY=... node scripts/gen-content.mjs
 *   GEMINI_API_KEY=... node scripts/gen-content.mjs --limit 5
 *   GEMINI_API_KEY=... node scripts/gen-content.mjs   # resumes; skips products that already have copy
 *   GEMINI_API_KEY=... node scripts/gen-content.mjs --force
 *
 * Writes whyThis, avoid, howToUse (and short Hinglish/Tenglish variants) into public/catalog.json
 * after each successful product, with copyGeneratedBy + copyGeneratedOn.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(join(ROOT, '.env'));

const MODEL = 'gemini-3.5-flash-lite';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const BANNED = /\b(cure[sd]?|cures|diagnos(?:e|is|es)|prescription|guaranteed|miracle|100\s*%|permanently|eliminates? acne|treats? (?:eczema|psoriasis|disease)|clinical(?:ly)? proven|doctor[- ]approved)\b|₹\s*\d|rs\.?\s*\d|inr\s*\d|coupon|% off|mrp\b/i;

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

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

const key = (process.env.GEMINI_API_KEY || '').trim();
if (!key) {
  die('Missing GEMINI_API_KEY. Create a Free-tier key at https://aistudio.google.com/apikey (no card required) and run:\n  GEMINI_API_KEY=your_key node scripts/gen-content.mjs');
}

const askedModel = (arg('--model', process.env.GEMINI_CONTENT_MODEL || MODEL) || MODEL).trim();
if (askedModel !== MODEL) {
  die(`Refusing model "${askedModel}". This script only uses ${MODEL} with no tools, which we confirmed works on the Gemini API Free tier without Search grounding or billing.`);
}

const limit = Math.max(1, Math.min(80, Number(arg('--limit', 80)) || 80));
const sleepMs = Math.max(800, Number(arg('--sleep-ms', 2500)) || 2500);
const force = process.argv.includes('--force');
const dry = process.argv.includes('--dry-run');
const idsArg = arg('--ids', '');

const catalogPath = join(ROOT, 'public/catalog.json');

function loadCatalog() {
  return JSON.parse(readFileSync(catalogPath, 'utf8'));
}

function saveCatalog(catalog) {
  catalog.updated = todayISO();
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
}

function hasCopy(p) {
  return !!(p && p.copyGeneratedOn && p.whyThis && (p.whyThis.general || Object.keys(p.whyThis).length) && p.howToUse);
}

function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

function clip(s, max) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf('. ');
  return (at > 40 ? cut.slice(0, at + 1) : cut).trim();
}

function cleanText(s, max) {
  s = clip(s, max);
  if (!s || BANNED.test(s)) return '';
  return s;
}

function cleanMap(obj, allowedTypes, max) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  const keys = ['general', ...allowedTypes];
  for (const k of keys) {
    const v = cleanText(obj[k], max);
    if (v) out[k] = v;
  }
  return out;
}

function cleanList(arr, maxItems, maxLen) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    const v = cleanText(item, maxLen);
    if (v) out.push(v);
    if (out.length >= maxItems) break;
  }
  return out;
}

function knownBits(p) {
  const actives = Array.isArray(p.actives) ? p.actives : [];
  return {
    id: p.id,
    cat: p.cat,
    brand: p.brand,
    name: p.name,
    size: p.size || '',
    skin: Array.isArray(p.skin) ? p.skin : [],
    sensitiveFriendly: !!p.sens,
    knownIngredients: actives,
    packNote: p.note || '',
    spf: p.spf || '',
  };
}

function promptFor(p) {
  const info = knownBits(p);
  const skins = info.skin.length ? info.skin.join(', ') : 'not specified (write a general whyThis only)';
  return `You write short, honest product blurbs for GN Care, a skincare PWA in India.

Use ONLY these facts. If an ingredient is not listed, do not invent one.
${JSON.stringify(info, null, 2)}

Rules:
- No medical claims. Do not say a product cures, treats a disease, diagnoses, or is clinically proven or guaranteed.
- No prices, discounts, MRP, coupons, or shop offers.
- Do not invent effects that do not follow from the product name, category, listed ingredients, or pack note.
- If ingredients are unknown, say that plainly and keep advice generic for that category (cleanser, moisturizer, sunscreen, serum, intimate wash, beard oil).
- "Why this suits you" must be 1-2 short sentences per relevant skin type (${skins}). Skip skin types it is not listed for. You may also write a "general" line.
- "What to avoid": 1-3 short, practical cautions (patch test, do not stack too many acids, intimate wash is for external use only, sunscreen every morning, etc.) based only on the known facts.
- "How to use": 1-2 short sentences. For sunscreen, say to apply as the pack directs and reapply outdoors. For intimate wash, say external use only.
- Also write short Hinglish (Hindi-English mix) and Tenglish (Telugu-English mix) variants: a general why line, how-to-use, and up to 2 avoid lines. Same honesty rules. Keep them plain and easy.
- Return ONLY JSON with this shape:
{
  "whyThis": { "general": "", "Oily": "", "Dry": "", "Combination": "", "Normal": "" },
  "avoid": ["", ""],
  "howToUse": "",
  "whyThisHi": { "general": "" },
  "avoidHi": [""],
  "howToUseHi": "",
  "whyThisTe": { "general": "" },
  "avoidTe": [""],
  "howToUseTe": ""
}
Omit a key rather than filling it with a guess.`;
}

async function generate(p) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: promptFor(p) }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
  };
  // No tools. Search grounding is not used (not available / can bill on Gemini 3.x).
  const res = await fetch(`${API}/${encodeURIComponent(MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) {
    const msg = (data.error && data.error.message) || text.slice(0, 300);
    const err = new Error(`Gemini HTTP ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  const parts = ((((data.candidates || [])[0] || {}).content || {}).parts || []).map((x) => x.text || '').join('');
  const parsed = extractJson(parts);
  if (!parsed) {
    const err = new Error('No parseable JSON in model response');
    err.status = 200;
    err.retryable = true;
    throw err;
  }
  return parsed;
}

function toFields(p, raw) {
  const types = Array.isArray(p.skin) ? p.skin : [];
  const whyThis = cleanMap(raw.whyThis, types, 280);
  const howToUse = cleanText(raw.howToUse, 280);
  const avoid = cleanList(raw.avoid, 3, 180);
  if (!howToUse || (!whyThis.general && !types.some((t) => whyThis[t]))) return null;
  const out = {
    whyThis,
    avoid,
    howToUse,
    whyThisHi: cleanMap(raw.whyThisHi, types, 220),
    avoidHi: cleanList(raw.avoidHi, 2, 160),
    howToUseHi: cleanText(raw.howToUseHi, 220),
    whyThisTe: cleanMap(raw.whyThisTe, types, 220),
    avoidTe: cleanList(raw.avoidTe, 2, 160),
    howToUseTe: cleanText(raw.howToUseTe, 220),
    copyGeneratedBy: MODEL,
    copyGeneratedOn: todayISO(),
  };
  // Drop empty variant objects so the catalog stays small.
  for (const k of ['whyThisHi', 'whyThisTe']) if (!Object.keys(out[k]).length) delete out[k];
  for (const k of ['avoidHi', 'avoidTe']) if (!out[k].length) delete out[k];
  if (!out.howToUseHi) delete out.howToUseHi;
  if (!out.howToUseTe) delete out.howToUseTe;
  if (!out.avoid.length) delete out.avoid;
  return out;
}

function applyFields(p, fields) {
  const keys = ['whyThis', 'avoid', 'howToUse', 'whyThisHi', 'avoidHi', 'howToUseHi', 'whyThisTe', 'avoidTe', 'howToUseTe', 'copyGeneratedBy', 'copyGeneratedOn'];
  for (const k of keys) {
    if (fields[k] != null) p[k] = fields[k];
    else delete p[k];
  }
}

async function main() {
  const catalog = loadCatalog();
  let products = catalog.products || [];
  if (idsArg && idsArg !== true) {
    const want = new Set(String(idsArg).split(',').map((s) => s.trim()).filter(Boolean));
    products = products.filter((p) => want.has(p.id));
  }
  const pending = products.filter((p) => force || !hasCopy(p)).slice(0, limit);
  const skipped = products.length - pending.length;
  console.log(`gen-content using ${MODEL} (no tools, Free tier). Pending ${pending.length}, already have copy ${skipped}. Sleep ${sleepMs}ms.`);
  if (dry) {
    pending.forEach((p) => console.log(' would generate', p.id, p.brand, p.name));
    return;
  }

  let ok = 0;
  let failed = 0;
  let calls = 0;
  const log = { startedOn: todayISO(), model: MODEL, tools: false, calls: 0, ok: 0, failed: 0, stopped: null, items: [] };

  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    process.stdout.write(`[${i + 1}/${pending.length}] ${p.id} ${p.brand} … `);
    try {
      let raw;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          calls++;
          raw = await generate(p);
          break;
        } catch (err) {
          const transient = err.status === 503 || err.retryable;
          if (!transient || attempt === 2) throw err;
          console.log('transient', err.status || err.message, '— retrying once after 8s …');
          await new Promise((r) => setTimeout(r, 8000));
        }
      }
      const fields = toFields(p, raw);
      if (!fields) {
        failed++;
        console.log('rejected (empty or failed honesty checks)');
        log.items.push({ id: p.id, status: 'rejected' });
      } else {
        // Re-load so we never clobber other edits; then save immediately for resume.
        const live = loadCatalog();
        const target = (live.products || []).find((x) => x.id === p.id);
        if (target) {
          applyFields(target, fields);
          saveCatalog(live);
        }
        ok++;
        console.log('ok');
        log.items.push({ id: p.id, status: 'ok' });
      }
    } catch (err) {
      failed++;
      console.log('ERROR', err.message);
      log.items.push({ id: p.id, status: 'error', message: err.message });
      if (err.status === 429) {
        log.stopped = '429';
        console.error('Hit a rate limit (429). Stopping. Progress is saved; re-run the same command later (it resumes). RPD resets at midnight Pacific Time.');
        break;
      }
      if (err.status === 401 || err.status === 403 || err.status === 404 || err.status === 400) {
        log.stopped = String(err.status);
        console.error('Stopping: API rejected the request. Not switching models or adding billed tools.');
        break;
      }
    }
    if (i < pending.length - 1) await new Promise((r) => setTimeout(r, sleepMs));
  }

  log.calls = calls;
  log.ok = ok;
  log.failed = failed;
  log.finishedOn = todayISO();
  const outDir = join(ROOT, 'scripts/out');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'gen-content-log.json'), JSON.stringify(log, null, 2));
  console.log(`Done. Generated ${ok}, failed ${failed}, API calls ${calls}. Log: scripts/out/gen-content-log.json`);
}

main().catch((e) => die(e.stack || e.message));
