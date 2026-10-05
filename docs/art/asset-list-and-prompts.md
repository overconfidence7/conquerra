# Conquerra Art: Asset List and Prompt Pack

*For Nate, to generate art with an AI image tool. Save each file into `art/incoming/` in the project folder, using the exact file name shown. Claude Code's import script handles resizing, trimming, seamless tiling and compression. Anything still missing shows as a placeholder, so work in priority order and don't worry about finishing everything.*

**Status (Oct 3):** every Tier 1 and Tier 2 item below is in `art/incoming/` (79 files). Tier 3 is still to do.

**In the game (Oct 4, session 6):** all 79 imported and judged on both maps. Worth redoing, in order: (1) `tree-conifer-1` and `-2` (still round bushes; use the pine prompt below, "clear spiky tips"); (2) `terrain-rock` and `terrain-snow` (big boulders; mostly hidden under mountain sprites, so low priority); (3) `terrain-hills` (big swirls). Everything else fits; the importer fixed the pink edges, the `tree-broadleaf-3` smudge and the cream clouds.

**Batch 3 (Oct 5, for session 11):** about 20 images: the redo items plus new pieces for the visual upgrade. See "Batch 3" at the end of this file. The art session prompt is `docs/prompts/gemini-art-session-03.md`.

**Before you start:** confirm your image tool's terms allow commercial use of the images, since the game will be sold.

## How to prompt (read once)

*Tip from the first batch (Oct 2): ground textures with big built-in shapes and shadows (boulders, mounds) repeat visibly across the map and fight the game's own hill shading. Ask for flat, even lighting and small detail.*
1. **Start every prompt with the style line** below, so all the art matches.
2. **Transparent images:** for sprites and icons, ask for a *flat solid magenta (#FF00FF) background*; the import script cuts it out.
3. **Textures** (ground, water) must be *seamless and tileable*, seen straight from above, with no objects, no horizon and no lighting gradient.
4. **No text, logos, frames, borders or UI** in any image unless the item says otherwise.
5. **Color-tinted items** (figures, banners, shields, flags): make them in **neutral white/grey**. The game tints them to each House's color.
6. Generate 2–4 options for each item and keep the best one. Consistency beats perfection: if one image looks off-style, redo it.

### Style line (paste first in every prompt)
> Semi-realistic, richly detailed hand-painted fantasy campaign-map art: natural earthy palette, fine painterly texture, soft daylight from the upper left, depth from shading. Not cartoon: no black outlines, no flat fills, no candy-bright colors, no text.

Then add the angle: textures *straight top-down*; trees *almost directly overhead*; mountains, hills, settlements, buildings, figures, ship and bridge *three-quarter view from above, camera about 45° down*. For sprites end with: *"One object, centered, wide empty margin on every side, on a flat pure magenta (#FF00FF) background filling the entire image, no ground plane, no shadow on the background."*

The target look is `docs/art/reference-mockup.png` (realistic terrain) with the painted feel of `docs/art/reference-illustrated.jpg`.

### Working in Gemini (lessons from sessions 1–2)
- **Attach 2–3 style references** in the first message of a fresh chat and say they are *style references only: do not edit or copy them and include nothing from them*. Good anchors: `reference-mockup.png`, the forest texture, the foot-soldier sprite (for figures), and three finished icons (for icons).
- **Pick anchors that don't share subjects with what you're making.** With the fort sprite attached, Gemini pasted fort walls and a tiny tower into a flag and a ship. With the forest texture + soldiers attached, it didn't.
- **Gemini bleeds the previous image into the next one** (a ghost ship under the bridge arch, an orb next to a cloud). Start each prompt with *"A brand-new image, nothing from earlier images (no ___)"*, naming the last subject. When a stray piece appears anyway, a follow-up *"Edit the image you just made: remove the ___, leave flat magenta there"* fixes it cleanly.
- **Start a new chat about every 8–10 images**, or whenever it starts editing instead of drawing.
- **Review the downloaded file, not the on-screen preview.** The preview can differ from the full-size file (once the full file had a fort wall the preview didn't show).
- **Downloads** are usually JPG, sometimes PNG. PNG downloads carry a small Gemini sparkle watermark in the bottom-right corner; paint that corner back to magenta.
- **Icons:** add *"Every part fully solid, nothing fading out"* (otherwise the bottom of a coin stack faded into the background) and *"no badge, no circle, no frame behind it"*.
- **Portraits:** add *"no lion emblems"*. Gemini kept putting a lion brooch on every cloak.
- The import script accepts a background within about 90 colour-distance of pure magenta at the corners; Gemini's lighter pinks (e.g. 240,54,245) are fine.

---

## Tier 1: the map

### Ground textures: square, 1024×1024 or larger, seamless, straight top-down
| File | Prompt (after the style line) |
|---|---|
| `terrain-grass.png` | Seamless tileable texture of lush green grassland seen from directly above, subtle variation, small wildflowers, no objects. |
| `terrain-farmland.png` | Seamless tileable texture of a patchwork of small medieval farm fields from above, greens and golds, thin hedgerows, no buildings. |
| `terrain-forest.png` | Seamless tileable texture of dense forest canopy from directly above, mixed deep greens, no clearings, no gaps. |
| `terrain-hills.png` | Seamless tileable texture of grassy hill ground from directly above, flat even lighting, small-scale detail, scattered small rocks, no big shapes or shadows. (The game adds the hill shading itself.) |
| `terrain-rock.png` | Seamless tileable texture of grey mountain rock and scree from directly above, flat even lighting, small-scale detail, no big boulders or shadows. |
| `terrain-snow.png` | Seamless tileable texture of snow and ice on rock from directly above, flat even lighting, small-scale detail, no big boulders or shadows. |
| `terrain-swamp.png` | Seamless tileable texture of murky swamp, dark pools, reeds and moss, from directly above. |
| `terrain-sand.png` | Seamless tileable texture of a sandy beach and dunes from directly above. |
| `water-shallow.png` | Seamless tileable texture of clear shallow coastal water from directly above, light turquoise, gentle ripples. |
| `water-deep.png` | Seamless tileable texture of deep ocean water from directly above, dark blue, soft waves. |

### Map sprites: magenta background, single object, centered
| File | Prompt (after the style line) |
|---|---|
| `tree-conifer-1.png` … `-3.png` | A small cluster of 3–6 tall, pointed dark green pine trees with clear spiky tips, seen almost directly overhead. Not round or bushy. (Make 3 different ones.) |
| `tree-broadleaf-1.png` … `-3.png` | A small cluster of 3–5 round leafy oak trees, seen almost directly overhead. (Make 3.) |
| `mountain-1.png` … `-4.png` | A single tall rocky mountain peak with a snowy top. (Make 4 different peaks.) |
| `hill-1.png` … `-3.png` | A single low grassy hill mound with a few rocks. (Make 3.) |
| `village-1.png` … `-3.png` | A tiny medieval village of 4–6 thatched cottages. (Make 3.) |
| `town-1.png`, `town-2.png` | A small walled medieval town with a market square. |
| `capital-1.png`, `capital-2.png` | A grand fortified castle city with towers and a central keep. |
| `building-fort.png` | A small stone fort with four corner towers. |
| `building-market.png` | A cluster of market stalls and a trading hall. |
| `building-barracks.png` | A wooden-and-stone military barracks with a training yard. |
| `building-watchtower.png` | A tall stone watchtower. |
| `figure-army.png` | A small group of 5–7 medieval foot soldiers with spears and shields standing in formation, plain white/grey tabards (the game tints them). |
| `figure-cavalry.png` | A single mounted knight on a sturdy brown warhorse in a gentle trot, lance tilted forward at about 45°, plain white/light-grey tabard and horse caparison, no colors or emblems. The whole knight and lance well inside the frame. |
| `figure-siege.png` | A wooden mangonel catapult on a wheeled base with two small crew in plain white/light-grey tunics, one pulling down the arm, one carrying a stone. |
| `figure-scouts.png` | A lone scout in a hooded plain white/light-grey cloak over brown leather, kneeling and looking through a brass spyglass, short bow and quiver on the back. |
| `figure-engineers.png` | Two engineers in plain white/light-grey work tunics, leather aprons and tool belts, one hammering a beam, one carrying a plank, beside a small pile of timber and stone blocks. |
| `figure-healers.png` | A field healer in long plain white/light-grey robes with a herb satchel, beside a small open-fronted off-white canvas medical tent. No red crosses or symbols. |
| `banner-flag.png` | Only a flag on its pole and nothing else: a tall plain white cloth flag on a straight wooden pole with an iron spike tip, rippling to the right. The whole pole, including its bottom end, well inside the frame. |
| `ship.png` | A small medieval single-masted cog with a weathered wooden hull, one plain white square sail, rigging, a small raised stern deck, no flags. Bow pointing lower-left. Only the ship: no water, no waves. |
| `bridge.png` | A short medieval stone bridge with a single low arch, weathered grey stone with a little moss, cobbled walkway, low parapets, neat stone abutments, running diagonally. Only the bridge: no water, no banks. |
| `cloud-1.png` … `-3.png` | A soft white painted cloud seen from above with grey-blue shading underneath. Make three clearly different shapes: (1) one rounded cumulus, wider than tall; (2) a long thin wispy streak with two small trailing puffs; (3) a loose cluster of 3–4 separate puffs. |

## Tier 2: the info layer and menus
Make these as **icons**: bold, simple shapes that read at 24 pixels, in the same painted style, magenta background, with a thin light-gold rim. Add: *"Every part fully solid. Single icon centered filling about 60% of the image, wide empty margin, no shadow, no badge, no circle, no frame behind it, no text."*

| File | Prompt (after the style line) |
|---|---|
| `shield-base.png` | An empty heraldic heater shield, front view, plain white/light-grey face with subtle shading and a slight curve, thin polished gold rim. No emblem. (The game tints it and adds the House pattern.) |
| `banner-base.png` | A hanging cloth banner, front view: a short wooden crossbar with small gold finials, a tall rectangle of plain white/light-grey cloth with a swallowtail bottom edge and thin gold trim. |
| `icon-crown.png` | A small royal gold crown with five points and a few deep red gems. |
| `icon-gold.png` | A small neat stack of thick gold coins, four or five high, with one coin leaning against it. |
| `icon-culture.png` | A green laurel wreath forming an open circle, with a small rolled parchment scroll tied with a red ribbon across its center. |
| `icon-troops.png` | Two steel longswords crossed in an X behind a small round steel kettle helmet. |
| `icon-fort.png` | A small squat stone fort, front view: a crenellated wall with an arched wooden gate and two round towers. |
| `icon-market.png` | A single market stall: wooden counter with sacks, a cheese wheel and apples under a cream-and-terracotta striped awning. |
| `icon-barracks.png` | A long low barracks hall: stone lower wall, timber upper wall, steep dark shingle roof, crossed spears over the door. |
| `icon-watchtower.png` | A tall slender stone watchtower with a small arched window and a wooden lookout platform under a pointed roof. |
| `icon-cavalry.png` | The head and neck of a dark bay warhorse in side profile facing left, black mane, leather bridle. |
| `icon-siege.png` | A siege battering ram: an iron-capped log hung by chains under a small peaked wooden roof on four wheels. |
| `icon-scouts.png` | An almond-shaped amber-brown eye with a short brass spyglass laid diagonally below it. |
| `icon-engineers.png` | An iron hammer and an iron wrench with wooden grips crossed in an X. |
| `icon-healers.png` | A bundle of green medicinal herbs with a few small white flowers, tied with brown twine. No cross symbol. |
| `emblem.png` | A compass-rose star emblem in polished engraved gold, four long main points and shorter diagonals, a raised round boss in the center. No ring, no letters. |
| `seal.png` | A round deep-red wax seal with a melted blob edge and a raised four-pointed compass-star impression in gold leaf. No ribbon, no paper. |
| `frame-corner.png` | An ornate thin gold filigree corner piece shaped like an L in the top-left region: two slender lines along the top and left meeting in a scrolled flourish with small curling leaves. |

### Leader portraits: square, chest-up, dark navy background (no magenta)
> Semi-realistic hand-painted portrait of a fantasy kingdom's military leader, chest-up, determined expression, [person and armor], fine painterly brushwork, natural skin tones, soft light from the upper left. Background: plain dark navy blue (about #1A2238) with a subtle painted vignette. No black outlines, no cartoon look, no frame, no text, no lion emblems.

File names: `leader-01.png` … `leader-10.png`. The ten made on Oct 3: grizzled grey-bearded veteran in plate and a red fur cloak; young auburn-braided woman in mail with a green cloak; Black commander with a shaved head, steel cuirass and blue cloak; silver-haired older woman in leather and a wolf-fur mantle; young East Asian officer in lacquered lamellar; dark-skinned woman in a gilded bronze breastplate and white cloak; burly red-bearded warrior in mail and bearskin; South Asian general in scale armor with a saffron sash; gaunt schemer in black enamel plate and a purple cloak; young freckled blonde knight in plain dented plate.

### Territory card art: wide (Gemini's 16:9; the import crops to 2:1)
> A brand-new wide landscape painting, semi-realistic hand-painted, of a fantasy [scene], natural earthy palette, soft light from the upper left. No black outlines, no cartoon look, no frame, no border, no text.

File names: `vista-city.png` (castle city on a hill above fields), `vista-valley.png` (farming valley with a mill and river), `vista-forest.png` (forest town among giant trees), `vista-mountain.png` (mountain fortress above a gorge and waterfall), `vista-harbor.png` (harbor town with ships and a lighthouse).

## Tier 3: later
Lobby and title background art, the game-over screen, faction-specific castles, extra building variants, seasonal textures and the marketing key art.

### Ideas for batch 4 (from session 11)
*Not a list to make yet: what session 11 found it could use, for the orchestrator to weigh. Batch 3 comes first.*
| File | What it's for |
|---|---|
| `peak-narrow-1.png` … `-3.png` | Tall, narrow single peaks for ranges that run up and down the screen (ridges only suit ranges running across it, so steep stretches are stacked peaks today). |
| `ridge-diag-1.png`, `-2.png` | Ridges running diagonally (about 30–45°), so slanting ranges read as one chain too. |
| `cliff-side-1.png`, `-2.png` | Cliffs seen from the side, for coasts facing left or right (cliffs only go on coasts facing down the screen today). |
| `fringe-bush-1.png` … `-3.png` | Small bushes and saplings for the edges of forests, so woods fade into fields instead of stopping. |
| `glade-1.png`, `-2.png` | A small meadow with flowers and a fallen log, top-down, for the open glades inside forests. |
| `paper-grain.png` | A seamless, neutral parchment grain (top-down, very flat), for the painted-atlas look at Far zoom (today it's made by the shader). |

*(This section sits under Tier 3 on purpose: a test counts the file names in Tiers 1–2 and Batch 3 against the game's art list.)*

---

## Batch 3 (Oct 5): for session 11, the big visual upgrade
*About 20 images. Same rules as above: the style line first, PNG into `art/incoming/` with the exact file name, magenta background for sprites. Work top to bottom; session 11 copes with anything missing (it keeps today's drawing for that piece). The "before" pictures these are judged against are in `docs/art/screens/bench/`.*

### 1. Redo (same file names; the new file replaces the old one)
| File | Prompt (after the style line) | What was wrong |
|---|---|---|
| `tree-conifer-1.png`, `tree-conifer-2.png` | A small cluster of 3–5 tall, narrow, pointed pine trees seen from above at a slight angle, so each tree shows as a **dark green star of spiky branch tips around a pointed top**, with a narrow pointed shadow. Clearly different from round leafy trees: **no round or bushy shapes, no smooth outlines**. (Make 2 different clusters.) | They read as round bushes next to the oaks. |
| `terrain-hills.png` | Seamless tileable texture of short grass and bare earth on rolling ground, from directly above, **completely flat even lighting, no shadows, no swirls, no big shapes**: only small-scale detail (tufts, pebbles, small earth patches) spread evenly across the whole image. | Big swirls that repeat. |
| `terrain-rock.png` | Seamless tileable texture of grey mountain scree and gravel from directly above, **completely flat even lighting, no boulders, no shadows**: small stones and grit spread evenly across the whole image. | Big boulders that repeat. |
| `terrain-snow.png` | Seamless tileable texture of wind-packed snow with a few small grey rock specks showing through, from directly above, **completely flat even lighting, no big shapes or shadows**, detail spread evenly. | Big shapes that repeat. |

### 2. The dragon map outline (not magenta)
| File | Prompt (no style line for this one) |
|---|---|
| `mask-dragon.png` | A solid flat black silhouette of a dragon seen from the side, facing left, wings raised and spread, on a pure white background. Black and white only: no detail, no shading, no grey. **Chunky, rounded shapes:** a thick neck, a thick tail that curls, broad wings with a scalloped edge and no thin spikes, short stubby horns and legs, so it still reads as a dragon at a small size. The dragon fills most of the image with a wide white margin. |

*This becomes the shape of Wyrmland. Thin parts (claws, spines, a whip tail) can't become land, so chunky is right. Make 2–3 and keep the one that most clearly says "dragon" when you squint at it small.*

### 3. New map sprites (magenta background, three-quarter view unless noted)
| File | Prompt (after the style line) |
|---|---|
| `ridge-1.png` … `ridge-3.png` | A short mountain ridge: three or four connected rocky peaks of different heights in a row, running left to right, snow on the highest one, grey-brown rock with small dark pines at the base. Clearly wider than tall. (Make 3 different ridges.) Ranges get drawn as chains of these, so they read as ranges, not rubble. |
| `cliff-1.png` … `cliff-3.png` | A short stretch of rocky sea cliff running left to right: a grassy top edge, a grey-brown rock face, and a thin line of white foam along its bottom edge. Only the cliff and foam: no sea, no sky. Clearly wider than tall. (Make 3 different stretches.) |
| `pass-gate.png` | A mountain pass gatehouse: a stone archway with an open wooden gate between two short square stone towers, a cobbled road running through the arch toward the viewer. |
| `scaffold.png` | Wooden construction scaffolding with nothing inside it: a square frame of rough timber poles with lashed crossbeams, two ladders, a small rope hoist, a stack of planks and a few cut stone blocks at its foot. (Drawn over a building while it's being built.) |
| `bridge-wood.png` | A short rustic wooden bridge: a plank deck on timber trestles with simple rails, running diagonally. Only the bridge: no water, no banks. |
| `landmark-ruins.png` | The crumbling ruins of an ancient stone temple: a few broken columns, one fallen arch, mossy blocks. Only the ruins, no ground around them. |
| `landmark-stones.png` | A ring of seven tall grey weathered standing stones, one stone lying fallen, a lintel across two of them. Only the stones, no ground around them. |
| `landmark-lighthouse.png` | A tall round stone lighthouse with a lantern room at the top and a small keeper's cottage at its foot, on a little rocky base. |
| `landmark-windmill.png` | A medieval wooden post windmill with four lattice sails, on a small stone base. |

### 4. Info layer (magenta background, front view)
| File | Prompt (after the style line) |
|---|---|
| `frame-plaque.png` | An empty ornate nameplate, front view: a wide horizontal plate of dark navy enamel, about four times wider than tall, with a thin polished gold rim and small scrolled gold end caps on the left and right. Completely empty in the middle, no text, every part fully solid. (The game writes the province name and bonus on it.) |
