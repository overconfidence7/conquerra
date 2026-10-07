import type { PlayerId, PlayerStats, PlayerView } from "@conquerra/engine";

/**
 * The end of the game (session 16, Nate #11): the awards, worked out from what each House did (the game's record,
 * shown to everyone once the game is over). Ties are shared. An award nobody earned (no spy ever got in, no deal
 * ran its course) isn't given.
 */
export interface Award {
  id: string;
  title: string;
  /** What it's for, in a line. */
  for: string;
  winners: PlayerId[];
  /** "12 battles won". */
  value: string;
}

type Stat = keyof PlayerStats;
const DEFS: { id: string; title: string; for: string; stat: Stat; unit: (n: number) => string }[] = [
  { id: "military", title: "Best Military", for: "The most battles won", stat: "battlesWon", unit: (n) => `${n} battle${n === 1 ? "" : "s"} won` },
  { id: "culture", title: "Best Culture", for: "The most culture raised", stat: "culture", unit: (n) => `${n} level${n === 1 ? "" : "s"} of culture` },
  { id: "builder", title: "Master Builder", for: "The most buildings finished", stat: "buildings", unit: (n) => `${n} building${n === 1 ? "" : "s"}` },
  { id: "spymaster", title: "Spymaster", for: "The most spies into a rival's province", stat: "infiltrations", unit: (n) => `${n} infiltration${n === 1 ? "" : "s"}` },
  { id: "diplomat", title: "Diplomat", for: "The most deals kept to the end", stat: "dealsKept", unit: (n) => `${n} deal${n === 1 ? "" : "s"} kept` },
  { id: "wall", title: "Iron Wall", for: "The most attacks held off", stat: "holds", unit: (n) => `${n} attack${n === 1 ? "" : "s"} held off` },
  { id: "kingslayer", title: "Kingslayer", for: "The most rival Leaders felled", stat: "leadersKilled", unit: (n) => `${n} Leader${n === 1 ? "" : "s"} felled` },
  { id: "fortune", title: "Fortune's Favourite", for: "The most good Fate on their land", stat: "fateGood", unit: (n) => `${n} good turn${n === 1 ? "" : "s"} of Fate` },
  { id: "quartermaster", title: "Quartermaster", for: "The most troops raised", stat: "recruited", unit: (n) => `${n} troops recruited` },
  { id: "oathbreaker", title: "Oathbreaker", for: "The most handshake deals broken (an honour of sorts)", stat: "dealsBroken", unit: (n) => `${n} deal${n === 1 ? "" : "s"} broken` },
];

export function awardsFor(view: Pick<PlayerView, "players" | "winner" | "turn" | "stats">): Award[] {
  const stats = view.stats;
  if (!stats) return [];
  const ids = view.players.map((p) => p.id);
  const out: Award[] = [];
  for (const d of DEFS) {
    const best = Math.max(0, ...ids.map((p) => stats[p]?.[d.stat] ?? 0));
    if (best <= 0) continue;
    out.push({ id: d.id, title: d.title, for: d.for, winners: ids.filter((p) => (stats[p]?.[d.stat] ?? 0) === best), value: d.unit(best) });
  }
  // Survivor: of everyone but the winner, who held out longest (still standing at the end beats any knock-out).
  const others = view.players.filter((p) => p.id !== view.winner);
  if (others.length && view.winner && view.winner !== "draw") {
    const lasted = (p: (typeof others)[number]) => p.eliminatedTurn ?? view.turn + 1;
    const longest = Math.max(...others.map(lasted));
    const who = others.filter((p) => lasted(p) === longest);
    out.push({ id: "survivor", title: "Survivor", for: "Held out longest against the winner", winners: who.map((p) => p.id), value: longest > view.turn ? "still standing at the end" : `lasted until turn ${longest}` });
  }
  return out;
}

/** Each House's share of the map (0..1) after every turn, for the power graph. */
export function powerSeries(view: Pick<PlayerView, "players" | "history">, territories: number): { player: PlayerId; points: { turn: number; share: number }[] }[] {
  const history = view.history ?? [];
  return view.players.map((p) => ({ player: p.id, points: history.map((h) => ({ turn: h.turn, share: (h.land[p.id] ?? 0) / Math.max(1, territories) })) }));
}
