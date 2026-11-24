# Telegram deals channel (you create it)

This repo does **not** create a Telegram channel, bot, or posts for you. When you want a deals channel, follow the steps below, then run the script when you are ready.

## 1. Create the public channel

1. In Telegram, start a new **channel** (not a group). A suggested name is “GN Care deals”; pick any name you like.
2. Add a short description, for example: “Typical skincare deals from GN Care. Prices are approximate — check the store. As an Amazon Associate and Flipkart affiliate, GN Care earns from qualifying purchases.”
3. Make it public and choose a username, for example `gncaredeals`. Your public URL will be `https://t.me/gncaredeals`.
4. Paste that URL into `TELEGRAM_URL` in `public/config.js`. The Shop tab shows a “Join our Telegram deals” button only when this is a `https://t.me/...` or `https://telegram.me/...` link. Leave it empty until the channel exists.

## 2. Create a bot and add it as admin

1. Open [@BotFather](https://t.me/BotFather) in Telegram, send `/newbot`, and follow the prompts.
2. Copy the bot token. Store it only as the `TELEGRAM_BOT_TOKEN` environment variable or GitHub Actions secret. **Never commit it.**
3. Add the bot to your channel as an **administrator** with permission to post messages.
4. Set `TELEGRAM_CHANNEL` to the channel username (`@gncaredeals`) or the numeric chat id.

## 3. Post from the catalog

The script reads `public/catalog.json`, builds a short message from the curated `deals` list (typical MRP vs typical price, plus Amazon and Flipkart search links with your affiliate tags), and always appends the affiliate disclosure. It will not invent products, prices, or coupon codes. Expired coupons are omitted.

```bash
# Print the message only
node scripts/post-telegram-deals.mjs --dry-run

# Post for real
TELEGRAM_BOT_TOKEN=your_token TELEGRAM_CHANNEL=@yourchannel node scripts/post-telegram-deals.mjs
```

You can also put the two variables in `.env` (gitignored).

## 4. Optional GitHub Action

`.github/workflows/telegram-deals.yml` is **disabled**. To use it later:

1. Add Actions secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL`.
2. Set the repository variable `ENABLE_TELEGRAM_DEALS` to `true`.
3. Uncomment the `schedule` cron if you want a weekly post. Until then it only runs on `workflow_dispatch`.

Posting too often with the same affiliate links can look spammy and may conflict with Amazon Associates or Flipkart rules. Read those programmes before you automate.

## 5. If you later close the channel

Clear `TELEGRAM_URL` in `public/config.js` so the Shop button disappears, and remove the Actions secrets.
