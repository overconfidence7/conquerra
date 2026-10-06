# Conquerra Art: Asset List and Prompt Pack

*For Nate, to generate art with an AI image tool. Save each file into `art/incoming/` in the project folder, using the exact file name shown. Claude Code's import script handles resizing, trimming, seamless tiling and compression. Anything still missing shows as a placeholder, so work in priority order and don't worry about finishing everything.*

**Status (Oct 3):** every Tier 1 and Tier 2 item below is in `art/incoming/` (79 files). Tier 3 is still to do.

**In the game (Oct 4, session 6):** all 79 imported and judged on both maps. Worth redoing, in order: (1) `tree-conifer-1` and `-2` (still round bushes; use the pine prompt below, "clear spiky tips"); (2) `terrain-rock` and `terrain-snow` (big boulders; mostly hidden under mountain sprites, so low priority); (3) `terrain-hills` (big swirls). Everything else fits; the importer fixed the pink edges, the `tree-broadleaf-3` smudge and the cream clouds.

**Batch 3 (made Oct 6):** all 20 pieces are in `art/incoming/` (old versions of the redone files in `_old/`, contact sheet `_review/batch-3.png`, a paler chalk cliff in `_review/_alt/cliff-3-chalk.png`). Session 12 imports them. The pines came out as steep-angle fir clusters rather than straight overhead (Gemini wouldn't do overhead pines without making thistle-like stars); they read as pines at game size.

**Batch 4 (Oct 6):** about 50 pieces for the polish pass (effects for the replay, key art, the new specialists and spies, scenery fixes), listed under Tier 3 below and made with `docs/prompts/gemini-art-session-04.md`.

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

**Lessons from batch 3 (Oct 6):**
- **Textures:** Gemini quietly builds "seamless tileable" textures out of copies of one small patch (a 4×4 or 2×2 grid). Don't say "seamless tileable texture". Say "bird's-eye view looking straight down from very high above at a vast [ground]… one continuous scene, nothing repeats, no grid", ask for 16:9 with only the mockup attached, then crop a square from the middle. Check every texture for repeats inside the image, not just when tiled 3×3.
- **Ridges and cliffs:** "camera faces it straight on… runs perfectly horizontally, NOT diagonal". For cliffs add "both ends taper naturally into tumbled rocks, not cut off like a block".
- **Mountain colour:** "cold blue-grey granite, heavy snow on the upper third" matches the existing peaks; without it, ridges come out brown.
- **Windmill-like sprites:** "turned to face the viewer, four sails in a clean symmetrical X, no ladders or tail pole".
- **Silhouettes (map masks):** "the whole [shape] is ONE single solid black shape, no white lines or gaps inside", or the inner lines split the land.
- **Chat length:** start a fresh chat after about 6 images; the magenta drifts darker in long chats (past the importer's tolerance).
- **Driving Gemini from Claude in Chrome:** pick menu items by element, not by screen position (the menu moves with the greeting text; one position click opened Deep Research).

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

### Batch 4 (Oct 6): to make now, for sessions 16 and 20
*About 50 images, for the polish pass (`docs/09-polish-and-effects-plan.md`) and the fixes found on the bench. Same rules as above: the style line first (except where noted), PNG into `art/incoming/` with the exact file name. Work in the order below; anything missing simply waits for a later batch. Session 20 (the polish pass) registers these names and moves this list into its own "## Batch 4" section after Batch 3 (it sits under Tier 3 until then, because a test counts the names from the Batch 3 heading onward against the game's registry).*

**Two new backgrounds in this batch:**
- **Magenta** (as before) for solid objects.
- **Pure black (#000000)** for soft effects (`fx-` pieces marked "black"): smoke, dust, flames, mist, lightning and the like. The importer turns their brightness into transparency, so they keep soft edges with no fringe. End those prompts with: *"on a pure black (#000000) background filling the entire image; soft edges fading smoothly into the black; nothing touches the edges of the image; no ground, no other objects."*

#### 1. Redo (same file names; the new file replaces the old one)
| File | Prompt (after the style line) | Why |
|---|---|---|
| `terrain-hills.png` | Bird's-eye view looking straight down from very high above at vast rolling green upland pasture: short lush grass in several greens, small darker tufts, a few tiny pale stones, only a little bare earth. Completely flat, even lighting, no shadows, no big shapes. One continuous scene, nothing repeats, no grid. (16:9; crop a square from the middle.) | Reads as brown dirt at Near. |
| `tree-conifer-1.png`, `tree-conifer-2.png` | As batch 3's pines (a small cluster of 3–5 tall, narrow pointed pines seen from above at a slight angle, a dark green star of spiky branch tips around a pointed top, a narrow pointed shadow), but **a warm deep green like the oak trees, not blue-green**. Attach `tree-broadleaf-1.png` as the colour reference. | Bluer than the broadleaf trees. |
| `scaffold.png` | Low, wide wooden construction scaffolding, **about as tall as it is wide**: a single storey of rough timber poles and lashed crossbeams with wide open gaps between them, one short ladder, a small rope hoist, a few planks and cut stone blocks at its foot. Nothing inside it. | Too tall; it hid the building. |
| `bridge-wood.png` | A rustic wooden bridge, **longer and lighter**: pale weathered planks on light timber trestles with simple rails, running diagonally, clearly longer than it is wide. Only the bridge: no water, no banks. | Small and dark at Mid. |

#### 2. The new specialists and spies
Icons as in Tier 2 (bold, simple, reads at 24 px, thin light-gold rim, magenta, *"Every part fully solid. Single icon centered filling about 60% of the image, wide empty margin, no shadow, no badge, no circle, no frame behind it, no text."*). Figures as the other figures (three-quarter view, plain white/light-grey cloth so the game can tint them, magenta).
| File | Prompt (after the style line) |
|---|---|
| `icon-rangers.png` | A longbow with an arrow nocked, held diagonally, a small sprig of green oak leaves tied at its grip. |
| `icon-standard-bearer.png` | A tall wooden pole with a gold finial and a swallow-tailed war banner streaming to the right, plain white/light-grey cloth with gold trim. |
| `icon-spy.png` | A dark hooded cloak seen from the front with the face hidden in shadow, a slim dagger held diagonally in front of it. |
| `figure-rangers.png` | Two woodland rangers in hooded plain white/light-grey cloaks over green-brown leather, one drawing a longbow, one kneeling with an arrow ready, a few fern leaves at their feet. |
| `figure-standard-bearer.png` | A single armoured soldier in a plain white/light-grey tabard holding a tall pole with a large swallow-tailed plain white war banner streaming in the wind. |
| `figure-spy.png` | A lone hooded figure in a long plain dark-grey cloak, mid-stride, face hidden, one hand on a dagger at the belt. |

#### 3. Effects for battles (for the replay)
| File | Background | Prompt (after the style line) |
|---|---|---|
| `fx-smoke-1.png` … `-3.png` | black | A single soft billowing puff of battle smoke, white and pale grey with gentle shading, soft and cloudy. (Make 3 different shapes: one round puff, one tall rising column, one wide low drift.) |
| `fx-dust-1.png`, `fx-dust-2.png` | black | A low, wide cloud of dust kicked up from the ground, warm pale tan and cream, wispy edges. (Make 2: one wide and low, one round swirl.) |
| `fx-flame-1.png` … `-3.png` | black | A single tongue of fire: bright yellow-white core, orange and deep red at the edges, flickering upward. (Make 3 different flames: small, tall, and a wide cluster.) |
| `fx-impact.png` | black | A burst of earth, dust and small stone debris flying outward from a single point of impact, seen from three-quarter view above, warm grey-brown. |
| `fx-arrow.png` | magenta | A single wooden arrow with grey goose feathers and an iron tip, pointing right, perfectly horizontal. |
| `fx-stone.png` | magenta | A single rough round catapult stone, grey granite with chips and a little moss. |

#### 4. Effects for events, deals and the map
| File | Background | Prompt (after the style line unless noted) |
|---|---|---|
| `fx-splash.png` | black | A splash of water thrown up into the air, white foam and droplets, seen from three-quarter view above. |
| `fx-wisp-1.png`, `fx-wisp-2.png` | black | A thin drifting wisp of mist, white, translucent and swirling. (Make 2 different shapes.) The game tints it (sickly green for plague, grey for fog). |
| `fx-lightning-1.png`, `fx-lightning-2.png` | black | A single forked lightning bolt, bright white with a pale blue glow, top to bottom. (Make 2 different forks.) |
| `fx-crack.png` | black | A single jagged crack, like a split in stone or a torn line, bright white, running left to right. No style line. |
| `fx-storm-cloud.png` | magenta | A dark brooding storm cloud seen from above at a slight angle, charcoal and slate blue, heavy and billowing, wider than tall. |
| `fx-rock-1.png`, `fx-rock-2.png` | magenta | A single tumbling rough grey boulder with sharp broken edges. (Make 2 different rocks.) |
| `fx-coin.png` | magenta | A single thick gold coin seen at a slight angle, with an engraved compass-star on its face. |
| `fx-leaf.png` | magenta | A single green laurel leaf with a touch of gold at its edge. |
| `fx-wheat.png` | magenta | A single golden ear of wheat with its stalk, curving gently. |
| `fx-scroll.png` | magenta | An unrolled parchment scroll seen from the front, warm cream paper with wooden rollers at the top and bottom, completely blank, wider than tall. |
| `fx-birds.png` | magenta | A small loose flock of five dark birds in flight seen from above, wings spread, in a rough V. |
| `landmark-windmill-body.png` | magenta | The same medieval wooden post windmill as `landmark-windmill.png` (attach it), but **with no sails at all**: only the wooden body, its roof and its stone base, the hub where the sails would join visible on the front. |
| `landmark-windmill-sails.png` | magenta | Only the four lattice windmill sails in a clean symmetrical X, seen straight from the front, with the round hub in the exact centre. No building, nothing else. (The game turns them.) |

#### 5. Key art (no magenta; Gemini's widest ratio)
| File | Prompt (after the style line) |
|---|---|
| `art-title.png` | A grand painted scene of a fantasy campaign table in a war tent at night: a richly painted atlas of islands and mountains spread across the table, brass compass and dividers, small carved army figures and ships, red wax seals, a dagger pinning a corner, candlelight and lantern glow, the tent's canvas dark around the edges. **The left third calmer and darker** (the menu sits there). No text, no people's faces. |
| `art-victory.png` | A triumphant army on a green hilltop at sunrise, seen from behind and a little above: ranks of soldiers raising spears, a tall plain gold-and-white banner at the front, a castle on the next hill with smoke clearing, golden light breaking through clouds. No text. |
| `art-defeat.png` | A lone torn banner on a broken pole in the mud of a quiet battlefield at dusk, a fallen shield and helmet beside it, smoke drifting over a burned-out castle in the distance, crows on a dead tree, cold blue-grey light. No text. |

#### 6. Scenery additions (for the polish pass, session 20)
| File | Prompt (after the style line) |
|---|---|
| `peak-narrow-1.png` … `-3.png` | A single tall, narrow mountain peak, much taller than it is wide, cold blue-grey granite with heavy snow on the upper third, small dark pines at the base. (Make 3 different peaks.) For ranges that run up and down the screen. |
| `ridge-diag-1.png`, `ridge-diag-2.png` | A short mountain ridge of three or four connected peaks running **diagonally from lower-left to upper-right at about 35°**, cold blue-grey granite with snow on the highest, small dark pines at the base. (Make 2.) |
| `cliff-side-1.png`, `cliff-side-2.png` | A short stretch of rocky sea cliff **seen from the side, running from the top of the image to the bottom**, the rock face turned to the right, a grassy top edge on the left, a thin line of white foam along its right edge. Both ends taper into tumbled rocks. Only the cliff and foam. (Make 2.) |
| `fringe-bush-1.png` … `-3.png` | A small cluster of two or three low green bushes and one young sapling, seen almost directly overhead. (Make 3.) For forest edges. |
| `glade-1.png`, `glade-2.png` | A small round forest meadow seen straight from above: soft grass, a few wildflowers, a fallen mossy log, edges fading softly into the magenta. (Make 2.) |
| `paper-grain.png` | No style line, no magenta: bird's-eye view of a large sheet of warm neutral parchment paper, very flat and even, fine fibres and faint mottling only, no stains, no edges, no folds, one continuous sheet, nothing repeats. (16:9; crop a square from the middle.) |

*(This list sits under Tier 3 on purpose: a test counts the file names in Tiers 1–2 and from the Batch 3 heading onward against the game's art list. Session 20 moves it.)*

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
