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
   - **Borders:** owned land gets a thick House-colored glowing outline with a light tint inside. Neutral land gets a thin pale line. Province borders are heavier.
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

### Fog
- **Standard fog** (default): the land is visible, desaturated and darkened, with drifting mist. No owners or troops.
- **Blackout fog** (later, big games): thick cloud banks hide everything until it's explored.

## Menus
- **Palette:** panels Navy `#0F1620` / Raised `#172231`; gold trim `#C9A45C` with a highlight `#E3C77E`; text Parchment `#EDE6D6`, muted `#9AA3AE`; danger `#C2553F`.
- **House tinctures** (bright enough to glow on the illustrated land): Gules, Azure, Vert, Or, Purpure, Tenné, Teal, Murrey, Sable, Argent. Each House also gets a pattern on its banner and shield, so colorblind players can tell them apart.
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
| **Right column** | Players panel (House, name, Leader portrait, still in or out; no territory counts), event pop-ups, then the territory card |
| **Bottom** | The action bar of big round icon buttons (Move/Attack, Recruit, Hire, Build, Culture, Retreat), the army panel, the order queue, the Lock in seal and the minimap |

### Phone layout
The map is full screen with a compact top bar. The action bar sits at the bottom; panels open as a bottom sheet, and the minimap and players panel are toggles.

## Performance targets
- Aim for 60 fps panning and zooming on a mid-range phone.
- The terrain and relief are drawn once per game into tiles, not every frame.
- Art ships as compressed WebP and loads progressively.

## Art pipeline (AI-generated)
- Nate generates assets with `docs/art/asset-list-and-prompts.md` and drops them into `art/incoming/`.
- An import script trims, resizes, makes textures tile seamlessly, compresses them and registers them in an art manifest.
- Placeholders fill any gaps.
- Confirm the image tool's commercial-use terms before shipping.
