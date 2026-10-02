# Claude Code: Session 1 (Milestone 1 kickoff)

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window; then everyone watches a shared replay of their visible area. The owner is Nate, who directs the project but isn't a full-time developer: explain choices in plain language.

## Setup
1. This folder (`C:\Users\nkurt\Claude\Projects\Strategy Game`) is the project. The GitHub repo is `overconfidence7/conquerra`.
   - If this folder isn't yet a git clone of that repo, connect it without losing any files: `git init`, add the remote, fetch, `git reset origin/main`, then `git status` to confirm nothing is lost.
   - Restore any files that exist only in the repo (e.g. `.github/workflows/ci.yml`).
2. Install: Node 22+, `pnpm install`, `pnpm test`, `pnpm sim --games 100`. Report anything that doesn't work.

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (where we are)
3. `docs/02-game-design-outline.md` (v0.1 design)
4. `docs/04-design-additions.md` (v0.2 changes; **where 02 and 04 disagree, 04 wins**)
5. `docs/03-build-plan.md` (architecture and milestones)
6. `docs/decisions.md` (decisions log)

## Task 1: review the existing prototype and decide
The planning assistant built a prototype engine before the v0.2 design existed: `packages/content`, `packages/engine`, `packages/bots`, `apps/sim`.
- Review it against the v0.2 design. Main gaps you'll find:
  - It uses three unit types; v0.2 is **troops + specialists**.
  - No culture, no contingency presets, no "surface details" event filtering, and no turn-timer setting.
- Decide: **keep**, **change**, or **start fresh**, module by module. Write `docs/05-prototype-review.md`: one short paragraph per module, plus your overall call and why. Keep the language plain.

## Task 2: deliver Milestone 1 (engine core v0.2 + headless sim)
Follow the M1 scope in `docs/03-build-plan.md`. Key points:
- **Troops + specialists:**
  - Every army is one troop number, plus up to 2 specialist attachments (cavalry: move 2; siege: breaks forts; scouts: extra vision; engineers: build a fort in one turn; healers: fewer losses).
  - Specialists are bought with gold at a barracks. In M1, assume culture unlocks only gate the fancier ones; keep it simple.
  - Define what happens to specialists when their army dies or is captured, and document the rule.
- **Contingency presets:** implement the presets listed in `04-design-additions.md` §3 as named, one-tap templates that expand into conditions and fallbacks.
- **Light culture:**
  - One culture number per territory, raised by spending gold.
  - It reduces the effect of bad events and uprisings, and boosts holding bonuses.
  - Captured culture passes to the conqueror.
  - No culture victory, no culture tree. **Military first.**
- **Fog rule (v0.2, §8):** details only on your own and bordering territories. Everywhere else, the view shows only map geography and bonus values (no owner, troops or culture). Make sure the view and data model can later support spies (§8) without a rewrite, but don't build spies yet.
- **Fog-filtered replay:** each player gets the turn's events trimmed to what they could see. Events in fogged areas come through as "surface details" only (e.g. "a battle in the north").
- **Game config:** turn timer (default 300 seconds; longer allowed) and turn limit. The engine only stores these; it doesn't keep time.
- **Balance:** use the sim to get typical game length to **about 15–25 turns**. Tune numbers in `packages/content` only.
- Update the "Recruit" bot to work with all of the above.
- **Measure turn-resolution CPU time** in the sim (average and worst case, at 2, 6 and 10 players, with bots planning). We need this to size Cloudflare hosting; see `docs/infra-cloudflare.md`.
- **Out of scope for M1 (later milestones):** spies, Spoils and Fate decks, diplomacy, generals and standing instructions, the Fallen, any UI or server.

## Exit criteria
- `pnpm test` and `pnpm typecheck` are green. The determinism test passes.
- 1,000+ bot games at 2, 4 and 6 players with no crashes. Report win rate by seat, average length and the predictability stats.
- `docs/rules-reference.md`: a plain-language rules summary Nate can read in 10 minutes.
- `docs/decisions.md` and `PROGRESS.md` updated (simple language; add a dated entry, and bump "Claude Code sessions completed").
- Commit with clear messages and push to GitHub.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks.** Keep it under one page.
