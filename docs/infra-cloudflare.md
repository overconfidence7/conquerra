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
- Setup (built in session 5; see the README, "The private preview"):
  - A Worker `conquerra` serving the built game as static assets (`apps/web/wrangler.jsonc`), deployed with Wrangler from Nate's computer (`pnpm deploy:preview`). Deploying from GitHub waits until M4.
  - No public address: `workers_dev = false`, preview URLs off. Only the custom domain `conquerra.overconfidenceonline.com`.
  - A new Access application "Conquerra" using the existing Google login, allowing only `nkurtz@gmail.com`, created before the domain goes live. Session duration 1 month, so the installed app doesn't ask to sign in every day.
  - **Done Oct 4:** the Access app "Conquerra" exists (Google sign-in only, instant sign-in, 1 month, policy "Conquerra players" allowing only Nate's email). **Live Oct 4** (deployed in session 6, lock verified by the orchestrator). The Worker's DNS record took over an hour to appear the first time. Update with `pnpm deploy:preview`.
  - **Session 6 (Oct 4):** Wrangler logged in on Nate's computer; the Worker `conquerra` is uploaded (versions `2751944d`, then `095343fd`). Cloudflare confirms: workers.dev address **off**, preview addresses **off**, custom domain `conquerra.overconfidenceonline.com` attached with a certificate. **But the address doesn't answer yet:** the zone's own nameservers have no record for `conquerra` (keel resolves fine), so nobody can open it, which is safe. Next: look in the dashboard (DNS → Records, and Workers → conquerra → Domains & Routes) for why the record is missing, then re-run `pnpm check:preview`.
  - `wrangler deployments list --config apps/web/wrangler.jsonc` works.

### M4 (online with friends): the real backend (built in session 26)
- **Built, session 26 (Oct 13):** the Worker `conquerra` now has a script (`apps/web/server/`): static files as before, plus the online API under `/api` (only `/api/*` runs the Worker's code: `run_worker_first`). Bindings: the Durable Object `GameRoom` (SQLite storage, migration tag `v1`), D1 `conquerra_db` (id `eed2c38b-1ca4-4e45-8b0b-b3c808183a6c`, migrations in `apps/web/migrations/`), the variables `ACCESS_TEAM` (`keel-nkurtz.cloudflareaccess.com`) and `ACCESS_AUD` (the Conquerra app's AUD tag, in `apps/web/wrangler.jsonc`). Workers Logs on (observability). No R2 yet.
- **Deploy:** `pnpm deploy:preview` runs the tests, builds, applies any new D1 migration (`wrangler d1 migrations apply conquerra_db --remote`), deploys (which creates the Durable Object's storage the first time), and runs the lock check (every page, the API and a real WebSocket must be refused without signing in).
- **Local:** `npx wrangler dev --config apps/web/wrangler.jsonc` (after `pnpm build`), with `DEV_EMAIL=you@example.com` in `apps/web/.dev.vars` (git-ignored, never uploaded) standing in for the sign-in, and `npx wrangler d1 migrations apply conquerra_db --local` once.

#### Nate's steps for M4 (copy-paste simple)
**1. The AUD tag (once, session 26).** The Worker checks every API call's sign-in against the Conquerra Access app's "audience" tag. It isn't a secret (it's inside every sign-in token).
   1. Open https://one.dash.cloudflare.com and pick "Nkurtz@gmail.com's Account".
   2. Left menu: **Access controls → Applications** (on older layouts: **Access → Applications**).
   3. Find **Conquerra**, click the three dots (or its name), then **Edit** / **Configure**.
   4. On the **Overview** (or **Basic information**) tab, find **Application Audience (AUD) Tag**, and click the copy button next to it. It's a long string of letters and digits.
   5. Paste it to Claude Code (it goes into `apps/web/wrangler.jsonc`, `"ACCESS_AUD"`), or put it there yourself and run `pnpm deploy:preview`.
   Until it's set, the lobby's Online block says "not switched on yet" and single player is unaffected.

**2. Friends (session 27):** add their emails to the "Conquerra players" policy (same page as step 1, **Policies** tab).

#### What M4 needed, as planned
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

## The one cost decision: Workers Paid ($5/month). Not needed for M4 (corrected Oct 13)
- The Free plan's real limit is **10 ms of CPU per request on the Worker itself**. Resolving a turn with the bots planning takes 15 to 40 ms, so the Oct 2 note assumed the upgrade at the start of M4.
- **Checked Oct 13 against Cloudflare's limits pages:** a **Durable Object gets 30 seconds of CPU per request on the Free plan too** (an HTTP request, a WebSocket message or an alarm each reset it). The game room is a Durable Object, and all the heavy work (the engine, the bots) happens inside it. The Worker's own handlers (checking the Access sign-in, opening the room) take well under a millisecond.
- **What the Free plan caps, for a table of friends:** 100,000 requests a day (outgoing WebSocket messages are free; incoming ones count 20 for 1), 13,000 GB-seconds of room time a day (about 28 hours of a room actively working; rooms sleep between turns), 5 GB of storage in all (a saved game is tens of KB). Nowhere near.
- **Rule for the code:** the engine and bots run only inside the room, never in the Worker's request handlers.
- **If a limit is ever hit:** Cloudflare returns error 1102 (CPU) or 1027 (requests); the game is saved every turn; the upgrade is a dashboard switch with no code change. **Upgrade at the public launch (M5)**, for volume and storage, not before.

## Steps only Nate can do (when the time comes)
1. M2 or M4: approve creating the Worker, custom domain and Access app. Claude Code can do this with Wrangler once Nate logs in (`npx wrangler login` opens a browser).
2. M4: nothing to pay (see above). M5: switch to Workers Paid ($5/month) under Workers plans → Upgrade.
3. M4: add friends' emails to the Conquerra Access policy.
4. M5: Stripe account for payments.
