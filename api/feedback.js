'use strict';
/*
  POST /api/feedback  { stars: 1-5, kind: 'app'|'ai'|'bug'|'idea', msg?: string, site?: '' (honeypot), v?: string }
  Forwards the rating to a Google Sheet through an Apps Script web app (FEEDBACK_WEBHOOK_URL).
  If no webhook is set but Upstash Redis is, it keeps the last 1000 entries in a Redis list.
*/
const L = require('./_lib');

const KINDS = new Set(['app', 'ai', 'bug', 'idea']);
const MSG = {
  invalid: 'Please choose a star rating first.',
  limit: 'You have sent a lot of feedback today. Thank you. Please try again tomorrow.',
  send: 'We could not send your feedback. Please try again later.',
  off: 'Feedback is not switched on yet.'
};
const fail = (res, status, code) => L.send(res, status, { ok: false, code, msg: MSG[code] });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return L.send(res, 405, { ok: false, code: 'method', msg: 'Method not allowed.' }); }
  if (!L.sameOrigin(req)) return L.send(res, 403, { ok: false, code: 'origin', msg: 'Request not allowed.' });

  const b = L.parseBody(req);
  if (!b) return fail(res, 400, 'invalid');
  if (b.site) return L.send(res, 200, { ok: true }); /* honeypot: bots fill hidden fields */

  const stars = Number(b.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return fail(res, 400, 'invalid');
  const kind = KINDS.has(b.kind) ? b.kind : 'app';
  const msg = L.clean(b.msg, 500);
  const v = L.clean(b.v, 12);

  const id = L.clientId(req);
  if ((await L.incr('gn:fb:' + id + ':' + L.ptDate(), 90000)) > 6) return fail(res, 429, 'limit');

  const entry = { ts: new Date().toISOString(), stars, kind, msg, v };
  const url = process.env.FEEDBACK_WEBHOOK_URL;

  if (url) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ secret: process.env.FEEDBACK_SECRET || '' }, entry))
      });
      if (r.ok) return L.send(res, 200, { ok: true });
    } catch (e) { /* handled below */ }
    return fail(res, 502, 'send');
  }

  if (await L.listPush('gn:feedback', entry, 1000)) return L.send(res, 200, { ok: true });
  return fail(res, 503, 'off');
};
