# Claude Code: Session 8 (M3 start: the fog lifts during the replay, smarter bots)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser, a deploy and his phone.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

M2 is done. This session starts M3 with:
- **Part A:** an idea from Nate's phone test: **the fog lifts during the replay**, so he can watch a chain push into land he couldn't see
- **Part B:** **smarter bots**, the planned fix for long games
- **Part C:** a small tip for phones with Chrome's "Desktop site" setting on

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (the last three entries)
3. `docs/decisions.md`, newest lines at the bottom. Especially the Oct 4 lines on:
   - the replay fog
   - bot levels
   - Desktop site
   - runaways
4. `docs/rules-reference.md`:
   - §3–§5 (turns, orders, chaining)
   - §11 (fog and the replay)
   - §12 (choke points)
5. `docs/sim-results-m2-maps.md` ("What the choke points changed") and `docs/sim-results-m2-chaining.md`

## Step 0: sync
1. Run `git --no-optional-locks status`. Nate's folder is behind `main`: the orchestrator pushed docs and this prompt.
2. If anything local is uncommitted, stash it and check it against `main`, as in session 6.
3. Run `git pull` and `pnpm install`. Work on `main` and push to `main`.
4. If `art/incoming/` has new files (Nate may redo `tree-conifer-1`/`-2`), run `pnpm art:import`, check the result in the game, and commit it.

## Part A: the fog lifts during the replay (engine first, with tests)
Today the replay shows the fog as it was at the start of the turn, and the view only updates at the end. So a chain into fogged land plays out in the mist. The new rule (decided Oct 4):

**Vision is worked out step by step through the turn.**
- At the start of the turn, you see exactly what you saw while planning.
- After each step that changes what you can see, your vision is worked out again from the game as it is at that moment. Such steps include:
  - you take land
  - you lose land
  - a watchtower is finished
- When you take a territory, you see it and its neighbours from that step on, with full detail as they are then: owner, troops, specialists, building, culture, Leader. That's the same detail `viewFor` gives.
- When you lose one, land you no longer see fogs over from that step on, showing what you last saw.

**What the replay shows (replaces "visible at the start or end of the turn"):**
- Your own actions and every battle you're in always show.
- Any other event shows in full **if you could see its territory at the moment it happened** (just before or just after it).
- Everything else follows today's fog rules: battles and fallen Leaders become surface details ("a battle in Northreach"), and quiet things don't show.
- Eliminations and the game's end are announced to everyone, as today.

**New replay event:**
- At each step where your vision changes, the replay gets an event listing:
  - the territories you just started seeing, each with its snapshot at that moment
  - the territories that just fogged over
- Only ever what you could really see then.

**"Last seen" memory:**
- Everything you saw during the turn goes into your memory through `recordSighting`, with what you saw at that moment.
- A later sighting in the same turn replaces an earlier one, and the end-of-turn update still happens.
- Land you only saw mid-turn should read naturally on the tap card, for example "Seen last turn".

**Engine constraints:**
- It stays pure and deterministic. If you can, work out the step-by-step vision from the start-of-turn state plus the turn's events, rather than saving extra copies of the game. The event log is what M4's server will store.
- **Fog off:** nothing changes. **Knocked-out players:** still see everything.
- **Speed:** report turn-resolution time before and after (average and worst case, at 4 and 10 players). It must stay comfortably small; it was under 1 ms on average.
- Update `docs/rules-reference.md` §11 in plain language.

**Engine tests:**
- A 3-hop chain into fog reveals the land step by step, in order.
- A rival's battle on land you only saw mid-turn shows in full.
- A rival's action on land that only came into view later in the turn (not when it happened) does not show in full. This is the narrowed rule; say so in the rules.
- Losing land fogs its surroundings from that step.
- The memory records mid-turn sightings, including land you took and then lost again in the same turn.
- **No leaks:** a property test that every replay event and every vision snapshot matches the real game at that step, and only for land the player could see then.
- The determinism test still passes.

**On the screen:**
- The replay starts from the start-of-turn fog. At each vision event, the fog fades off the newly seen land (about 0.3 s) and its troop pills and borders appear; land that fogs over takes the "last seen" look.
- By the end, the map must match the new turn's view exactly, with no jump.
- **Skip** goes straight to the end. **Watch again** starts from the start-of-turn fog again.
- **The replay camera** follows a chain that pushes off screen, as it does for battles.
- **Turn report:** "What came out of the fog" includes things first seen during the turn.
- Keep the timeline and camera logic outside the renderer, and tested.
- Rebuild the info layer only when vision actually changes (remember session 6's replay freeze).

## Part B: smarter bots (a new default level)
- **Bot levels:**
  - Add a new bot level, working name **"Captain"**. Nate may rename it.
  - It becomes the lobby default. Today's Recruit bot stays as the easy level.
  - The lobby gets one more row in the existing segmented style: **Bots: Recruit (easy) / Captain**.
- **Fog-fair:** bots use only `viewFor` (including "last seen" memory). They never peek.
- **What Captain does better.** Keep it a short list of priorities you can explain, not a heavy search:
  1. **Holds choke points cheaply.** On a pass or sea-lane landing facing a rival, it keeps a small garrison and builds a fort there when it can afford one, instead of piling troops everywhere.
  2. **Breaks through with force.** It gathers a real army before attacking through a pass or sea lane, bringing siege if the far side has a fort. Once through, it chains on.
  3. **Lands from the sea.** It plans a landing where the far side is weak.
  4. **Finishes what it starts.** It prefers finishing off a weakened rival. When 3 or fewer players are left, it concentrates on one front and the rival's capital instead of trading land back and forth (the long endgames in the M2 sims).
  5. **Defends its capital** when a big army stands next to it.
  6. **Chains like a person.** It hops on when the next hop is likely to win. Tune the margin and report it.
- **Speed budget:** a Captain turn takes under about 20 ms on Nate's laptop at 10 players (measure it). Bots run in the browser's background worker now, and on the server in M4.
- **Simulator:** 1,000+ games at 2, 4, 6 and 10 players, all-Captain tables, compared with session 7's "after" numbers. Report:
  - average and median game length, and the share of games inside 15–25 turns (**target at 4–6 players: average 25 or under**)
  - seat fairness
  - the runaway check (one player holding over half the map by turn 10)
  - chained hops per game
  - how many battles cross a pass or sea lane (it was under 1 in 20)
  - **mixed tables:** 1 Captain + 3 Recruits at 4 players (Captain should win clearly more than 25%), and 1 Captain vs 1 Recruit
- Write it up as `docs/sim-results-m3-bots.md`, in plain language.
- **Don't change the rules.** If targets are missed, or runaways get worse, describe it and give Nate options. Rule changes belong to the session 14 balance pass.
- **Tests:** Captain only issues legal orders, never reads beyond its view, and is deterministic for a given seed. Include a small scenario test for each priority above (for example, it garrisons a pass it borders).

## Part C: the Desktop site tip
- When the screen facts show a phone-sized touch screen (short side 600 px or less) but the page is much wider than the screen (say, more than 1.5×), show a one-line tip in the lobby and in the game:
  > "Chrome's Desktop site is on, so everything looks small. To fix it, tap ⋮ and untick Desktop site."
- It can be dismissed, and the dismissal is remembered on the device.
- Reuse the facts from `apps/web/src/logic/layout.ts`, and test the check.
- Don't try to rescale the game yourself.

## Out of scope
- **Session 9:** the map lab and the art test bench.
- **Sessions 10–13:** generals, the Fallen, the card decks, diplomacy, spies, culture unlocks.
- **Session 14:** any rule change for runaways or 10-player game length (the balance pass).
- **Phone menu sizes:** Nate says they're fine with Desktop site off. Leave them.
- **M4:** online play.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- `docs/sim-results-m3-bots.md` is written, and the turn-time numbers (before and after Part A) are reported.
- **Screenshots** in `docs/art/screens/`:
  - a replay of a chain into fog at three moments (start, mid-chain with the fog lifted around the first capture, end), desktop and phone: `ui-replay-fog-1/2/3.png` and `ui-replay-fog-phone-2.png`
  - the lobby with the bot level row
  - the Desktop site tip (emulated)
- `pnpm deploy:preview` passes its lock check.
- Then ask Nate to:
  1. tap **Update now** in the installed app
  2. play a game against Captain bots with a 3-minute timer
  3. queue a chain into the fog and watch the fog lift during the replay
  4. say whether the bots feel smarter

  Record what he says.
- `PROGRESS.md`, `docs/decisions.md` and `docs/rules-reference.md` are updated in simple language, with "Claude Code sessions completed" bumped to 8.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the replay rule change in one sentence, and anything it hid that used to show
- the turn-time and bot-time numbers
- the sim table (Captain vs session 7), and the mixed-table win rates
- the screenshot paths
- what Nate said after playing
