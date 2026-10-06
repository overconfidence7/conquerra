import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { agreedIn, captainBot, judgeOffer, negotiate, withAgreed, type Answer } from "@conquerra/bots";
import { createGame, indexMap, replayFor, resolveTurn, viewFor, type DealTerms, type GameContext, type GameState, type Offer, type OrdersByPlayer, type PlayerId, type ReplayEvent, type TerritoryId } from "@conquerra/engine";

/**
 * Acceptance rates (session 14): is the Captain a pushover or a wall? A fixed set of offers, sorted beforehand into
 * good, neutral and bad for the bot that judges them, using the true game (not the bot's view), at moments of real
 * Captain games (turns 4, 8, 12 and 16). The bot then judges each from its own view only.
 *
 *   pnpm tsx apps/sim/src/acceptance.ts [games per table size, default 60]
 *
 * Good: a truce when it's fighting on two fronts and can't afford this one; a joint war against the runaway leader
 * (one it borders); 12 gold for nothing. Neutral: a fair gold trade (10 now for 3 a turn for 4 turns); a truce with a
 * rival it doesn't border; a truce on a quiet, even border. Bad: a truce from the runaway leader; the runaway asking
 * for a border territory for 5 gold; a rival asking for 15 gold for nothing; a truce from a rival it's crushing.
 */

type Category = "good" | "neutral" | "bad";
interface Sample {
  cat: Category;
  kind: string;
  answer: Answer;
}

const games = Number(process.argv[2] ?? "60");
const results: Sample[] = [];

function sampleAt(ctx: GameContext, s: GameState, lastTurn: Map<string, ReplayEvent[]>) {
  const idx = indexMap(ctx.map);
  const living = s.players.filter((p) => p.eliminatedTurn === null).map((p) => p.id);
  const land = new Map<PlayerId, TerritoryId[]>(living.map((p) => [p, idx.ids.filter((t) => s.territories[t]!.owner === p)]));
  const total = idx.ids.length;
  const ranked = [...land].sort((a, b) => b[1].length - a[1].length);
  const [top, topLand] = ranked[0]!;
  const second = ranked[1]?.[1].length ?? 0;
  const runaway = living.length >= 3 && (topLand.length >= 0.4 * total || (topLand.length >= 0.25 * total && topLand.length >= 1.75 * second)) ? top : null;
  let n = 0;
  for (const judge of living) {
    const mine = land.get(judge)!;
    /** Troops on each side of the border between judge and p. */
    const front = (p: PlayerId) => {
      let ours = 0, theirs = 0;
      const ourSide = new Set<TerritoryId>(), theirSide = new Set<TerritoryId>();
      for (const t of mine)
        for (const x of idx.neighbors.get(t)!)
          if (s.territories[x]!.owner === p) {
            ourSide.add(t);
            theirSide.add(x);
          }
      for (const t of ourSide) ours += s.territories[t]!.troops;
      for (const t of theirSide) theirs += s.territories[t]!.troops;
      return { ours, theirs, borders: ourSide.size > 0 };
    };
    const rivals = living.filter((p) => p !== judge);
    const fronts = rivals.filter((p) => front(p).borders && front(p).theirs >= 4);
    const offers: { cat: Category; kind: string; from: PlayerId; terms: DealTerms }[] = [];
    const truce: DealTerms = { kind: "truce", scope: { kind: "all" }, turns: 3 };
    for (const p of rivals) {
      const f = front(p);
      // Good
      if (fronts.length >= 2 && fronts.includes(p) && p !== runaway && f.theirs >= f.ours) offers.push({ cat: "good", kind: "truce on a front it can't afford, while fighting on two", from: p, terms: truce });
      if (runaway && runaway !== judge && p !== runaway && front(runaway).borders) offers.push({ cat: "good", kind: "joint war on the runaway leader", from: p, terms: { kind: "war", target: runaway, turns: 4 } });
      if (p !== runaway) offers.push({ cat: "good", kind: "12 gold for nothing", from: p, terms: { kind: "trade", give: { gold: 12 }, get: {} } });
      // Neutral
      if (p !== runaway) offers.push({ cat: "neutral", kind: "a fair gold trade (10 now for 3 a turn, 4 turns)", from: p, terms: { kind: "trade", give: { gold: 10 }, get: { perTurn: 3 }, turns: 4 } });
      if (p !== runaway && !f.borders) offers.push({ cat: "neutral", kind: "truce with a rival it doesn't border", from: p, terms: truce });
      if (p !== runaway && f.borders && fronts.filter((q) => q !== p).length === 0 && f.ours > 0 && Math.abs(f.ours - f.theirs) <= 0.25 * Math.max(f.ours, f.theirs)) offers.push({ cat: "neutral", kind: "truce on a quiet, even border", from: p, terms: truce });
      // Bad
      if (p === runaway && f.borders) offers.push({ cat: "bad", kind: "truce from the runaway leader (on their border)", from: p, terms: truce });
      if (p === runaway && f.borders) {
        const t = mine.find((x) => x !== s.players.find((q) => q.id === judge)!.capital && idx.neighbors.get(x)!.some((y) => s.territories[y]!.owner === p));
        if (t) offers.push({ cat: "bad", kind: "the runaway asks for border land for 5 gold", from: p, terms: { kind: "trade", give: { gold: 5 }, get: { land: [t] } } });
      }
      if (p !== runaway) offers.push({ cat: "bad", kind: "15 gold for nothing (to them)", from: p, terms: { kind: "trade", give: {}, get: { gold: 15 } } });
      if (p !== runaway && f.borders && fronts.filter((q) => q !== p).length === 0 && f.ours >= 2.5 * Math.max(1, f.theirs)) offers.push({ cat: "bad", kind: "truce from a rival it's crushing", from: p, terms: truce });
    }
    const view = viewFor(ctx, s, judge);
    for (const o of offers) {
      // An offer that can't be made (a deal of that kind already between them) isn't a test of judgement.
      if (s.deals.some((d) => ((d.a === judge && d.b === o.from) || (d.b === judge && d.a === o.from)) && d.terms.kind === o.terms.kind)) continue;
      const target = o.terms.kind === "war" ? o.terms.target : null;
      if (target && s.deals.some((d) => (d.terms.kind === "truce" || d.terms.kind === "war") && ((d.a === judge && d.b === target) || (d.b === judge && d.a === target)))) continue;
      const offer: Offer = { id: `acc-${n++}`, from: o.from, to: judge, terms: o.terms, bond: "handshake" };
      // 15 gold it doesn't have isn't a fair test of judgement.
      if (o.terms.kind === "trade" && (o.terms.get.gold ?? 0) > view.me.gold) continue;
      results.push({ cat: o.cat, kind: o.kind, answer: judgeOffer(ctx, view, offer, "captain", lastTurn.get(judge)) });
    }
  }
}

for (const players of [4, 6]) {
  const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
  for (let g = 0; g < games; g++) {
    const seed = `acceptance-${players}p-${g}`;
    let s = createGame(ctx, { gameId: seed, seed, players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `Bot ${i + 1}` })) });
    let last = new Map<string, ReplayEvent[]>();
    for (let turn = 1; turn <= 16 && !s.winner; turn++) {
      if (turn % 4 === 0) sampleAt(ctx, s, last);
      const living = s.players.filter((p) => p.eliminatedTurn === null);
      const views = new Map(living.map((p) => [p.id, viewFor(ctx, s, p.id)]));
      const talk = negotiate(ctx, living.map((p) => ({ id: p.id, level: "captain" as const })), (id) => views.get(id)!, (id) => last.get(id), null);
      const agreed = agreedIn(talk.orders);
      const orders: OrdersByPlayer = {};
      for (const p of living) orders[p.id] = [...(talk.orders[p.id] ?? []), ...captainBot.plan(ctx, withAgreed(views.get(p.id)!, agreed), last.get(p.id))];
      const before = s;
      const r = resolveTurn(ctx, s, orders);
      s = r.state;
      last = new Map(s.players.map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
    }
  }
}

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : "-");
console.log(`Acceptance rates: ${results.length} offers to the Captain, from ${games} games each at 4 and 6 players (turns 4, 8, 12, 16).\n`);
for (const cat of ["good", "neutral", "bad"] as Category[]) {
  const xs = results.filter((r) => r.cat === cat);
  const yes = xs.filter((r) => r.answer.accept).length;
  const counter = xs.filter((r) => r.answer.counter).length;
  console.log(`${cat.toUpperCase()}: ${pct(yes, xs.length)} accepted, ${pct(counter, xs.length)} countered, ${pct(xs.length - yes - counter, xs.length)} declined (${xs.length} offers)`);
  for (const kind of [...new Set(xs.map((r) => r.kind))]) {
    const k = xs.filter((r) => r.kind === kind);
    const reasons = new Map<string, number>();
    for (const r of k) reasons.set(r.answer.reason, (reasons.get(r.answer.reason) ?? 0) + 1);
    const top = [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t, c]) => `"${t}" ×${c}`).join("; ");
    console.log(`  ${kind}: ${pct(k.filter((r) => r.answer.accept).length, k.length)} yes, ${pct(k.filter((r) => r.answer.counter).length, k.length)} counter (${k.length}) — ${top}`);
  }
}

// The answers that went against the sorting (good declined, bad accepted), by reason: where the judgement and the
// true game disagree (often fog: the bot can't see what the sorting saw).
for (const [cat, accepted] of [["good", false], ["bad", true]] as const) {
  const odd = results.filter((r) => r.cat === cat && r.answer.accept === accepted);
  const by = new Map<string, number>();
  for (const r of odd) by.set(`${r.kind}: "${r.answer.reason}"`, (by.get(`${r.kind}: "${r.answer.reason}"`) ?? 0) + 1);
  console.log(`\n${cat} offers ${accepted ? "accepted" : "declined or countered"} (${odd.length}), by reason:`);
  for (const [k, c] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`  ${c} × ${k}`);
}
