import { councilLine, lines, type CouncilSituation, type LeaderVoice } from "@conquerra/content/lines";
import { indexMap, type GameContext, type Instruction, type LeaderRecord, type Order, type PlayerId, type PlayerView, type ReplayEvent, type TerritoryId } from "@conquerra/engine";
import type { CouncilAsk } from "../host/protocol";
import type { CouncilMemory, VoiceLine, VoiceMemory } from "./voices";

/**
 * Your council (session 29, design §13): now and then one of your leaders asks you something, and you answer by
 * multiple choice. Every choice is an ordinary game action: a command (through the Leaders panel's own path), a budget,
 * or leaving things as they are. Nothing here is a new order, and nothing changes the game by itself.
 *
 * Fair by construction, like the leaders' lines (`voices.ts`): it reads only your view before the turn, your view after
 * it, your own replay and the orders you gave. Not heavy: at most one question a turn, from one leader, none in the
 * first two turns, and only when the leader has no command yet or the situation changes what its command means.
 * Unanswered by lock-in, the question lapses, and the leader says so next turn ("I took that as a no.").
 */

/** The choices' words (plain: they're buttons). */
export const COUNCIL_UI = {
  takeBack: "Yes, take it back",
  raid: "Raid them",
  holdNow: "Hold for now",
  holdIt: "Yes, hold it",
  stay: "Stay as you are",
  fortify: "Fortify the border",
  culture: (province: string) => `Raise culture in ${province}`,
  yourCall: "Your call",
  share: (pct: number) => `Give it ${pct}% of income`,
  leave: "Leave it",
} as const;

const L = () => lines.limits;
const keyOf = (l: { kind: string; of: PlayerId }) => `${l.kind}:${l.of}`;
const orderKey = (o: Order) => (o.kind === "instruct" || o.kind === "budget" ? `${o.role === "steward" ? "steward" : "leader"}:${o.general}` : null);

export function councilTurn(input: { ctx: GameContext; before: PlayerView; after: PlayerView; events: readonly ReplayEvent[]; memory: VoiceMemory; orders: readonly Order[]; spoken: readonly VoiceLine[] }): { ask: CouncilAsk | null; lines: VoiceLine[]; memory: VoiceMemory } {
  const { ctx, before, after, events } = input;
  const me = before.me.id;
  const turn = before.turn;
  const memory: VoiceMemory = { ...input.memory };
  const c: CouncilMemory = { ...(memory.council ?? {}) };
  const idx = indexMap(ctx.map);
  const place = (t: TerritoryId) => idx.byId.get(t)?.name ?? t;
  const player = (p: PlayerId) => after.players.find((x) => x.id === p)?.name ?? before.players.find((x) => x.id === p)?.name ?? p;
  const alive = (p: PlayerId) => after.players.some((x) => x.id === p && x.eliminatedTurn === null);
  const mine = (l: LeaderRecord) => l.of === me;
  const find = (key: string) => after.me.leaders.find((l) => keyOf(l) === key);
  const voice = (l: LeaderRecord): LeaderVoice => l.personality ?? "neutral";
  const say = (l: LeaderRecord, s: CouncilSituation, vars: Record<string, string> = {}) => councilLine({ game: before.gameId, turn, who: keyOf(l), voice: voice(l) }, s, vars);
  const out: VoiceLine[] = [];
  const spoke = new Set(input.spoken.map((v) => v.leader));
  const room = () => input.spoken.length + out.length < L().perReport;
  const line = (l: LeaderRecord, situation: string, text: string, extra: Partial<VoiceLine> = {}) => {
    if (spoke.has(keyOf(l)) || !room()) return false;
    spoke.add(keyOf(l));
    out.push({ leader: keyOf(l), name: l.name, style: l.personality, text, situation, ...extra });
    return true;
  };

  // Last turn's question: answered (an order for that leader, or its command changed), or it lapses with a line.
  const open = c.ask;
  delete c.ask;
  if (open) {
    const l = find(open.leader);
    const answered = input.orders.some((o) => orderKey(o) === open.leader) || (l && JSON.stringify(l.command ?? null) !== open.command);
    if (l && !answered) line(l, "councilLapse", say(l, "lapsed"), { ask: open.id });
  }

  const leader = find(`leader:${me}`);
  const steward = find(`steward:${me}`);
  const leaderAlive = !!leader && after.me.leader.alive;
  const g = memory.grudge;

  // The grudge, once asked about: every few turns, a needle while you don't go after them.
  if (g && g.state === "open" && c.grudgeAsked === g.turn && leaderAlive && alive(g.rival)) {
    const after_ = leader!.command;
    const going = !!after_ && "player" in after_ && after_.player === g.rival && (after_.kind === "pushBack" || after_.kind === "raid");
    if (!going && turn - (c.needled ?? c.grudgeAsked) >= L().grudgeEvery && line(leader!, "councilNeedle", say(leader!, "needle", { rival: player(g.rival) }))) c.needled = turn;
  }

  // At most one question a turn, never in the first two turns, from a leader still in your service.
  let ask: CouncilAsk | null = null;
  const asking = (l: LeaderRecord, situation: CouncilAsk["situation"], s: CouncilSituation, vars: Record<string, string>, choices: CouncilAsk["choices"]) => {
    ask = { id: `${turn}:${keyOf(l)}`, leader: keyOf(l), name: l.name, style: l.personality, text: say(l, s, vars), situation, choices };
    c.ask = { id: ask.id, leader: keyOf(l), command: JSON.stringify(l.command ?? null) };
  };
  const threat = leaderAlive ? threatTo(ctx, after) : null;
  // (A threat that was already there last turn isn't news: the question comes when it first appears.)
  const newThreat = !!threat && c.threatSeen !== turn - 1;
  if (threat) c.threatSeen = turn;
  const again = (last: number | undefined) => turn - (last ?? -99) >= L().councilRepeat;
  if (turn >= 2 && !after.winner && turn - (c.asked ?? -99) >= L().councilEvery) {
    // A rival army newly near your capital, and your Leader isn't already holding it.
    const holding = (i: Instruction | null | undefined) => !!i && i.kind === "defend" && "territory" in i && i.territory === after.me.capital;
    if (threat && newThreat && !holding(leader!.command) && turn - (c.capitalAsked ?? -99) >= L().threatEvery) {
      asking(leader!, "capital", "askCapital", { capital: place(after.me.capital), rival: player(threat) }, [{ label: COUNCIL_UI.holdIt, instruct: { kind: "defend", territory: after.me.capital } }, { label: COUNCIL_UI.stay }]);
      c.capitalAsked = turn;
    }
    // A grudge (a rival wiped out its army or took your home province): once per grudge, while you aren't after them.
    else if (g && g.state === "open" && (g.kind === "army" || g.kind === "home") && c.grudgeAsked !== g.turn && leaderAlive && alive(g.rival) && !targets(leader!.command, g.rival)) {
      asking(leader!, "grudge", "askGrudge", { rival: player(g.rival), place: place(g.place) }, [
        { label: COUNCIL_UI.takeBack, instruct: { kind: "pushBack", player: g.rival } },
        { label: COUNCIL_UI.raid, instruct: { kind: "raid", player: g.rival } },
        { label: COUNCIL_UI.holdNow, instruct: { kind: "hold" } },
      ]);
      c.grudgeAsked = g.turn;
    }
    // Your Steward handed gold back (nothing worth building) while running the realm (or doing nothing).
    else if (steward && events.some((e) => e.type === "purseTaken" && e.handout && e.player === me && e.leader.kind === "steward" && e.leader.of === me) && (!steward.command || steward.command.kind === "realm" || steward.command.kind === "economy") && again(c.stewardAsked)) {
      const province = idx.byId.get(after.me.capital)?.province;
      const pname = ctx.map.provinces.find((p) => p.id === province)?.name;
      asking(steward, "steward", "askSteward", {}, [{ label: COUNCIL_UI.fortify, instruct: { kind: "fortify" } }, ...(province && pname ? [{ label: COUNCIL_UI.culture(pname), instruct: { kind: "culture" as const, province } }] : []), { label: COUNCIL_UI.yourCall, instruct: { kind: "realm" } }]);
      c.stewardAsked = turn;
    }
    // A leader with a command, an empty purse and no budget at all.
    else {
      const broke = after.me.leaders.find((l) => mine(l) && l.command && l.purse === 0 && ("share" in l.budget ? l.budget.share === 0 : l.budget.gold === 0) && (l.kind === "steward" || after.me.leader.alive));
      if (broke && again(c.purseAsked)) {
        asking(broke, "purse", "askPurse", {}, [{ label: COUNCIL_UI.share(10), budget: { share: 0.1 } }, { label: COUNCIL_UI.share(20), budget: { share: 0.2 } }, { label: COUNCIL_UI.leave }]);
        c.purseAsked = turn;
      }
    }
  }
  if (c.ask) c.asked = turn;
  memory.council = c;
  return { ask, lines: out, memory };
}

/** Is this command already going after `rival`? */
function targets(i: Instruction | null | undefined, rival: PlayerId): boolean {
  return !!i && "player" in i && i.player === rival && (i.kind === "pushBack" || i.kind === "raid" || i.kind === "defend");
}

/** The rival with the biggest army near your capital (as your Leader's warning reads it: what you can see), or null. */
function threatTo(ctx: GameContext, view: PlayerView): PlayerId | null {
  const idx = indexMap(ctx.map);
  const capProv = idx.byId.get(view.me.capital)?.province;
  const home = ctx.map.territories.filter((t) => t.province === capProv).map((t) => t.id);
  const dist = new Map<TerritoryId, number>(home.map((t) => [t, 0]));
  const queue = [...home];
  while (queue.length) {
    const t = queue.shift()!;
    const d = dist.get(t)!;
    if (d >= L().threatSteps) continue;
    for (const x of idx.neighbors.get(t)!) if (!dist.has(x)) (dist.set(x, d + 1), queue.push(x));
  }
  const cap = view.territories[view.me.capital];
  const capTroops = cap?.detail === "full" ? cap.troops : 0;
  let worst: { owner: PlayerId; troops: number } | null = null;
  for (const [t, d] of dist) {
    const v = view.territories[t];
    if (d === 0 || v?.detail !== "full" || !v.owner || v.owner === view.me.id) continue;
    if (v.troops >= Math.max(L().threatMin, capTroops) && (!worst || v.troops > worst.troops)) worst = { owner: v.owner, troops: v.troops };
  }
  return worst?.owner ?? null;
}
