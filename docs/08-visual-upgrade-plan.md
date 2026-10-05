# Visual Review and Upgrade Plan

*Written Oct 4 (orchestrator), after Nate's play test of session 8. Nate's verdict: "the visuals still need to be cleaned up and improved." This is the orchestrator's own look at the game (the screenshots in `docs/art/screens/` and the art in `apps/web/public/art/`), followed by the plan to raise it in steps.*

## What Nate saw
- **Connections:** some passes are so slim the range looks closed. Some territories don't look like they touch, but they do.
- **Provinces** (the "countries" that give a bonus): you can't tell where their borders are or what holding one is worth.
- **Buildings** look like a soft ghost image, not like something standing on the map the way the capital does.
- **The maps** are one big round landmass. Nate wants bigger maps, with more imaginative shapes.

## What the orchestrator found
**The map: clarity (the most urgent)**
1. **Hairline borders are real.**
   - Measured from the map data:
     - Embervale has 8 land borders under a quarter of the usual length. The shortest is about 5% of it.
     - Greatmarch has 13; one is 0.6 map units, practically a single point.
   - The two territories count as neighbours, but on screen they look like they only meet at a corner.
2. **Passes are 10–35% as wide as a normal border.** At Mid and Far zoom the pass road disappears into the range, so the range looks unbroken.
3. **Nothing shows what's connected.** Selecting a territory doesn't mark its neighbours, so you can't check before you plan.
4. **Territory edges are faint.** Inside one House's land, and between neutral lands, the dividing lines are thin and low-contrast, so it's hard to count territories.
5. **Province borders look the same as territory borders.** Province names are large, faint lettering that runs under armies, and the bonus only shows in the territory card's small text.

**Buildings**
1. A building sprite is drawn **26 map units wide**, about a quarter of a territory and much smaller than the capital's castle, with no base or shadow to sit on.
2. **While it's being built it's drawn at 45% opacity.** A fort takes until the end of the next turn, so for a whole turn it's literally a ghost.
3. The art itself is good: the fort, market, barracks and watchtower sprites match the capital. The problem is size, opacity and grounding.

**Colour and painting**
1. House washes vary in strength. Or (gold) turns grassland a muddy yellow at Mid zoom; Azure and Gules read better.
2. The pines are still round bushes (`tree-conifer-1`/`-2`), and forests are uniform blobs.
3. Mountain ranges read as grey rubble lines rather than ranges. The rock, snow and hills textures still have big built-in shapes.
4. The saved **Tactical view** screenshot (`embervale-tactical.png`) looks almost the same as the painted Far view. Tactical is meant to be flat House colours, so check it.

**Menus (desktop)**
1. The right column and the bottom dock cover nearly half the screen, so the map feels cramped. The army panel is wide but mostly empty.
2. The panel text is dense and grey ("Pinemark (+3 if you hold it all) · plains, defense ×1, +2 gold"). "Culture 0 of 5" doesn't say what culture does.
3. Turn report messages are technical ("Your order didn't happen: condition not met: odds") and don't say which order.

## The plan, in three steps
**Session 9: clarity fixes.** These matter for every game played from now on.
- **Connections:**
  - The map maker stops making hairline borders: a minimum shared border length, otherwise the two aren't neighbours.
  - Passes get a minimum width, with a clear road and gate.
  - Embervale and Greatmarch are rebuilt.
  - Selecting a territory marks every neighbour you can reach, with a small link mark across each border (and the sea lane lit up).
- **Edges and provinces:**
  - Clearer territory edges at every zoom.
  - Province borders get their own style (a gilded double line).
  - Each province gets a plaque: its name, its bonus, and how much of it you hold ("Pinemark +3 · you hold 3 of 5").
- **Buildings stand on the map:**
  - about twice the size, on a ground shadow like the capital
  - a scaffolding look while being built, not transparency
  - a solid icon on the troop pill
- **Panel and report wording:** plain words, icons, and the culture explanation.

**Session 10: bigger, more varied maps** (with the map lab).
- **Map shapes:**
  - island chains
  - twin continents
  - an inland sea
  - a crescent
  - a "fantasy land" silhouette drawn from a shape mask
- **Sizes:** a 40-territory quick map stays; new maps are 60–120 territories.
- The map lab is where these get made, judged and simulated.

**Session 11: the big visual upgrade.** A new art batch from Nate (Gemini, using the prompt pack), then a renderer pass. *(Oct 5: the batch is "Batch 3" in `docs/art/asset-list-and-prompts.md`, made with `docs/prompts/gemini-art-session-03.md`. Session 11's prompt is `docs/prompts/claude-code-session-11.md`.)*
- **New art:**
  - pines that look like pines
  - better rock, snow and hills textures
  - mountain-range pieces with more variety, and cliffs along coasts
  - building construction sprites, a pass gate, bridges
  - province plaque and banner frames
  - a few landmarks (ruins, standing stones, lighthouses) to make each map memorable
- **Renderer pass:**
  - per-House wash tuning, so no colour muddies the ground
  - richer forests: clusters, edges, clearings
  - mountain ranges drawn as ranges
  - coast cliffs and surf
  - a softer, more painterly Far view
  - Tactical view checked to be truly flat
- **Menus:**
  - a more compact desktop layout that gives the map more room (merge the territory card and army panel; a collapsible dock)
  - clearer type sizes
- **Judged on the art test bench** (built in session 10) before and after, with screenshots side by side. The "before" set is in `docs/art/screens/bench/` (`pnpm map-check bench` retakes it; see `docs/07-map-tooling.md`, "The art test bench").

### Session 11: what got done (Oct 5)
Art batch 3 hadn't been made yet, so every new piece is built and placed but keeps today's drawing until its art is imported (see `docs/07-map-tooling.md`, "When art batch 3 arrives").
- [x] The six new maps are official and in the lobby (eight maps); each map's data loads only when a game on it starts.
- [ ] Pines that look like pines; better rock, snow and hills textures: **waiting for batch 3** (nothing to change in code: they import by name).
- [x] Mountain ranges drawn as ranges: chains along each range's spine, passes left open (ridge art waiting for batch 3; today's peaks stand in).
- [x] Coasts: cliffs on high, straight, open coasts (art waiting for batch 3) and a painted surf line (done).
- [x] Pass gatehouses, the wooden bridge, scaffolding, landmarks and the plaque frame: placed by rules, art waiting for batch 3. Stone bridges now stand at river crossings (there were none before).
- [x] House washes: painted by the map's shader so each House keeps its own hue on every ground (Or no longer mustard on grass).
- [x] Forests: pines high and north, broadleaf low and south, with glades.
- [x] A softer, more painterly Far view; Tactical checked truly flat.
- [x] Desktop: one merged panel for the selected territory, a foldable dock, one type scale. Phone unchanged (6 taps on 384 px).
- [x] Judged on the bench: before and after side by side in `docs/art/screens/compare/`.
- [ ] Wyrmland redrawn from the Gemini dragon outline: **waiting for batch 3** (it keeps today's dragon).

**Guardrails still apply:** the painting never carries game state, the info layer reads at every zoom, and Tactical view is one tap away.
