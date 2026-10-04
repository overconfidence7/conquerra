# Conquerra: Build Plan v0.1

*For Claude Code. Read `02-game-design-outline.md` first. Work one milestone at a time; each one ends with something Nate can play or see.*

---

## Architecture

```
conquerra/
├─ packages/
│  ├─ engine/      Pure TypeScript game rules. No DOM, no network, no Cloudflare.
│  ├─ content/     Data: maps, units, buildings, factions, events (JSON + schemas)
│  ├─ bots/        AI players; depend only on engine
│  └─ shared/      Types and the wire protocol shared by client and server
├─ apps/
│  ├─ web/         React + Vite client (PWA). Runs the engine locally for single player.
│  ├─ sim/         CLI: runs thousands of bot-vs-bot games for testing and balance
│  └─ server/      Cloudflare Worker + Durable Objects (from Milestone 4)
└─ docs/
```

### Key principles
1. **The engine is deterministic and pure.** `resolveTurn(state, ordersByPlayer, seed) → { newState, events[] }`. The same inputs always give the same outputs. This one rule makes replays, provably fair luck, bots, testing and server/client parity all straightforward.
2. **The engine has zero platform dependencies**, so it runs in the browser, in Node (sim), in a Web Worker (bots) and in a Durable Object without changes. That's also our protection against Cloudflare lock-in.
3. **Rules are data-driven.** Unit stats, buildings, events and deal penalties live in `content/` as JSON validated with Zod, so balance changes don't need code changes.
4. **Event-sourced games.** A game is stored as its initial setup + seed + every turn's orders. State can be rebuilt at any point; a replay is just re-running it.
5. **Fog is enforced by the server.** Clients only ever receive a per-player *view* of the state (`viewFor(state, playerId)`), never the full state.

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) everywhere | One language across engine, client and server |
| Monorepo | pnpm workspaces | Simple and fast |
| Tests | Vitest + fast-check (property tests) | Deterministic engine invariants |
| RNG | Small seeded PRNG (e.g., sfc32), seed committed by SHA-256 hash | Provably fair |
| Client | React + Vite, SVG map rendering, Zustand for state | SVG handles a few hundred territories fine; PixiJS only if 50-player maps need it |
| PWA | vite-plugin-pwa | Installable, offline single player, push notifications |
| Server | Cloudflare Workers + Hono router | Already on Nate's account/domain |
| Game rooms | Durable Objects (one per game, SQLite storage, WebSocket hibernation, alarms for turn timers) | Each game is a single consistent actor; idle async games cost almost nothing |
| Accounts/ratings | Cloudflare D1 | SQL, same platform |
| Maps/replays/assets | Cloudflare R2 | Cheap object storage |
| Notifications | Cloudflare Queues → Web Push + email | "Your turn" pings |
| Auth (friends beta) | Cloudflare Access with Google login | Zero code, free for small groups, Nate already uses Cloudflare |
| Auth (public) | Google OAuth/OIDC handled in the Worker | Access is built for internal apps, not public consumer sign-up |
| Payments (public) | Stripe one-time purchase on web; store in-app purchase for native | |
| Native apps | Capacitor wrapping the PWA | Reuses the web client |
| CI/CD | GitHub Actions → wrangler deploy | |

---

## Milestones (revised Oct 2 for design v0.2)

The design is now `02-game-design-outline.md` (v0.1 base) **plus** `04-design-additions.md` (v0.2). Where they disagree, **04 wins**.

### M0: Design ✅ Done
Research, outline v0.1, v0.2 additions, and decisions.

### M1: Engine core v0.2 + headless sim ✅ Done (Oct 2)
- Claude Code first reviews the planner-built prototype (`packages/`, `apps/sim`) and decides whether to keep it, change it, or start fresh. The decision is written up in `docs/05-prototype-review.md`.
- Engine scope:
  - **troops + specialists** (replaces the three unit types)
  - order queues with **contingency presets**
  - round-robin resolution with initiative
  - 70/30 combat with an odds preview
  - gold economy with upkeep
  - **light culture** (one number per territory)
  - fog, with per-player replay filtering ("surface details" for fogged events)
  - Leader
  - classic and conquest victory
- Turn timer settings in the game config: 5-minute default, longer allowed. The engine doesn't keep time; it only stores the setting.
- Bots: "Recruit" tier, updated for specialists and presets.
- Sim reports game length. **Target: about 15–25 turns.**
- Exit: tests green, 1,000+ bot games with no crashes, a plain-language rules reference (`docs/rules-reference.md`) for Nate to read.

### M2: Playable local alpha (browser, vs bots)
- Map, plus a fast order builder with presets (goal: a basic turn in about 60 seconds, a deep turn within 5 minutes).
- 5-minute timer, odds preview, and the shared replay showing your visible area.
- A private preview at `conquerra.overconfidenceonline.com` behind Cloudflare Access (Google login already set up), so Nate can test on his phone. See `docs/infra-cloudflare.md`. (Decided Oct 2.)
- Split into four Claude Code sessions:
  - **Session 2 ✅:** small engine updates, then the browser app: map, order builder with presets and odds, local game vs bots, a simple text log.
  - **Session 3 ✅:** the seeded map maker and real geography (`04-design-additions.md` §9): seas, lakes, mountain ranges, passes, rivers, sea lanes, choke points, plus the height map, biome and decoration data the illustrated map needs. Rebuild both test maps.
  - **Session 4 ✅:** the illustrated map renderer (WebGL/PixiJS) in the "Gilded Atlas" style (`docs/06-art-direction.md`): terrain from the biome data, relief lighting from the height map, sprites and specialist figures, the info layer (borders, banners, icons), zoom levels, Tactical view, fog mist, "last seen" intel, the hover/tap card, the art import script and placeholders.
  - **Session 5 ✅:** the gilded menus (territory card, army panel, Leader portrait, turn report, minimap), the animated replay, the turn timer, phone layout, installable app, and the private preview setup. It ran in the cloud, so it couldn't reach Nate's art or Cloudflare.
  - **Session 6 (run locally on Nate's computer):** import art batches 2 and 3 and judge them in the game, retake the screenshots, put the private preview online, and have the replay camera follow off-screen action. Then Nate's real-phone test closes M2.
- Exit: Nate plays full games against bots on phone and laptop.

### M3: Depth + balance
- Leader-as-general (standing instructions) and captured generals.
- Spoils and Fate decks (events and missions).
- Preset-based diplomacy with counteroffers and the re-confirm rule.
- The Fallen.
- Specialist unlocks via culture.
- Spies: independent travel, country infiltration, spy-vs-spy defense with deception (`04-design-additions.md` §8).
- Smarter bots: hold passes with small armies, push through choke points with enough force, plan sea-lane landings. This should bring 4–6 player games back under 25 turns on average.
- Balance pass using the sim.
- **Map lab** (dev-only, early in M3): seed and knobs in, the real illustrated map out, with its quality checks, a 12-seed gallery and the art test bench. See `docs/07-map-tooling.md`.

### M4: Online with friends (Cloudflare)
- Live 5-minute turns, plus a longer-timer option.
- Durable Object per game, WebSockets for the live replay.
- Google sign-in via the existing Cloudflare Access setup (Google login already configured), invite links.
- Upgrade to Workers Paid ($5/month) at the start of M4, because turn resolution likely exceeds the Free plan's 10 ms of CPU per request.
- Deploy from GitHub with Cloudflare's built-in Git integration.
- Resources to create: Worker `conquerra`, Durable Object `GameRoom`, D1 `conquerra_db`, R2 `conquerra-replays`, Access app "Conquerra". Full details in `docs/infra-cloudflare.md`.
- Bot takeover for quitters; notifications.

### M5: Public 1.0
- Public Google sign-in, matchmaking and ratings.
- 50-player battle royale, asymmetric factions, secret objectives, team games.
- Random maps generated on the spot, and the "blackout" fog option (`04-design-additions.md` §9). First split the map maker into stages with their own random streams and pins (`docs/07-map-tooling.md`), so the map builder can reuse it.
- Anti-collusion, tutorial, one-time purchase.

### M6: Native apps + later
- iOS and Android apps, cosmetics.
- **Map builder** on the same staged map maker (`docs/07-map-tooling.md`): for Nate first, players later.

## Working conventions for Claude Code
- Start each session by reading `CLAUDE.md`, `docs/02-game-design-outline.md` and the current milestone in this file.
- Engine changes require tests. The determinism test must always pass.
- Never import DOM, Node or Cloudflare APIs into `packages/engine`.
- Balance numbers go in `packages/content`, not in code.
- Keep `docs/decisions.md` updated: one line per decision, with the date.
- End each session with a short summary: what's done, what's next, any open questions for Nate.

## Open questions
1. Free tier contents vs. the one-time purchase, and the price.

## Settled (Oct 1–2)
- Game name: **Conquerra** (USPTO trademark search + domain check still to do).
- Repo on Nate's GitHub, `overconfidence7` (CI + Cloudflare deploys).
- Hosted at `conquerra.overconfidenceonline.com` on the existing Cloudflare account.
- GitHub: `overconfidence7/conquerra`.
- Orders are unlimited for now; revisit a command-point cap only if testing shows a problem.
