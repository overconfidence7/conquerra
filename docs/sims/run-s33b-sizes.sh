#!/usr/bin/env bash
# Session 33b, Part 2: random maps at 300 and 400 territories, all Marshals, version 5 (the shipped head start).
# 100 maps a run (seedWords(0..99), the five shapes in turn), one game each, seed s33b. Writes
# docs/sims/s33b-random-<tag>-<size>-[<players>p-]from0.{txt,json}; table with s33-combine.ts --prefix s33b <tag>.
run() { # tag size players [extra args]
  local tag=$1 size=$2 players=$3; shift 3
  local name="$size-from0"; [ "$size" = 300 ] && name="$size-${players}p-from0"
  npx tsx apps/sim/scripts/s30-sims.ts --random "$size:all:100" "$players" --seed s33b --json "docs/sims/s33b-random-$tag-$name.json" "$@" > "docs/sims/s33b-random-$tag-$name.txt" 2>&1
}
run big 300 8
run big 400 10
run big 300 10
run bigbo 400 10 --fog blackout
