# Claude Code: Session 4 (Milestone 2, part 3: the illustrated map)

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer: explain choices in plain language and keep setup steps copy-paste simple.

Session 3 built the map maker and rebuilt both maps, with all the drawing data (outlines, biome grid, height map, decorations, label points). **This session replaces the plain SVG map with the illustrated map**: a WebGL renderer in the "Gilded Atlas" style, with relief lighting, a crisp info layer, zoom levels and fog. It also adds "last seen" intel to the engine.

Nate is generating the AI art in parallel. **None has arrived yet** (`art/incoming/` is empty), so everything must work with good-looking placeholders and pick up real art automatically when it lands.

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (including the orchestrator's review of session 3)
3. **`docs/06-art-direction.md`** (the look, the info layer, zoom levels, fog) and the references `docs/art/reference-illustrated.jpg` (the map) and `docs/art/reference-mockup.png` (depth and lighting; its menus are session 5)
4. **`docs/map-data.md`** (what's in the map data and how to read it)
5. `docs/art/asset-list-and-prompts.md` (the file names your art import must recognize)
6. `docs/04-design-additions.md` §8 (fog, last seen, players panel) and §9 (maps)
7. `docs/03-build-plan.md` (the M2 section) and `docs/decisions.md` (newest lines at the bottom)

## Step 0: housekeeping
Commit the orchestrator's doc updates as they are: `PROGRESS.md`, `docs/decisions.md`, `docs/03-build-plan.md`, `docs/04-design-additions.md`, `docs/06-art-direction.md`, this prompt and `docs/prompts/orchestrator-02.md` ("Docs: orchestrator review of session 3, session 4 prompt").

## Part A: "last seen" intel (engine, with tests)
- Each player keeps a memory, inside the game state, of what they last saw on every territory: owner, troops, building and the turn it was seen. It's updated at the end of each turn from that player's vision.
- `viewFor` returns fogged territories with `lastSeen` (or none if never seen). It still never sends anything the player hasn't seen.
- Design it so a fooled spy (M3) can write false entries into this memory later.
- Tests:
  - the memory updates on sight and goes stale in fog
  - it never contains anything the player couldn't have seen
  - the determinism test still passes
- Add it to `docs/rules-reference.md` (fog section).

## Part B: the illustrated renderer (`apps/web`)
Use **PixiJS (WebGL)**. Replace the SVG map; the panels stay as they are (the menu redesign is session 5). Keep the renderer behind a small interface so the UI code just says "show this view, highlight this, draw these orders."

### 1. The world layer, drawn once per game into tiles (not every frame)
- **Ground:** blend the terrain textures by the biome grid, smoothly, with no visible squares. Clip land against the coast and water outlines for crisp shores.
- **Relief lighting from the height map:**
  - soft hill shading lit from the upper left
  - darker, shadowed mountain ranges with visible peaks; ranges must look clearly impassable and different from passable "mountains" territories
  - coastal depth: light shallows fading to deep water, and a soft shoreline
- **Water:** sea and lake textures, with a gentle animated shimmer if it's cheap.
- **Rivers:** drawn along their paths, wider toward the mouth.
- **Passes:** a clear gap with a small road through the range.
- **Sea lanes:** gently curved dotted routes, with a ship sprite.
- **Decorations:** trees, peaks, hills, villages and towns at the map maker's placements, in order (top to bottom), plus a castle at each capital and building sprites at each territory's site.

### 2. The info layer (always crisp, redrawn as the game changes)
- **Owned territories:** a thick House-colored glowing border plus a light tint inside. **Neutral land:** a thin pale line. **Province borders:** heavier. **Province names:** large and curved along `provinceLabels`.
- **Army marker** at each territory's label point:
  - a small House banner and a **troop pill** with a big bold number (Manrope 800, tabular)
  - a Leader crown, the building icon (an outline while under construction), specialist icons and culture as 1–5 dots
- **House colors:** each House has a tincture and a pattern (`06-art-direction.md`), so colorblind players can tell them apart.
- **Specialist figures** (rider, catapult, scout, engineer, healer) beside the army at **Near** zoom.
- **Capitals:** a two-line label (name, then "Capital").
- **Selection:** a gold glow. **Queued orders:** gold-trimmed arrows. **Odds:** the four-pip badge on the target.
- **Markers:** keep a minimum on-screen size at every zoom, and never overlap (shift or merge them when they would collide).
- **Hover (desktop) / tap-and-hold (phone) card:** owner, troops, building, culture, gold value and specialists. Fogged land shows `lastSeen` values with "?" and their age ("seen 2 turns ago"), or "Unexplored."

### 3. Fog
- **Standard fog:** desaturate and darken the land, with slow drifting mist. No markers, except "last seen" ones drawn faded with a "?".
- Leave a clean hook for blackout fog (thick clouds hiding geography) without building it.

### 4. Zoom, pan and views
- Mouse wheel and drag on desktop; pinch and drag on phones; a double-tap or button to fit the map.
- **Far / Mid / Near** detail levels, exactly as in `06-art-direction.md`, with smooth fades between them.
- **Tactical view:** a one-tap toggle to flat House colors with every detail and no illustration. It's also the automatic fallback if WebGL isn't available.

### 5. Placeholder art (must look good, not like debug boxes)
- Generate placeholder ground textures and simple illustrated-style sprites in code: noise-painted textures, and stylized trees, peaks, cottages, a castle, a ship, banners and icons drawn with shapes.
- Every visual comes from **one art manifest**, so real art replaces a placeholder by file name with no code change.

### 6. Art import script (`pnpm art:import`)
- It reads `art/incoming/`, using the exact file names from `docs/art/asset-list-and-prompts.md`, and writes processed files plus the manifest.
- **Sprites and icons:** trim, cut out a magenta (#FF00FF) background if present, and resize to sensible sizes.
- **Ground and water textures:** make them tile seamlessly.
- Convert everything to WebP. Report missing, unknown or badly sized files in plain language.
- **Shields, banners, flags and army figures** are tinted to the House color at runtime (they're made white/grey).
- Test it with a couple of generated sample images, and don't commit sample art into `art/incoming/`.

### 7. A small extra
- Add a per-map **names override file**, so Nate can rename any place without touching the generator.
- `pnpm build-maps` applies it, and the docs say how to use it in two lines.

## Performance (measure and report)
- **Targets:** smooth pan and zoom (aim for 60 fps) on a mid-range phone, using Chrome's device emulation with CPU slowdown as the stand-in.
- Report the time until the map first appears, frame rate while panning at each zoom level, and memory use, for both maps.
- If Greatmarch can't hit the target at Far zoom, simplify Far (fewer decorations or a cached image) rather than dropping the target.

## Out of scope (don't build)
- **Session 5:**
  - the gilded menus: navy/gold panels, players panel, event pop-ups, minimap, action bar, Leader portraits, territory card art
  - the animated replay, the turn timer, the phone bottom sheet, the installable app, and deployment
- **Later:**
  - random maps in the lobby and blackout fog
  - anything from M3 (spies, cards, diplomacy, generals, the Fallen, smarter bots)

## Tests
- Engine: last seen (above).
- Web: marker collision and minimum size, the zoom-level rules and the tap card's last-seen text. Keep that logic outside the renderer so it can be tested without WebGL.
- Art import: name matching, the magenta cut-out and the manifest.
- The determinism test still passes. Keep CI green: GitHub's CI can't run WebGL, so renderer code must at least build and typecheck there.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass.
- If the GitHub command-line tool isn't installed and logged in, say so in the summary. The orchestrator also checks CI.
- A full game is playable to the end on the new map, on desktop and in phone emulation, with Tactical view working.
- **Screenshots** in `docs/art/screens/`: Far, Mid, Near, Tactical view, fog with a last-seen marker, and the tap card, on Embervale, plus one of Greatmarch at Far.
- `docs/rules-reference.md`, `docs/decisions.md` and `PROGRESS.md` are updated in simple language, with "Claude Code sessions completed" bumped to 4.
- Committed and pushed. Map and image files are large: if a push fails, raise git's HTTP buffer for this repo, as in session 3.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the screenshot paths
- the performance numbers
- which placeholder art most needs replacing first, so Nate knows which AI art to generate first
- anything in the art direction that didn't work in practice
