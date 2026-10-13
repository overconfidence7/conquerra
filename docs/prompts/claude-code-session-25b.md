# Claude Code: Session 25b (Nate's play-test fixes: sound, the lobby, two controls)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser (screenshots, the sound bench) and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is Nate's play-test notes after sessions 24 and 25** (`PROGRESS.md`, "Oct 13: Nate's play test after sessions 24 and 25"). It runs **before session 26** (the server) so the lobby is redesigned before the Online block lands in it. His notes, in his order: harder spots need no lobby row; the lobby needs a redesign (declutter, dropdowns, smaller text); the sound is too much (music to about a fifth, the slider faded instead of lowering, the replay's sounds overlap and need to be much simpler and shorter, the "losing a territory" sound is terrible); a Recruit-then-Done glitch; clicking your Leader should show where they are.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy, push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order and each ends with a deploy,** so the session is complete at any part boundary. Whatever isn't reached goes to session 26's Step 0; say what's left.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 13: Nate's play test after sessions 24 and 25", "Oct 12: Orchestrator review of session 25", "Oct 11: Orchestrator review of session 24"
3. `docs/09-polish-and-effects-plan.md` §9 and its last block "Nate's calls after playing session 24's sound"; `docs/sound/sound-list.md`; `docs/sound/credits.md` ("How a sound gets replaced")
4. `docs/10-online-plan.md` §4 (the lobby's future: the Online block, seats, colours), `docs/04-design-additions.md` §12 (controls) and §16's last block (the seat rule: no lobby row)
5. `docs/voice-guide.md` (every new line of text follows it; a test enforces the hard rules)
6. The code: `apps/web/src/sound/` (`music.ts`, `duck.ts`, `mixer.ts`, `plan.ts`, `cues.ts`, `settings.ts`), `packages/sound/data/recipe.json` and the importer (`pnpm sound:import`), the sound bench (`?lab=sound`), `apps/web/src/ui/Lobby.tsx` and the lobby's styles in `apps/web/src/styles.css`, `apps/web/src/ui/Panel.tsx` (`RecruitPanel`, its Done), `apps/web/src/store.ts` (`recruitAt`, `closeRecruit`, `quickRecruit`, `select`), `apps/web/src/ui/LeadersPanel.tsx`, the camera (`apps/web/src/map/` or `render/`: how "Fit the whole map" and the minimap move it)

## Step 0: sync, the seat rule's row, the two controls
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Harder spots: no lobby row.** Remove "Harder spots: Bots first / Anyone" from the lobby; new games always deal harder spots to bots first (the setup keeps carrying `seatRule` so saves replay as played; the sims keep their switch). Update `docs/rules-reference.md` and the test list. The "(a harder spot)" notice stays for whoever does land on one.
3. **The Recruit-then-Done glitch.** Reproduce it first: choose Recruit at a territory, tap other territories on the map (recruit sites and not), come back to the first, press Done. Nate needed several presses. Likely each tap on a recruit site opened or re-targeted a recruit order and Done closes one at a time, or the selection and the order being edited disagree. Fix it so one Done always closes the panel and leaves exactly the orders Nate meant (say in the summary what it was). A test on the store reproduces the sequence.
4. **Click your Leader, see where they are.** Tapping your Leader (the Leaders panel, the card's leader line, the left rail's portrait) pans the camera to their territory and pulses it once (the info layer, not the painting). The same for your Steward and captured leaders where they have a place. On the phone the sheet lowers enough to see the map. No new tap for anything else.
5. **Commit and push.** (Run the full `pnpm test` before this and every push.)

## Part 1: sound, quieter and simpler (the first deploy)
1. **Music at about a fifth.** Two changes together: the music files re-imported quieter (target −26 LUFS, from −18; `recipe.json` and the importer; the test's target per kind changes) and the default Music slider at **25%** (from 45%), so the slider has room both ways. Ambience follows the music down (it sits under Music's volume). Nate's "about 20% of what it is now" is the goal at the default; check the numbers (20 log10 of the ratio is about −14 dB: −8 dB from the files and −6 dB from the slider, or close to it).
2. **The sliders set the level, directly.** Moving Music made the music fade in and out. Find why (the duck or the crossfade reacting to a volume change, or a track restarted on each change) and make a slider move an instant, monotonic level change. The same check for Master and Sound effects. A test: a sequence of slider values gives a sequence of gains with no overshoot and no zero between them.
3. **The replay's sounds, much simpler and shorter.** The busy turn on the bench plays 61 sounds in 20 s and they overlap. Orchestrator defaults (Nate can change them from the bench):
   - **at most two effects at once** during the replay (the cap in the planner, not only the mixer), **one per beat** per kind
   - **marches** only for armies of 20 or more (`march-large`); small and medium marches silent
   - **one short clash per battle**, under 0.6 s (re-cut `battle`; `battle-big` and the crowd layer cut to a single short shout or dropped)
   - **a capture:** a short tap (under 0.4 s), not a bar of music; the cooldown stays
   - **a rival takes your land** (`capture-rival`): **replaced**, Nate's words were "sounds like it is erroring": a short low drum hit (the war drums' single hit, under 0.5 s), no horn
   - **the long beds** (the drum loop in marches, the crowd) cut to a second or less wherever they remain
   - **keep as they are:** a capital falling, a knock-out, a Leader falling, the fog's rumble (one per beat), the seal, the coins, the ticks, the sweep
   - every re-cut file goes through `pnpm sound:import` with its credit (all from the same CC0 sources), the sound list and the bench updated, and the loudness tests still pass
4. **Measure on the bench's busy turn:** sounds played (61 before), the most at once (6 before), the total seconds of sound in the 20 s. Target: about 20 sounds, 2 at once, and silence between beats.
5. **Deploy** (`pnpm deploy:preview`, with its lock check). **Commit and push.** Ask Nate to play one replay and the bench's "Play a turn".

## Part 2: the lobby, redesigned (the second deploy)
1. **The goal (Nate):** declutter, dropdowns where possible, smaller text, and room for what's coming (the Online block in session 26: "New online game", "Your online games", seats and colours). Starting a default game stays **one tap** (Start), a custom game a few.
2. **Orchestrator defaults for the layout** (change them if the screen says so, and say why):
   - **In view:** the title and version, **Map** (the picture and name, with the map picker behind it), **Opponents** (the count and level, with the Marshals count behind "Mixed"), **Start**, and **Continue / Load** (as now).
   - **Folded, closed by default, remembered on the device:** **Your House** (house colour, your Leader and Steward: names and personalities), **Rules** (luck, fog, Fate, diplomacy, victory, turn timer). A folded block shows its current choices in one line on its header ("Rules: normal luck, fog on, Fate on, diplomacy on, classic, 5 min") so nothing is hidden.
   - **Text one size smaller** across the lobby (the field names and the choices; the title stays); the blocks' padding tightened; on the phone the whole thing fits in about two screens, the Start button reachable without scrolling past Rules.
   - **Leave a place** for the Online block under the local game (a heading and nothing in it is fine; or the "Online" heading hidden until 26).
   - Keep the key art and the menus' weight (session 21); nothing here changes the game screen.
3. Screenshots: the lobby on desktop and phone, folded and unfolded; the same for "Continue" with saves.
4. **Deploy. Commit and push.**

## Last: the write-up, the test list
- `docs/09-polish-and-effects-plan.md` §9: a BUILT block for 25b (the targets, the cue changes, the busy-turn numbers). `docs/sound/sound-list.md` current. `docs/rules-reference.md` (Settings → Sound defaults, the lobby's new shape in one paragraph, the seat rule's row gone). `docs/decisions.md`: one line per decision.
- **"Things to test after session 25b"** in `PROGRESS.md`, most important first (a replay with sound: simpler now? the music level at the default; the Music slider; the new "rival takes your land" sound; the lobby on the phone; Recruit then other territories then Done; tap your Leader). Carry over what Nate hasn't tried from "after session 25" (holding a wall, a weak spot, the Marshals' feel, the comeback card, the bench cue by cue).
- `PROGRESS.md` (sessions completed: 25b), `docs/decisions.md`.
- **Commit and push.**

## Out of scope
- Session 26 (the server, the Online block itself): next. Don't start it.
- New sounds from paid packs or AI tools; voice acting.
- Anything in the game screen's layout beyond the Leader pan.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The start-up bundle within 2 KB of 492.6 KB; the lock check passes on every deploy.
- The Recruit glitch has a test that failed before the fix; the slider test; the loudness tests at the new targets; the voice test.
- Screenshots of the lobby (both devices, folded and unfolded) and the busy-turn numbers before and after.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (to 26's Step 0)
- what the Recruit glitch was
- the music and slider changes (the numbers), and the busy turn before and after (sounds, most at once, seconds of sound)
- which cues were re-cut, replaced or silenced
- the lobby's new shape in one paragraph, and the tap counts (a default game, a custom game)
- the deployed version
