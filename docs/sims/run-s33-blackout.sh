#!/usr/bin/env bash
# Session 33, Part 2: the personalities and your leaders under blackout. Usage:
#   run-s33-blackout.sh <tag> '<tweak json or empty>' <what...>
#   what: personalities-on | personalities-blackout | pair-blackout (the Turtle and the Opportunist only) | delegate-on | delegate-blackout
# The tweak is merged into named personalities (the tournament's --tweak, s23-tables' last argument); MARSHAL_PATCH in
# the environment changes the shared settings (explore.leaders). Each run's output: docs/sims/s33-bo-<tag>-*.txt.
tag=$1; tweak=$2; shift 2
for what in "$@"; do
  fog=${what##*-}
  case $what in
    personalities-*|pair-*)
      list="turtle opportunist conqueror blitzer schemer merchant"; [ "${what%%-*}" = pair ] && list="turtle opportunist"
      for p in $list; do
        npx tsx apps/sim/src/tournament.ts --table embervale:4 --seats marshal-$p,marshal,marshal,marshal --games ${GAMES:-300} --fog $fog --seed s33 ${tweak:+--tweak "$tweak"} > "docs/sims/s33-bo-$tag-$p-$fog.txt" 2>&1
      done ;;
    delegate-*)
      npx tsx apps/sim/scripts/s23-tables.ts delegate ${DGAMES:-300} wyrmland:6 s33 --fog $fog $tweak > "docs/sims/s33-bo-$tag-delegate-$fog.txt" 2>&1 ;;
  esac
done
