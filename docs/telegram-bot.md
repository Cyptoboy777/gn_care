# Telegram bot: join requests, spam, lock, and polls

The webhook lives at `POST /api/telegram` (`api/telegram.js`). Daily deal posts still go out from GitHub Actions (`scripts/post-telegram-store-deals.mjs`); those scripts only *send*, they do not call `getUpdates`, so they do not conflict with this webhook.

## What the bot can do today

@GnCare_bot (`GncareAi`) is already an **administrator** of [@Gncarestore](https://t.me/Gncarestore). That chat is a **public supergroup** (not a broadcast channel). Join requests are already on (`join_by_request`). There is **no linked discussion group**.

Current bot rights in @Gncarestore:

- Allowed: manage chat, change info, delete messages, invite users (needed to approve join requests), restrict members (needed to `/lock` and to ban repeat spammers), pin messages, manage topics, manage video chats, stories.
- Not allowed: promote other admins.

Members can still send messages until an admin sends `/lock`. Privacy mode is still on (`can_read_all_group_messages` is false). Being an admin is often enough for the bot to see group messages, but to be sure, open [@BotFather](https://t.me/BotFather), send `/setprivacy`, choose @GnCare_bot, and **Disable** privacy mode.

## Commands (admins only)

Send these in @Gncarestore, or in a private chat with @GnCare_bot. Only people listed by `getChatAdministrators` can run them.

| Command | Action |
| --- | --- |
| `/lock` | Members cannot send messages (read-only). Also applied to a linked discussion group if you add one later. |
| `/unlock` | Members can send messages again. Spam rules still apply. |
| `/poll Question \| option1 \| option2 \| ...` | Posts an anonymous poll to @Gncarestore (2–10 options). |
| `/quiz Question \| option1 \| *correct option \| ...` | Posts a quiz. Prefix the correct option with `*`. |
| `/help` | Lists the commands. |

Example: `/quiz Which is a sunscreen? | A moisturizer | *SPF 50 lotion | A toner`

## Automatic moderation

- **Join requests:** normal profiles are approved. The bot declines a request when the name or bio has a link, an `@handle`, or scam keywords (crypto, investment, earn, forex, admin support, and similar).
- **Group messages (non-admins):** messages with links, invite links, `@mentions` of non-admins, forwarded channel posts, or those scam keywords are deleted. A second strike bans the user and revokes their messages.
- Strike counts live in memory on the Vercel instance, so they reset on a cold start. That is a free-tier limit, not a second store.

The bot does not scan private albums, call logs, or anything outside this Telegram chat.

## Webhook

- URL: `https://gncare.xyz/api/telegram` (same app as `https://gn-care.vercel.app/api/telegram`).
- Auth: header `X-Telegram-Bot-Api-Secret-Token`. If `TELEGRAM_WEBHOOK_SECRET` is set, that value is used. Otherwise the secret is `SHA-256(TELEGRAM_BOT_TOKEN)` as hex, so no extra secret is required.
- `allowed_updates`: `chat_join_request`, `message`, `edited_message`, `chat_member`.
- Setting or updating the webhook (does not print the token):

```bash
# Run on a machine that already has TELEGRAM_BOT_TOKEN in the environment.
SECRET="${TELEGRAM_WEBHOOK_SECRET:-$(printf %s "$TELEGRAM_BOT_TOKEN" | sha256sum | awk '{print $1}')}"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"   --data-urlencode "url=https://gncare.xyz/api/telegram"   --data-urlencode "secret_token=${SECRET}"   --data-urlencode 'allowed_updates=["chat_join_request","message","edited_message","chat_member"]'   --data-urlencode "drop_pending_updates=true"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

`TELEGRAM_BOT_TOKEN` must also be set in the Vercel project `gn-care` (Production, Preview, and Development, type Sensitive). The function cannot talk to Telegram without it.

## What you may still need to do in Telegram

1. The bot is already an admin with the rights above. If you ever remove it, add it again with: *Delete messages*, *Invite users via link* (approve join requests), *Ban users*, and *Pin messages*.
2. Keep **Approve new members** / join requests enabled (already on).
3. In BotFather, **Disable** privacy mode so spam filtering can see every group message.
4. Send `/lock` when you want the group read-only.
5. There is no linked discussion group right now. If you later attach one, add @GnCare_bot as admin there with the same rights; `/lock` and the spam filter will cover it automatically.

Do not paste the bot token into chat, Issues, or commits.
