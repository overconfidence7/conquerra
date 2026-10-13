# The polish pass: replay effects, a living map and menus with weight

*Written by the orchestrator on Oct 6, at Nate's request: "I want this game to look like a large development team with a good budget made it, so visuals are important. Special effects would be a fun add too for the playback portion of the game." The art comes from Gemini in **art batch 4** (`docs/art/asset-list-and-prompts.md`, Tier 3, "Batch 4"). The code comes in **Claude Code session 21**, after the Marshal (17), the leaders (18), the bigger maps and balance pass (19) and the play-test fixes and balance follow-up (20). Nate can cut or reorder anything here.*

## What "a big team made this" means here
Big-studio strategy games feel polished for a handful of reasons, and most are about motion and consistency rather than more detail:
1. **Nothing just appears.** Every change on the map has a short, physical cause: an army marches and kicks up dust, a banner falls and another is raised, a fort is built as its scaffold drops away.
2. **The important moments are bigger.** A capital falling is not the same size of event as a skirmish over a farm. Effects, camera and pacing scale with what's at stake.
3. **The world is alive while you think.** Water moves, clouds drift, smoke rises from chimneys, and flags flutter, quietly.
4. **The menus have weight.** Buttons press, panels ease in, numbers roll, and the wax seal thuds when you lock in.
5. **It's consistent.** One light direction, one palette, one set of materials (gold, parchment, wax, ink, steel), used everywhere.
6. **It never gets in the way.** Effects are short, readable and skippable, and the info layer always tells the truth.

## The rules every effect follows
- **The info layer still carries the game.** Effects decorate what happened; they never replace the pills, borders and report. A player who switches effects off loses nothing but the show.
- **Effects fit inside today's replay timing.** The replay's length cap (about 20 s median) stays. Effects play within each beat, and Skip still skips.
- **The same replay looks the same every time:** effects are seeded from the game and the event, so "Watch again" matches.
- **Fog is respected:** a fogged event stays "something stirs": a soft generic pulse, never a colour or shape that hints at what it was.
- **A setting, "Effects: Full / Light / Off",** in Settings. Light halves the particles and drops camera shake and screen flashes. A phone that drops below about 50 fps in the replay moves to Light by itself. "Reduce motion" in the device's settings starts on Light.
- **Budget:** about 600 particles at once on a phone and 2,000 on desktop; pooled sprites; no new start-up weight (the effects load with the game screen).

## 1. A cinematic replay
- **Replay mode looks different from planning:** thin dark bars top and bottom (letterbox), a soft vignette, and a slightly warmer, golden-hour grade over the painted map. Planning is the map table; the replay is the story. It eases in over half a second as the replay starts and out as it ends.
- **The camera moves like a camera:** smooth eased pans, a gentle push-in on big moments (a capital, a knock-out, a battle with many troops), and a slow pull-out at the end of the turn.
- **Big-moment title cards:** a short banner across the top for the moments that matter: "Galeholt falls to House Gules", "House Vert is no more", "Lady Morwen breaks the truce". At most one or two a turn.

**BUILT (session 21):** letterbox, vignette and a warm grade ease in and out over half a second (not on Effects Off); the camera pushes in on a capital falling and on very big battles (30+ troops) and pulls out slowly as the turn ends; title cards for a capital falling, a House knocked out and a deal broken (at most two a turn, never two at once, never for anything fogged). `replay/titles.ts`, `replay/camera.ts`, `ui/replay.css`.

## 2. Armies on the move
- **A marching army is an army,** not a disc: the House-tinted soldier figure (`figure-army`) with its banner, bobbing as it walks, the troop number on a small pill beside it. Cavalry trots faster with more dust. Ships cross sea lanes on the `ship` sprite, bobbing, with a small wake.
- **The order arrow unrolls ahead of the army** like an inked campaign line, gold-trimmed, and fades behind it.
- **Feet raise dust** on land (`fx-dust`), with terrain flavour: snow powder in the mountains, mud flecks in swamp, a splash at a river ford (`fx-splash`).
- **Right of passage:** the path through a partner's land is drawn in white stitches, matching the map.

**BUILT (session 21):** House-tinted soldiers (cavalry when the army has cavalry) with their banner, bobbing; ships with a wake on sea lanes; the inked, gold-trimmed campaign line unrolling ahead and fading behind; dust in the ground's colour (snow powder, mud flecks), a splash at fords; passage in white stitches. The troop number rides beside them (and is all there is on Effects Off).

## 3. Battles
- **Armies meet at the border, not at the territory's middle.** The clash plays out where they meet.
- **The fight:** a swirling cloud of dust and smoke (`fx-smoke`, `fx-dust`), steel glints and sparks (drawn in code), and a few arrow volleys from the defender (`fx-arrow`). From behind a fort, the volleys come from the walls. A Siege engine lobs a stone (`fx-stone`) that lands in a puff of debris (`fx-impact`). Terrain flavour as above.
- **The size of the fight shows:** more troops, a bigger cloud, more volleys. A light camera shake on big battles (off on Light).
- **The result:**
  - **Captured:** the old banner topples and the new House's banner is raised (`banner-flag`, tinted), with a ripple of the new colour sweeping across the territory's border band and a short gold shimmer.
  - **Held:** the defender's shield flashes, and the attackers fall back in a drift of smoke.
  - **Losses** float up from each side as two small ink-and-gold numbers and fade. The plaque stays, made nicer.
- **A capital falls:** the big one. A push-in, smoke columns and embers over the castle (`fx-smoke`, `fx-flame`, code embers), the banner change, the title card, and a slow pull-out.
- **A House is knocked out:** its banner burns away (`fx-flame` over the banner), its last land washes to the conqueror's colour, and the title card "House Vert is no more".

**BUILT (session 21):** armies meet at the border (the middle of the longest stretch they share); smoke, dust, sparks and steel glints, the defenders' arrows (from the walls behind a fort or a wall), a Siege stone landing in debris with a shockwave ring; more troops, more smoke; a light shake on big battles (Full only). Captured: the old banner topples, the new one rises, a ripple of the new colour round the land, a gold shimmer. Held: the shield flashes, the attackers fall back in smoke. Losses float up from each side. A capital: smoke columns, flames and embers, the push-in, the title card. A knock-out: its last banner burns away, "House Azure is no more". *Not yet:* the shockwave as a real distortion filter (pixi-filters was allowed; a ring does the job without the cost).

## 4. Building, recruiting, gold
- **Recruits** march out of the castle gate as a few small figures with a puff of dust, and their number pops.
- **Buildings:** the scaffold rises as building starts. When it's finished, the scaffold drops away in a puff of sawdust (`fx-dust`) and a glint.
- **Culture raised:** golden laurel leaves (`fx-leaf`) drift up from the territory with a soft glow ring.
- **Gold at the start of the turn:** a few coins (`fx-coin`) fly from your land to the gold counter, which rolls up to the new total.
- **Turning in Spoils:** the three cards fan out and burst into the windfall (troops march out, a fort's scaffold drops, laurels rise).

**BUILT (session 21):** recruits march out in a puff of dust; the scaffold rises as building starts and drops away in sawdust with a glint; laurels and a glow ring for culture; coins fly to the gold counter as the replay ends and it rolls up; the Spoils cards fan out and burst in gold.

## 5. Fate and the Fallen
Each event gets its own short signature, readable at a glance:

| Event | Effect |
|---|---|
| A bountiful harvest | golden wheat motes (`fx-wheat`) drift up, warm glow |
| A hidden hoard | a burst of coin glints (`fx-coin`) |
| A wandering band, veterans return, mercenaries | a small group of figures arrives in a puff of dust |
| Pilgrims | soft lantern lights move in, laurel leaves |
| Master masons | the scaffold drops away, as for a finished building |
| A flooded ford | water spreads along the river crossing (`fx-splash`, code ripples); the crossing shows closed |
| A rockslide | rocks tumble into the pass (`fx-rock`) with dust; the gate shows barred |
| Squalls at sea, the Fallen's storm | a dark storm cloud (`fx-storm-cloud`) over the lane, rain streaks (code), a lightning flash (`fx-lightning`) |
| Fire in the works | flames (`fx-flame`) and smoke on the scaffold |
| Camp fever, plague | a sickly green-grey mist (`fx-wisp`, tinted) creeps over the land |
| Blight, famine | the ground's colour drains briefly to brown, with a few drifting dead leaves |
| An uprising | torch flames and red flicker; rebels' figures appear |

Under fog, all of these are the same soft "something stirs" pulse.

**BUILT (session 21):** every row of the table, as written (`replay/fx/recipes.ts`); the fogged ones stay the same soft pulse (now without the coloured dot that hinted at a battle).

## 6. Diplomacy and spies
- **A deal is sealed:** a parchment scroll (`fx-scroll`) unrolls between the two banners and the wax seal (`seal`) stamps down. A truce border draws itself in white stitches; a joint war shows two banners crossing over the target.
- **A deal is broken:** the scroll tears, a red crack (`fx-crack`) runs along the truce border, and an Oathbreaker brand stamps onto the breaker's portrait in the Players panel.
- **Spies:** a hooded figure (`figure-spy`) fades in and out in a wisp of smoke. An infiltration opens an eye over the province. A caught spy shows a red stamp ("caught").

**BUILT (session 21):** the scroll unrolls between the two banners and the seal stamps down in gold flecks; a truce or passage border stitches itself in white; a joint war's banners cross; a broken deal: a red crack and torn parchment, and the Oathbreaker mark stamps onto the name in the Players panel; your spies: the hooded figure in a wisp, the eye over a province it got into, a red "Caught". (Spies report as the turn ends, so they play over its last moments: no new time.)

## 7. A living map (always on, quiet)
- **Water:** a gentle moving shimmer on the sea and lakes, foam along the coasts that breathes in and out, and boats bobbing on sea lanes.
- **Clouds** (`cloud-*`) drift slowly across at Far and Mid, with their shadows on the land.
- **Chimney smoke** curls up from villages, towns and capitals (`fx-smoke`, small and slow).
- **Windmills turn** (`landmark-windmill-sails` over the body), **flags flutter** on capitals, and **the lighthouse beam** sweeps at Mid.
- **Birds** (`fx-birds`) cross the map now and then.
- **Fog mist drifts.**
- All of this pauses when the tab is hidden, and goes to Light when the device asks for less motion.

**BUILT (session 21):** clouds drifting at Far and Mid with shadows, chimney smoke (at most 20 chimneys on screen, 10 on Light), windmills turning, flags on the capitals in the owner's colour, the lighthouse beam at Mid, boats bobbing, birds every 40 s (not on Light), breathing coastal foam (the water's shimmer and the fog's mist were already in the shader). Under every border and pill. It costs about 0.4–1 ms a frame on the throttled phone at Mid (a frame or two a second at 60). `render/pixi/living.ts`.

## 8. Menus with weight
- **Lock in:** the wax seal stamps down with a small press and a scatter of gold flecks. The turn timer glows like an ember in its last 10 seconds.
- **Turn change:** "Turn 8" sweeps across with the compass emblem, briefly.
- **Panels** ease in and out; buttons press down; the gold trim catches a slow glint on hover (desktop).
- **Numbers roll** (gold, troops) instead of jumping.
- **The turn report's lines** come in one by one.
- **Title screen:** the new key art (`art-title`) with slow drifting clouds over it (parallax). The lobby sits over it.
- **Game over:** full illustrations for victory (`art-victory`) and defeat (`art-defeat`), with drifting embers or petals.

**BUILT (session 21):** the seal presses with gold flecks; the timer glows like an ember in its last 10 seconds; "Turn N" sweeps across with the compass emblem; panels ease in; buttons press; a slow gold glint on hover (desktop, in the game); gold rolls up; the report's lines come in one by one; clouds drift over the title art (two depths); embers over a defeat, petals over a victory. All short, none blocks a tap; Reduce motion turns them off.

## 9. Sound (Nate, Oct 7: its own session, after the language pass; not part of the polish pass)
Sound is the other half of feeling expensive: a march drum, the clash of steel, a fanfare on a capture, the thud of the wax seal, coins, and quiet music under planning. It needs a source (a licensed sound pack, or an AI audio tool whose terms allow commercial use) and a volume setting.

**BUILT (session 24):** 41 cues and 56 files (`docs/sound/sound-list.md`), all from **25 CC0 sources** downloaded without an account (Kenney's RPG Audio, Impact Sounds, Casino Audio and Interface Sounds; rubberduck's CC0 packs; artisticdude; Vehicle's Tinysized SFX; William Hector's war drums; StumpyStrust's horn; Thimras; StarNinjas; NenadSimic; OwlishMedia; railkill; and RandomMind's "Medieval" music series, one composer for all five tracks). Every source's page, author, license and date: `docs/sound/credits.md` (written by the importer), license texts in `docs/sound/licenses/`, and Settings → Credits.
- **The importer** (`pnpm sound:import`, `packages/sound`): mixes each file from layers cut from the packs (`data/recipe.json`), trims silence, normalises loudness, limits peaks at 4× the sample rate, encodes MP3 (every browser plays it), names files by cue and writes the registry with each file's sources. To swap one sound: drop a file named like it in `sound/incoming/replace/`, add its credit, re-run. Tests: every file has a credits entry with an allowed license, a file without one fails, the list, recipe and registry agree.
- **Loudness:** effects −16 LUFS at their loudest moment (momentary, 400 ms), music −18 LUFS and ambience −24 LUFS integrated, every peak under −1 dBTP. The sharpest clicks (ticks, a card, a shield) sit under the target: the limiter holds them, as it should for taps.
- **Size:** effects 602 KB, music 2.36 MB, ambience 603 KB (3.5 MB in all). A first game loads the effects (with the game screen), the title, planning and replay music and one sting (streamed), and the ambience: **3.1 MB of distinct files** (3.3 with a sting; measured fetches were 3.9 to 4.0 MB because a streaming audio element asks for parts of a long file more than once). The lobby loads no sound until the first tap, and then only the title music. Start-up bundle 489.8 → **491.2 KB** (the first-tap unlock and the title music's hook).
- **How it plays:** cues are data with a schema (`apps/web/src/sound/cues.ts`: files, volume, pitch range, troop scaling, which beat, priority, cooldown, ducking); the replay's sounds are worked out from its timeline (`sound/plan.ts`) and fired as its clock passes them, seeded from the public id, the turn and the event, so "Watch again" sounds the same and Skip stops them. Fogged events are one distant rumble per beat, the same whatever they were (tested by swapping what each fogged event was). @pixi/sound v6 for effects (loaded with the game screen, handed the first tap's audio context); music and ambience stream from audio elements through the same context (an 80 s loop decoded whole would hold about 28 MB).
- **Never annoying:** 6 sounds at once on a phone, 12 on a laptop (a more important one takes the least one's place); the same cue at most twice in 100 ms; cooldowns (a capture's fanfare at most every 2.5 s, a rival's horn every 3.5 s and never for neutral land); music dips under a capital falling, a knock-out, a Leader falling, the Fallen; nothing on a tap is loud; nothing plays while the tab is hidden.
- **Frame rate** (phone profile, 384 px, CPU 4×, fog lifted, three turns, the same pinned game muted and with sound; `docs/sound/perf-s24.json`): Wyrmland 6 muted 63.8, 81.8 and 72.9 fps, with sound 73.7, 83.4 and 88.0; Krakenmere 10 muted 74.9, 66.2 and 61.5, with sound 57.4, 64.5 and 57.7 (the third pass with music and ambience in; `perf-s24-final.json`). Two muted runs of the same game differ by up to 28% on this machine, so sound's cost is inside the noise (Krakenmere averaged about 10% lower with sound: watch it on the phone). Session 21's were 93 and 79 on Full (another game). A profile of a replay with sound on shows nothing from the sound library in the main thread's time.
- *Weak or makeshift, for later (a paid pack or an AI tool):* no real whisper for a spy, the capture "fanfare" is the Victory theme's first bar (no brass call), the march is drums only, the Fallen's choir is a chant over a sting, the title music is a 42 s loop.

## How it's built (for Claude Code, session 21)
- **An effects layer in Pixi** with a small pooled particle system (sprites with normal, additive and screen blending), driven by the replay timeline's progress so effects pause, scrub and skip with it.
- **Effect recipes as data** (one per beat kind and event: which textures, how many, how they move and fade, and how they scale with troop counts), so tuning doesn't need code changes.
- **The importer learns "fx-" art:** these are painted on pure black. The importer turns brightness into transparency and keeps the colour, so smoke and flames have soft edges with no fringe. Magenta-background `fx-` pieces (coin, arrow, stone, rocks, leaf, wheat, scroll, storm cloud, birds) are cut out as usual.
- **Libraries (Oct 6, at Nate's request):** stay on **PixiJS v8** (free, open source, MIT, and already the game's engine; a switch would be a rewrite). Add **pixi-filters** v6 (MIT) for the filters below. **@pixi/sound** v6 (MIT) if Nate wants sound. **Build the particles in-house** on PixiJS's own `ParticleContainer`, not with an off-the-shelf emitter: those simulate frame by frame with random numbers, so effects couldn't follow the replay's clock (pause, skip, "Watch again") or stay seeded. No tweening library: a small set of easing functions is enough (GSAP is free but not open source, and not needed).
- **Already in by then:** the end-of-game power graph and awards and the Chronicle (session 16); the polish pass gives them their finish.
- **Filters, only where they're worth their cost:** a shockwave ripple for siege impacts and a capital falling; a soft glow on gold; a displacement shimmer on water. Check the frame rate on a phone after each one.
- **Checks:** frame rate in the replay on a 384 px phone profile (aim for at least 50 fps on Full); the replay's length unchanged; the bundle at start-up unchanged; screenshots and a short screen recording (GIF) of a turn's replay for Nate.

## What session 21 built, in numbers
- **The replay got faster before it got prettier.** On the 384 px phone profile (CPU slowed 4×, three turns with the fog lifted, `s21-perf.mjs`) the replay ran at **4.9 fps on Wyrmland 6 and 1.3 on Krakenmere 10** at the session's start: every event redrew every border, rebuilt all 200 markers and every realm. With all the effects on, at the end: **Wyrmland 6: 93 fps on Full, 108 on Light; Krakenmere 10: 79 on Full (its busiest turn 48), 81 on Light** (the laptop: 200–300). Full table in PROGRESS.md, session 21.
- **Particle budget:** 600 on a phone, 2,000 on a laptop; a busy moment uses 60–90 on Full, 35–40 on Light.
- **The replay's length is unchanged** (the timeline wasn't touched; the 10–20 s median test passes): effects play inside each beat, and what a result leaves behind drifts on for at most 1.6 s over the next beat.
- **Start-up bundle:** 486.3 → 491.2 KB (gzip 149.3 → 150.8): batch 4's names in the art list, Step 0's notices, the title art's styles. The effects, their recipes, the fx art and the living map load with the game screen.

## Order of work in session 21 (most visible first; one session, stop cleanly at a part boundary if it runs low)
1. The importer's `fx-` rule, the effects layer and the Effects setting.
2. Armies on the move and battles (§2, §3), the capital falling and knock-outs.
3. The cinematic replay (§1).
4. Building, recruiting, gold, Spoils (§4), then Fate, the Fallen, diplomacy and spies (§5, §6).
5. The living map (§7).
6. Menus with weight, the title screen and game over (§8).

### Nate's calls after playing session 24's sound (Oct 13; session 25b)
- **Music at about a fifth of today's level.** The default Music slider comes down accordingly, and the music files themselves are quieter (so the slider has room both ways).
- **The sliders set the level directly.** Moving Music made it fade in and out; a slider move is a level change, instant and monotonic, never a crossfade or a duck.
- **The replay's sounds, far simpler and shorter.** They overlapped and cut into the enjoyment of the replay. Orchestrator defaults for 25b: at most two effects at once during the replay, one per beat; marches only for armies of 20 or more; one short clash per battle (under 0.6 s); a short tap for a capture; the long beds (the crowd, the drum loop) cut to a second or less; the fog's rumble one per beat as today. The busy turn on the bench (61 sounds in 20 s) should come down to about 20.
- **"Losing a territory" (a rival takes your land) sounds like an error.** Replace it: a short low drum hit, not a horn.
