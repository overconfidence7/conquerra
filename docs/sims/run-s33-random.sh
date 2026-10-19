#!/usr/bin/env bash
# Session 33: random maps' graded head start, all Marshals, by exposure. Usage:
#   run-s33-random.sh <tag> <start> <count> [extra args...]   e.g. run-s33-random.sh k5 100 200 --grade '{"k":5}'
# Maps seedWords(start .. start+count-1) at each size, one game each; the text report and every game (JSON) are kept.
tag=$1; start=$2; count=$3; shift 3
for sp in "40 4" "80 4" "120 6" "200 8"; do
  read -r size players <<<"$sp"
  npx tsx apps/sim/scripts/s30-sims.ts --random "$size:all:$count" "$players" --start "$start" --seed s33 --json "docs/sims/s33-random-$tag-$size-from$start.json" "$@" > "docs/sims/s33-random-$tag-$size-from$start.txt" 2>&1
done
