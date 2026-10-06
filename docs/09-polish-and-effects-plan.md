# The polish pass: replay effects, a living map and menus with weight

*Written by the orchestrator on Oct 6, at Nate's request: "I want this game to look like a large development team with a good budget made it, so visuals are important. Special effects would be a fun add too for the playback portion of the game." The art comes from Gemini in **art batch 4** (`docs/art/asset-list-and-prompts.md`, Tier 3, "Batch 4"). The code comes in **Claude Code session 20**, after the Marshal (17), the leaders (18) and the bigger maps and balance pass (19). Nate can cut or reorder anything here.*

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

## 2. Armies on the move
- **A marching army is an army,** not a disc: the House-tinted soldier figure (`figure-army`) with its banner, bobbing as it walks, the troop number on a small pill beside it. Cavalry trots faster with more dust. Ships cross sea lanes on the `ship` sprite, bobbing, with a small wake.
- **The order arrow unrolls ahead of the army** like an inked campaign line, gold-trimmed, and fades behind it.
- **Feet raise dust** on land (`fx-dust`), with terrain flavour: snow powder in the mountains, mud flecks in swamp, a splash at a river ford (`fx-splash`).
- **Right of passage:** the path through a partner's land is drawn in white stitches, matching the map.

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

## 4. Building, recruiting, gold
- **Recruits** march out of the castle gate as a few small figures with a puff of dust, and their number pops.
- **Buildings:** the scaffold rises as building starts. When it's finished, the scaffold drops away in a puff of sawdust (`fx-dust`) and a glint.
- **Culture raised:** golden laurel leaves (`fx-leaf`) drift up from the territory with a soft glow ring.
- **Gold at the start of the turn:** a few coins (`fx-coin`) fly from your land to the gold counter, which rolls up to the new total.
- **Turning in Spoils:** the three cards fan out and burst into the windfall (troops march out, a fort's scaffold drops, laurels rise).

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

## 6. Diplomacy and spies
- **A deal is sealed:** a parchment scroll (`fx-scroll`) unrolls between the two banners and the wax seal (`seal`) stamps down. A truce border draws itself in white stitches; a joint war shows two banners crossing over the target.
- **A deal is broken:** the scroll tears, a red crack (`fx-crack`) runs along the truce border, and an Oathbreaker brand stamps onto the breaker's portrait in the Players panel.
- **Spies:** a hooded figure (`figure-spy`) fades in and out in a wisp of smoke. An infiltration opens an eye over the province. A caught spy shows a red stamp ("caught").

## 7. A living map (always on, quiet)
- **Water:** a gentle moving shimmer on the sea and lakes, foam along the coasts that breathes in and out, and boats bobbing on sea lanes.
- **Clouds** (`cloud-*`) drift slowly across at Far and Mid, with their shadows on the land.
- **Chimney smoke** curls up from villages, towns and capitals (`fx-smoke`, small and slow).
- **Windmills turn** (`landmark-windmill-sails` over the body), **flags flutter** on capitals, and **the lighthouse beam** sweeps at Mid.
- **Birds** (`fx-birds`) cross the map now and then.
- **Fog mist drifts.**
- All of this pauses when the tab is hidden, and goes to Light when the device asks for less motion.

## 8. Menus with weight
- **Lock in:** the wax seal stamps down with a small press and a scatter of gold flecks. The turn timer glows like an ember in its last 10 seconds.
- **Turn change:** "Turn 8" sweeps across with the compass emblem, briefly.
- **Panels** ease in and out; buttons press down; the gold trim catches a slow glint on hover (desktop).
- **Numbers roll** (gold, troops) instead of jumping.
- **The turn report's lines** come in one by one.
- **Title screen:** the new key art (`art-title`) with slow drifting clouds over it (parallax). The lobby sits over it.
- **Game over:** full illustrations for victory (`art-victory`) and defeat (`art-defeat`), with drifting embers or petals.

## 9. Sound (Nate's call, not part of session 20 unless he says so)
Sound is the other half of feeling expensive: a march drum, the clash of steel, a fanfare on a capture, the thud of the wax seal, coins, and quiet music under planning. It needs a source (a licensed sound pack, or an AI audio tool whose terms allow commercial use) and a volume setting.

## How it's built (for Claude Code, session 20)
- **An effects layer in Pixi** with a small pooled particle system (sprites with normal, additive and screen blending), driven by the replay timeline's progress so effects pause, scrub and skip with it.
- **Effect recipes as data** (one per beat kind and event: which textures, how many, how they move and fade, and how they scale with troop counts), so tuning doesn't need code changes.
- **The importer learns "fx-" art:** these are painted on pure black. The importer turns brightness into transparency and keeps the colour, so smoke and flames have soft edges with no fringe. Magenta-background `fx-` pieces (coin, arrow, stone, rocks, leaf, wheat, scroll, storm cloud, birds) are cut out as usual.
- **Libraries (Oct 6, at Nate's request):** stay on **PixiJS v8** (free, open source, MIT, and already the game's engine; a switch would be a rewrite). Add **pixi-filters** v6 (MIT) for the filters below. **@pixi/sound** v6 (MIT) if Nate wants sound. **Build the particles in-house** on PixiJS's own `ParticleContainer`, not with an off-the-shelf emitter: those simulate frame by frame with random numbers, so effects couldn't follow the replay's clock (pause, skip, "Watch again") or stay seeded. No tweening library: a small set of easing functions is enough (GSAP is free but not open source, and not needed).
- **Already in by then:** the end-of-game power graph and awards and the Chronicle (session 16); the polish pass gives them their finish.
- **Filters, only where they're worth their cost:** a shockwave ripple for siege impacts and a capital falling; a soft glow on gold; a displacement shimmer on water. Check the frame rate on a phone after each one.
- **Checks:** frame rate in the replay on a 384 px phone profile (aim for at least 50 fps on Full); the replay's length unchanged; the bundle at start-up unchanged; screenshots and a short screen recording (GIF) of a turn's replay for Nate.

## Order of work in session 20 (most visible first)
1. The importer's `fx-` rule, the effects layer and the Effects setting.
2. Armies on the move and battles (§2, §3), the capital falling and knock-outs.
3. The cinematic replay (§1).
4. Building, recruiting, gold, Spoils (§4), then Fate, the Fallen, diplomacy and spies (§5, §6).
5. The living map (§7).
6. Menus with weight, the title screen and game over (§8).
