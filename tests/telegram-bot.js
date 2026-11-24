'use strict';
/* Run with: node tests/telegram-bot.js  (no network; Telegram API is mocked) */
const assert = require('assert');
const path = require('path');
const crypto = require('crypto');

const TEST_TOKEN = 'TEST_BOT_TOKEN_DO_NOT_USE';
const STORE_ID = -1004323596440;
const BOT_ID = 9119580602;
const ADMIN_ID = 7250968528;
const USER_ID = 111000222;
const LINKED_ID = -100111222333;

function secretFromToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function fresh(env) {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_CHANNEL;
  Object.assign(process.env, env || {});
  const rel = path.join(__dirname, '../api/telegram.js');
  delete require.cache[require.resolve(rel)];
  return require(rel);
}

function call(handler, opts) {
  opts = opts || {};
  const req = {
    method: opts.method || 'POST',
    headers: Object.assign({}, opts.headers || {}),
    body: opts.body
  };
  return new Promise((resolve) => {
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(s) { resolve({ status: this.statusCode, json: JSON.parse(s || '{}') }); }
    };
    Promise.resolve(handler(req, res)).catch((e) => resolve({ status: 500, error: e.message }));
  });
}

function methodOf(url) {
  const s = String(url);
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

let fetchCalls = [];
function mockFetch(handler) {
  fetchCalls = [];
  global.fetch = async (url, init) => {
    const body = init && init.body ? JSON.parse(init.body) : {};
    const method = methodOf(url);
    assert.ok(!String(url).includes(TEST_TOKEN) === false || String(url).includes('api.telegram.org'));
    /* record method + body only; never keep the raw URL (it contains the token) */
    fetchCalls.push({ method, body });
    if (handler) return handler(method, body);
    return jsonOk(defaultResult(method, body));
  };
}

function jsonOk(result) {
  return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
}

function defaultResult(method, body) {
  if (method === 'getChat') {
    return { id: STORE_ID, title: 'Gn Care Products store', username: 'Gncarestore', type: 'supergroup', linked_chat_id: undefined };
  }
  if (method === 'getChatAdministrators') {
    return [
      { user: { id: BOT_ID, is_bot: true, first_name: 'GncareAi', username: 'GnCare_bot' }, status: 'administrator' },
      { user: { id: ADMIN_ID, is_bot: false, first_name: 'Narendra', username: 'Narendra43217' }, status: 'creator' }
    ];
  }
  return true;
}

const secret = secretFromToken(TEST_TOKEN);

function hdrs(extra) {
  return Object.assign({ 'x-telegram-bot-api-secret-token': secret }, extra || {});
}

function load() {
  const handler = fresh({ TELEGRAM_BOT_TOKEN: TEST_TOKEN, TELEGRAM_CHANNEL: '@Gncarestore' });
  handler.helpers.resetStrikes();
  handler.helpers.clearAdminCache();
  handler.helpers.setStoreMeta({ id: STORE_ID, username: 'Gncarestore', linkedId: null });
  mockFetch();
  return handler;
}

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

(async () => {
  console.log('api/telegram');

  await t('derives webhook secret from SHA-256 of the bot token', async () => {
    const h = fresh({ TELEGRAM_BOT_TOKEN: TEST_TOKEN });
    assert.strictEqual(h.helpers.webhookSecret(), secret);
    assert.strictEqual(secret.length, 64);
  });

  await t('TELEGRAM_WEBHOOK_SECRET overrides the derived hash', async () => {
    const h = fresh({ TELEGRAM_BOT_TOKEN: TEST_TOKEN, TELEGRAM_WEBHOOK_SECRET: 'plain_override_secret-1' });
    assert.strictEqual(h.helpers.webhookSecret(), 'plain_override_secret-1');
  });

  await t('rejects GET and a missing or wrong secret', async () => {
    const h = load();
    const get = await call(h, { method: 'GET', headers: hdrs(), body: {} });
    assert.strictEqual(get.status, 405);
    const missing = await call(h, { body: { update_id: 1 } });
    assert.strictEqual(missing.status, 401);
    const wrong = await call(h, { headers: { 'x-telegram-bot-api-secret-token': 'nope' }, body: { update_id: 1 } });
    assert.strictEqual(wrong.status, 401);
  });

  await t('accepts a valid secret and empty-ish update with 200', async () => {
    const h = load();
    const r = await call(h, { headers: hdrs(), body: { update_id: 9 } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.ok, true);
  });

  const H0 = fresh({ TELEGRAM_BOT_TOKEN: TEST_TOKEN });
  const { isScamProfile, shouldDelete, parsePollArgs, commandFrom, hasLinks, hasInviteLink, mentionedNonAdmins, isChannelForward } = H0.helpers;

  await t('flags scam join profiles: links, @handles, keywords', async () => {
    assert.strictEqual(isScamProfile({ first_name: 'Ravi', last_name: 'Kumar' }, ''), false);
    assert.strictEqual(isScamProfile({ first_name: 'Daily crypto tips' }, ''), true);
    assert.strictEqual(isScamProfile({ first_name: 'Maya' }, 'Forex signals daily'), true);
    assert.strictEqual(isScamProfile({ first_name: 'Sam' }, 'Admin support please dm'), true);
    assert.strictEqual(isScamProfile({ first_name: 'Join http://spam.example' }, ''), true);
    assert.strictEqual(isScamProfile({ first_name: 'Ann' }, 'ping me @bossman now'), true);
    assert.strictEqual(isScamProfile({ first_name: 'Lee', username: 'earn_with_lee' }, ''), true);
    assert.strictEqual(isScamProfile({ first_name: 'Priya', username: 'priya_skin' }, 'dry skin help'), false);
  });

  await t('parses /poll and /quiz args, including @bot suffix and * correct option', async () => {
    const poll = parsePollArgs('Favourite cleanser? | CeraVe | Cetaphil | Bioderma', false);
    assert.strictEqual(poll.question, 'Favourite cleanser?');
    assert.deepStrictEqual(poll.options, ['CeraVe', 'Cetaphil', 'Bioderma']);
    const bad = parsePollArgs('Only one option | CeraVe', false);
    assert.ok(bad.error);
    const quiz = parsePollArgs('Which is SPF? | Moisturizer | *SPF 50 | Toner', true);
    assert.strictEqual(quiz.correctOptionId, 1);
    assert.deepStrictEqual(quiz.options, ['Moisturizer', 'SPF 50', 'Toner']);
    const unmarked = parsePollArgs('Which? | A | B', true);
    assert.ok(unmarked.error && /Mark the correct/i.test(unmarked.error));
    const cmd = commandFrom({ text: '/poll@GnCare_bot Skin type? | Dry | Oily', entities: [{ type: 'bot_command', offset: 0, length: 16 }] });
    assert.strictEqual(cmd.name, 'poll');
    assert.strictEqual(cmd.rest, 'Skin type? | Dry | Oily');
  });

  const admins = new Set([ADMIN_ID, BOT_ID]);
  const adminNames = new Set(['narendra43217', 'gncare_bot']);

  await t('deletes non-admin links, invites, @non-admins, channel forwards, scam words', async () => {
    const from = { id: USER_ID, is_bot: false, first_name: 'User' };
    const chat = { id: STORE_ID, type: 'supergroup' };
    assert.strictEqual(shouldDelete({ chat, from, text: 'Love this serum' }, admins, adminNames), false);
    assert.strictEqual(shouldDelete({ chat, from, text: 'Buy here https://scam.example/x', entities: [{ type: 'url', offset: 9, length: 22 }] }, admins, adminNames), true);
    assert.strictEqual(hasLinks({ text: 'see t.me/something' }), true);
    assert.strictEqual(hasInviteLink({ text: 'join t.me/+AbCdEfGhIj' }), true);
    assert.strictEqual(shouldDelete({ chat, from, text: 'join t.me/+AbCdEfGhIj' }, admins, adminNames), true);
    assert.strictEqual(mentionedNonAdmins({ text: 'hi @spammer', entities: [{ type: 'mention', offset: 3, length: 8 }] }, admins, adminNames), true);
    assert.strictEqual(mentionedNonAdmins({ text: 'hi @Narendra43217', entities: [{ type: 'mention', offset: 3, length: 14 }] }, admins, adminNames), false);
    assert.strictEqual(isChannelForward({ forward_origin: { type: 'channel', chat: { id: -1, type: 'channel' }, date: 1, message_id: 2 }, text: 'deal' }), true);
    assert.strictEqual(isChannelForward({ forward_from_chat: { type: 'channel', id: -1 }, text: 'deal' }), true);
    assert.strictEqual(shouldDelete({ chat, from, text: 'Easy forex investment plan' }, admins, adminNames), true);
    assert.strictEqual(shouldDelete({
      chat, from, text: 'shop', reply_markup: { inline_keyboard: [[{ text: 'Open', url: 'https://evil.example' }]] }
    }, admins, adminNames), true);
  });

  await t('never flags admin messages as spam', async () => {
    const from = { id: ADMIN_ID, is_bot: false, first_name: 'Narendra', username: 'Narendra43217' };
    const msg = { chat: { id: STORE_ID }, from, text: 'Deal https://www.flipkart.com/x', entities: [{ type: 'url', offset: 5, length: 26 }] };
    assert.strictEqual(shouldDelete(msg, admins, adminNames), false);
  });

  await t('approves a normal join request and declines a scam profile', async () => {
    const h = load();
    const ok = await call(h, {
      headers: hdrs(),
      body: {
        update_id: 1,
        chat_join_request: {
          chat: { id: STORE_ID, type: 'supergroup', username: 'Gncarestore' },
          from: { id: USER_ID, is_bot: false, first_name: 'Asha' },
          user_chat_id: USER_ID,
          date: 1,
          bio: 'skincare lover'
        }
      }
    });
    assert.strictEqual(ok.status, 200);
    assert.deepStrictEqual(fetchCalls.map((c) => c.method), ['approveChatJoinRequest']);
    assert.strictEqual(fetchCalls[0].body.user_id, USER_ID);

    fetchCalls = [];
    mockFetch();
    const bad = await call(h, {
      headers: hdrs(),
      body: {
        update_id: 2,
        chat_join_request: {
          chat: { id: STORE_ID, type: 'supergroup', username: 'Gncarestore' },
          from: { id: 99, is_bot: false, first_name: 'Crypto King' },
          user_chat_id: 99,
          date: 1,
          bio: 'forex investment earn now t.me/spam'
        }
      }
    });
    assert.strictEqual(bad.status, 200);
    assert.deepStrictEqual(fetchCalls.map((c) => c.method), ['declineChatJoinRequest']);
    assert.strictEqual(fetchCalls[0].body.user_id, 99);
  });

  await t('ignores join requests for some other chat', async () => {
    const h = load();
    const r = await call(h, {
      headers: hdrs(),
      body: {
        update_id: 3,
        chat_join_request: {
          chat: { id: -1009, type: 'supergroup', username: 'unrelated' },
          from: { id: USER_ID, first_name: 'Asha' },
          user_chat_id: USER_ID,
          date: 1
        }
      }
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(fetchCalls.length, 0);
  });

  await t('deletes a first spam message and bans on the second strike', async () => {
    const h = load();
    const spam = (mid) => ({
      message_id: mid,
      chat: { id: STORE_ID, type: 'supergroup', username: 'Gncarestore' },
      from: { id: USER_ID, is_bot: false, first_name: 'Spammer' },
      text: 'Free crypto earn here https://spam.example',
      entities: [{ type: 'url', offset: 21, length: 21 }]
    });
    const first = await call(h, { headers: hdrs(), body: { update_id: 10, message: spam(51) } });
    assert.strictEqual(first.status, 200);
    const methods1 = fetchCalls.map((c) => c.method);
    assert.ok(methods1.includes('getChatAdministrators'));
    assert.ok(methods1.includes('deleteMessage'));
    assert.ok(!methods1.includes('banChatMember'));
    assert.strictEqual(h.helpers.strikeCount(USER_ID), 1);

    fetchCalls = [];
    mockFetch();
    const second = await call(h, { headers: hdrs(), body: { update_id: 11, message: spam(52) } });
    assert.strictEqual(second.status, 200);
    const methods2 = fetchCalls.map((c) => c.method);
    assert.ok(methods2.includes('deleteMessage'));
    assert.ok(methods2.includes('banChatMember'));
    const ban = fetchCalls.find((c) => c.method === 'banChatMember');
    assert.strictEqual(ban.body.user_id, USER_ID);
    assert.strictEqual(ban.body.revoke_messages, true);
  });

  await t('admin /poll posts to the store and non-admins cannot', async () => {
    const h = load();
    const r = await call(h, {
      headers: hdrs(),
      body: {
        update_id: 20,
        message: {
          message_id: 70,
          chat: { id: ADMIN_ID, type: 'private' },
          from: { id: ADMIN_ID, is_bot: false, username: 'Narendra43217' },
          text: '/poll Favourite cleanser? | CeraVe | Cetaphil',
          entities: [{ type: 'bot_command', offset: 0, length: 5 }]
        }
      }
    });
    assert.strictEqual(r.status, 200);
    const poll = fetchCalls.find((c) => c.method === 'sendPoll');
    assert.ok(poll);
    assert.strictEqual(poll.body.chat_id, STORE_ID);
    assert.strictEqual(poll.body.question, 'Favourite cleanser?');
    assert.deepStrictEqual(poll.body.options.map((o) => o.text), ['CeraVe', 'Cetaphil']);
    assert.ok(!('type' in poll.body) || poll.body.type !== 'quiz');
    const thanks = fetchCalls.find((c) => c.method === 'sendMessage');
    assert.ok(thanks && /posted to @Gncarestore/i.test(thanks.body.text));

    fetchCalls = [];
    mockFetch();
    const nope = await call(h, {
      headers: hdrs(),
      body: {
        update_id: 21,
        message: {
          message_id: 71,
          chat: { id: USER_ID, type: 'private' },
          from: { id: USER_ID, is_bot: false, first_name: 'User' },
          text: '/poll Hack? | A | B',
          entities: [{ type: 'bot_command', offset: 0, length: 5 }]
        }
      }
    });
    assert.strictEqual(nope.status, 200);
    assert.ok(!fetchCalls.some((c) => c.method === 'sendPoll'));
  });

  await t('admin /quiz posts a quiz with the starred option as correct', async () => {
    const h = load();
    const r = await call(h, {
      headers: hdrs(),
      body: {
        update_id: 22,
        message: {
          message_id: 80,
          chat: { id: STORE_ID, type: 'supergroup', username: 'Gncarestore' },
          from: { id: ADMIN_ID, is_bot: false, username: 'Narendra43217' },
          text: '/quiz Which is sunscreen? | Moisturizer | *SPF 50 | Toner',
          entities: [{ type: 'bot_command', offset: 0, length: 5 }]
        }
      }
    });
    assert.strictEqual(r.status, 200);
    const poll = fetchCalls.find((c) => c.method === 'sendPoll');
    assert.ok(poll);
    assert.strictEqual(poll.body.type, 'quiz');
    assert.strictEqual(poll.body.correct_option_id, 1);
    assert.deepStrictEqual(poll.body.options.map((o) => o.text), ['Moisturizer', 'SPF 50', 'Toner']);
  });

  await t('admin /lock and /unlock set default member permissions', async () => {
    const h = load();
    h.helpers.setStoreMeta({ id: STORE_ID, username: 'Gncarestore', linkedId: LINKED_ID });
    const r = await call(h, {
      headers: hdrs(),
      body: {
        update_id: 30,
        message: {
          message_id: 90,
          chat: { id: STORE_ID, type: 'supergroup' },
          from: { id: ADMIN_ID, is_bot: false, username: 'Narendra43217' },
          text: '/lock',
          entities: [{ type: 'bot_command', offset: 0, length: 5 }]
        }
      }
    });
    assert.strictEqual(r.status, 200);
    const locks = fetchCalls.filter((c) => c.method === 'setChatPermissions');
    assert.strictEqual(locks.length, 2);
    assert.deepStrictEqual(locks.map((c) => c.body.chat_id).sort(), [LINKED_ID, STORE_ID].sort());
    assert.strictEqual(locks[0].body.permissions.can_send_messages, false);
    assert.ok(fetchCalls.some((c) => c.method === 'sendMessage' && /read-only/i.test(c.body.text)));

    fetchCalls = [];
    mockFetch();
    const u = await call(h, {
      headers: hdrs(),
      body: {
        update_id: 31,
        message: {
          message_id: 91,
          chat: { id: STORE_ID, type: 'supergroup' },
          from: { id: ADMIN_ID, is_bot: false, username: 'Narendra43217' },
          text: '/unlock',
          entities: [{ type: 'bot_command', offset: 0, length: 7 }]
        }
      }
    });
    assert.strictEqual(u.status, 200);
    const unlocks = fetchCalls.filter((c) => c.method === 'setChatPermissions');
    assert.strictEqual(unlocks.length, 2);
    assert.strictEqual(unlocks[0].body.permissions.can_send_messages, true);
  });

  await t('does not call getUpdates', async () => {
    const h = load();
    await call(h, { headers: hdrs(), body: { update_id: 40, chat_member: { chat: { id: STORE_ID }, date: 1, old_chat_member: {}, new_chat_member: {} } } });
    assert.ok(!fetchCalls.some((c) => c.method === 'getUpdates'));
    const fs = require('fs');
    const root = path.join(__dirname, '..');
    for (const rel of ['api/telegram.js', 'scripts/post-telegram-deals.mjs', 'scripts/post-telegram-store-deals.mjs']) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      assert.ok(!src.includes('getUpdates'), rel + ' should not poll getUpdates');
    }
  });

  console.log('\n' + passed + ' telegram-bot checks passed' + (process.exitCode ? ', some FAILED' : ''));
})();
