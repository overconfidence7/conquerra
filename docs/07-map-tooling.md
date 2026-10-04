# Map Tooling: the map maker, random maps and the map builder

*Written Oct 3 (orchestrator), after Nate raised a custom map builder as a future add-on. Nothing here is built yet; this is the plan and the guardrails so today's work doesn't close any doors.*

## The short answer
**Yes, random maps and a map builder should share one foundation, but not one schedule.** What they share is the map maker's pipeline, its quality checks and the renderer. The builder's screens are a separate, later job. So the order is:

1. **Map lab** (early M3, dev-only): a page where you pick a seed and a few knobs and see the real illustrated map, its quality checks and a gallery of seeds. It costs little, helps Nate curate maps now, and doubles as the art test bench (below).
2. **Random maps** (M5): split the map maker into stages that can be re-run on their own, then offer "Random map" in the lobby.
3. **Map builder** (M6, or sooner if Nate wants it): screens for editing each stage by hand, on top of the same pipeline.

Each step reuses most of the one before it. Building the builder first would mean building the pipeline split anyway, with a much bigger interface on top, before we know what random maps need.

## What's shared
| Piece | Random maps use it to… | The builder uses it to… |
|---|---|---|
| **The cell mesh** (the map is made of ~thousands of small cells) | grow land, territories and provinces | paint land, water, terrain and territories cell by cell, so every border still comes out smooth and shared |
| **Outline code** (one shared line between neighbours, no gaps) | draw borders, coasts and ranges | the same, after every edit, so hand-made borders always render correctly |
| **Quality checks** (`checks.ts`: connected, no slivers, fair capitals, choke points) | throw away a bad map and try the next seed | show live warnings ("Capital 3 is two steps closer to gold than Capital 5") |
| **Placement** (decorations, label points, building and castle sites) | dress the map | re-dress only the part you just edited |
| **Names** | name everything | name everything, with your overrides kept |
| **The renderer** | draw it | preview it exactly as players will see it |

## How the pipeline should change (M5)
Today `generateMap` runs every step in one pass with one shared random stream. That's fine for fixed maps, but it means changing one early step reshuffles everything after it.

- **Stages:** land and height → water and mountain ranges → rivers → territories → provinces → capitals → ground types → places and decorations → names → checks.
- **Each stage gets its own random stream**, made from the seed plus the stage's name. Changing the territories then doesn't re-roll every tree on the map.
- **Pins:** any stage's result can be pinned with hand edits. A random map has no pins. A hand-made map is a recipe (seed and knobs) plus its pins, and the later stages re-run around them.
- **Saved maps keep the finished result too.** A published map stores its full geometry, so a later map-maker update never changes a map people already play. (The existing `MAPGEN_VERSION` number tracks this.)

## How this answers the blending and border question
- **Maps are data, never pictures.** Whether a map is generated or built by hand, it ends up as the same thing: outlines, a ground-type grid, a height map and decoration spots. The renderer paints all of it with the same textures, lighting and sprites. So blending gets solved **once, in the renderer**, and every map (ours, random or custom) gets the fix.
- **Borders are always computed, never drawn freehand.** In the builder you assign cells to territories (or split, merge and nudge), and the outline code redraws the shared line. That's what keeps the House border rules in `06-art-direction.md` working on any map.
- **The builder paints ground types, not images.** Nobody pastes a picture into a map; you paint "forest" and the renderer decides how forest meets grass.

## Guardrails from now on (all sessions)
- The map maker stays pure and seeded (same seed, same map), like the engine.
- The renderer reads only `geometry` and never has special cases for one map.
- Every map, ours or generated, passes `checkMap` before it's used.
- New art is judged on the art test bench, not just on Embervale.

## The art test bench (part of the map lab)
- **House-on-ground grid:** each House colour's border and tint over each ground type, at Far, Mid and Near.
- **Ground sampler:** a small generated map where every pair of ground types touches (forest next to sand, snow next to swamp, and so on), plus a coast and a river through hills.
- **Seed gallery:** 12 random maps side by side.
- Every new art batch gets checked here, and the screenshots go in `docs/art/screens/bench/`.

## Questions for Nate
1. **Who is the builder for?** Just you (a desktop tool for making our maps) or players (a feature they use and share)? A player feature needs undo, a phone-friendly layout, sharing and moderation, roughly three times the work. Suggestion: build it for you first, and open it to players later.
2. **Should player-made maps be playable online?** If so, they need storage and a review step (M4 infrastructure or later).
