# Prototype Review (Claude Code, Session 1)

*October 2, 2026. The planner built an early engine before the v0.2 design existed. This is my module-by-module call on what to keep, change, or replace, and why.*

## Overall call: keep the foundation, rebuild the parts v0.2 changed

The prototype got the hard, invisible things right: the game is deterministic (same seed and orders give the same result every time), luck is provably fair, and the round-robin turn order with backups works and is well tested. Those are exactly the pieces that are expensive to get wrong and boring to redo, so starting fresh would have thrown away good work for no gain.

What v0.2 changed (troops + specialists, culture, presets, the new fog rule, fogged replays, the turn timer setting) touches the *data model* and the *bot*, not the turn machinery. So I kept the skeleton and rewrote the layers on top of it. Roughly half the engine code is new; all of the tests were updated, and there are about twice as many as before.

## Module by module

**`packages/content` (rules and maps): changed.** The idea is right: every balance number lives in one JSON file, checked by a schema, so tuning never needs code changes. I replaced the three unit types with one troop number plus five specialists, and added culture, build times, and the game settings (turn timer, turn limits). I also added a second, larger test map, *Greatmarch* (80 territories, up to 10 players), because the original map only fits 6 and we need 10-player timing for hosting.

**`rng.ts` and `fairness.ts` (random numbers and the fair-seed fingerprint): kept as is.** Small, correct, and tested. Nothing in v0.2 touches them.

**`mapIndex.ts` (who borders whom): kept as is.**

**`combat.ts` (the 70/30 battle math): changed.** The formula (expected result plus a ±30% luck spread) is unchanged. Inputs changed from "infantry/cavalry/siege counts" to "troops plus specialists": siege now cancels a fort's bonus, and healers cut their own side's losses. The odds preview uses the same function, so the preview can never disagree with the real result.

**`resolve.ts` (running a turn): kept the structure, rewrote the inside.** The turn order (shuffled seats, Seize the Initiative first, round-robin, Lie in Wait last) and the condition/backup system are the prototype's. New: specialists moving with armies, building that takes time (engineers make it instant), culture investment, retreat and "push on" orders used by presets, unrest when you can't pay upkeep, and a rule that order conditions can't peek through fog.

**`economy.ts` (gold, upkeep, score): changed.** Same income and upkeep model, plus culture's holding bonus, specialist upkeep, and culture-based specialist unlocks.

**`view.ts` (what each player is sent): replaced.** The old view already used the right radius (your land plus its neighbours), but it was built around the three unit types and had no room for culture, specialists, or a second way of seeing (spies). The new view follows §8 exactly: full detail on your land and its neighbours (further with watchtowers and scouts); everywhere else, nothing but the public map. It's built around a list of "why you can see this" sources, so spies (M3) become one more source rather than a rewrite.

**Replay filtering: replaced** (now `replay.ts`). The old filter only kept or dropped events. The new one turns fogged battles into "surface details" (just "a battle in Northreach"), drops quiet fogged moves entirely, and always shows you battles you were in.

**`units.ts`: removed.** It existed only for the three unit types.

**`setup.ts` (starting a game): changed lightly.** Same capital spreading; now stores the turn timer and validates the settings.

**`packages/bots` (the Recruit bot): mostly rewritten.** Same personality (grab valuable land it can probably take), but it now hires specialists, invests a little culture, builds forward barracks, concentrates its armies, and uses the presets. It's also what fixed most of the game-length problem: the old bot spread one-troop garrisons everywhere, which made land flip back and forth for 80–110 turns.

**`apps/sim` (the simulator): extended.** Runs several table sizes in one go, measures CPU time per turn (needed for the Cloudflare decision), and reports how often bots used presets, specialists and culture. I added three small helper scripts for balance work (`tune.ts`, `trace.ts`, `longest.ts`).
