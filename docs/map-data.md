# Map Data (for the illustrated renderer)

*What the map maker (`packages/mapgen`) puts in each map, and how session 4 should read it. The schema, with comments, is `MapGeometry` in `packages/content/src/schemas.ts`. The engine never reads any of this; it only uses territories, provinces and borders.*

## Where it comes from
- `pnpm build-maps` regenerates `packages/content/data/maps/*.json` and the debug previews in `docs/maps/`. The recipes (seed, sizes, style knobs) are in `packages/mapgen/src/configs.ts`.
- A test checks the committed files are exactly what the generator makes, so if the generator changes, rerun `pnpm build-maps` and commit the maps.
- **Renaming places:** open `packages/mapgen/names/<map>.json` and add `"Old name": "New name"` lines inside `renames` (any territory, province, sea, lake, range or river).
  Then run `pnpm build-maps`; it warns about any old name it can't find.
- The page gets the map from the game host when a game starts (`HostStart.map`), never by importing it. Blackout fog (M5) can then send a trimmed copy.

## Map maker v2 (session 9): no hairlines, wide passes
- **Hairline borders are gone.** The orchestrator measured (v1) 8 land borders on Embervale and 13 on Greatmarch under a quarter of the usual length (shortest 4.4 and 0.6 map units, against a typical 88). In v2, every land border is at least 22 units (`MIN_BORDER_CHECK`; the maker aims for 24, `MIN_BORDER`).
  - **How:** `fixHairlines` (`packages/mapgen/src/contacts.ts`) works one cell at a time. Where two territories meet at a corner, it hands the meeting cell to a third territory that already surrounds it, so the two simply stop touching (the eye reads a corner as "not touching" anyway). Where that isn't possible, it widens the contact: a third territory's cell next to both sides joins one of them, or, at a narrow neck of land between two waters, a shallow water cell beside the neck becomes land. Every move must leave fewer hairlines overall; if it gets stuck, the maker tries the next seed.
  - **Why mostly "not neighbours" rather than "widen":** it keeps the shapes the land already has, and removes exactly the links players couldn't see.
- **Passes are wide.** v1 passes were 9–31 units wide (one or two mesh edges). v2 keeps the middle of the range crossing open until it's 38 units wide where the border allows (`MIN_PASS`), and picks, for each pass, the widest border near its spot. The check (`MIN_PASS_CHECK`) is 28: about 17 px at the far edge of Mid zoom and 45 px in the middle of it, with a road and a gate drawn across.
- **Both are `checkMap` checks**, so no future map can bring them back.
- **Numbers after the rebuild:** Embervale: shortest land border 24.0 (was 4.4), none under a quarter of typical, passes 36, 42, 45 (were 12, 23). Greatmarch: shortest 22.9 (was 0.6), passes 29–50 (were 9–31).
- **Same seeds, same land:** both maps keep their coasts, lakes, islands and ranges (Embervale's config now names the seed its v1 map came from, `embervale#2`). Place names changed, and now come from their own random sequence, so later changes to shapes won't rename places again.

## Shapes and sizes (session 10)
- **A `shape` knob** in the recipe (`MapGenOptions`), in `packages/mapgen/src/shapes.ts`:
  - `continent`: one rounded landmass (the default, and what Embervale and Greatmarch use, so they don't change)
  - `archipelago`: many islands on a loose grid, so each has a neighbour across a short stretch of sea. Every island gets at least one sea lane (`islands` sets how many).
  - `twinContinents`: two big landmasses with a channel between them, sea lanes across it, and sometimes a narrow land bridge (`landBridge`)
  - `inlandSea`: land in a ring round a central sea, with an isle in the middle (`islands`)
  - `crescent`: a curved landmass round a bay, with isles strung across the bay's mouth
  - `mask`: the land grows inside a silhouette (`mask`: `dragon`, `shield` or `crown`, in `masks.ts`)
- **How a shape works:** the shape is drawn as a smooth field (deep inside = high, the coast = 0, the sea = low), and the same coast noise as before bends it into bays and headlands (`roughness`, 0–1). Parts thinner than about one territory are trimmed first, so tips and necks don't turn into slivers. Each shape draws its random numbers from its own sequence (`seed|shape`), and only uses exact arithmetic, so the same seed gives the same map everywhere.
- **Water share:** a shape sets its own (the sea around and inside it) unless the recipe gives `water`.
- **Capitals and ranges** may go on every landmass of 3 or more territories (not just the biggest), so islands and both twins get capitals and mountains.
- **Adding a silhouette:** draw an outline in `masks.ts`, or turn a black-and-white picture into one: `pnpm --filter @conquerra/mapgen mask picture.png wolf "The Wolf"` (black is land), then add the line it prints.
- **Sizes:** 40 (the quick map) to 120 territories. `recipeFor(shape, size, seed)` (`recipes.ts`) fills in sensible knobs: about 4.5 territories a province, and more lakes, rivers, ranges, sea lanes and choke points as maps grow. Who a size suits: 60 → 2–6 players (4–6 recommended), 80 → 2–8 (4–8), 100 → 2–10 (6–10), 120 → 2–10 (8–10). Every player count from 2 up gets a fair capital layout.
- **Ids past 100:** maps over 100 territories number them `t000`–`t119`.
- **Hairline fix, last resort:** when two territories meet at a point squeezed between mountains (or at the coast) and no neighbour can take the corner, that one cell now joins the range (or becomes a little cove). Before, the maker gave up and tried the next seed; big maps hit this often. Maps that never needed it come out exactly as before.
- **Trying many seeds:** `pnpm --filter @conquerra/mapgen try-maps --shapes archipelago,crescent --sizes 60,120 --seeds 5 --out docs/maps/try` reports how many pass, how long they take and why attempts were rejected, and saves a picture of each.
- **How long it takes** (this laptop, 4 seeds each, including rejected tries): 60 territories 0.3–1.6 s; 80: 0.5–2.7 s; 100: 1.3–3 s (crescent about 11 s); 120: 2–8.5 s (crescents and silhouettes need the most retries; worst single map about 23 s).

## Coordinates
- Map units, origin top-left, y down. `geometry.width` × `geometry.height` (Embervale 1133 × 781, Greatmarch 1577 × 1088).
- Lines and outlines are flat number lists `[x0, y0, x1, y1, …]`, rounded to 0.1.
- Outlines are smoothed once and shared: neighbouring territories, coasts and mountain edges use exactly the same points, so there are no gaps or overlaps.

## What's in `geometry`
| Field | What it is | Renderer use |
|---|---|---|
| `biome` | Grid of squares (`cellSize` ≈ 10.5 units), one character per square: `g` grass, `a` farmland, `f` forest, `h` hills, `r` rock, `s` snow, `w` swamp, `d` sand, `o` shallow water, `O` deep water | Blend ground textures (sample it like a low-res texture) |
| `heightMap` | Same grid; base64, one byte (0–255) per square. `seaLevel` (79): water is at or below it, land above. Rivers are carved in so they run downhill. Lightly blurred already | Hill shading, mountain shadows, coastal depth (lighter shallows near the shore) |
| `territories[]` | `rings` (draw even-odd: a ring inside another is a hole), `label` {x, y, r = clear radius for the banner}, `site` (building sprite), `castle` (only on capital slots) | Info-layer borders and glow; banner and sprite placement |
| `borderLines[]` | The shared border between two touching territories (one or more lines) | Province edges (where provinces differ), House border glow, the line a river follows |
| `water[]` | Each sea and lake: `kind`, `name`, `rings`, `label` | Coastline, water names |
| `mountains[]` | Each impassable range: `name`, `rings` (it can be in pieces where passes cut through), `label` | Mountain painting, range names |
| `passes[]` | Where each pass crosses its range (`a`, `b`, `range`, x, y) | A clearly visible gap and road through the range |
| `rivers[]` | `name` and `path`, from the source down to the mouth | Painted rivers (wider toward the mouth) |
| `seaLanes[]` | `a`, `b`, and a straight `path` from coast to coast | Ships and a sailing route (curve it as you like) |
| `provinceLabels[]` | A three-point line (start, bowed middle, end) through each province's long axis, always left to right | Large curved province names (e.g. an SVG `Q` curve or text on a path) |
| `decorations[]` | `kind` (tree-conifer, tree-broadleaf, peak, hill, village, town), x, y, `v` (variant 1…n). Sorted top to bottom, so draw them in order for correct overlap | Sprites. Each sits on matching ground, never in water, and at least 22 units from any banner (12 from a site, 18 from a castle) |

## Things session 4 should know
- **Density:** about 1,500 decorations on Embervale and 2,500 on Greatmarch. They're meant to be drawn once into the terrain tiles, not every frame.
- **Mountains territories vs mountain ranges:** a *mountains* territory is passable land (mostly hills ground, a little rock). Bare rock and snow mostly mean an impassable range, so keep ranges visibly different (darker, with peaks).
- **The biome grid is coarse** (about 10 units a square). Blend or dither between squares, and clip land textures with the territory and water outlines for crisp coasts.
- **Island and lake names** and the province name lines are suggestions; it's fine to hide some at Far zoom.
- **Sizes:** each map file is 350–680 KB (mostly outlines and decorations). The worker loads it; the page never bundles it.
