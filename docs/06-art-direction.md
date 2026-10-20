# Art Direction v0.3: "Gilded Atlas" (illustrated, with relief lighting)

*Decided Oct 2. This replaces v0.1 ("Ink & Ember", too simple) and v0.2 (fully realistic painting, which is hard to generate consistently for random maps). AI-generated art throughout; a two-layer map with zoom; rich menus.*

## Reference images
- **Map style and the info layer:** `docs/art/reference-illustrated.jpg` (Gemini)
- **Menus, and the depth and richness to aim for:** `docs/art/reference-mockup.png` (ChatGPT)

Both were made without knowing our rules, so they show things we don't have. The tables below say what to take from each.

## The idea
**A hand-illustrated fantasy atlas that comes alive, under a gilded command table.**
- The map is **illustrated, not photoreal**: bright, clean painted textures and storybook-style trees, mountains, towns and castles.
- The map maker adds **relief lighting** from a height map, so hills, mountains and coasts have real depth and shadow, getting close to the richness of the realistic mockup.
- The menus are dark navy panels with fine gold trim, serif headings, Leader portraits and illustrated icons.
- **Why illustrated:** random maps are built from layers (ground textures, stamped decorations, then borders and banners on top). An illustrated style hides repeats and seams, AI tools produce matching pieces reliably, and it stays light and readable on phones.
- **The rule:** the illustration never carries game state. A crisp **info layer** always shows who holds what, how many troops are there, and what's built.

## What we take from the references
| From | Take |
|---|---|
| Illustrated (Gemini) | **Glowing House borders** (thick colored glow on owned land; neutral land stays natural) · **troop pills** (a number with a small icon, beside a House banner) · a **hover/tap card** for each territory · **specialist figures** on the map (a horseman for cavalry, a catapult for siege) · **capital labels** ("Vornheim / Capital: Vorn Citadel") · **event pop-ups** ("Iron Reach captures Kaelen's Hold") · a **players panel** · **cloud fog** from the edges · **large province names** curving across the land |
| Realistic (ChatGPT) | Navy-and-gold panels, serif headings, **Leader portrait card**, territory card with vista art, minimap, the event feed, and a sense of depth and lighting on the terrain |

**Never shown in our game (both images had them):**
- other resources (food, iron, population, purple gems), "/hr" rates, "Year 342"
- Research
- pause / play / fast-forward
- Spy and Diplomacy actions before M3

## The map: two layers
1. **Illustrated world:**
   - **Terrain textures** (grass, farmland, forest floor, hills, rock and snow, swamp, sand, shallow and deep water) blended by biome.
   - **Relief lighting** from the map maker's height map: soft hill shading, mountain shadows, and coastal depth (lighter shallows fading to deep water).
   - **Decoration sprites** from the map maker's placements: tree clusters, mountain peaks, hills, villages and towns, a castle at each capital, building sprites where built, and ships on sea lanes.
   - Rivers wind along borders; passes are clearly visible gaps in the mountains.
2. **Info layer** (always crisp):
   - **Borders:** House borders on the inside edge of owned land, fading inward; neutral land gets a thin pale line; province borders are heavier. Full rules in "Borders and ownership" below.
   - **Army marker,** at each territory's label point:
     - a small House banner and a **troop pill** with a big bold number (a shield icon for a defending garrison)
     - a Leader crown, the building icon (an outline while under construction), specialist icons and culture shown as 1–5 small dots
   - **Specialist figures:** small illustrated figures beside the army at Near zoom (rider, catapult, scout, engineer, healer).
   - Markers keep a minimum size on screen and never overlap.
   - **Capitals:** a castle sprite and a two-line label (name, then "Capital").
   - **Province names:** large, curved across the land, fading out when you zoom in.
   - **Selection:** a gold glow. **Orders:** gold-trimmed arrows. **Odds:** the four-pip badge.
   - **Hover/tap card:** owner, troops, building, culture, gold value and specialists. When the info isn't certain (spy intel, or "last seen" intel for land you can't see right now, with its age), the number shows with "?".

### Zoom levels
| Zoom | What you see |
|---|---|
| **Far** | Illustration dimmed, House tint stronger, pills show numbers only, province names large. |
| **Mid** (default) | Full illustration, borders, troop pills and building icons. |
| **Near** | Specialist figures and icons, culture dots, gold value and territory names. |

**Tactical view** (one tap): flat House colors with all details and no illustration. It doubles as the low-power and accessibility mode.

### Borders and ownership (revised Oct 3)
Session 4's borders are a good start, but the screenshots show three problems: the glow straddles the line, so where two Houses meet the colours overlap and one wins; the glow spills into the sea and into neighbours' land; and the flat tint muddies the ground (Gules over hills reads brown, Or over grass reads mustard). The rules:
1. **Each House's band sits inside its own land.** Where two Houses meet you see both colours side by side, split by a thin dark ink line. No glow crosses into a neighbour or onto water.
2. **An edge wash, not a flat fill.** The colour is strongest at the border and fades to almost nothing about 15 map units inward, so the middle of a territory keeps its natural ground. At Far zoom the inside tint rises (as now); Tactical view stays flat.
3. **Keep the House colour true on every ground.** Tint so the hue survives the ground underneath (Gules looks red over hills, sand and snow), not a plain see-through fill. Checked with a grid of every House over every ground type. *(Session 11: the map's display shader paints the tint. It greys the ground's own colour first, then lays the House's `land` colour on at the House's own brightness, keeping the painting's light and shade. Gold no longer turns mustard over grass, and red no longer turns brown over forest. Each House's `land` colour is in `apps/web/src/map/houses.ts`.)*
4. **Neutral land:** a thin pale line only. **Between two of your own territories:** the thin pale line only. **Province edges:** heavier, as now.
5. **Selection can't look like a House.** Or and Argent are already pale gold and white, so selection is a gold double rule just outside the House band with a slow pulse, not just a colour.
6. **Remembered land** ("last seen" in the fog): a faint dashed line in the last-seen owner's colour, so the "?" markers and the borders tell the same story.
7. **Borders keep the same on-screen thickness** at every zoom.

These rules read only the map's outlines, so they work unchanged on random and hand-built maps (`docs/07-map-tooling.md`).

### Making the pieces blend
Every map (ours, random or hand-built) is data that one renderer paints, so blending is fixed once, in the renderer and the importer:
- **Colour matching at import.** Each ground texture is nudged to a target colour, brightness and contrast for its ground type (a small palette, kept with the art list), and large light and dark patches are evened out. Sprites get the same treatment, so a tree from one batch matches a tree from the next.
- **One final colour grade** over the painted world, so everything sits in the same light.
- **Natural edges between ground types:** ragged, noise-shaped edges instead of blurred squares, with sensible rules (rock on high, steep ground; snow only on the highest; sand in a thin band along coasts; swamp near low rivers) and a scatter of small "fringe" pieces (bushes at a forest edge, pebbles at a rock edge).
- **Grounded sprites:** a soft contact shadow under each one, cast down and to the right to match the light from the upper left, with slight size, flip and shade changes so repeats don't show.
- **The art test bench** (`docs/07-map-tooling.md`) is where every new art batch gets judged.

### Scenery placed by rules (session 11)
Everything below is worked out by the renderer from the map data alone (`apps/web/src/render/pixi/scenery.ts`), seeded from the map, so the same map always gets the same painting, any new map gets it too, and no map file changes. None of it carries game state.
- **Mountain ranges as ranges:** each range's middle line is found from its outline, and pieces go along it, biggest first, overlapping like a chain. Where the range runs across the screen a wide `ridge-*` goes there; where it runs up and down (a ridge across it would look wrong in this three-quarter view), single peaks stack instead. Smaller single peaks fill the ends and the gaps. Nothing goes near a pass, so the gap and its road stay open, and nothing hangs over a coast or a sea lane's landing. Until the ridge art arrives, three of today's peaks in a row stand in for each ridge.
- **Pass gatehouses:** `pass-gate` stands on every pass road. With it in, the info layer's gate symbol shows at Far and gives way to the painting from Mid in.
- **Sea cliffs:** `cliff-*` on fairly straight stretches of coast that face down the screen (so the rock face shows), with open sea in front and high or rocky land behind; never on sand, never by a sea lane's landing, a banner, a castle or a building site. A few per map.
- **Surf:** a soft, broken white line where the waves meet every coast, and a faint swell a little way out.
- **Bridges:** one where two territories meet across a river, at the middle of their shared border: `bridge-wood` near a river's source or among farmland in its middle reaches, the stone `bridge` further down (the stone one stands in until the wooden art arrives).
- **Landmarks** (decoration only, no name, nothing on the card): about one per 15 territories, spread out: lighthouses on coasts, windmills on farmland, standing stones on grass or hills, ruins almost anywhere. Never on a capital, a building site, a pass, a river, a sea lane's landing, or under a banner or a province plaque.
- **Forests:** inside forests, pines on high ground and further north, broadleaf lower and further south, with a ragged line between; a few lumpy open glades in big forests. Lone trees keep the kind the map maker gave them.
- **Buildings being built:** `scaffold` over the washed-out building (the drawn scaffold stands in until it arrives). **Province plaques** sit on `frame-plaque`, stretched in the middle so its end caps keep their shape (the drawn plaque until then).
- **The Far view** is softer, like one painted atlas: the land is read a little blurrier, with a warm parchment grade and a faint paper grain. The sea is unchanged, and borders, pills and plaques stay crisp.

### Fog
- **Standard fog** (default): a soft, pale haze. The painted land shows faintly through it (desaturated, only lightly darkened) with drifting mist, so the map never reads as a dark blanket early in a game. No owners or troops, except faded "last seen" markers with a "?". (Lightened Oct 2.)
- **Blackout fog** (later, big games): thick cloud banks hide everything until it's explored.

## Menus
- **Palette:** panels Navy `#0F1620` / Raised `#172231`; gold trim `#C9A45C` with a highlight `#E3C77E`; text Parchment `#EDE6D6`, muted `#9AA3AE`; danger `#C2553F`.
- **House tinctures** (bright enough to glow on the illustrated land): Gules, Azure, Vert, Or, Purpure, Tenné, Teal, Murrey, Sable, Argent (Teal replaced Celeste on Oct 2: Celeste looked too much like Azure at Far zoom). Each House also gets a pattern on its banner and shield, so colorblind players can tell them apart.
- **Twenty Houses (session 34), for tables of up to 20:** a second ten, the bots' at a big table (people pick from the first ten): **Rose** (pink, per pale), **Sinople** (dark green, per fess), **Verdigris** (sea green, per bend), **Olive** (chequy), **Chartreuse** (lime, barry), **Cendrée** (ash grey, paly), **Brunâtre** (brown, a lozenge), **Indigo** (a pile), **Carnation** (coral, gyronny), **Sanguine** (blood red, an orle). Heraldry's stains and later tinctures, each with a **two-tone field** in its ink so the second ten read apart from the first by their shields as well as their colour. Chosen by colour difference: every pair of the twenty is at least **17 apart by CIEDE2000** (the closest, Murrey and Sanguine, 17.2; the first ten's own closest, Gules and Tenné, is 20.9), and a test checks it. Not Celeste again: a light blue looked like Azure at Far on Oct 2, so the sea green Verdigris (21 or more from every House) took its place. The power graph gives each a dash of its own. Screenshots: `docs/art/screens/s34-rootholm20-far.jpg`, `s34-rootholm20-mid.jpg` (a 20-seat Rootholm at turn 9, fog off), `s34-houses-phone.jpg` (the phone's panel, "and 12 more").
- **Type:**
  - *Cinzel* for the logo, headings, province and place names
  - *Spectral* for panel text and logs
  - *Manrope 800* (tabular) for every number on the map and in counters
- **Frames:** thin double gold rules with small corner ornaments, in one reusable frame.
- **Icons:** illustrated, from the same art set as the map.

### Desktop layout
| Area | Contents |
|---|---|
| **Top bar** | Logo · gold (+N per turn) · Turn N and the timer · settings |
| **Left rail** | Map, Turn report, Settings (more only as M3 features arrive) |
| **Right column** | Players panel (House, name, Leader portrait, still in or out; no territory counts), event pop-ups, then your Leader |
| **Bottom left** (session 11) | One panel for the selected territory, only as tall as what's in it: the round action buttons (Attack, Recruit, Spend, Culture, Retreat), a slim vista strip, who holds it, troops, terrain/gold/province chips, buildings, culture, then what you can do there. Fogged land shows what you last saw. |
| **Bottom right** (session 11) | The dock: minimap and order queue. It folds down to a slim "Orders (n) · gold left" bar and remembers it. The Lock in seal always shows (and the turn timer is in the top bar). |

**Type scale (session 11):** one scale for titles, body, small print and labels (`--fs-title`, `--fs-body`, `--fs-small`, `--fs-label` in `styles.css`), readable on a laptop at 100% zoom; nothing smaller than the label size.

### Phone layout
The map is full screen with a compact top bar. The action bar sits at the bottom; panels open as a bottom sheet, and the minimap and players panel are toggles.

## The polish pass (Nate, Oct 6)
Nate wants Conquerra to look like a large team with a good budget made it, with special effects in the replay. The plan is `docs/09-polish-and-effects-plan.md`: a cinematic replay, armies that march and fight in dust and smoke, banners raised over captured land, an effect for every event, a living map, menus with weight, and title and game-over art. The art is batch 4 (`docs/art/asset-list-and-prompts.md`); the code is session 21 (BUILT lines under each section of the plan). Session 16 also makes zoom sharp: the map is painted at higher detail where you're looking, and the art is stored bigger. Effects never carry game state, fit inside the replay's timing, respect fog, and have a Full / Light / Off setting.

### Effects, light and the 3D buildings (session 21, as built)
- **One light, from the upper left**, everywhere: the scenery's contact shadows, the walls' shadow and lit top, the buildings' cast shadows (down and to the right), the plinths' lit tops and shaded fronts, the clouds' shadows.
- **Buildings stand up off the land in code** (`render/pixi/solid.ts`): a cast shadow made from the building's own outline, laid flat and leaning away from the light; a low stone plinth (lit top, shaded front, ink edge); a lit rim on the upper-left edges and a shaded rim on the lower-right. Forts, markets, barracks, watchtowers, scaffolds and the capitals' castles. The painted sprites are unchanged: art batch 5 can paint 3D versions.
- **Effects art:** painted on pure black for soft things (smoke, dust, flames, mist, lightning, splash, crack): the importer turns brightness into transparency and keeps the colour, so edges are soft with no fringe; on magenta for solid things (arrows, stones, rocks, coins, leaves, wheat, the scroll, the storm cloud, birds). Blending is in the art list: flames and lightning **add** light, splashes and cracks **screen**, smoke, dust and mist sit on the land as **normal** see-through matter.
- **Layers:** the living map and the replay's show (figures, banners, dust, smoke) sit over the painting and **under** every border, troop pill and plaque; the replay's numbers, results and plaques sit over everything. Nothing decorative may hide the info layer.
- **Effects never carry game state**, play inside the replay's beats, are seeded from the game's public id, the turn and the event (never the dice seed), and look the same on "Watch again". Fogged events are the same pale pulse whatever they were.

## Performance targets
- Aim for 60 fps panning and zooming on a mid-range phone.
- The terrain and relief are drawn once per game into tiles, not every frame.
- Art ships as compressed WebP and loads progressively.

## Art pipeline (AI-generated)
- Nate generates assets with `docs/art/asset-list-and-prompts.md` and drops them into `art/incoming/`.
- An import script trims, resizes, makes textures tile seamlessly, compresses them and registers them in an art manifest.
- Placeholders fill any gaps.
- Confirm the image tool's commercial-use terms before shipping.
