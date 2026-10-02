# Conquerra

A fantasy, military-first strategy game of rival kingdoms. Everyone sets their orders in secret during a 5-minute window; then all the plans play out at once, one action per player at a time, in a shuffled order, and everyone watches the replay of what they could see.

- Design: [`docs/02-game-design-outline.md`](docs/02-game-design-outline.md) plus [`docs/04-design-additions.md`](docs/04-design-additions.md) (04 wins where they disagree)
- Rules as built: [`docs/rules-reference.md`](docs/rules-reference.md)
- Build plan: [`docs/03-build-plan.md`](docs/03-build-plan.md)
- Decisions: [`docs/decisions.md`](docs/decisions.md)
- Will live at **conquerra.overconfidenceonline.com**

## What's here (Milestone 1)

| Folder | What it is |
|---|---|
| `packages/content` | Game data: the test maps (Embervale, 40 territories, up to 6 players; Greatmarch, 80 territories, up to 10) and every balance number (`data/rules.json`) |
| `packages/engine` | The rules of the game. Pure, deterministic TypeScript: same seed + same orders = same result, every time |
| `packages/bots` | AI players. "Recruit" is the first, simplest tier |
| `apps/sim` | Runs bot-vs-bot games and reports balance stats and CPU time |

## Running it

You need [Node.js 22+](https://nodejs.org) and pnpm (`npm install -g pnpm`). Then, from this folder:

```
pnpm install                          # one time
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
