/*
  Lets the same handlers in api/ run on Cloudflare Pages Functions.
  It turns a Cloudflare Request into the small req/res shape the handlers expect.
  Cloudflare supplies the visitor IP and country in its own headers, so they are mapped here,
  and any client-sent copies of the mapped headers are discarded so they cannot be faked.
*/
export async function run(handler, ctx) {
  const request = ctx.request;
  const url = new URL(request.url);

  /* Cloudflare gives variables per request. The handlers read process.env. */
  if (typeof process !== 'undefined' && process.env) {
    for (const k of Object.keys(ctx.env || {})) {
      if (typeof ctx.env[k] === 'string') process.env[k] = ctx.env[k];
    }
  }

  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  delete headers['x-forwarded-for'];
  delete headers['x-vercel-ip-country'];
  const ip = request.headers.get('cf-connecting-ip');
  const country = request.headers.get('cf-ipcountry');
  if (ip) headers['x-forwarded-for'] = ip;
  if (country) headers['x-vercel-ip-country'] = country;
  headers.host = url.host;

  const body = request.method === 'POST' ? await request.text() : '';
  const req = { method: request.method, headers, body, socket: { remoteAddress: '' } };

  return new Promise((resolve) => {
    const out = new Headers();
    const res = {
      statusCode: 200,
      setHeader(k, v) { out.set(k, v); },
      end(text) { resolve(new Response(text, { status: this.statusCode, headers: out })); }
    };
    Promise.resolve(handler(req, res)).catch(() => {
      resolve(new Response(JSON.stringify({ ok: false, code: 'error', msg: 'Something went wrong. Please try again.' }), {
        status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      }));
    });
  });
}
