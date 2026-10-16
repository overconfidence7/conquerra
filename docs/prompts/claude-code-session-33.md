# Claude Code: Session 33 (M5 part four: balance with sims: random maps' graded head start, then the Turtle and your leaders under blackout)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs the simulator with its 19 workers (the sims are the session), Wrangler (logged in there), his browser and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is balance, decided by numbers.** Two things the sims showed and Nate wants fixed before scale (his calls, Oct 16):
1. **Random maps miss the fairness bar.** With +4 on the harder spots and the band at 4.0 (version 3), the safest capital spot still wins up to twice its share at 8 players (`docs/sim-results-m5-random-maps.md`, session 31). Nate's call: **a graded head start by exposure rank**, every spot but the safest gets something, the most exposed the most, until every size is inside ±5 by exposure, or the numbers say why not.
2. **Two Marshal personalities and your leaders play differently under blackout** (`docs/sim-results-m5-blackout.md`, session 32): the Turtle wins 14.7% against 22.5% with standard fog, the Opportunist 30.1% against 20.9%, and the delegating seat (your leaders running a missed turn, Wyrmland 6) 1.28× fair against 1.54×. The explore drive doesn't move them; it's the personalities and the leaders themselves. Tune them under blackout so each is within its bar.

**Every balance value lives in `packages/content`**, standard-fog games stay byte for byte the same unless a part says otherwise (and then the fingerprints are re-pinned in the same commit with the reason), and every claim comes with the sim that shows it. Scale, abuse limits and the map lab's switch are session 34: don't start them.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1 and 2 each end with a deploy,** so the session is complete at either boundary. Whatever isn't reached becomes session 33b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy** (a random map pins its version; a running game keeps its map). Long sims run in the background (19 workers) while you go on.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 16: Orchestrator review of session 32" (the two page leaks and the label, for Step 0), and **every "Nate's play test" entry after session 32** (his solo notes outrank anything below)
3. **`docs/sim-results-m5-random-maps.md`** (sessions 30 and 31: the tables by exposure, what +4 and the band did, the orchestrator's reading: the safest spot is the problem), **`docs/sim-results-m5-blackout.md`** (session 32: the headline, the three settings tried, the personalities' and the delegating seat's numbers and the bars)
4. `docs/sim-results-m3-balance.md` ("The seat rule", session 23's start bonus sizes +2 to +6 and how they were chosen), `docs/sim-results-m3-marshal.md` (the personalities, their bars: each within 0.2 × fair of the others' table), `docs/sim-results-m3-leaders.md` (the delegating seat's bar)
5. `docs/04-design-additions.md` §9 (random maps, blackout), §4 (the Marshal's personalities), §12 (leaders); `docs/11-launch-plan.md` §2 and §5
6. `docs/decisions.md`, the Oct 16 lines at the bottom
7. The code: `packages/mapgen/src/random.ts` (`markHarder`, `exposureProblem`, `randomMap`), `seed.ts` (`RANDOM_VERSIONS`: 2 and 3; a game pins its version), `capitals.ts` (`exposureOf`), `packages/engine/src/setup.ts` (the layout's `bonus` and the seat rule), `apps/sim/scripts/s30-sims.ts` (`--random <size>:<shape>:<n> <players>`, `--band`, the by-exposure report), `packages/content/data/personalities.json` (`explore`, each personality's `attack.calmMargin`, `strikeTurn`, `chainMargin`), `packages/bots/src/marshal/plan.ts` and `judge.ts` (where calm and strike are read), `packages/bots/src/known.ts` (the known map; blackout is `view.settings.fog === "blackout"`), `generals.ts` and `delegateSeat.ts` (your leaders on a missed turn), `apps/sim/src/tournament.ts` (`--seats marshal-turtle,marshal,marshal,marshal --fog blackout`), `apps/sim/scripts/s23-tables.ts` (`delegate 300 wyrmland:6 <seed> --fog blackout`), `apps/web/src/render/pixi/` (the province outline and the replay's arrows, for Step 0), `apps/web/src/ui/LobbyFolds.tsx` (the Blackout line)

## Step 0: sync and the fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Nate's solo notes after 32** in `PROGRESS.md`: do the small ones here; list the rest for the orchestrator.
3. **The Rules fold's Blackout line says nothing about the bots (Nate's call, Oct 16):** "Blackout: the map is hidden until you explore it." and no more. The rules reference §11 keeps its paragraph on what the bots know (that's for the curious), without the label's old words.
4. **Two blackout leaks on the page** (the orchestrator's live check; the wire is clean, the honesty test holds, these are the page drawing more than a person should see):
   - **The province outline runs through the cloud.** Select your capital under blackout and the province's gold outline traces every member, unknown ones included: the shape of land you've never seen. Clip the outline (and the province plaque's placement) to known land, so it stops at the cloud's edge; the same for any other outline or glow that follows a province or a realm (a wall's glow, a front's outline, the Steward's realm).
   - **The replay and the report can name or place cloud land.** A Fate closure on a border into the cloud reads "the river crossing between Whitehome and Dawnrest is closed" when Whitehome is unknown; an army marching out of the cloud gets an arrow that starts inside it. Under blackout, an unknown territory in a line a person reads is "the cloud" ("the river crossing from Dawnrest into the cloud is closed"), an arrow out of the cloud starts at the cloud's edge, and a fog-news line never names unknown land. The replay's event data may keep the id (the engine is unchanged); the words and the drawing don't. A test on `replayFor`'s words and the report's lines for a blackout seat.
5. **The start-up bundle sits at 397.9 KB against 398.2.** Nothing in this session belongs in the start-up code; the allowance stays **398.2 KB**. If Step 0's page fixes need room, they load with the game screen, not the lobby.
6. **Commit, deploy, push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Standard-fog games on the twelve official maps are byte for byte the same** after Part 1 (random maps only) and after Part 2 (a blackout-only change to the personalities and the leaders): the `--digest 4 20 --seed s30d` run gives `dc8962d4f8ba3bc6`, the Captain fingerprint `232617a30b1f8b47`, and the same seeded sim at the commit before and after (`pnpm sim --games 40 --players 6 --map wyrmland --bots marshal --seed o33`). If a part needs standard fog to change (say the Turtle's calm margin everywhere), stop and say so in the summary with the numbers; don't re-pin without Nate.
- **Random map version 4:** the graded head start is a new version in `RANDOM_VERSIONS`; versions 2 and 3 still build, so running games and saves keep their maps (the test from session 31). The lobby's card says what a random map's harder spots get, in one line.
- **Balance values in `packages/content`** (the grade's shape, the blackout adjustments per personality, the leaders' blackout settings), with Zod schemas; the content-equals-its-schema test keeps passing.
- **Bots never cheat:** nothing here reads beyond the known map; the scrambled-unknown test (`apps/sim/test/blackout-honest.test.ts`) keeps passing after every part.
- **Every new line a player reads** in the voice (`docs/voice-guide.md`); no sarcasm in the Rules fold or the lobby's cards.

## Part 1: random maps' graded head start (the first deploy)
1. **The grade:** for each random layout, rank the spots by exposure (`exposureOf`, the safest first). The safest spot gets nothing. Every other spot gets a head start that grows with how exposed it is: the default to try first is **`bonus = round(k × (e − e₀) / e₀)`** with `e₀` the safest spot's exposure, capped at the official maps' top weak-spot bonus (+6), with `k` a content value (start at 3). Keep `harder` as it is (the most exposed third of the table, for the seat rule: bots take those first). Version 4 in `RANDOM_VERSIONS` with `band: 4.0` and the grade; the lobby's random-map card says "Exposed spots start with extra troops (up to 6)."
2. **The sim, in the background as Step 0 runs:** 100 maps a size (`s30-sims.ts --random <size>:all:100 <players> --seed s33`), all Marshals, by exposure rank against fair, exactly as sessions 30 and 31 tabled it, plus the harder spots' wins, turns and within 40. **The bar: every size within ±5 by exposure** (4 players: 40 and 80; 6: 120; 8: 200). Then tune `k` (three settings, say what each did: 2, 3, 4 or whatever the first run suggests) and the cap if a size misses. If the safest spot still runs ahead at 200 (8 players) with the grade, try the grade against the middle spot instead of the safest (every spot above the middle gets a start, so the safest spot's rivals are lifted, not every seat) and say which won. If no setting brings a size inside ±5, say so with the numbers and ship the best one.
3. **The seeds that pass** (the band is unchanged, so about the same as session 31: one in six to three in ten fail; the lobby rerolls by itself since 32) and the official maps unchanged (the digest).
4. **Write-up:** `docs/sim-results-m5-random-maps.md` gains "Session 33: the graded head start" (the table by size and setting, the shipped grade, the reading); `docs/rules-reference.md` §12 (Random maps: the head start in one sentence); `docs/decisions.md`. **Tests:** version 4 pinned (a seed at each size), versions 2 and 3 still build the same maps, the grade's arithmetic, the lobby's line in the voice. **Deploy. Commit and push.**

## Part 2: the Turtle, the Opportunist and your leaders under blackout (the second deploy)
1. **What the numbers say (session 32):** the Turtle stays "calm" until its strike turn (14) and its chains need 2.2 times the odds, so under blackout, where every chain already stops at the cloud's edge, it sees the least and grows the slowest; the Opportunist feeds on the fights it finds. Switching the explore drive off changes neither, so these are personality matters.
2. **Blackout adjustments per personality, in content:** a `blackout` block on a personality (`personalities.json`) that overrides a few of its attack values only when `view.settings.fog === "blackout"`: the Turtle's `calmMargin` and `strikeTurn` (try 1.6 and 10 first), the Opportunist's `vulture` or whatever drives it to found fights (try half). Nothing changes with standard fog (the fingerprint and the digest say so). Read the override in one place (where the personality is applied), not scattered through the plan.
3. **Your leaders under blackout** (the delegating seat): the generals' chains stop at the cloud's edge like everyone's; give the Leader's military command and the Steward's realm the same explore term the Marshal has (content: `explore.leaders`), and let the Leader hire Scouts under blackout as the Marshal does. The council's lines don't change.
4. **The sims, in the background (the bars decide):**
   - **Each personality under blackout** (`tournament.ts --table embervale:4 --seats marshal-<p>,marshal,marshal,marshal --games 300 --fog blackout --seed s33`, and the same with standard fog for the pair): **each within 0.2 × fair of its standard number** (fair 25%, so within 5 points). The Turtle and the Opportunist are the two to fix; check the other four don't move.
   - **The delegating seat on Wyrmland 6 under blackout** (`s23-tables.ts delegate 300 wyrmland:6 s33 --fog blackout`): **within 0.2 of its standard 1.54× fair.**
   - **The headline again** (300 all-Marshal games, Embervale 4 and Wyrmland 6, blackout): still within ±5 by seat, turns within 3 of standard, the explore pace about where session 32 left it (half the map by turn 5 on Embervale).
   - Three settings tried at most per knob; say what each did. If a bar is still missed, ship the closest and say so with the numbers.
5. **Write-up:** `docs/sim-results-m5-blackout.md` gains "Session 33: the personalities and your leaders" (the tables, the shipped values, the reading); `docs/04-design-additions.md` §4 and §12 a BUILT line each; `docs/decisions.md`. **Tests:** the override applies only under blackout (a Turtle's orders identical with standard fog before and after), the leaders' explore term zero with standard fog, the honesty test. **Deploy. Commit and push.**

## Part 3 (can slip to 33b): the blackout bot line
1. **A Marshal's one line about the cloud** (session 32 skipped it): once a game, in the table chat, when its own replay showed a stretch of cloud lifting: "Nothing but cloud past the river, until today." in the voice, written from its own replay, never naming unknown land, under the chat's limits from session 29 (one bot line a bot a turn, two a turn, three turns apart). The fog-wire test with a planted leak (a fogged name on the line) must fail. **Commit and push.**

## Last: the test list
- **"Things to test after session 33"** in `PROGRESS.md`, most important first: a random 120 or 200 and the start of the game (does the head start read on the first turn's report?); a blackout game against Marshals with the personalities shown (Rules: Show the Marshals' personalities): does the Turtle still turtle?; Step 0's fixes (the province outline stops at the cloud; a replay's arrow out of the cloud; the Rules fold's line); carry over what Nate hasn't tried.
- `PROGRESS.md` (sessions completed: 33), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 34 and after)
- Bigger tables and the sim's numbers for them, the map lab off in production, abuse limits (34); launch polish and a load test (35); sign-in and Workers Paid (36); the purchase and the site (37); battle royale (38); a top-tier bot above the Marshal (later).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- Standard fog unchanged after each part: the digest `dc8962d4f8ba3bc6`, the Captain fingerprint `232617a30b1f8b47`, the seeded sim identical before and after. The honesty test passes.
- The random-map table by exposure at every size, with the shipped grade; the personalities' and the delegating seat's blackout numbers against their bars; the headline again.
- The start-up bundle within the allowance (398.2 KB); the lock check passes on every deploy; running games survive each deploy.
- A random 120 started on the preview in Nate's Chrome (the first turn's report says who got what head start), and a blackout game's first turn with the province outline stopping at the cloud (a screenshot of each).

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 33b)
- Step 0: what Nate's notes changed (one line each), the two leaks' fixes in a line each
- the random-map table: each size, each setting tried, by exposure against fair, the shipped grade
- the blackout table: each personality standard against blackout, the delegating seat, the headline again
- the digest, the fingerprint and the seeded sim, unchanged (or exactly what changed and why, if a part had to)
- the deployed version
