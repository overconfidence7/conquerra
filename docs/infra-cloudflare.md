# Cloudflare Setup: What Exists and What Conquerra Needs

*Checked in Nate's Cloudflare dashboard, Oct 2, 2026. No changes were made.*

## What Nate already has

| Item | Current setup | Matters for Conquerra? |
|---|---|---|
| Account | "Nkurtz@gmail.com's Account" (ID `a3c440cb9c05c9f7f9007386e9c0f6c4`) | Same account |
| Domain | `overconfidenceonline.com`, active, Free plan, DNS on Cloudflare | `conquerra.overconfidenceonline.com` goes here |
| Main site | The domain root and `www` point to a Pages project, `overconfidence-online`, which deploys automatically from GitHub `overconfidence7/overconfidence-online` | A pattern to copy: deploy from GitHub |
| Other apps | Workers **keel** (`keel.` subdomain) and **curse-of-stats** (`curseofstats.` subdomain), deployed with Wrangler, not connected to GitHub | Same subdomain pattern |
| Workers plan | **Free** ($5 Paid is not active) | See "the one cost decision" below |
| Durable Objects | One SQLite-backed namespace in use (curse-of-stats). Works on the Free plan | Our game rooms use the same thing |
| D1 databases | `keel_db`, `curse-of-stats` | We add `conquerra_db` |
| R2 buckets | `keel-files`, `curse-of-stats-assets` (both empty, $0) | We add `conquerra-replays` |
| Zero Trust (Access) | Free plan, team domain `keel-nkurtz.cloudflareaccess.com`, **Google login already configured**, 1 app (Keel), 2 of 50 seats used | The friends beta reuses this: Google sign-in with zero new setup |
| Email | Email Routing on the domain; Keel sends from `keel@overconfidenceonline.com` | Optional later: "your turn" emails from `conquerra@...` |
| API tokens | None | Needed only if we deploy from GitHub Actions (see below) |

## What Conquerra needs, by milestone

### M1 (engine): nothing.

### M2 (browser alpha vs bots): optional private preview
- The alpha runs entirely in the browser, so it can be hosted as static files at `conquerra.overconfidenceonline.com`, behind Access, so only Nate (and invited friends) can open it, on phone or laptop.
- Cost: $0.
- Setup:
  - A Worker serving static assets, deployed from GitHub.
  - A custom domain.
  - A new Access application "Conquerra" using the existing Google login, with an allow list of emails.

### M4 (online with friends): the real backend
- **Worker** `conquerra`: serves the web app and the API on `conquerra.overconfidenceonline.com`.
- **Durable Object** `GameRoom` (SQLite storage): one per game. Its alarms run the 5-minute timers; WebSockets carry the live replay.
- **D1** `conquerra_db`: users, games, results.
- **R2** `conquerra-replays`: saved replays and map files.
- **Access app** "Conquerra" (Google login, friends' emails). Free up to 50 people in total, shared with Keel.
- **Deploys:** connect the GitHub repo through Cloudflare's built-in Git integration (Workers Builds), the same way the main site deploys. No API tokens to manage. If we ever need GitHub Actions to deploy instead, Nate creates a scoped API token himself and adds it as a GitHub secret.

### M5 (public): changes
- Access is for invited users, not public sign-up. Public launch replaces it with regular Google sign-in inside the app.
- Upgrade to Workers Paid if not already done (see below).
- Stripe for the one-time purchase.

## The one cost decision: Workers Paid ($5/month)
- On the **Free** plan, each request gets **10 ms of CPU time**. Resolving a turn for 6–10 players, with bots planning for any AI seats, will likely take longer than that, and 50-player battle royale certainly will.
- **Paid** ($5/month plus usage) raises the limit to 30 seconds by default (up to 5 minutes) and includes 10 million requests a month.
- **Recommendation:** stay Free through M1–M3 (nothing runs on Cloudflare yet). Upgrade to Paid at the start of M4. Claude Code should measure real turn-resolution time in the sim first, so we know.

## Steps only Nate can do (when the time comes)
1. M2 or M4: approve creating the Worker, custom domain and Access app. Claude Code can do this with Wrangler once Nate logs in (`npx wrangler login` opens a browser).
2. M4: switch to Workers Paid ($5/month) under Workers plans → Upgrade.
3. M4: add friends' emails to the Conquerra Access policy.
4. M5: Stripe account for payments.
