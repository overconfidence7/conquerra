# Conquerra

A fantasy strategy game of rival kingdoms, played online in async turns. Everyone writes a chain of orders in secret; then all the plans play out at once, one action per player at a time, in a shuffled order.

- Design: [`docs/02-game-design-outline.md`](docs/02-game-design-outline.md)
- Build plan: [`docs/03-build-plan.md`](docs/03-build-plan.md)
- Decisions: [`docs/decisions.md`](docs/decisions.md)
- Will live at **conquerra.overconfidenceonline.com**

## What's here (Milestone 1)

| Folder | What it is |
|---|---|
| `packages/content` | Game data: the test map (Embervale, 40 territories) and every balance number (`data/rules.json`) |
| `packages/engine` | The rules of the game. Pure, deterministic TypeScript: same seed + same orders = same result, every time |
| `packages/bots` | AI players. "Recruit" is the first, simplest tier |
| `apps/sim` | Runs bot-vs-bot games and reports balance stats |

## Running it

You need [Node.js 22+](https://nodejs.org) and pnpm (`npm install -g pnpm`). Then, from this folder:

```
pnpm install                 # one time
pnpm test                    # run all the tests
pnpm sim                     # 500 bot games, 4 players, prints stats
pnpm sim --players 6 --games 1000
pnpm sim --watch --seed demo # play-by-play of one game in plain English
pnpm sim --luck 0            # no luck at all; try 0.5 for more chaos
pnpm sim --mode conquest --turn-limit 20
```

To tweak balance, edit `packages/content/data/rules.json` and re-run `pnpm sim`.
