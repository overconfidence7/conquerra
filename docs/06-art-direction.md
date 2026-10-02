# Art Direction v0.2: "Gilded Atlas"

*Replaces v0.1 ("Ink & Ember"), which Nate found too simple. The target is `docs/art/reference-mockup.png`, an AI mockup Nate made. It wasn't made with our rules in mind, so the "Keep / change" list below says what to take from it. Decided Oct 2: AI-generated art throughout, a two-layer map with zoom, rich menus, and the graphics engine built now.*

## The idea
**A living, painted world under a gilded command table.**
- The map is a richly painted fantasy landscape: forests, snowy peaks, rivers, coasts, villages and castles, seen from above.
- The menus are dark navy panels with fine gold trim, serif headings, Leader portraits and illustrated icons.
- **The rule that makes it work:** the painting is never where you read the game state. A clean **info layer** sits on top and always shows who holds what, how many troops are there, and what's built.

## Keep / change from the mockup
**Keep:**
- the painted, top-down terrain
- House-colored territory borders with a soft glow
- banner markers with troop numbers
- named settlements with a House shield
- a crown for capitals and Leaders
- clouds for fog
- the minimap
- navy-and-gold panels, serif headings and portraits
- a territory card on the right and an event feed

**Change (it doesn't fit our game):**

| In the mockup | In Conquerra |
|---|---|
| Food, iron and manpower; "/hr" rates | **Gold only**, shown as "+N per turn"; culture lives on territories |
| Research | Cut (no tech tree; military first) |
| Units with RTS-style unit types | **Troops + specialists**: one number plus up to 2 specialist slots |
| Pause / play / fast-forward | **Turn timer + the Lock in seal** |
| "Spring, 1943" | "Turn 18" |
| Population, loyalty | Owner, terrain, troops, building, culture (0–5), gold value, specialists |
| Generals with portraits | **Your Leader** gets the portrait card (Seize the Initiative, Lie in Wait). Generals arrive in M3 |
| Intel, Diplomacy tabs | Only when they exist (M3). M2's left rail: Map, Turn report, Settings |

## The map: two layers
1. **Painted world** (the background):
   - Terrain textures blended by biome (grass, farmland, forest, hills, rock and snow, swamp, sand), with painted coastlines and water.
   - Sprites scattered by the map maker: tree clusters, mountain peaks, hills, villages and towns, a castle at each capital, buildings where they're built, and ships on sea lanes.
   - Rivers wind along the borders they run on, and mountain ranges look impassable with a clearly visible pass.
2. **Info layer** (always crisp, never painted):
   - **Borders:** House-colored lines with a soft inner glow; neutral land gets a thin pale line; province borders are heavier.
   - **Territory banner,** at each territory's label point:
     - a House shield (tincture + pattern, so colorblind players can tell Houses apart) with a big bold troop number
     - a Leader crown on top
     - an icon strip underneath: the building (an outline while under construction), specialist icons, and culture shown as 1–5 small dots
   - Banners keep a minimum size on screen at every zoom and never overlap.
   - **Capitals:** a larger banner, the city sprite and the place name.
   - **Selection:** a gold glow outline.
   - **Orders:** gold-trimmed arrows from source to target.
   - **Odds:** the four-pip badge on the target (Guaranteed / Likely / Possible / Impossible).

### Zoom levels (the readability rule)
| Zoom | What you see |
|---|---|
| **Far** | Painting dimmed and flattened, House colors filled in at about 50%, banners show numbers only. Reads like the minimap. |
| **Mid** (default) | Full painting, borders, banners with numbers and building icons. |
| **Near** | Everything: specialist icons, culture dots, gold value and territory names. |

**Tactical view** (one tap, any time): flat House colors with every detail shown and no painting. It doubles as the low-power and accessibility mode.

### Fog
- **Standard fog** (default): you can see the land but not who holds it. Fogged terrain is desaturated and darker, with drifting mist. No banners.
- **Blackout fog** (later, big games): thick painted clouds, like the left edge of the mockup, hide everything until it's explored.

## Menus
- **Palette:** panels Navy `#0F1620` / Raised `#172231`; gold trim `#C9A45C` with a highlight `#E3C77E`; text Parchment `#EDE6D6`, muted `#9AA3AE`; danger `#C2553F`.
- **House tinctures** (as v0.1, a touch brighter so they glow on painted terrain): Gules, Azure, Vert, Or, Purpure, Tenné, Celeste, Murrey, Sable, Argent.
- **Type:**
  - *Cinzel* for the logo, headings and place names
  - *Spectral* for panel text and logs
  - *Manrope 800* (tabular) for the numbers on banners and counters, because they must read at small sizes
- **Frames:** thin double gold rules with small corner ornaments, built as one reusable frame so every panel matches.
- **Icons:** illustrated, in one consistent set (from the asset pack).
- **Lock in:** a wax seal in gold and red. It's the one big button.

### Desktop layout
| Area | Contents |
|---|---|
| **Top bar** | Logo emblem · gold (+N per turn) · Turn N and the timer · settings |
| **Left rail** | Map, Turn report, Settings (more tabs only as M3 features arrive) |
| **Right column** | Territory card (art, owner, troops, building, culture, gold value, specialists), then the turn report feed |
| **Bottom left** | Army panel for the selected territory: troops, the 2 specialist slots, the Leader portrait if present, action buttons and preset chips |
| **Bottom right** | Order queue, the Lock in seal and the minimap |

### Phone layout
The map is full screen with a compact top bar. Panels open as a bottom sheet, and the minimap is a toggle.

## Performance targets
- Smooth panning and zooming (aim for 60 fps) on a mid-range phone.
- The painted terrain is drawn once per game into tiles, not every frame.
- Art ships as compressed WebP and loads progressively.

## Art pipeline (AI-generated)
- Nate generates assets with an image tool, using `docs/art/asset-list-and-prompts.md`.
- He drops the files into `art/incoming/` with the names that list gives.
- An import script trims, resizes, makes textures tile seamlessly, compresses them and registers them in an art manifest.
- Any missing asset falls back to a procedural placeholder, so the game always runs and gets better as art arrives.
- **Commercial use:** before shipping, confirm the image tool's terms allow commercial use of what it generates.
