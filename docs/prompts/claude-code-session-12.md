# Claude Code: Session 12 (M3: art batch 3 in, then generals, captured generals and the Fallen)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his new art, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session has two jobs:**
1. **Bring in art batch 3,** which session 11 got ready for. That includes a new dragon for Wyrmland and another try at rivers for the Crownlands.
2. **Build the next big systems:**
   - **Generals:** hand your Leader's army a standing instruction and let it command itself, so a big empire still fits in a 5-minute turn.
   - **Captured generals:** knock a player out and their Leader joins you.
   - **The Fallen:** knocked-out players keep playing by spending Influence on capped world events.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **If you run short, the Fallen (Part 4) moves to session 13** (Nate agreed); stop cleanly after Part 3.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md` (the last three entries: session 11, the orchestrator's review and Nate's calls)
3. `docs/04-design-additions.md` §4 (generals, with the decisions of Oct 5) and `docs/02-game-design-outline.md` §9 (the Fallen)
4. `docs/decisions.md`, newest lines at the bottom
5. `docs/rules-reference.md` (how the game plays today, especially §3 the turn, §9 Leaders falling and coming back, §13 bots)
6. `packages/bots/src/captain.ts` (generals and Fallen bots reuse its brain)
7. `docs/07-map-tooling.md` ("what to do when batch 3 arrives", how to make a seed official) and `docs/08-visual-upgrade-plan.md`

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Check `art/incoming/` for batch 3.** List what's there and what's missing. The full list is the "Batch 3" section of `docs/art/asset-list-and-prompts.md`. If nothing has arrived, do Part 1's Crownlands step only and go on to Part 2. Don't stop.
3. **Play-test notes:** if Nate pasted notes from sessions 9–11, fix anything small and clearly broken first. List anything bigger in your summary. Also check the desktop selected-territory panel at a 1440×900 window: its last row sits right at the window's bottom edge in `ui-desktop-selected.png`. Make sure nothing is cut off.

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **Fog is respected everywhere:** generals and Fallen bots judge only from their owner's view.
- **Simple to play:**
  - A basic turn is still about 6 taps on a 384 px phone (run `tap-count.mjs`).
  - Giving a general an instruction takes **3 taps or fewer** after selecting it.
  - Nothing new appears on screen until a player has a general or has fallen.
- **Military first:** gold stays the only resource. No new resource for generals. Influence is only for the Fallen, who aren't playing for the win any more.
- **Game length:** up to 30–40 turns (Nate). Report what the new systems do to it.

## Part 1: art batch 3 in, Wyrmland's dragon, the Crownlands' rivers
1. **The art:**
   - Run `pnpm art:import` and check the report.
   - Look at **every new piece** on the bench at Far, Mid and Near on several grounds, and tune sizes and placement there: the pines, the hills/rock/snow textures, ridges, cliffs, the pass gate, the scaffold, the wooden bridge, the landmarks and the plaque frame.
   - Anything that doesn't work: keep today's drawing and say why. Then list what to remake in the art file's "Ideas for batch 4" (under Tier 3; **don't add a new `##` section after Batch 3**, because a test counts the names there).
2. **Wyrmland:**
   - Turn `art/incoming/mask-dragon.png` into the dragon silhouette with the mask script (steps in `docs/07-map-tooling.md`).
   - Find a seed (same recipe, 2 mountain ranges) that **reads as a dragon at Far zoom** and passes every check.
   - **Show Nate the Far picture and wait for his OK** before making it official. While you wait, carry on with Part 2.
   - Then run the 200-game Captain sims at 6, 8 and 10 players.
3. **The Crownlands** (Nate wants rivers):
   - Try seeds of the same crown recipe, at least 24, until one has **at least 3 rivers**, still reads as a crown and passes every check.
   - **Show Nate the before/after Far pictures and wait for his OK.** If no seed gives rivers, keep today's Crownlands and say why. Don't change the map maker in a way that changes any other official map.
   - Run 200-game Captain sims at 6 and 10 players.
4. **Pictures:** retake `pnpm map-check bench` into `bench-after/` and rebuild the before/after pictures in `docs/art/screens/compare/`. Look at them yourself.
5. **Tests:** every official map equals its recipe and passes the checks, and the other maps are unchanged.
6. **Commit and push.**

## Part 2: generals (your Leader as a general)
Read `04-design-additions.md` §4 first. **The decided first version:**
- **A general leads one army:** the troops in the territory where it stands, and it goes with them when they move.
- **Four standing instructions,** in plain words:
  - **Hold here:** keep this territory, and pull in troops if it's threatened.
  - **Defend this border:** toward a rival or a chosen neighbouring place.
  - **Push toward a place:** take land along the way.
  - **Raid a rival:** take their weakly held land and avoid their strong armies.
- **Each turn it writes that army's orders with the Captain's brain** (`captain.ts`), limited to its own army and its instruction, judging **only from its owner's view**. Use the same seeded, deterministic approach as the bots. Reuse the Captain's code rather than copying it.
- **Generals never spend gold.** One treasury: you still recruit, build and raise culture yourself.
- **Your Leader is your first general.** Order its army directly as today, or hand it an instruction. The Leader keeps its +20% fighting bonus and its timing tricks either way.
- **Who controls the army:**
  - If you give your own order to that army, you take control back for the turn, and you can switch the instruction off with one tap.
  - The order queue **shows the general's planned orders before you lock in**, marked with its portrait, so you're never surprised. You can cancel any of them.
- **When are its orders written?** At the start of planning, from your view (shown in the queue). If a turn ends without you locking in, the same orders still go in. They come out identical either way, because both use the same view and seed. Today that's the local game host; later, the M4 server.
- **On screen:**
  - **Phone:** a **Command** button on your Leader's territory (3 taps: Command, pick an instruction, pick a place or rival if needed).
  - **Desktop:** the same, in the merged panel.
  - Your Leader card in the right column says what it's doing ("Holding Galeholt", "Pushing toward Old March").
  - The replay and the report say when a general acted: "Your Leader, holding Galeholt, drove back Lady Morwen's attack".
- **Bots don't need generals** (they already plan everything), but must not break.
- **Tests:**
  - each instruction produces sensible orders on small hand-made maps
  - fog is respected: a general can't use what its owner can't see
  - determinism: same seed and view, same orders
  - taking control back works
  - generals never spend gold
- **Sim:** a seat whose Leader army runs on each instruction against all-Captain tables (4 and 6 players, 200 games each). Report its win share against the plain Captain, and anything a general does that looks dumb (it must not feel like it cheated the player).
- **Commit and push.**

## Part 3: captured generals
- **When a player is knocked out,** whoever knocked them out (already recorded) gets their Leader as a **captured general**.
  - It appears at the winner's capital, with no army until troops are there or move with it, and takes instructions exactly as in Part 2.
- **Command only:** a captured general **doesn't add the +20% fighting bonus** (only your own Leader does) and has **no timing tricks**.
- **You keep at most 2.** When a third would arrive, you choose which to keep. Bots keep the two nearest their front.
- **If a captured general's army is wiped out,** or the territory it stands in is taken, it's gone for good. Only your own Leader comes back.
- **On screen:** its portrait (the knocked-out player's Leader portrait) on its army marker and in the right column, under your Leader.
- **Tests:**
  - captured on knock-out
  - the cap of 2, and the choice when a third arrives
  - no fighting bonus
  - lost for good when it falls
- **Commit and push.**

## Part 4: the Fallen (moves to session 13 if you're short)
Base design: `02-game-design-outline.md` §9. **The orchestrator's defaults** (put every number in `packages/content`; Nate can change them):
- **Influence:**
  - When you're knocked out, you become one of **the Fallen** and earn **Influence** every turn.
  - The more Fallen there are, the faster each one earns.
  - Several Fallen can **pool** Influence for one bigger event.
- **Five world events,** each aimed at a living player's land:
  - **Plague:** a share of troops lost in one province
  - **Storm:** closes one border for a turn
  - **Uprising:** one weakly held territory turns neutral, held by a few rebels
  - **Mercenaries:** a neutral army appears next to a territory
  - **Famine:** a player's gold income is cut for a turn
- **Caps, so events can't decide the game:**
  - no event takes or targets a capital, or knocks a player out
  - at most one event lands on each living player per turn
  - each event has a cooldown
  - **culture's protection applies** (each level blocks 15% of the effect, as with unrest)
- **What the Fallen see:** who holds what everywhere (a political map), but **no troop numbers**. That's enough to aim at whoever is ahead without passing army details to living friends.
- **On screen when you fall:**
  - a short, plain screen: "You are one of the Fallen. Spend Influence to shake the living."
  - an Influence counter, the five events as cards with their cost and effect, and pick a target
  - "Watch to the end" or "Leave the game"
- **The living see events** in the replay and the report under the fog rules: events on your own land are always reported, others only if you can see them.
- **Fallen bots** aim at whoever looks to be leading, reusing the Captain's runaway judgement, from their own (political) view.
- **Tests:**
  - Influence earned and pooled
  - every cap holds
  - culture protection applies
  - fog rules hold for event reports
  - determinism
- **Sim:** compare game length and the three runaway measures (half the map by turn 10, the halfway leader wins, comebacks) with and without the Fallen, at 4, 6 and 10 players, 500 games each. The Fallen should make comebacks a little more likely without deciding games. Report how often the eventual winner was hit hardest.
- **Session 13 decides** whether Influence later moves into Fate draws, as the design suggests. Build the events so they could be drawn from a deck later; don't build the deck now.
- **Commit and push.**

## Part 5: write it up, deploy, play test
- Write `docs/sim-results-m3-generals.md` (Parts 2–4 numbers). Update `docs/rules-reference.md` (generals, captured generals, the Fallen; update "Not in yet").
- **Screenshots (desktop and 384 px phone):**
  - the Command panel
  - the queue showing a general's planned orders
  - a captured general on the map and in the right column
  - the "You are one of the Fallen" screen and an event in the replay
  - the new Wyrmland and Crownlands at Far
- `pnpm deploy:preview` passes its lock check.
- **Commit and push.**

## Out of scope
- **Session 13:** the Spoils and Fate decks (and moving Influence into Fate, if decided).
- **Session 14:** preset diplomacy.
- **Session 15:** spies, culture unlocks and the **"Govern this province"** general instruction (on file; don't build it now).
- **Session 16:** balance pass.
- Rule changes for runaways; online play (M4).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Check that GitHub's checks pass on your last commit** (`gh` isn't installed on Nate's computer, so ask Nate to look at the repo's Actions page, or say you couldn't check).
- Screenshots as listed, `docs/sim-results-m3-generals.md`, and `pnpm deploy:preview` with its lock check.
- **Then ask Nate to play on the preview:**
  1. **Laptop, 4 players on the Twin Realms:** give your Leader "Push toward" a place across the land bridge. Watch what it does over 3–4 turns, then take control back. Did it do what you expected?
  2. **Phone, 6 players on the Ringsea:** knock a player out if you can, and use the captured general.
  3. If you get knocked out (or start a game you'll lose), try a few Fallen events and say whether they feel fair.
  4. Look at the new art at Far, Mid and Near, and at Wyrmland and the Crownlands.
  5. Tell you how many turns each game took.

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **12**), `docs/decisions.md`, `docs/rules-reference.md`, `docs/04-design-additions.md` (if anything changed) and `docs/07-map-tooling.md` are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which batch 3 pieces are in, and any that didn't work (and why)
- Wyrmland and the Crownlands: seeds, checks, sim numbers, and Nate's OK
- generals: win share per instruction, and anything that looked dumb
- the Fallen: length and runaway numbers with and without them
- the tap counts (basic turn, giving an instruction)
- the screenshot paths
- what Nate said after playing
