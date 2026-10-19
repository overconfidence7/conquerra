import data from "../data/random-maps.json";
import type { RandomMaps } from "./schemas";

/**
 * Random maps' versions (sessions 31 and 33): `data/random-maps.json`, its schema `RandomMaps` in `schemas.ts`. Its own
 * entry point (no Zod), so it loads with the map maker and the lobby's random-map card, never with the game's start-up.
 */
export const randomMaps: RandomMaps = data as RandomMaps;
