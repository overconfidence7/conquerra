import { defaultRules, type MapDef } from "@conquerra/content";
import { loadMap } from "@conquerra/content/loadMap";
import { LAYOUT_VERSION } from "@conquerra/content/bigTables";
import { createGame, readSave, replayFor, resolveTurn, viewFor, type GameContext, type GameState, type Order, type OrdersByPlayer, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import { cloudBorders, dealPersonalities, knownMap, makeMarshalBot, type MarshalBot } from "@conquerra/bots";

/**
 * Session 32's "What a bot knew" page, in the background: plays a blackout game with Marshals to turn N (or opens a
 * saved game) and sends back one seat's view, the orders its Marshal gives from that view alone, and the cloud's edge.
 * In a worker so none of this joins the game's start-up code.
 */
export type KnownRequest = { type: "play"; mapId: string; players: number; seed: string; seat: number; turn: number } | { type: "save"; text: string; seat: number };
export type KnownResponse =
  | { type: "shot"; mapId: string; view: PlayerView; orders: Order[]; bot: string; known: number; edge: { id: string; borders: number }[] }
  | { type: "error"; error: string };

const scope = self as unknown as { onmessage: ((e: MessageEvent<KnownRequest>) => void) | null; postMessage(msg: KnownResponse): void };

function shot(ctx: GameContext, mapId: string, view: PlayerView, orders: Order[], bot: string): KnownResponse {
  const known = knownMap(ctx.map, view);
  const edge = known.territories.flatMap((t) => (cloudBorders(known, t.id) > 0 ? [{ id: t.id, borders: cloudBorders(known, t.id) }] : []));
  return { type: "shot", mapId, view, orders, bot, known: known.territories.length, edge };
}

async function play(r: Extract<KnownRequest, { type: "play" }>): Promise<KnownResponse> {
  const map: MapDef = await loadMap(r.mapId);
  const ctx: GameContext = { map, rules: defaultRules };
  const ids = Array.from({ length: r.players }, (_, i) => `p${i + 1}`);
  const deal = dealPersonalities(r.seed, ids);
  const bots = new Map<string, MarshalBot>(ids.map((p) => [p, makeMarshalBot(deal[p]!)]));
  let s: GameState = createGame(ctx, { gameId: `known-${r.seed}`, seed: r.seed, players: ids.map((id, i) => ({ id, name: `Seat ${i + 1}` })), settings: { fog: "blackout", luck: defaultRules.combat.luck }, startBonus: true, layouts: LAYOUT_VERSION });
  let last = new Map<string, ReplayEvent[]>();
  const me = ids[r.seat]!;
  for (;;) {
    const orders: OrdersByPlayer = {};
    for (const p of s.players.filter((x) => x.eliminatedTurn === null)) orders[p.id] = bots.get(p.id)!.plan(ctx, viewFor(ctx, s, p.id), last.get(p.id));
    if (s.turn >= r.turn || s.winner || s.players.find((p) => p.id === me)!.eliminatedTurn !== null) return shot(ctx, r.mapId, viewFor(ctx, s, me), orders[me] ?? [], `the Marshal (${deal[me]})`);
    const before = s;
    const res = resolveTurn(ctx, s, orders);
    s = res.state;
    last = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(ctx, before, res, p.id)]));
  }
}

async function open(r: Extract<KnownRequest, { type: "save" }>): Promise<KnownResponse> {
  const read = readSave(JSON.parse(r.text));
  if (!read.ok) return { type: "error", error: read.why };
  const map = await loadMap(read.save.mapId).catch(() => null);
  if (!map) return { type: "error", error: `Only the twelve official maps here (this save is on ${read.save.mapId}).` };
  const ctx: GameContext = { map, rules: defaultRules };
  const me = read.save.state.players[r.seat]?.id ?? read.save.state.players[0]!.id;
  const view = viewFor(ctx, read.save.state, me);
  return shot(ctx, read.save.mapId, view, makeMarshalBot("conqueror").plan(ctx, view), "the Marshal (conqueror)");
}

scope.onmessage = (e) => {
  (e.data.type === "play" ? play(e.data) : open(e.data)).then(
    (m) => scope.postMessage(m),
    (err: unknown) => scope.postMessage({ type: "error", error: err instanceof Error ? err.message : String(err) }),
  );
};
