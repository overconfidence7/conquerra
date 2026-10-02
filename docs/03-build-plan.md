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

## Milestones

### M0: Design sign-off ✅ Done
- Market research (`01`), design outline (`02`), this plan (`03`).
- **Exit:** Nate approves the outline and the open questions are answered.

### M1: Engine core + headless sim ✅ Done (Oct 2): see `sim-results-m1.md`
Goal: two bots can play a full game in the terminal.
1. Repo scaffold: pnpm workspace, TS strict, ESLint/Prettier, Vitest, GitHub Actions running tests.
2. `content`: map schema (territories, adjacency, provinces, terrain, special borders) + one hand-made test map (~40 territories, 2–6 players).
3. `engine` state model: players, territories, armies (by unit type), gold, buildings, leaders.
4. Order types: `recruit`, `build`, `move`, `attack`, `useAbility`, with `conditions[]` and `fallback`.
5. Resolution loop: seeded seat shuffle → round-robin → condition check → execute or fallback or fizzle. Initiative hooks (`first`, `last`).
6. Combat: expected-value model + luck blend (default 0.3), terrain/fort/unit modifiers, `previewCombat()` for the odds UI.
7. Economy: income, province bonuses, upkeep curve.
8. Fog: `viewFor(state, player)`.
9. Victory checks: classic, conquest (turn limit + score).
10. `bots`: "Recruit" tier, a rule-based utility AI (score candidate orders, pick the best plan).
11. `apps/sim`: `pnpm sim --map test --players 4 --games 500` → win rates, average game length, first-player advantage, snowball metrics.
- **Tests:** determinism (same seed → same result), no negative troops, conservation checks, property tests on random order queues.
- **Exit:** 1,000 bot games run without errors; the stats look sane.
- **Built as specified, with these M1 rule choices:**
  - A one-unit garrison must stay behind on every move.
  - Units that moved or fought can't act again that turn; freshly recruited units can.
  - Failed attacks fall back to their starting territory.
  - Cavalry-only armies can move two territories through land you hold.
  - Combat luck is a ±luck% spread around the expected result (0 = fully deterministic).
- **Note:** the server is the single source of truth for results. JavaScript engines can differ in the last decimal of `Math.pow`, so clients replay the server's event log rather than re-computing turns.

### M2: Playable local alpha (browser, single player vs bots)
1. `web` app shell, a home screen and a new-game screen (map, bots, luck %, fog, mode).
2. SVG map renderer: territories colored by owner, troop badges, fog shading, zoom/pan, mobile touch.
3. **Order builder UI.** This is the hardest UX piece:
   - Tap a territory, then pick an action, then pick a target. The order appears in a queue panel.
   - Drag to reorder the queue.
   - "Add condition" / "Add fallback" with a few simple templates first (still own X, at least N troops, target owner is Y).
   - Live odds preview on attacks.
4. Bots run in a Web Worker.
5. Turn replay: step-by-step animation + log; skip/scrub.
6. Save/load local games (IndexedDB).
7. Fair-seed display: fingerprint at start, revealed seed and a verify button at the end.
- **Exit:** Nate plays full games against bots on his phone and laptop and has opinions.

### M3: Depth + balance
1. Unit types (cavalry movement, siege vs forts) and the leader hero with 3–4 starter abilities, including initiative abilities.
2. All four buildings.
3. Diplomacy engine: handshake and binding deals, expiry, scaled break penalties, the Oathbreaker mark. Bot diplomacy logic.
4. The Fallen: Influence, world events, pooling, caps.
5. A second and third map (a 6–10 player map).
6. Balance pass using the sim: tune the upkeep curve, combat numbers and event caps from data.
- **Exit:** a 6-player game against bots feels tense through the end, and the sim shows no dominant strategy.

### M4: Online with friends (Cloudflare)
1. `server` Worker + `GameRoom` Durable Object: create, join, submit orders, lock in, resolve on alarm or all-locked, broadcast per-player views over WebSocket.
2. D1 schema: users, games, game_players, results. R2: replays.
3. Auth via Cloudflare Access (Google) on `game.<domain>`.
4. Lobby: create a private game, share an invite link, choose a turn timer (5 min–24 hr).
5. Notifications: Web Push + email when a turn resolves or a deadline is near.
6. Bot takeover after N missed turns; vacation mode.
7. In-game chat (per game, plus private 1:1).
8. Staging + production environments; deploy from CI.
- **Exit:** Nate and friends finish real async games from their phones.

### M5: Public 1.0
1. Public Google sign-in (replacing Access), profiles, guest-to-account upgrade.
2. Matchmaking (quick match), ratings (Glicko-2), reliability score.
3. Battle royale (50 players): large map, performance pass (Canvas/Pixi if needed), lobby fill with bots.
4. Asymmetric factions (3–4), secret objectives, team games.
5. Collusion and multi-account signals (shared device/IP patterns, suspicious pact patterns) feeding a review queue.
6. Interactive tutorial.
7. One-time purchase (Stripe) + entitlements.
8. Landing page, privacy policy and terms.

### M6: Native apps + later
- Capacitor builds for iOS/Android, store in-app purchases, native push.
- Tech tree, map editor, random map generator, cosmetics store, seasons.

---

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
