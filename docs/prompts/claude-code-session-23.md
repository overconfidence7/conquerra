# Claude Code: Session 23 (M3: bots and balance: your leaders' last fixes, the Marshal learns, a head start for the weak spots)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It runs long simulations (use all the machine's workers), takes screenshots and deploys. It doesn't touch `art/incoming/`.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is bots and balance, the last M3 session before sound.** Four things Nate has already decided:
1. **A Steward with nothing worth building hands back** whatever its purse holds over two turns of its budget, with a reason (and the handout lines written in session 22).
2. **A remnant judged honestly under fog:** no "Finishing them off: Duke Varric (17 territories left)" on turn 6.
3. **The Marshal learns from your leaders** (Nate's rule: a leader that beats the Marshals across map types is a behaviour the Marshals adopt): **the Merchant's lesson** (markets that pay back come before forts that aren't urgent) for the Marshal and the Neutral Steward, and **the Steward's plan** (where to build, and walls) for the Marshal. Then the delegating seat is re-checked at fair on every table.
4. **A head start for the weak capital spots:** **extra troops at the capital** (Nate, Oct 10), sized per map and table size by the sims.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (Part 1 onward), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order, and each ends with a deploy,** so the session is complete at any part boundary. Whatever isn't reached becomes session 23b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build.

**Long simulations:** run them in the background with every worker the machine has, and keep working while they run. Save each run's raw output under `docs/sims/s23-*.txt`. Compare planning times only side by side on this machine, never against an old number.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: session 22 and "Oct 10: Orchestrator review of session 22"
3. `docs/decisions.md`, the Oct 9 and 10 lines at the bottom (Nate's calls after 20b and 20d, the remnant default, the start bonus form)
4. `docs/04-design-additions.md` §4 and §11 (leaders and the Marshal), §15 ("Nate's calls after 20d")
5. `docs/sim-results-m3-leaders.md` (sessions 20, 20c, 20d: the purse, the finish, the fog sweep, the Steward's plan and walls), `docs/sim-results-m3-balance.md` ("Fair seats (session 20b)": the spot table and "Maps that would still need a start bonus"), `docs/sim-results-m3-walls.md`, `docs/sim-results-m3-marshal.md`
6. `docs/voice-guide.md` and **`docs/voice/nate-picks-oct10.md`** (Step 0 applies it)
7. The code: `packages/bots/src/marshal/leaders.ts` (the Steward's plan, `planned`), `packages/bots/src/marshal/plan.ts` (the "Finishing them off" status, cleaning up), the Marshal's building, `packages/content/data/lines.json`, the scripts in `apps/sim/scripts/` (`s18-variant.ts`, `s20-marshal.ts`, `s20d-purse.ts`, `s20d-walls.ts`, `s20b-fair-seats.ts` and `s20b-harness.ts`, `captain-fingerprint.ts`)

## Step 0: sync, Nate's picks, two nits, the comeback card, the baseline
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Apply Nate's picks** (`docs/voice/nate-picks-oct10.md`) to `lines.json`: keep and drop versions as listed, add his Merchant line ("The math isn't mathing here."), add `{turn}` to the captured leader's first report, replace the Blitzer's lobby blurb. Let the library's three-version minimum skip situations Nate has picked (a flag in the data the test reads). Regenerate `docs/voice/lines-for-nate.md`.
3. **Two nits from the review:** the Fallen's uprising line in `apps/web/src/logic/narrate.ts` still says "its 1 rebels" (`cards.ts` was fixed, this one wasn't); fix the plural there and anywhere else a count meets a noun (search for `${...} rebels`, `troops`, `territories` built without a plural check).
4. **A comeback title card** (Nate, Oct 10): when **your own House** falls to a quarter of the most land it ever held and later climbs back above half of it, a title card plays with a sarcastic subline (three to five versions in the line library, in the voice: "Rumours of our death were premature." style, your own words). **Yours only:** a rival's land size is hidden (the Players panel shows no territory counts), so a card about a rival's comeback would give away what the fog hides. Once per game. Tests: the rule, once only, nothing for rivals.
5. **The baseline, before changing any bot:** with seeds of your own, run and save
   - the delegating seat (Leader 80%, Steward 20%) against Marshals: `s18-variant.ts delegate-80 marshal embervale 4 300`, `wyrmland 6 300`, `rootholm 8 300`
   - all-Marshal tables: `s20-marshal.ts` (game length, the halfway leader's win rate, how often a game hits the turn cap) on Embervale 4, Wyrmland 6, Rootholm 8
   - each Marshal personality's win rate on the same tables (they should still play differently afterwards)
   - planning time per bot per turn (`s19-speed.ts`)
   - `captain-fingerprint.ts` (the Captain must not change in this session)
6. **Commit and push.** (Run the full `pnpm test` before this and every push, and re-pin any pinned test in the same commit as the change that moves it.)

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`.** The start bonus (Part 3) is the only rule change, and it ships with engine tests and the determinism test.
- **Bots never cheat:** the Marshal and your leaders judge only from their own view. The sweep covers the fog because the remnant *could* be there, never because the planner peeked.
- **The Captain doesn't change** (its fingerprint stays). The Recruit stays easy.
- **Personalities keep playing differently:** after Part 2, each Marshal personality's win rate and style (how much it builds, how often it walls, how fast it attacks) should still differ the way they did; a change that makes all six play alike is a regression.
- **Game length:** all-Marshal tables stay within Nate's 30 to 40 turns on the mid-size maps (Embervale 4 about 22 today, Wyrmland 6 about 36, Rootholm 8 about 44). Report before and after; if Part 2 makes games longer by more than about 3 turns on any table, stop and say so.
- **Planning time:** no more than 20% slower per bot per turn than the baseline, side by side on this machine.
- **Every number re-run with fresh seeds** before it goes in a doc (300 games is about ±2.5 points).
- **The words are session 22's voice:** any new line goes in the line library with versions, passes the voice test, and follows the guide.
- **Screenshots** (desktop and 384 px phone) for anything a player sees: `docs/art/screens/s23-*.png`.

## Part 1: your leaders' last fixes (idle gold handed back, a remnant judged honestly)
1. **Idle gold handed back** (Nate, Oct 10): a Steward (and a Leader on a realm command) with **nothing worth building** hands back whatever its purse holds **over two turns of its budget**, at the end of the turn, into your gold. The report says so in the Steward's voice with the amount and the reason (the handout lines: "Sent {n} gold back. Wanted the peasants to have something."). "Nothing worth building" is the planner's own judgement (no building it would choose this turn, nothing it is saving toward that it can afford within two turns). Tests: it never hands back gold it is saving for something it will buy within two turns; the amount is exact; the purse shown afterwards is right. Check it on the turn-54 save from session 21 (811 gold in purses): what's handed back, and what stays.
2. **A remnant judged honestly under fog** (orchestrator default, Oct 10): before cleaning up, a rival counts as "down to a handful" only when **its known land plus the fogged land it could plausibly hold** (the sweep's "might be" set) is a handful. No "Finishing them off: Duke Varric (17 territories left)" on turn 6. Cleaning up at 75% of the map (known exactly) is unchanged. Tests: the turn-6 case from session 20d's screenshot, and a real remnant in the fog still counts.
3. Re-run Step 0's delegating seat (Embervale 4 and Rootholm 8) and `s20d-purse.ts`: what changed, in a few lines.
4. Screenshots: the report with a Steward's handout, the Leaders panel afterwards.
5. **Deploy** (`pnpm deploy:preview`, with its lock check). **Commit and push.**

## Part 2: the Marshal learns (the Merchant's lesson, the Steward's plan), then the delegating seat at fair
1. **The Merchant's lesson,** for the Marshal's building and the Neutral Steward: a market that pays for itself before the game is likely to end comes before a fort that isn't urgent (urgent: a rival army that could take the territory next turn, or a wall that's one step from done). Define "pays for itself" from the market's price and income and the turns the game likely has left (from the map's size and the turn), as settings in `packages/content`. The Turtle and the Merchant personalities keep their own leanings (the Turtle still forts first, the Merchant still markets first).
2. **The Steward's plan for the Marshal:** the Marshal's realm share uses the planned Steward (`planned: true`): markets and barracks deep inside, forts on choke points and wall candidates, walls up fast when threatened, its Leader garrisoning the wall. Session 20d left it off for the Marshal on purpose; this is where it goes on.
3. **Measure, side by side with Step 0's baseline (fresh seeds, 300 games a line):**
   - the delegating seat (80/20) against the new Marshals on Embervale 4, Wyrmland 6 and Rootholm 8, and at the other suggested table sizes of three more map types (a 60 to 80, a 100 and a 160 territory map). **Target: within 0.85 to 1.2 times fair on every table.** If the seat is still well above fair on the small tables, say what's left between them; if it falls below 0.85, say why (the Marshals may now be better than your leaders, and the fix belongs to your leaders, not the Marshals).
   - all-Marshal tables: game length, the halfway leader's win rate, the turn cap
   - each personality's win rate and style
   - the Captain's fingerprint (unchanged) and the Recruit against the Captain (still easy)
   - planning time
4. Write it up in `docs/sim-results-m3-leaders.md` (a "Session 23" section, the tables before and after).
5. **Deploy. Commit and push.**

## Part 3: a head start for the weak capital spots (can run long; the rest becomes 23b)
1. **The rule** (Nate, Oct 9 and 10): a capital spot that wins **under half of its fair share** among equal bots starts with **extra troops at its capital**, set per map, table size and spot in the map's data (`packages/content/data/maps/*.json`, beside the pinned layouts). Engine: applied at setup, deterministic, with tests; saved games and replays carry it (bump the save version if the setup changes; older saves load as before).
2. **Readable and fair:** the player sees it. The first turn's report says "Rookhome starts with 4 extra troops (a harder spot)", the territory card shows it on turn 1, and the rules reference explains it in one paragraph. A bot gets the same bonus at the same spot. No spot is ever given less than today.
3. **Sizing, by the sims, after Part 2** (the Marshals changed, so re-measure each spot first): for every spot under half of fair, try +2, +4 and +6 troops (never more than 6, half of a capital's 12 starting troops), 300 fresh games each, and keep **the smallest bonus that brings the spot to at least half of fair without taking it above fair.** If +6 doesn't get it there, keep +6 and list the spot. Use `s20b-harness.ts` (the same games for every option).
4. **Order of the maps** (most played first): Embervale 4 and 6, Wyrmland 6 and 8, Rootholm 8 and 10, then The Shattered Isles, The Moon Coast, The Crownlands, The Sundered Crowns, Krakenmere, Ashwing, The Ringsea, Greatmarch and The Twin Realms at their suggested sizes. **Deploy after the first six tables are done,** then keep going; whatever isn't reached is 23b.
5. **The table:** each map and size, each weak spot, its win rate before (after Part 2's Marshals), the bonus chosen and its win rate after, in `docs/sim-results-m3-balance.md` ("The start bonus (session 23)").
6. **Equal bots exaggerate a weak spot** (session 19): note it in the write-up; Nate's play will tell whether a person at a weak spot still feels behind.
7. Screenshots: the first turn's report with the bonus line, the territory card on turn 1.
8. **Deploy. Commit and push.**

## Last: the write-up, the test list
- `docs/sim-results-m3-leaders.md` and `docs/sim-results-m3-balance.md` as above; `docs/rules-reference.md` (the handout, the start bonus, the comeback card); `docs/04-design-additions.md` (BUILT lines).
- **"Things to test after session 23"** in `PROGRESS.md`, most important first (for example: does your Steward ever hand back gold you wanted spent? Did the Marshals feel tougher? Do they wall up now, and do the walls look right? Start at a weak spot: does the head start feel fair, too much or too little? Did you ever get the comeback card?). Carry over what Nate hasn't tried from "after session 22".
- `PROGRESS.md` (sessions completed: 23; M3 ready to close after Nate's play test, then sound), `docs/decisions.md`.
- **Commit and push.**

## Out of scope
- **Sound:** the next session, after this one.
- **A top-tier bot above the Marshal** (from Nate's own games): later.
- **Art batch 5**, the map builder, M4 (online play, chat, deals between people).
- New controls; any rule change other than the start bonus.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The Captain's fingerprint unchanged; the voice test strict; the determinism test passing.
- The delegating seat's table (before and after) and the start-bonus table in the docs, with the raw runs in `docs/sims/`.
- Every deploy a working build; the final `pnpm deploy:preview` with its lock check.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 23b), and which maps got a start bonus
- the delegating seat before and after on every table measured (as times fair)
- all-Marshal game length and the halfway leader's win rate, before and after
- each personality's win rate before and after
- what the turn-54 save's Steward handed back
- planning time before and after (side by side), the Captain's fingerprint
- the bundle size and the deployed version
