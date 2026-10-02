# Conquerra Art: Asset List and Prompt Pack

*For Nate, to generate art with an AI image tool. Save each file into `art/incoming/` in the project folder, using the exact file name shown. Claude Code's import script handles resizing, trimming, seamless tiling and compression. Anything still missing shows as a placeholder, so work in priority order and don't worry about finishing everything.*

**Before you start:** confirm your image tool's terms allow commercial use of the images, since the game will be sold.

## How to prompt (read once)
1. **Start every prompt with the style line** below, so all the art matches.
2. **Transparent images:** for sprites and icons, ask for a *transparent background*. If the tool can't do transparency, ask for a *flat solid magenta (#FF00FF) background* and the import script will cut it out.
3. **Textures** (ground, water) must be *seamless and tileable*, seen straight from above, with no objects, no horizon and no lighting gradient.
4. **No text, logos, frames, borders or UI** in any image unless the item says otherwise.
5. **Color-tinted items** (banners, shields, flags): make them in **neutral white/grey**. The game tints them to each House's color.
6. Generate 2–4 options for each item and keep the best one. Consistency beats perfection: if one image looks off-style, redo it.

### Style line (paste first in every prompt)
> Painted fantasy strategy-game art, top-down bird's-eye view with a slight three-quarter angle for objects, rich but natural colors, soft daylight from the upper left, fine painterly detail, crisp edges, consistent scale, no text.

---

## Tier 1: the map (needed for session 4)

### Ground textures: square, 1024×1024 or larger, seamless, straight top-down
| File | Prompt (after the style line) |
|---|---|
| `terrain-grass.png` | Seamless tileable texture of lush green grassland seen from directly above, subtle variation, small wildflowers, no objects. |
| `terrain-farmland.png` | Seamless tileable texture of a patchwork of small medieval farm fields from above, greens and golds, thin hedgerows, no buildings. |
| `terrain-forest.png` | Seamless tileable texture of dense forest canopy from directly above, mixed deep greens, no clearings, no gaps. |
| `terrain-hills.png` | Seamless tileable texture of rolling grassy hills from above, soft shading, scattered rocks. |
| `terrain-rock.png` | Seamless tileable texture of grey mountain rock and scree from directly above. |
| `terrain-snow.png` | Seamless tileable texture of snow and ice on rock from directly above. |
| `terrain-swamp.png` | Seamless tileable texture of murky swamp, dark pools, reeds and moss, from directly above. |
| `terrain-sand.png` | Seamless tileable texture of a sandy beach and dunes from directly above. |
| `water-shallow.png` | Seamless tileable texture of clear shallow coastal water from directly above, light turquoise, gentle ripples. |
| `water-deep.png` | Seamless tileable texture of deep ocean water from directly above, dark blue, soft waves. |

### Map sprites: transparent background, single object, centered
| File | Prompt (after the style line) |
|---|---|
| `tree-conifer-1.png` … `-3.png` | A small cluster of 3–6 dark green pine trees, isolated on a transparent background. (Make 3 different ones.) |
| `tree-broadleaf-1.png` … `-3.png` | A small cluster of 3–5 round leafy oak trees, isolated on a transparent background. (Make 3.) |
| `mountain-1.png` … `-4.png` | A single tall rocky mountain peak with a snowy top, seen from above at a slight angle, isolated on a transparent background. (Make 4 different peaks.) |
| `hill-1.png` … `-3.png` | A single low grassy hill mound with a few rocks, isolated on a transparent background. (Make 3.) |
| `village-1.png` … `-3.png` | A tiny medieval village of 4–6 thatched cottages, isolated on a transparent background. (Make 3.) |
| `town-1.png`, `town-2.png` | A small walled medieval town with a market square, isolated on a transparent background. |
| `capital-1.png`, `capital-2.png` | A grand fortified castle city with towers and a central keep, isolated on a transparent background. |
| `building-fort.png` | A small stone fort with four corner towers, isolated on a transparent background. |
| `building-market.png` | A cluster of colorful market stalls and a trading hall, isolated on a transparent background. |
| `building-barracks.png` | A wooden-and-stone military barracks with a training yard, isolated on a transparent background. |
| `building-watchtower.png` | A tall stone watchtower, isolated on a transparent background. |
| `ship.png` | A small medieval sailing ship seen from above at an angle, white sails, isolated on a transparent background. |
| `bridge.png` | A short arched stone bridge seen from above, isolated on a transparent background. |
| `cloud-1.png` … `-3.png` | A soft, wispy white cloud seen from above, semi-transparent edges, isolated on a transparent background. (Make 3.) |

## Tier 2: the info layer and menus (needed for session 5)
Make these as **icons**: bold, simple silhouettes that read at 24 pixels, transparent background, painted style with a light gold rim.

| File | Prompt (after the style line) |
|---|---|
| `shield-base.png` | An empty heraldic shield in plain white with a thin gold rim, front view, transparent background. (The game tints it and adds the House pattern.) |
| `banner-base.png` | A hanging cloth banner on a short pole, plain white cloth with a thin gold trim, front view, transparent background. |
| `icon-crown.png` | A small gold crown icon, transparent background. |
| `icon-gold.png` | A small stack of gold coins icon, transparent background. |
| `icon-culture.png` | A laurel wreath around a small scroll, icon, transparent background. |
| `icon-troops.png` | Two crossed swords over a small helmet, icon, transparent background. |
| `icon-fort.png`, `icon-market.png`, `icon-barracks.png`, `icon-watchtower.png` | A simple icon of a [stone fort / market stall / barracks / watchtower], bold silhouette, transparent background. |
| `icon-cavalry.png`, `icon-siege.png`, `icon-scouts.png`, `icon-engineers.png`, `icon-healers.png` | A simple icon of [a horse head / a siege ram / an eye with a spyglass / a hammer and wrench / a healer's herb bundle], bold silhouette, transparent background. |
| `emblem.png` | A compass-rose star emblem in gold, game logo mark, front view, transparent background. |
| `seal.png` | A round red wax seal with a gold compass-star impression, front view, transparent background. |
| `frame-corner.png` | An ornate thin gold filigree corner ornament for a UI panel, front view, transparent background. |

### Leader portraits: square, 512×512, chest-up, dark simple background
Make 10, with a mix of men and women, ages and looks:
> Portrait of a fantasy kingdom's military leader, chest-up, armor and cloak, determined expression, painted, dark navy background, no text.

File names: `leader-01.png` … `leader-10.png`.

### Territory card art: wide, 1200×600
> A painted vista of a fantasy [castle city / farming valley / forest town / mountain fortress / harbor town], wide landscape, no text.

File names: `vista-city.png`, `vista-valley.png`, `vista-forest.png`, `vista-mountain.png`, `vista-harbor.png`.

## Tier 3: later
Lobby and title background art, the game-over screen, faction-specific castles, extra building variants, seasonal textures and the marketing key art.
