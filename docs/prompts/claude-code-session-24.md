# Claude Code: Session 24 (M3: sound, the last M3 session)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It downloads sound packs, needs his browser (the sound bench, screenshots) and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is sound.** Nate wants the game to feel like a large, well-funded team made it; session 21 did the look, and sound is the other half: a march drum, the clash of steel, a fanfare on a capture, the thud of the wax seal, coins, and quiet music under planning (`docs/09-polish-and-effects-plan.md` §9). **The source (Nate, Oct 11): free packs whose licenses allow commercial use, first.** Any sound that turns out weak can be upgraded later from a paid pack or an AI tool, so build the pipeline so a sound can be swapped by replacing one file.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (Part 2 onward), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order, and each from Part 2 on ends with a deploy,** so the session is complete at any part boundary. Whatever isn't reached becomes session 24b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: sessions 21 to 23 and "Oct 11: Orchestrator review of session 23"
3. `docs/09-polish-and-effects-plan.md` (the whole plan, §9 sound, and "The rules every effect follows": sound follows the same rules)
4. `docs/decisions.md`, the Oct 6 lines on libraries (@pixi/sound v6, MIT) and the Oct 10 to 11 lines at the bottom
5. `docs/rules-reference.md` §10 (the replay)
6. The code: `apps/web/src/replay/` (the timeline, the effects layer and how it follows the replay's clock: pause, Skip, "Watch again"), `apps/web/src/replay/fx/recipes.ts` (recipes as data with a schema: do the same for sound cues), Settings (`apps/web/src/ui/`, the Effects setting), the art importer (`packages/art/src/import.ts`) and art bench (`?lab=bench`) as patterns for the sound importer and the sound bench

## Step 0: sync and the small fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **The report repeats itself when a Steward raises culture several levels:** session 23's turn-55 report has one line per level ("raised culture at Larkgarth to 2 (4 gold)", "to 3 (6 gold)", "to 4", "to 5"). Group them: "Your Steward, Odo, raised culture at Larkgarth from 1 to 5 (28 gold)." Same for recruits at one place in one turn. The Chronicle the same way.
3. **Two wording nits:** a Fate card with a plural name reads "Squalls at sea strikes Hollydale" (make the verb agree, or phrase it "Fate on your land: squalls at sea at Hollydale"); the handout line says "Odo handed 908 gold back from its purse" (say "the purse": leaders are people).
4. **Commit and push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Licenses first, always.** Use only sounds whose license allows commercial use in a paid game: CC0 / public domain is best; CC-BY is allowed with credit; **never** "non-commercial", "personal use only", "editorial", or a license you can't find. Record every file's source page, author, license and date downloaded in `docs/sound/credits.md` (and as data the game reads, see Part 1). If a site needs an account to download (Freesound does), stop and ask Nate to download those files into `sound/incoming/` himself (it stays out of git, like `art/incoming/`).
- **Sound never carries game state** (the same rule as effects): with sound off, nothing is missing. A fogged event gets the same generic distant rumble whatever it was; no sound hints at what the fog hides.
- **Deterministic:** cues are driven by the replay's clock, so pause, Skip, scrub and "Watch again" sound the same; where a cue has variants (three sword clashes), the pick is seeded from the game's public id, the turn and the event, never `Math.random()`.
- **Never annoying:** a cap on how many sounds play at once (about 6 on a phone, 12 on a laptop), the same cue never stacks more than twice in 100 ms, music ducks under big moments (a capital falling, game over), nothing loud or sharp on taps. Loudness normalized across all files (pick a target and say it).
- **Separate from Effects:** Settings gets **Sound: Master, Music, Effects (sound effects) volumes and a Mute**, remembered on the device. Effects: Off does not silence sound, and Mute does not change the visual effects. Default: on at a moderate volume, music lower than effects.
- **Phones:** browsers only allow sound after the first tap, so unlock audio on the first tap anywhere (the lobby's buttons count) and never show an error. Sound pauses when the tab is hidden.
- **Size and speed:** the start-up bundle unchanged (within 2 KB of 489.8 KB): @pixi/sound and every sound load with the game screen, not the lobby (the title music is the exception: it loads after the first tap). Total sound for a first game **under about 4 MB** (compressed; music streamed or loaded after the effects). Use a format every target browser plays (check Android Chrome and iOS Safari; mp3 or m4a are safe). The replay's frame rate on the phone profile stays where session 21 left it (within noise).
- **No new controls in the game screen** beyond the Settings rows; keep the tap counts.

## Part 1: the sound list, the sources, the importer
1. **The sound list** (`docs/sound/sound-list.md`), most important first, about 40 cues. A starting list (adjust it, keep the order):
   - **Replay:** an army marching (a drum or boots, by army size: small, medium, large), a battle (sword clashes, shouts, arrows from walls), a siege stone landing, a capture (a short fanfare for yours, a lower horn for a rival's), a capital falling (a big, heavy hit and a bell), a House knocked out (a fading drum), a Leader falling, recruits marching out, a wall going up, a building finished (a hammer and a thump), the fog's pulse (a generic distant rumble)
   - **Fate, the Fallen, deals, spies:** a short signature each (Fate's card flip, the Fallen's low choir hit, a deal sealed with a wax stamp, a deal broken with a crack, a spy's whisper, "Caught")
   - **Planning and menus:** the seal's press when you lock in, coins (spending, income), the timer's last 10 seconds (soft ticks), a panel opening (very soft), a Spoils card turned in, the turn sweep, a notice
   - **Music:** a quiet planning loop, a replay loop (more drive), the title screen, a victory sting and a defeat sting
   - **Ambience (Part 4):** wind, sea and birds under the map, quiet
2. **Find the sounds** from free sources that allow commercial use (for example packs released as CC0, and CC0 music); check each license on the source's own page and keep a copy of the license text. Prefer whole packs with one consistent sound over a mix of mismatched files. Note any cue you couldn't fill well (for 24b or a paid pack later).
3. **The importer** (`pnpm sound:import`, from `sound/incoming/` like the art): trims silence, normalizes loudness, converts to the game's format, names files by cue (`sfx-battle-1`, `music-planning`), and writes the registry the game reads with each file's license and credit. **Tests:** every registered cue has a file and a credits entry with an allowed license; a file with no license entry fails the test; the registry's names match the sound list.
4. **Credits on screen:** if any file is CC-BY, a "Credits" line in Settings opens a short list (author, title, license). With CC0 only, still list the packs (it's polite and it's how a sound gets traced later).
5. **Commit and push.**

## Part 2: the replay's sound (and the first deploy)
1. **The sound layer** on @pixi/sound v6 (MIT), cues as data with a schema (like the effect recipes): which files, volume, pitch range, how they scale with troop counts, which beat they follow. Driven by the replay's clock; pause, Skip and "Watch again" behave like the effects.
2. **Every replay event gets its cue** from the list (marches, battles, captures, a capital falling, knock-outs, Leaders, walls, buildings, recruits; Fate, the Fallen, deals and spies). Fogged events: the generic distant rumble, nothing else (add a test like the effects' fog test).
3. **Settings:** Master, Music, Effects volumes and Mute (remembered on the device), with the first-tap unlock.
4. **The sound bench** (`?lab=sound`, like the art bench): every cue with a play button, its variants, its file, size, loudness and license, and a "play a turn" button that plays a recorded replay's cues in order. **This is how Nate reviews the sounds:** he opens the bench and marks what he'd change.
5. Measure: the replay's frame rate on the phone profile with sound on (before and after), the sound loaded for a first game (MB), the start-up bundle.
6. **Deploy** (`pnpm deploy:preview`, with its lock check). **Commit and push.**

## Part 3: menus and music
1. **Menu and planning sounds:** the seal's press, coins, the timer's last 10 seconds, the turn sweep, notices, Spoils, cards; soft and short, never on every tap.
2. **Music:** the planning loop under planning, the replay loop under the replay (crossfades between them, about 1 s), the title music after the first tap, the victory and defeat stings on game over (the music ducks under them). Music never starts over on every turn (it carries on through the turn's loop).
3. Screenshots: Settings with the sound rows (desktop and phone), the sound bench.
4. **Deploy. Commit and push.**

## Part 4 (can slip to 24b): ambience
1. A quiet bed under the map while planning: wind, the sea where the camera shows coast, birds now and then; it follows the zoom (closer is a little louder) and never covers the effects. A setting would be one more row: put it under Music's volume instead.
2. **Deploy. Commit and push.**

## Last: the write-up, the test list
- `docs/09-polish-and-effects-plan.md` §9: a BUILT block (the sources, the cue count, the sizes, the loudness target, the frame rate).
- `docs/sound/credits.md` complete; `docs/rules-reference.md` (Settings: the sound rows, in one short paragraph).
- **"Things to test after session 24"** in `PROGRESS.md`, most important first (for example: open the sound bench on the laptop and mark any cue you'd change; play a whole game on the phone with sound: too loud, too busy, ever annoying? Does the music get repetitive? Does a capital falling sound big enough?). Carry over what Nate hasn't tried from "after session 23".
- `PROGRESS.md` (sessions completed: 24; M3 done when Nate's play test is in), `docs/decisions.md`.
- **Commit and push.**

## Out of scope
- **Session 25 (bots and balance, part two), after Nate's play test:** a wall's stacking defense bonus (Nate, Oct 11) and the seat rule (weak capital spots go to bots first). Don't touch the engine or the bots here.
- Voice acting, a paid sound pack, an AI audio tool (later, only for cues that stay weak).
- Art batch 5, the map builder, M4.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- Every sound file has a recorded source and an allowed license (the test enforces it).
- The start-up bundle within 2 KB of 489.8 KB; sound for a first game under about 4 MB; the replay's phone frame rate within noise of session 21's.
- Every deploy a working build; the final `pnpm deploy:preview` with its lock check.
- The sound bench deployed, screenshots of Settings and the bench, and the docs above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 24b)
- the sources used (packs, licenses) and any cue left weak or empty
- the number of cues and files, the total size for a first game, the loudness target
- the replay's frame rate on the phone profile before and after, the start-up bundle
- anything Nate had to download himself
- the deployed version
