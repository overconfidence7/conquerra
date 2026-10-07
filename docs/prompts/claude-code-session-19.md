# Claude Code: Session 19 (M3: the balance pass, and bigger maps)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser (the map lab), and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session:** the balance pass Nate has been waiting for before his next play test, and two bigger maps. **Nate plays right after this session**, so what he plays should feel right: games long enough to matter, bots that are hard and team up on a runaway, culture and buildings that are worth their gold, and knocked-out players still having fun.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 5 ends with the deploy, so the session is complete there.** If time is short, the ~200-territory map (in Part 4) is the piece that can slip to session 20; say so.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: Nate's play test of sessions 11–15, the orchestrator's reviews of sessions 16–18, and **"Things to test after session 19"** (what Nate will try next)
3. `docs/decisions.md`, newest lines at the bottom (Nate's calls of Oct 6–7)
4. `docs/04-design-additions.md` §0, §4 (leaders), §11 (the Marshal, and Nate's calls after session 17), §12 (bigger maps), §9 (maps: real geography)
5. The sim write-ups: `docs/sim-results-m3-leaders.md`, `docs/sim-results-m3-marshal.md`, `docs/sim-results-s16.md`
6. `docs/07-map-tooling.md` (the map lab, land shapes, making a map official) and `docs/maps/candidates.md`
7. `docs/rules-reference.md` (§7 culture, §10 buildings, §16 the Fallen, §14–15 leaders)

## Step 0: sync, and one small fix
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Don't import art batch 4** (session 20 does).
3. **Small fix from session 18:** the "keep or let go" dialog lists only captured Leaders; captured Stewards over the cap go by default. List both kinds.
4. **Commit and push.**

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **Nate's standing calls on balance:**
  - **Game length is measured in turns: up to 30–40.** Bigger maps and 10-player games may run longer. Nate felt his 12-turn game was far too short.
  - **Fix runaways and the small-map snowball in the bots first.** Rule changes only where Nate has asked for one (below), or as options with numbers in your summary.
  - **Culture and buildings must pay:** test three levers; Nate picks (below).
  - **The Fallen act from their first turn out** (Nate: "the goal is to keep people knocked out still engaged in the game so everyone is still having fun").
- **The Marshal never cheats,** and personality stays play style, never extra power.
- **Keep the Captain unchanged** (its fingerprint test) and **the Recruit easy.**
- **Saves:** migrate if the game's shape changes; the old fixtures keep loading.
- **Every claim gets numbers:** 300 games a line at least (500 for the headline table), seats rotated.

## Part 1: the Marshal must be at least as good as your leaders
- Session 18 found, and the orchestrator re-ran: a player who hands everything to their leaders (`delegate-80`: the Leader on "Run the military" with 80% of the income, the Steward on "Run the realm" with 20%) **beats a table of Marshals 37.0% of the time on Embervale** (fair 25%), and 1.46× fair on Wyrmland. The leaders use the Marshal's own brain on less gold, so something differs.
- **Find out why**, with one-change tests:
  - Is the leader's planning path ("leader" scope, "Run the military", Expand's steering) better than the Marshal's own realm plan?
  - Does the Steward's 20% (forts, markets, barracks where needed) help more than the Marshal's own building?
  - Does a delegating player get more orders, or better timing in the round-robin, than a single planner would?
  - Anything else it turns up.
- **Then fix it the right way:**
  - If the leaders plan better, the Marshal adopts it: every Marshal plays at least as well as a fully delegating player (target: `delegate-80` against Marshals at about its fair share).
  - If it's an edge only delegating gives (more orders or better timing than one plan should have), make it fair.
- Re-run the tournament headline (one Marshal of each personality against Captains, and the strong stand-in on Wyrmland) to show the Marshal is no weaker anywhere.
- **Commit and push.**

## Part 2: culture and buildings that pay (three levers; Nate picks)
Session 17 found that culture and buildings don't pay back ("culture on safe land loses games"). Session 18's default Steward builds now, but costs wins on small maps for that reason.
- **Test the three levers Nate named,** each on its own and in sensible pairs, against today:
  1. **More income per culture level** (for example +1 gold a turn per level instead of +0.5)
  2. **Bigger markets** (more gold a turn, or cheaper)
  3. **Cheaper forts** (or quicker to build)
- **For each, measure:** does a Captain with the default Steward (`captain-steward-20`) now do at least as well as a plain Captain on Embervale and Wyrmland? Do Marshals' personalities that build (the Turtle, the Merchant) climb toward fair? What happens to game length and runaways? Does the "what wins" analysis now find building and culture worth doing at the right moments?
- **Pick the best one as the new default** (numbers in `packages/content`), and record it as **"pending Nate's pick"**: write all three in a short table in your summary, with your recommendation, so Nate can choose differently.
- **Then set the default Steward share** (20% today) where it helps: a person who never touches their leaders shouldn't be weaker for it.
- **Commit and push.**

## Part 3: the Fallen from their first turn, the small-map snowball, and runaways
- **The Fallen act from their first turn out (Nate):** a newly knocked-out player can make a world event on their very first turn as one of the Fallen (for example, they start with enough Influence for one of the cheaper events). The Fallen bots do the same. Keep the caps (no capitals, no knock-outs, one event per living player per turn). Make sure the Fallen screen appears straight away and makes it obvious what they can do now. Report what it does to length and comebacks.
- **The small-map snowball (Nate: bots first):** with 4 Marshals on Embervale, one holds half the map by turn 10 in 70% of games, and games last about 21 turns. Have Marshals at small tables read a runaway sooner and gang up harder (joint wars that actually attack, not just get signed), without making 6- and 10-player games drag. Target: well under half of 4-player Embervale games with a half-map player by turn 10, and games in the mid-20s or longer. If the bots can't get there, list rule options with numbers (don't make them).
- **Runaways at every table:** the halfway leader wins about 65–87% today. Bring it down where the bots can (the Marshal's estimates of hidden land, earlier and stickier joint wars, the Fallen's first-turn events). Report the three runaway measures before and after.
- **Commit and push.**

## Part 4: bigger maps (Nate: about 160 and 200 territories)
Nate: Wyrmland (120) "felt like a good size for a 6-player game but on the smaller side; we may need to go much bigger for some larger battles or if we want longer games."
- **Make two new official maps in the map lab:** about **160 territories** (suggested for 6–8 players) and about **200** (suggested for 8–10).
  - Imaginative shapes with clear provinces, real geography (`04-design-additions.md` §9): ranges with passes, rivers with crossings, coasts and sea lanes, a few choke points worth fighting over.
  - Use the existing recipes and checks (`07-map-tooling.md`); show **12-seed galleries** and the Far picture of your best two candidates for each.
  - **Nate OKs the Far picture** before a map becomes official. He's at the computer while you work: show him the candidates and wait for his pick. If he's away, pick the best, make it official, and mark it **"pending Nate's OK"** in `docs/maps/candidates.md`.
  - Names in the game's style, capital layouts with fair seats (check them in the sim), and a line in the lobby saying who each map suits.
- **Speed and memory on a phone:** paint time, texture memory (with session 16's Near tiles), panning and replay frame rate on a 384 px phone profile, and planning time at 10 players. Report anything slow, with the cause. If the 200 map is too heavy for a phone, say so with numbers and suggest a fix (don't build a whole new renderer).
- **Sims on the new maps:** length, within 40, runaways, seat fairness at their suggested table sizes.
- **Commit and push.**

## Part 5: the balance table, the M3 checklist, deploy
- **`docs/sim-results-m3-balance.md`**, with a short "what changed and why" at the top, and the headline table (500 games a line, Marshals unless noted):
  - every official map at its suggested table sizes: length, within 40, the three runaway measures, comebacks, seat fairness
  - **each system's cost in turns** (the Fallen, Spoils, Fate, diplomacy, spies, leaders), each switched off on its own against everything on, at 4, 6 and 10 players
  - the Recruit stays easy: a stand-in for a new player (the Captain) against three Recruits on Embervale should win most games
  - **a speed check before M4:** resolving and all bots planning, average and worst, at 10 players on the ~200 map with every system on
- **An M3 checklist** at the end: each M3 item in `docs/03-build-plan.md` marked done, partly done (what's missing) or moved, so the orchestrator can close M3 after session 20.
- **Rules reference:** everything this session changed, and "Not in yet".
- **Screenshots** (desktop and a 384 px phone), in `docs/art/screens/s19-*.png`: each new map at Far and Mid; the Fallen's screen on their first turn out.
- `pnpm deploy:preview` passes its lock check.
- **"Things to test after session 19"** in `PROGRESS.md`: add this session's items (for example: a 6–8 player game on the ~160 map; does culture or building now feel worth it; get knocked out on purpose once and try the Fallen's first turn; on Embervale against 3 Marshals, does the game last longer and does someone run away less?). Put the most important tries at the top: this is the list Nate plays from.
- **Commit and push.**

## Out of scope
- **Session 20:** the polish pass (`docs/09-polish-and-effects-plan.md`) with art batch 4's import.
- **M4:** online play.
- **Not in this session:** new systems, the Steward portraits, shared sight between partners.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` twice before your last push** (property tests use random inputs), and ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- `docs/sim-results-m3-balance.md` with the M3 checklist, the new maps official (or marked pending Nate's OK), the screenshots, and `pnpm deploy:preview` with its lock check.
- **"Things to test after session 19" is complete and ordered** (Nate plays from it next).
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **19**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- why the delegating player beat the Marshals, and what you changed
- the three culture and building levers in a small table (your pick marked, pending Nate's)
- the Fallen's first turn, the snowball and runaways: before and after
- the new maps: names, sizes, suggested players, Nate's OK (or pending), and phone speed
- the headline balance table (length and runaways at 4, 6, 8, 10 players) and each system's cost in turns
- the screenshot paths
