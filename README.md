# Conquerra

A fantasy, military-first strategy game of rival kingdoms. Everyone sets their orders in secret during a 5-minute window; then all the plans play out at once, one action per player at a time, in a shuffled order, and everyone watches the replay of what they could see.

- Design: [`docs/02-game-design-outline.md`](docs/02-game-design-outline.md) plus [`docs/04-design-additions.md`](docs/04-design-additions.md) (04 wins where they disagree)
- Rules as built: [`docs/rules-reference.md`](docs/rules-reference.md)
- Build plan: [`docs/03-build-plan.md`](docs/03-build-plan.md)
- Decisions: [`docs/decisions.md`](docs/decisions.md)
- Will live at **conquerra.overconfidenceonline.com**

## How to play it locally (Windows)

You only need to do steps 1–2 once.

1. Install **Node.js 22 or newer** from [nodejs.org](https://nodejs.org) (the "LTS" button; accept the defaults).
2. Open **PowerShell**, then copy and paste these lines one at a time:
   ```
   npm install -g pnpm
   cd "C:\Users\nkurt\Claude\Projects\Strategy Game"
   pnpm install
   ```
3. Every time you want to play, open PowerShell and paste:
   ```
   cd "C:\Users\nkurt\Claude\Projects\Strategy Game"
   pnpm dev
   ```
   Your browser opens the game (if it doesn't, go to http://localhost:5173). Leave the PowerShell window open while you play; press `Ctrl+C` in it to stop.

**How a turn works:** tap one of your territories (blue), then tap a neighbour to move or attack. Pick how many troops ("Just enough" is a good default), tap a preset if you like, then "Add attack". Recruit, hire, build and raise culture from the panel. When you're done, press **Lock in**: the bots plan their orders, everything plays out at once, and you get a report of what you could see.

## What's here

| Folder | What it is |
|---|---|
| `packages/content` | Game data: the test maps (Embervale, 40 territories, up to 6 players; Greatmarch, 80 territories, up to 10) and every balance number (`data/rules.json`) |
| `packages/mapgen` | The map maker: seeded maps with coasts, seas, lakes, mountain ranges and passes, rivers, sea lanes, provinces, fair capitals, and the drawing data (biomes, height map, decorations). `pnpm build-maps` rebuilds the test maps and their previews in `docs/maps/` |
| `packages/engine` | The rules of the game. Pure, deterministic TypeScript: same seed + same orders = same result, every time |
| `packages/bots` | AI players. "Recruit" is the first, simplest tier |
| `apps/sim` | Runs bot-vs-bot games and reports balance stats and CPU time |
| `apps/web` | The browser game (React + Vite). The engine and bots run in a background "local game host", and the screen only ever sees what your kingdom can see, just as it will when there's a real server |

## Running it

You need [Node.js 22+](https://nodejs.org) and pnpm (`npm install -g pnpm`). Then, from this folder:

```
pnpm install                          # one time
pnpm dev                              # play in the browser
pnpm build                            # build the web game (what CI checks)
pnpm test                             # run all the tests
pnpm typecheck                        # check the code for type mistakes
pnpm sim                              # 500 bot games, 4 players, prints stats
pnpm sim --games 1000 --players 2,4,6 # several table sizes at once
pnpm sim --games 200 --players 10     # 10 players (uses the Greatmarch map)
pnpm sim --watch --seed demo          # play-by-play of one game in plain English
pnpm sim --luck 0                     # no luck at all; try 0.5 for more chaos
pnpm sim --mode conquest --turn-limit 20
```

## Tuning balance

Edit `packages/content/data/rules.json` and re-run `pnpm sim`. To try a change without editing the file:

```
npx tsx apps/sim/src/tune.ts '{"troops":{"cost":3}}' 200 2,4,6
```

Two more helpers: `npx tsx apps/sim/src/longest.ts 6 100` finds the longest of 100 six-player games, and `npx tsx apps/sim/src/trace.ts 6 <seed>` prints that game turn by turn (land / troops / gold / income per player).
