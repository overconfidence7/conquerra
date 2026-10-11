import { capturedLine, leaderLine, lines, type CapturedSituation, type LeaderSituation, type LeaderVoice, type Vars } from "@conquerra/content/lines";
import { indexMap, previewAttack, type GameContext, type LeaderRecord, type LeaderRef, type LeaderStyle, type PlayerId, type PlayerView, type ReplayEvent, type TerritoryId } from "@conquerra/engine";
import { houseOf } from "../map/houses";
import type { ComebackMemory } from "./comeback";

/**
 * Your leaders' voices (session 22, the language pass): after each turn, what your Leader, your Steward and the
 * leaders you captured say about it, in their personality's voice (the line library), shown in the turn report, the
 * Chronicle and (the latest) the Leaders panel.
 *
 * Fair: it reads only your view as you planned the turn (`before`), your view after it (`after`) and your own replay
 * of it (`events`), so a leader never says anything you couldn't know. Words only: nothing here changes the game.
 * Deterministic: which version is said comes from the game's public id, the turn and the leader, and what it
 * remembers between turns (grudges, when it last judged you) is kept in the save (`VoiceMemory`).
 *
 * Not too much: at most one line per leader a turn and `limits.perReport` a report, the big moments first.
 */

/** One leader's line about a turn. */
export interface VoiceLine {
  /** The leader's key ("leader:p1", "steward:p1"). */
  leader: string;
  name: string;
  style: LeaderStyle | null;
  text: string;
  /** What it's about (for tests and the Chronicle). */
  situation: string;
  /** Where it happened, if anywhere (the Chronicle's "show me"). */
  at?: TerritoryId;
}

/** What your leaders remember between turns (in the save, so a reload says the same). */
export interface VoiceMemory {
  /** Your Leader last judged one of your moves on this turn, and what kind of mistake it was. */
  judged?: { turn: number; kind: string };
  complimented?: number;
  /** When each leader last grumbled about its empty purse. */
  purse?: Record<string, number>;
  /** When your Leader last warned you about your capital. */
  threat?: number;
  /** A running grudge, with receipts: the rival, the place, the turn, and how the story has gone since. */
  grudge?: { rival: PlayerId; place: TerritoryId; turn: number; kind: "fort" | "home" | "army"; told: number[]; state: "open" | "settled" | "respect" };
  /** You broke a truce: with whom, and when (a joint war on you soon after is the result). */
  brokeTruce?: { rival: PlayerId; turn: number };
  /** When each captured leader last needled its old House. */
  needled?: Record<string, number>;
  /** When each captured leader joined you. */
  captured?: Record<string, number>;
  /** Your House's comeback (session 23): its most land, whether it fell to a quarter of it, and when the card played. */
  comeback?: ComebackMemory;
}

const L = () => lines.limits;

interface Candidate {
  leader: LeaderRecord;
  priority: number;
  situation: string;
  text: string;
  at?: TerritoryId;
  /** What saying it changes in the memory. */
  said?: (m: VoiceMemory) => void;
}

export function leaderVoices(ctx: GameContext, before: PlayerView, after: PlayerView, events: readonly ReplayEvent[], memory: VoiceMemory = {}): { lines: VoiceLine[]; memory: VoiceMemory } {
  const me = before.me.id;
  const turn = before.turn;
  const mem: VoiceMemory = JSON.parse(JSON.stringify(memory));
  const idx = indexMap(ctx.map);
  const place = (t: TerritoryId) => idx.byId.get(t)?.name ?? t;
  const player = (p: PlayerId | null) => (p ? (after.players.find((x) => x.id === p)?.name ?? before.players.find((x) => x.id === p)?.name ?? p) : "the locals");
  const house = (p: PlayerId) => `House ${houseOf(after, p).name}`;
  // (A leader names at most three places; the report's own line lists them all: "Took Ashfell, Pinemark and 4 more.")
  const list = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 2).join(", ")} and ${xs.length - 2} more` : xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));
  const find = (r: LeaderRef) => after.me.leaders.find((l) => l.kind === r.kind && l.of === r.of) ?? before.me.leaders.find((l) => l.kind === r.kind && l.of === r.of);
  const yourLeader = find({ kind: "leader", of: me });
  const steward = find({ kind: "steward", of: me });
  const leaderAlive = before.me.leader.alive || after.me.leader.alive;
  const captured = (l: LeaderRecord) => l.of !== me;
  const voiceOf = (l: LeaderRecord): LeaderVoice => l.personality ?? "neutral";
  const key = (l: LeaderRecord) => `${l.kind}:${l.of}`;
  const speaker = (l: LeaderRecord) => ({ game: before.gameId, turn, who: key(l) });
  const own = (l: LeaderRecord, s: LeaderSituation, vars: Vars) => leaderLine({ ...speaker(l), voice: voiceOf(l) }, s, vars);
  const caught = (l: LeaderRecord, s: CapturedSituation, vars: Vars) => capturedLine(speaker(l), s, vars);
  const capitalName = place(before.me.capital);
  const out: Candidate[] = [];
  const add = (l: LeaderRecord | undefined, priority: number, situation: string, text: string | null, at?: TerritoryId, said?: Candidate["said"]) => {
    if (l && text) out.push({ leader: l, priority, situation, text, ...(at ? { at } : {}), ...(said ? { said } : {}) });
  };
  const leaderRuns = !!yourLeader?.command;
  const myLand = Object.values(after.territories).filter((t) => t.detail === "full" && t.owner === me).length;
  const battles = events.filter((e): e is Extract<ReplayEvent, { type: "battle" }> => e.type === "battle");
  const capitalOf = (t: TerritoryId) => {
    const v = before.territories[t];
    return v?.detail === "full" ? v.capitalOf : null;
  };
  const troopsBefore = (t: TerritoryId) => {
    const v = before.territories[t];
    return v?.detail === "full" ? v.troops : null;
  };

  // Your Leader's first word of the game.
  if (turn === 1 && yourLeader && leaderAlive) add(yourLeader, 3, "opening", own(yourLeader, "opening", { leader: yourLeader.name, capital: capitalName }));

  // What each of your leaders' armies did: land taken (a capital!), or driven back.
  const byLeader = new Map<string, typeof battles>();
  for (const e of battles) if (e.player === me && e.general) byLeader.set(e.general, [...(byLeader.get(e.general) ?? []), e]);
  for (const [of, run] of byLeader) {
    const l = find({ kind: "leader", of });
    if (!l) continue;
    const won = run.filter((e) => e.captured), lost = run.filter((e) => !e.captured);
    const cap = won.find((e) => capitalOf(e.to) && capitalOf(e.to) !== me);
    if (cap) {
      const rival = capitalOf(cap.to)!;
      add(l, 9, "capitalTaken", captured(l) ? caught(l, "capitalTaken", { capital: place(cap.to), rival: player(rival), house: house(l.of) }) : own(l, "capitalTaken", { capital: place(cap.to), rival: player(rival) }), cap.to);
    } else if (won.length) {
      const places = list(won.map((e) => place(e.to)));
      const whose = won[0]!.defender ? `${player(won[0]!.defender).replace(/^(Lady|Lord|Baron|Baroness|Queen|King|Duke|Duchess|Count|Countess|Prince|Princess|Sir|Dame|Warlord) /, "")}'s lot` : "the locals";
      add(l, 5, "took", captured(l) ? caught(l, "took", { places, place: place(won[0]!.to), house: house(l.of) }) : own(l, "took", { places, rival: whose }), won[0]!.to);
    } else if (lost.length) {
      const n = lost.reduce((a, e) => a + e.result.attackerLosses, 0);
      add(l, 4, "pushedBack", captured(l) ? caught(l, "pushedBack", { place: place(lost[0]!.to), n }) : own(l, "pushedBack", { place: place(lost[0]!.to), n }), lost[0]!.to);
    }
  }

  // A rival finished off by one of your leaders.
  for (const e of events)
    if (e.type === "eliminated" && e.by === me && e.leader) {
      const l = find(e.leader);
      if (l) add(l, 9, "finished", captured(l) ? caught(l, "finished", { rival: player(e.player), turn: mem.captured?.[key(l)] ?? turn, house: house(l.of) }) : own(l, "finished", { rival: player(e.player) }));
    }

  // Your capital fell: your Leader's dry comment (the title card is plain).
  const fell = battles.find((e) => e.captured && e.defender === me && e.to === before.me.capital);
  if (fell && yourLeader) add(yourLeader, 10, "capitalLost", own(yourLeader, "capitalLost", { capital: capitalName, rival: player(fell.player), n: fell.attackers.troops }), fell.to);

  // A leader joins you: its first report.
  for (const e of events) {
    const r: LeaderRef | null = e.type === "generalCaptured" && e.player === me ? { kind: "leader", of: e.general } : e.type === "stewardCaptured" && e.player === me ? { kind: "steward", of: e.steward } : null;
    const l = r && find(r);
    if (!l) continue;
    (mem.captured ??= {})[key(l)] = turn;
    const boss = r!.kind === "leader" ? yourLeader : steward;
    add(l, 8, "firstReport", caught(l, "firstReport", { name: l.name, house: house(l.of), leader: boss?.name ?? "you", turn }));
  }

  // The Steward's wall (only one it paid for itself this turn).
  for (const e of events)
    if (e.type === "walled" && e.player === me && steward) {
      const paid = e.territories.find((t) => events.some((x) => (x.type === "invested" || x.type === "built") && x.player === me && x.territory === t && x.by?.kind === "steward" && x.by.of === me));
      if (paid) add(steward, 5, "wallBuilt", own(steward, "wallBuilt", { place: place(paid), capital: capitalName }), paid);
    }

  // A rival army near your capital (from what you can see as the next turn's planning starts).
  if (yourLeader && leaderAlive && turn - (mem.threat ?? -99) >= L().threatEvery) {
    const capProv = idx.byId.get(after.me.capital)?.province;
    const home = ctx.map.territories.filter((t) => t.province === capProv).map((t) => t.id);
    const dist = new Map<TerritoryId, number>(home.map((t) => [t, 0]));
    const queue = [...home];
    while (queue.length) {
      const t = queue.shift()!;
      const d = dist.get(t)!;
      if (d >= L().threatSteps) continue;
      for (const x of idx.neighbors.get(t)!) if (!dist.has(x)) (dist.set(x, d + 1), queue.push(x));
    }
    const capTroops = after.territories[after.me.capital]?.detail === "full" ? (after.territories[after.me.capital] as { troops: number }).troops : 0;
    let worst: { owner: PlayerId; troops: number } | null = null;
    for (const [t, d] of dist) {
      const v = after.territories[t];
      if (d === 0 || v?.detail !== "full" || !v.owner || v.owner === me) continue;
      if (v.troops >= Math.max(L().threatMin, capTroops) && (!worst || v.troops > worst.troops)) worst = { owner: v.owner, troops: v.troops };
    }
    if (worst) {
      const vars = { rival: player(worst.owner), n: worst.troops, capital: place(after.me.capital) };
      add(yourLeader, 8, "threatened", own(yourLeader, leaderRuns ? "threatened" : "threatenedYours", vars), after.me.capital, (m) => (m.threat = turn));
    }
  }

  // Your Leader judges your own moves (Nate's running bit), or now and then hands out a grudging compliment.
  const judging = yourLeader && leaderAlive && myLand > L().judgeQuietAt && turn - (mem.judged?.turn ?? -99) >= L().judgeEvery;
  const judge = (kind: string, s: LeaderSituation, vars: Vars, at?: TerritoryId) => {
    if (judging && mem.judged?.kind !== kind) add(yourLeader, 7, s, own(yourLeader!, s, vars), at, (m) => (m.judged = { turn, kind }));
  };
  if (judging) {
    // An attack you ordered at poor odds (as the preview showed them) that failed.
    const poor = battles
      .filter((e) => e.player === me && !e.general && !e.captured && !e.through?.length)
      .filter((e) => {
        const p = previewAttack(ctx, before, { from: e.from, to: e.to, troops: e.attackers.troops, specialists: e.attackers.specialists });
        return p && !p.captureLikely;
      })
      .sort((a, b) => b.defenders.troops / b.attackers.troops - a.defenders.troops / a.attackers.troops)[0];
    if (poor) {
      const near = idx.neighbors
        .get(poor.to)!
        .filter((t) => t !== poor.from && before.territories[t]?.detail === "full" && (before.territories[t] as { owner: string | null }).owner === me)
        .map((t) => ({ t, k: (troopsBefore(t) ?? 0) - 1 }))
        .filter((x) => x.k >= 2)
        .sort((a, b) => b.k - a.k || (a.t < b.t ? -1 : 1))[0];
      const vars = { n: poor.attackers.troops, place: place(poor.to), m: poor.defenders.troops };
      // (It names the army next door only if bringing it along would have made the fight a fair one.)
      if (near && poor.attackers.troops + near.k >= poor.defenders.troops) judge("attack", "judgeAttack", { ...vars, k: near.k, other: place(near.t) }, poor.to);
      else judge("attack", "judgeAttackAlone", vars, poor.to);
    }
    // You broke a truce, and a joint war came down on you.
    const wars = events.filter((e): e is Extract<ReplayEvent, { type: "dealStarted" }> => e.type === "dealStarted" && e.deal.terms.kind === "war" && e.deal.terms.target === me);
    const b = mem.brokeTruce;
    if (b && turn - b.turn <= 3 && wars.some((w) => w.deal.a === b.rival || w.deal.b === b.rival)) {
      const friends = new Set(wars.flatMap((w) => [w.deal.a, w.deal.b]).filter((p) => p !== b.rival));
      if (friends.size) judge("truce", "judgeTruce", { rival: player(b.rival), n: friends.size });
    }
    // Only when you run the army yourself: land left thin, gold left idle, the capital left light.
    if (!leaderRuns) {
      const taken = battles.filter((e) => e.captured && e.defender === me);
      const thin = taken
        .map((e) => ({ e, n: troopsBefore(e.to), m: before.territories[e.from]?.detail === "full" && (before.territories[e.from] as { owner: string | null }).owner === e.player ? troopsBefore(e.from) : null }))
        .find((x) => x.n !== null && x.m !== null && x.n <= 2 && x.m >= 3 * Math.max(1, x.n) && x.e.to !== before.me.capital);
      if (thin) judge("thin", "judgeThin", { place: place(thin.e.to), n: thin.n!, rival: player(thin.e.player), m: thin.m! }, thin.e.to);
      const income = events.find((e): e is Extract<ReplayEvent, { type: "income" }> => e.type === "income" && e.player === me);
      const idle = income ? income.goldAfter - income.income + income.upkeep + (income.famine ?? 0) : 0;
      if (taken.length && idle >= L().goldIdle) judge("gold", "judgeGold", { n: idle, place: place(taken[0]!.to) }, taken[0]!.to);
      const atCap = battles.find((e) => e.defender === me && e.to === before.me.capital && !e.captured);
      const capN = troopsBefore(before.me.capital), capM = atCap ? troopsBefore(atCap.from) : null;
      if (atCap && capN !== null && capM !== null && capM > capN) judge("capital", "judgeCapital", { capital: capitalName, n: capN, rival: player(atCap.player), m: capM }, atCap.to);
    }
    // A good move: a risky attack of yours that worked.
    const bold = battles.find((e) => {
      if (e.player !== me || e.general || !e.captured) return false;
      const p = previewAttack(ctx, before, { from: e.from, to: e.to, troops: e.attackers.troops, specialists: e.attackers.specialists });
      return !!p && !p.captureLikely;
    });
    if (bold && turn - (mem.complimented ?? -99) >= L().complimentEvery)
      add(yourLeader, 4, "compliment", own(yourLeader!, "compliment", { place: place(bold.to) }), bold.to, (m) => (m.complimented = turn));
  }

  // The grudge: how the story goes this turn.
  const g = mem.grudge;
  if (g && g.state === "open" && yourLeader && leaderAlive) {
    const vars = { rival: player(g.rival), place: place(g.place), turn: g.turn };
    const fought = battles.some((e) => (e.player === me && e.defender === g.rival) || (e.player === g.rival && e.defender === me));
    const revenge = battles.find((e) => e.player === me && e.captured && e.defender === g.rival && (e.to === g.place || capitalOf(e.to) === g.rival)) ?? (events.some((e) => e.type === "eliminated" && e.player === g.rival && e.by === me) ? null : undefined);
    const again = battles.find((e) => e.player === g.rival && e.defender === me && e.captured && e.to !== g.place);
    if (revenge !== undefined) add(yourLeader, 7, "grudgeRevenge", own(yourLeader, "grudgeRevenge", vars), revenge?.to, (m) => (m.grudge!.state = "settled"));
    else if (again && g.told.length >= 2) add(yourLeader, 6, "grudgeRespect", own(yourLeader, "grudgeRespect", { ...vars, place: place(again.to) }), again.to, (m) => (m.grudge!.state = "respect"));
    else if (fought && turn - g.turn >= L().grudgeAfter && turn - (g.told.at(-1) ?? -99) >= L().grudgeEvery) {
      const s = g.kind === "fort" ? "grudgeFort" : g.kind === "home" ? "grudgeHome" : "grudgeArmy";
      add(yourLeader, 6, s, own(yourLeader, s, vars), g.place, (m) => m.grudge!.told.push(turn));
    }
  }

  // Captured leaders needle their old House, now and then, when you fight it.
  for (const l of after.me.leaders.filter(captured)) {
    const old = l.of;
    const alive = after.players.some((p) => p.id === old && p.eliminatedTurn === null);
    if (!alive || turn - (mem.needled?.[key(l)] ?? -99) < L().needleEvery) continue;
    if (!battles.some((e) => (e.player === me && e.defender === old) || (e.player === old && e.defender === me))) continue;
    add(l, 1, "needle", caught(l, "needle", { ruler: player(old), house: house(old) }), undefined, (m) => ((m.needled ??= {})[key(l)] = turn));
  }

  // A Steward with nothing worth building handed its spare gold back (session 23, Nate's running bit: a rich person's
  // handout to the poor). Your own leaders only (a captured one's report line says it plainly), and like a grumble about
  // the purse, at most once every few turns (the report's plain line says it every time).
  for (const e of events)
    if (e.type === "purseTaken" && e.handout && e.player === me) {
      const l = find(e.leader);
      if (l && !captured(l) && turn - (mem.purse?.[key(l)] ?? -99) >= L().purseEvery) add(l, 4, "handout", own(l, "handout", { n: e.gold }), undefined, (m) => ((m.purse ??= {})[key(l)] = turn));
    }

  // An empty purse: a grumble, at most once every few turns per leader.
  for (const l of after.me.leaders)
    if (l.command && l.purse === 0 && turn - (mem.purse?.[key(l)] ?? -99) >= L().purseEvery)
      add(l, 2, "purseEmpty", captured(l) ? caught(l, "purseEmpty", { house: house(l.of) }) : own(l, "purseEmpty", {}), undefined, (m) => ((m.purse ??= {})[key(l)] = turn));

  // What the memory keeps whether or not anyone speaks: a truce you broke, and a new grudge.
  for (const e of events) if (e.type === "dealBroken" && e.by === me && e.kind === "truce") mem.brokeTruce = { rival: e.a === me ? e.b : e.a, turn };
  if (!mem.grudge || mem.grudge.state !== "open") {
    const capProv = idx.byId.get(before.me.capital)?.province;
    const killed = events.find((e) => e.type === "leaderKilled" && e.player === me);
    const army = killed?.type === "leaderKilled" ? battles.find((e) => e.to === killed.territory && e.defender === me && e.captured) : undefined;
    const fort = battles.find((e) => e.captured && e.defender === me && e.player && e.defense.fort);
    const home = battles.find((e) => e.captured && e.defender === me && e.player && idx.byId.get(e.to)?.province === capProv);
    const [kind, e] = army ? (["army", army] as const) : fort ? (["fort", fort] as const) : home ? (["home", home] as const) : [null, null];
    if (kind && e && e.player !== mem.grudge?.rival) mem.grudge = { rival: e.player, place: e.to, turn, kind, told: [], state: "open" };
  }

  // The big moments first; one line per leader; at most `perReport` in all.
  const chosen: Candidate[] = [];
  for (const c of out.map((c, i) => ({ c, i })).sort((a, b) => b.c.priority - a.c.priority || a.i - b.i).map((x) => x.c)) {
    if (chosen.length >= L().perReport) break;
    if (chosen.filter((x) => x.leader === c.leader).length >= L().perLeaderPerTurn) continue;
    chosen.push(c);
    c.said?.(mem);
  }
  return {
    lines: chosen.map((c) => ({ leader: key(c.leader), name: c.leader.name, style: c.leader.personality, text: c.text, situation: c.situation, ...(c.at ? { at: c.at } : {}) })),
    memory: mem,
  };
}
