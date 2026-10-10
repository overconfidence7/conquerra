# Claude Code: Session 22 (M3: the language pass, every word in Nate's voice)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser for screenshots and it deploys. It doesn't touch `art/incoming/`, so a Gemini art chat could run alongside it, but two sessions at once share Nate's usage window.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is the language pass.** Nate (Oct 7): make every piece of writing in the game feel less like AI wrote it, written in his own voice, with a different tone for each bot personality and the leaders' voices. **The reference is `docs/voice-guide.md`**, built on Oct 10 from Nate's own writing-style skill ("nate-voice"). If that skill is available to you in Claude Code, load it too; where the two differ, the skill wins for tone and the guide wins for how the game stores and tests its lines. **What the bots and leaders decide does not change in this session, only what they say** (session 23 is bots and balance).

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (Part 2 onward), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order, and each from Part 2 on ends with a deploy,** so the session is complete at any part boundary. Whatever isn't reached becomes session 22b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build (the full test suite runs inside `pnpm deploy:preview`).

## Read first, in this order
1. `CLAUDE.md`
2. **`docs/voice-guide.md`** (the whole thing: the hard rules, the humor density table, the six personalities, the sample rewrites, how lines are stored)
3. `PROGRESS.md`: session 21 and "Oct 10: Orchestrator review of session 21" (the three replay fixes for Step 0)
4. `docs/04-design-additions.md` §13 (voice and chat: what's this session and what waits for M4), §4 and §11 (leaders and the Marshal's personalities)
5. `docs/decisions.md`, the Oct 10 lines at the bottom
6. `docs/rules-reference.md` (you rewrite it in Part 4), §10 (the replay), the leaders' and diplomacy sections
7. The code where the words are:
   - `packages/content/data/personalities.json` (each personality's `voice` block) and its schema
   - `packages/bots/src/marshal/talk.ts`, `packages/bots/src/diplomacy*` (deal answers and their plain reasons), `packages/bots/src/marshal/plan.ts` (the Leaders panel's status lines, like "Finishing them off")
   - `apps/web/src/logic/text.ts` and `narrate.ts` (the report and the Chronicle), the title cards and banners in `apps/web/src/ui/GameScreen.tsx` and `apps/web/src/replay/`
   - every other `apps/web/src/ui/*.tsx` (buttons, tooltips, notices, toasts, the lobby, Settings, the deal cards, the Leaders panel, game over and the awards)

## Step 0: sync, and three fixes from the orchestrator's review of session 21
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **On the laptop, the replay is half hidden.** During the replay the territory panel (`.selcell`) and the order dock stay open over the map, and the cinematic letterbox sits under them (see `docs/art/screens/s21-fx-*.png` and `s21-replay.gif`: about 40% of the map is covered). The phone already closes its sheet during the replay. On the desktop, **slide the territory panel and the order dock out of the way while the replay plays** (ease them out and back in, about 0.3 s, Reduce motion means no slide), and bring them back as they were when the replay ends or is skipped. The Houses column and the top bar stay. Make sure the letterbox and vignette show at full width. Screenshot it at 1440 px and at 1024 px.
3. **The same news, twice.** When a title card plays for an event (a capital falls, a House is knocked out, a deal broken), the small event banner for that same event doesn't show (today: "You capture Whitemarch" banner, then "Whitemarch falls to you" card right under it, in `s21-cine-title.png` and `s21-fx-capital.png`). One headline per event.
4. **The floating words over the map** during the replay ("Fire" in `s21-cine-fate.png`, "culture" in `s21-cine-laurels.png`) are plain white system text, some lowercase. Give them the same styling as the info layer's other pops (the game's display font, a dark outline or plate, the House or event colour) and a capital first letter. Part 4 gives them their final words.
5. **Before changing any words, record the baseline** for Part 1's "nothing but the words changed" check: `pnpm sim --games 50 --players 6 --bots marshal --map wyrmland --diplomacy on --seed s22base` and `pnpm sim --games 50 --players 4 --mix marshal-blitzer,captain,captain,captain --seed s22base`. Keep both outputs (winners, turns, deal counts) in a scratch file outside the repo.
6. **Commit and push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`.** The engine doesn't change. The bots' **decisions** don't change: only the text they attach.
- **The voice guide's hard rules apply to every line a player can read:** no dashes in prose, no semicolons, no arrows in prose, none of the banned words, no rhetorical questions, one exclamation point at most and only on a pleasantry or a win, never "champs."
- **Keep the specifics.** Every line keeps its names, places, numbers and its one plain reason (a deal answer always says why). Making a line shorter by dropping a real detail is a failure.
- **Humor follows the density table:** none in rules, menus, tooltips, odds, errors and the facts of the report; none on a title card when the player loses something big; one dry beat in a bot's line; leaders can breathe. **Receipts:** a joke names the real place, rival or turn. Never cruel, nothing crude, never every turn.
- **Fog respected:** no line reveals anything the reader couldn't know (no bragging about land in their fog, no hint at a hidden personality beyond how it plays). Leaders speak only from their owner's view. Keep the fogged-replay tests passing and add one for the new lines.
- **Deterministic and seeded:** which version of a line is picked comes from the game's public id, the turn and the speaker (never the dice seed, never `Math.random()`), so "Watch again" and a reload say the same thing.
- **Same length on screen:** a line must fit where it shows today at 384 px (the report, the Chronicle, the Leaders panel, the deal card, a title card). Check the longest version of each.
- **Start-up bundle** within 2 KB of today's 491.2 KB: the line libraries load with the game screen, not the lobby.
- **No new controls,** and keep the tap counts.
- **Screenshots after every part** (desktop and 384 px phone), `docs/art/screens/s22-*.png`, from real saves (the 20d and 21 saves are fine).

## Part 1: the voice in code (the guard rails for every later part)
1. **The voice test:** one test that collects every player-facing string it can reach (the content JSON's lines, the bots' reason strings, the web app's text modules and the UI's literal text; list in the test what it can't reach) and fails on the guide's hard rules: em and en dashes, a spaced hyphen, a semicolon, an arrow in prose, the banned words, "champs", and a question mark in a bot's or leader's line. It will fail at first: keep it in an "expected failures" list that each part shrinks, and make it strict (the list empty) by the end of the session.
2. **The line library:** bot and leader lines move to data in `packages/content` (JSON with a Zod schema): for each personality and each situation, **three to five versions**, with placeholders (`{place}`, `{places}`, `{rival}`, `{n}`, `{capital}`, `{leader}`) checked by the schema. A helper picks the version, seeded from the public id, the turn and the speaker. Tests: every situation has at least three versions for every personality, every placeholder is filled, the pick is deterministic.
3. **"Nothing but the words changed":** re-run Step 0's two sims with the same seed after every part. **Winners, turns and deal counts must match exactly.** If a pinned fingerprint test includes reason text, re-pin it in the same commit and say why in the commit message, and show the decisions underneath didn't move.
- **Commit and push.**

## Part 2: the six bot personalities (and the first deploy)
1. **Rewrite every line in each personality's `voice` block** in its own voice (the guide's table: the Conqueror certain, the Blitzer already moving, the Turtle house-proud about its walls, the Schemer friendly with a quiet tell, the Opportunist practical about others' bad luck, the Merchant at a negotiation with "walk me through"), **three to five versions each**: the yes and no for each deal kind, the offers, the broken-deal line, the "took" line. Start from the guide's sample rewrites.
2. **The shared reasons** every bot gives (in `talk.ts` and the diplomacy module: "You're running away with the map. I won't help you grow.", "I can't spare 12 gold for a binding pact.", "Gladly: Duke Varric is running away with the map.") get the voice of whoever says them: the reason stays exactly as true and as plain, the personality adds its turn of phrase. The Captain and the Recruit (no personality) keep one plain voice.
3. Screenshots: a deal card with each personality's answer (yes and no), an offer from a bot, a broken deal in the report.
4. **Deploy** (`pnpm deploy:preview`, with its lock check). **Commit and push.**

## Part 3: the leaders' voices
Today a leader with a personality says one line when it takes land; a Neutral leader says nothing. **Give your Leader, your Steward and captured leaders a full set**, in their personality's voice (the guide's samples), shown in the turn report, the Chronicle and, for the latest one, the Leaders panel:
- **took land** (the line today, now with versions), **lost land**, **a capture of a capital** (theirs or one they took), **finished a rival** ("We checked the fog twice."), **your capital threatened** (a rival army within 2 steps of the capital's province: "Heads up," what it saw, what it's doing about it), **purse empty** (a grumble, at most once every few turns), **a wall built** (the Steward), **a captured leader's first report** to its new master, **a former rival needled** by a captured leader (rarely)
- **a Neutral leader** gets a plain, brief voice for the same situations, facts only ("Took Ashfell and Pinemark.")
- **not too much:** at most one line per leader per turn, at most three leader lines in a turn's report, and the less important ones (purse empty, needling) give way to the big ones (a capital, a threat, a rival finished). Settings in `packages/content` with the lines.
- **The Steward's "gold handed back" line** is session 23's (that's when the rule arrives): write its versions now in the library so 23 only has to call it.
- Screenshots: a report with two leaders speaking, the Chronicle, the Leaders panel with a line, a captured leader's first report.
- **Deploy. Commit and push.**

## Part 4: every other word in the game
Go through every remaining string against the guide, surface by surface, and keep a note of anything you weren't sure about for Nate's sheet (Last):
- **The turn report and the Chronicle:** facts plain and exact (no humor in the fact itself), the turn order without arrows, the Fallen's events, Fate and Spoils, spies, deals
- **Title cards and banners** (session 21 wrote them plain): their final words. No humor on the player's own big losses; one dry beat at most on a rival's misfortune or a broken deal. Step 0's floating words get their final wording.
- **Notices and toasts** (the update notices, "Effects are on Light now", the autosave lines, errors): the point first, then what the player can do
- **The lobby, Settings, the Houses and Leaders panels, the leaders' commands, the deal cards, the path box, the Spoils and Fate cards, game over and the awards:** plain, short, specific. Awards may carry one dry beat from the game's real numbers.
- **Tooltips:** one sentence each
- **`docs/rules-reference.md`:** in the same voice, plain and exact (it's the rules: no humor)
- The map lab and the art bench (`?lab=`) are developer tools: leave them.
- By the end of this part the voice test's expected-failures list is empty.
- Screenshots: the report, the Chronicle, the lobby, Settings, a title card, game over.
- **Deploy. Commit and push.**

## Last: Nate's sheet, the write-up, the test list
- **`docs/voice/lines-for-nate.md`:** every bot and leader line, grouped by personality and situation (all versions), then the title cards, the notices and the awards. At the top, **ten key lines with two or three versions each** for Nate to pick (the lobby's tagline, victory, defeat, your capital falling, a House knocked out, a deal broken, your Leader's first line of a game, your Steward's wall, a captured leader's first report, the Merchant's "no"). Mark anything you weren't sure about. Nate reads this and strikes or changes lines; the next session applies his marks.
- **`docs/voice-guide.md`:** add anything you learned (a rule that needed a clarification, a placeholder that was missing).
- **`docs/04-design-additions.md` §13:** a BUILT block for the language pass.
- **"Things to test after session 22"** in `PROGRESS.md`, most important first (for example: read a whole turn's report: does it sound like you? Do the six personalities sound different in their deal answers? Did a leader ever say too much, or something that didn't happen? Any line you'd never say?). Carry over what Nate hasn't tried from "after session 21".
- `PROGRESS.md` (sessions completed: 22), `docs/decisions.md`.
- **Commit and push.**

## Out of scope
- **Chat** (M4, §13): the chat window, multiple-choice replies, leaders asking you questions, bots threatening and trash talk in chat. This session writes lines for the surfaces that exist today. (Write lines so they can be reused by the chat later: one situation, several versions, the speaker's voice.)
- **Leaders' temperaments** (loyal, hot-headed, cautious, ambitious, dry): later, with the chat.
- **Session 23: bots and balance** (the start bonus, the Marshal adopting the Merchant's lesson and the Steward's plan, idle Steward gold handed back, a remnant judged honestly under fog). Nothing the bots or leaders decide changes here.
- **Sound** (its own session after 23), art, new controls, new rules.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The voice test strict (no expected failures left), or the parts that slipped named with what's left in the list.
- Step 0's sims match exactly after the last part (winners, turns, deal counts).
- The start-up bundle within 2 KB of 491.2 KB.
- Every deploy a working build; the final `pnpm deploy:preview` with its lock check.
- Screenshots for every part reached, `docs/voice/lines-for-nate.md`, and the docs above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 22b)
- the replay fixes from Step 0 (with the screenshot paths)
- the voice test: how many strings it checks, what it can't reach, how many failures there were at the start
- the sims before and after (they must match)
- the number of lines written, by personality and situation
- five lines you're proudest of and five you're least sure of (Nate will read these first)
- the bundle size and the deployed version
