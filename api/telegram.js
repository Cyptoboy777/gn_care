'use strict';
/*
  POST /api/telegram
  Telegram webhook for @GnCare_bot: join-request review, group spam filter,
  /lock /unlock, and admin /poll /quiz posted to @Gncarestore.
  Verified with X-Telegram-Bot-Api-Secret-Token (TELEGRAM_WEBHOOK_SECRET, or a
  SHA-256 of TELEGRAM_BOT_TOKEN). Never log the bot token or API URLs.
*/
const crypto = require('crypto');

const STORE = process.env.TELEGRAM_CHANNEL || '@Gncarestore';
const STRIKE_BAN = 2;
const ADMIN_TTL_MS = 5 * 60 * 1000;
const META_TTL_MS = 10 * 60 * 1000;

const SCAM_RE = /\b(crypto|investment|investments?|investing|forex|airdrop|nft|binary\s*options?)\b|\bearn\b|admin\s*support|customer\s*support|dm\s*me\s*to\s*earn|double\s*your\s*(money|btc|investment)/i;
const URL_RE = /https?:\/\/|t\.me\/|telegram\.me\/|telegram\.dog\/|www\.|wa\.me\/|bit\.ly\/|tinyurl\.com\/|[a-z0-9-]+\.(com|in|net|org|ru|xyz|io|co|cc|me|info)\b/i;
const INVITE_RE = /t\.me\/\+|t\.me\/joinchat\/|telegram\.me\/joinchat\/|telegram\.dog\/joinchat\//i;
const HANDLE_RE = /(?:^|[^a-zA-Z0-9_])@[a-zA-Z]\w{3,}/;

const strikes = new Map();
const adminCache = new Map();
let storeMeta = null;

function webhookSecret() {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (explicit) return String(explicit);
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

function secretsMatch(got, expected) {
  if (!got || !expected) return false;
  const a = Buffer.from(String(got));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function parseUpdate(req) {
  let b = req.body;
  if (b == null) return null;
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') {
    const s = b.trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  }
  if (typeof b === 'object') return b;
  return null;
}

function displayName(user) {
  if (!user) return '';
  return [user.first_name, user.last_name].filter(Boolean).join(' ');
}

function isScamProfile(user, bio) {
  const name = displayName(user);
  const text = [name, bio || user && user.bio || ''].join('\n');
  if (!text.trim()) return false;
  if (URL_RE.test(text) || INVITE_RE.test(text)) return true;
  if (HANDLE_RE.test(text)) return true;
  if (SCAM_RE.test(text)) return true;
  const uname = user && user.username ? String(user.username).replace(/[_-]+/g, ' ') : '';
  if (uname && SCAM_RE.test(uname)) return true;
  return false;
}

function entityText(src, ent) {
  if (!src || !ent) return '';
  return String(src).slice(ent.offset, ent.offset + ent.length);
}

function messageParts(msg) {
  const text = [msg && msg.text, msg && msg.caption].filter(Boolean).join('\n');
  const entities = [].concat(msg && msg.entities || [], msg && msg.caption_entities || []);
  return { text, entities };
}

function hasInviteLink(msg) {
  const { text, entities } = messageParts(msg);
  if (INVITE_RE.test(text)) return true;
  for (const e of entities) {
    const raw = entityText(text, e);
    const url = e.url || raw;
    if (INVITE_RE.test(url) || INVITE_RE.test(raw)) return true;
  }
  return false;
}

function hasLinks(msg) {
  const { text, entities } = messageParts(msg);
  if (URL_RE.test(text) || INVITE_RE.test(text)) return true;
  for (const e of entities) {
    if (e.type === 'url' || e.type === 'text_link') return true;
    const url = e.url || entityText(text, e);
    if (URL_RE.test(url) || INVITE_RE.test(url)) return true;
  }
  const markup = msg && msg.reply_markup;
  const rows = markup && markup.inline_keyboard || [];
  for (const row of rows) {
    for (const btn of row || []) {
      if (btn && btn.url) return true;
    }
  }
  return false;
}

function mentionedNonAdmins(msg, adminIds, adminUsernames) {
  const { text, entities } = messageParts(msg);
  const ids = adminIds || new Set();
  const names = new Set([...(adminUsernames || [])].map((s) => String(s).replace(/^@/, '').toLowerCase()));
  for (const e of entities) {
    if (e.type === 'mention') {
      const handle = entityText(text, e).replace(/^@/, '').toLowerCase();
      if (handle && !names.has(handle)) return true;
    } else if (e.type === 'text_mention') {
      const id = e.user && e.user.id;
      if (id && !ids.has(id)) return true;
    }
  }
  return false;
}

function isChannelForward(msg) {
  if (!msg) return false;
  const origin = msg.forward_origin;
  if (origin && origin.type === 'channel') return true;
  const chat = msg.forward_from_chat;
  if (chat && (chat.type === 'channel' || chat.type === 'supergroup') && origin && origin.type === 'channel') return true;
  if (chat && chat.type === 'channel') return true;
  return false;
}

function hasScamKeywords(text) {
  return !!(text && SCAM_RE.test(text));
}

function isAdminUser(user, adminIds) {
  return !!(user && adminIds && adminIds.has(user.id));
}

function shouldDelete(msg, adminIds, adminUsernames) {
  if (!msg) return false;
  if (msg.from && msg.from.is_bot && adminIds && adminIds.has(msg.from.id)) return false;
  if (isAdminUser(msg.from, adminIds)) return false;
  if (msg.sender_chat && adminIds && (adminIds.has(msg.sender_chat.id) || msg.sender_chat.id === (msg.chat && msg.chat.id))) {
    /* anonymous admin posts as the chat itself; leave them */
    if (!msg.from || msg.from.id === 1087968824) return false;
  }
  const { text } = messageParts(msg);
  if (hasInviteLink(msg) || hasLinks(msg)) return true;
  if (mentionedNonAdmins(msg, adminIds, adminUsernames)) return true;
  if (isChannelForward(msg)) return true;
  if (hasScamKeywords(text)) return true;
  return false;
}

function commandFrom(msg) {
  if (!msg || !msg.text) return null;
  const { text, entities } = messageParts(msg);
  let raw = null;
  const ent = (entities || []).find((e) => e.type === 'bot_command' && e.offset === 0);
  if (ent) raw = entityText(text, ent);
  else {
    const m = text.match(/^\/([A-Za-z0-9_]+)(?:@\w+)?/);
    if (!m) return null;
    raw = m[0];
  }
  const name = raw.replace(/^\//, '').split('@')[0].toLowerCase();
  const rest = text.slice(raw.length).trim();
  return { name, rest, raw };
}

function parsePollArgs(rest, isQuiz) {
  const parts = String(rest || '').split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return { error: 'Need a question and at least two options, separated by |' };
  }
  const question = parts[0];
  let options = parts.slice(1);
  let correct = -1;
  if (isQuiz) {
    correct = options.findIndex((o) => /^(\*|✓|✔)\s*/.test(o));
    options = options.map((o) => o.replace(/^(\*|✓|✔)\s*/, ''));
    if (correct < 0) return { error: 'Mark the correct quiz option with a * prefix, for example *SPF 50' };
  }
  if (question.length < 1 || question.length > 300) return { error: 'Question must be 1–300 characters' };
  if (options.length < 2 || options.length > 10) return { error: 'Need 2–10 options' };
  if (options.some((o) => !o || o.length > 100)) return { error: 'Each option must be 1–100 characters' };
  const out = { question, options };
  if (isQuiz) out.correctOptionId = correct;
  return out;
}

function recordStrike(userId) {
  const n = (strikes.get(userId) || 0) + 1;
  strikes.set(userId, n);
  return n;
}

function resetStrikes(userId) {
  if (userId == null) strikes.clear();
  else strikes.delete(userId);
}

function strikeCount(userId) {
  return strikes.get(userId) || 0;
}

async function tg(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('missing-token');
  const res = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error('telegram-' + method);
    err.telegram = data;
    throw err;
  }
  return data.result;
}

async function getStoreMeta() {
  if (storeMeta && Date.now() - storeMeta.at < META_TTL_MS) return storeMeta;
  const chat = await tg('getChat', { chat_id: STORE });
  storeMeta = {
    id: chat.id,
    username: chat.username || null,
    linkedId: chat.linked_chat_id || null,
    at: Date.now()
  };
  return storeMeta;
}

function isWatchedChat(chat, meta) {
  if (!chat || !meta) return false;
  if (chat.id === meta.id || chat.id === meta.linkedId) return true;
  const uname = chat.username && String(chat.username).toLowerCase();
  if (uname && meta.username && uname === String(meta.username).toLowerCase()) return true;
  return false;
}

async function getAdmins(chatId) {
  const hit = adminCache.get(chatId);
  if (hit && Date.now() - hit.at < ADMIN_TTL_MS) return hit;
  const list = await tg('getChatAdministrators', { chat_id: chatId });
  const ids = new Set();
  const usernames = new Set();
  for (const row of list || []) {
    if (row.user && row.user.id) ids.add(row.user.id);
    if (row.user && row.user.username) usernames.add(String(row.user.username).toLowerCase());
    if (row.status === 'creator' || row.status === 'administrator') {
      /* already added */
    }
  }
  const val = { ids, usernames, at: Date.now() };
  adminCache.set(chatId, val);
  return val;
}

const LOCKED_PERMISSIONS = {
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
  can_change_info: false,
  can_invite_users: false,
  can_pin_messages: false,
  can_manage_topics: false
};

const UNLOCKED_PERMISSIONS = {
  can_send_messages: true,
  can_send_audios: true,
  can_send_documents: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_video_notes: true,
  can_send_voice_notes: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
  can_change_info: false,
  can_invite_users: true,
  can_pin_messages: false,
  can_manage_topics: true
};

const HELP = [
  'GN Care admin commands:',
  '/lock — members cannot send messages (read-only)',
  '/unlock — members can send messages again',
  '/poll Question | option1 | option2 | ...',
  '/quiz Question | option1 | *correct option | option3',
  '/help — this list',
  '',
  'Join requests are auto-approved unless the profile looks like a scam.',
  'Links, invite links, and scam messages from non-admins are deleted; a second strike is a ban.'
].join('\n');

async function setPermissions(meta, permissions) {
  const chats = [meta.id];
  if (meta.linkedId) chats.push(meta.linkedId);
  for (const chat_id of chats) {
    await tg('setChatPermissions', { chat_id, permissions });
  }
}

async function handleCommand(msg, meta, admins) {
  const cmd = commandFrom(msg);
  if (!cmd) return false;
  const fromId = msg.from && msg.from.id;
  const inPrivate = msg.chat && msg.chat.type === 'private';
  const watched = isWatchedChat(msg.chat, meta);
  if (!inPrivate && !watched) return false;
  if (!admins.ids.has(fromId)) return false;

  const replyTo = inPrivate ? msg.chat.id : (watched ? msg.chat.id : meta.id);

  if (cmd.name === 'help' || cmd.name === 'start') {
    await tg('sendMessage', { chat_id: replyTo, text: HELP });
    return true;
  }
  if (cmd.name === 'lock') {
    await setPermissions(meta, LOCKED_PERMISSIONS);
    await tg('sendMessage', { chat_id: replyTo, text: 'Group is now read-only. Members cannot send messages.' });
    return true;
  }
  if (cmd.name === 'unlock') {
    await setPermissions(meta, UNLOCKED_PERMISSIONS);
    await tg('sendMessage', { chat_id: replyTo, text: 'Group is unlocked. Members can send messages again. Spam still gets deleted.' });
    return true;
  }
  if (cmd.name === 'poll' || cmd.name === 'quiz') {
    const isQuiz = cmd.name === 'quiz';
    const parsed = parsePollArgs(cmd.rest, isQuiz);
    if (parsed.error) {
      await tg('sendMessage', { chat_id: replyTo, text: parsed.error + '.\nExample: /' + cmd.name + ' Favourite cleanser? | CeraVe | Cetaphil' + (isQuiz ? ' | *Bioderma' : '') });
      return true;
    }
    const body = {
      chat_id: meta.id,
      question: parsed.question,
      options: parsed.options.map((o) => ({ text: o })),
      is_anonymous: true
    };
    if (isQuiz) {
      body.type = 'quiz';
      body.correct_option_id = parsed.correctOptionId;
    }
    await tg('sendPoll', body);
    if (inPrivate) await tg('sendMessage', { chat_id: replyTo, text: (isQuiz ? 'Quiz' : 'Poll') + ' posted to @Gncarestore.' });
    return true;
  }
  return false;
}

async function handleJoinRequest(reqst, meta) {
  if (!reqst || !reqst.chat || !reqst.from) return;
  if (!isWatchedChat(reqst.chat, meta)) return;
  const user = reqst.from;
  const scam = isScamProfile(user, reqst.bio);
  const params = { chat_id: reqst.chat.id, user_id: user.id };
  if (scam) await tg('declineChatJoinRequest', params);
  else await tg('approveChatJoinRequest', params);
}

async function handleMessage(msg, meta) {
  if (!msg || !msg.chat) return;
  const inPrivate = msg.chat.type === 'private';
  const adminChatId = inPrivate ? meta.id : msg.chat.id;
  let admins;
  try { admins = await getAdmins(adminChatId); }
  catch (e) { admins = { ids: new Set(), usernames: new Set() }; }
  if (inPrivate) {
    await handleCommand(msg, meta, admins);
    return;
  }
  if (!isWatchedChat(msg.chat, meta)) return;
  if (await handleCommand(msg, meta, admins)) return;
  if (!shouldDelete(msg, admins.ids, admins.usernames)) return;
  const userId = msg.from && msg.from.id;
  try { await tg('deleteMessage', { chat_id: msg.chat.id, message_id: msg.message_id }); }
  catch (e) { /* message may already be gone */ }
  if (!userId || admins.ids.has(userId)) return;
  const n = recordStrike(userId);
  if (n >= STRIKE_BAN) {
    try {
      await tg('banChatMember', { chat_id: msg.chat.id, user_id: userId, revoke_messages: true });
    } catch (e) { /* tested only via mocks; never ban in manual testing */ }
  }
}

async function handleUpdate(update) {
  if (!update || typeof update !== 'object') return;
  const meta = await getStoreMeta();
  if (update.chat_join_request) {
    await handleJoinRequest(update.chat_join_request, meta);
    return;
  }
  const msg = update.message || update.edited_message;
  if (msg) {
    await handleMessage(msg, meta);
    return;
  }
  /* chat_member is accepted and ignored (no action) */
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'method' });
  }
  const headers = req.headers || {};
  const got = headers['x-telegram-bot-api-secret-token'] || headers['X-Telegram-Bot-Api-Secret-Token'];
  if (!secretsMatch(got, webhookSecret())) return send(res, 401, { ok: false, error: 'unauthorized' });
  if (!process.env.TELEGRAM_BOT_TOKEN) return send(res, 503, { ok: false, error: 'not-configured' });

  const update = parseUpdate(req);
  if (!update) return send(res, 400, { ok: false, error: 'bad-body' });
  try {
    await handleUpdate(update);
  } catch (e) {
    return send(res, 200, { ok: true, error: 'handled' });
  }
  return send(res, 200, { ok: true });
}

handler.helpers = {
  webhookSecret,
  secretsMatch,
  isScamProfile,
  hasLinks,
  hasInviteLink,
  mentionedNonAdmins,
  isChannelForward,
  hasScamKeywords,
  shouldDelete,
  commandFrom,
  parsePollArgs,
  recordStrike,
  resetStrikes,
  strikeCount,
  STRIKE_BAN,
  LOCKED_PERMISSIONS,
  UNLOCKED_PERMISSIONS,
  setStoreMeta(meta) { storeMeta = meta ? Object.assign({ at: Date.now() }, meta) : null; },
  clearAdminCache() { adminCache.clear(); },
  handleUpdate,
  STORE
};

module.exports = handler;
