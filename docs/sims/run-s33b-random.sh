#!/usr/bin/env bash
# Session 33b: random maps' income head start, all Marshals, by exposure, on session 33's 300 maps a size (the same
# game seeds, s33, so each game pairs with session 33's k = 8 game on the same map). Usage:
#   run-s33b-random.sh <tag> [extra args...]   e.g. run-s33b-random.sh mkt --version 5 --income '{"spots":"all"}'
# Writes docs/sims/s33b-random-<tag>-<size>-from0.{txt,json}; put them together with s33-combine.ts --prefix s33b <tag>.
tag=$1; shift
for sp in "40 4" "80 4" "120 6" "200 8"; do
  read -r size players <<<"$sp"
  npx tsx apps/sim/scripts/s30-sims.ts --random "$size:all:300" "$players" --start 0 --seed s33 --json "docs/sims/s33b-random-$tag-$size-from0.json" "$@" > "docs/sims/s33b-random-$tag-$size-from0.txt" 2>&1
done
