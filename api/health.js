'use strict';
/* GET /api/health  Shows what is switched on. Returns yes/no values and provider names only, never keys or URLs. */
const L = require('./_lib');
const ai = require('./ai');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return L.send(res, 405, { ok: false, code: 'method', msg: 'Method not allowed.' }); }
  const c = ai.cfg();
  const e = process.env;
  res.setHeader('Cache-Control', 'no-store');
  return L.send(res, 200, {
    ok: true,
    ai: { ready: c.providers.length > 0, providers: c.providers },
    feedback: !!(e.FEEDBACK_WEBHOOK_URL || (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN)),
    redis: !!(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN)
  });
};
