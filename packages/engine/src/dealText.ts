import { isParty, otherSide, tradeTotals } from "./diplomacy";
import type { DealKind, DealProblem, DealTerms, GameEvent, PlayerId, TerritoryId } from "./types";

/**
 * Plain words for deals (session 14): the deal cards, and a line for each deal event in the turn report and the
 * replay. Shared by the game screen, the simulator and `pnpm sim --replay`, so they all say the same thing.
 */

export interface DealNames {
  /** Whose report this is (null: an outside reader, such as the simulator's log). */
  you: PlayerId | null;
  player(id: PlayerId): string;
  place(id: TerritoryId): string;
  province(id: string): string;
}

export const DEAL_NAME: Record<DealKind, string> = { truce: "truce", trade: "trade", war: "joint war", passage: "right of passage" };
const turnsWord = (n: number) => `${n} turn${n === 1 ? "" : "s"}`;
const gold = (n: number) => `${n} gold`;

/** "you" for the reader, else the player's name. */
const who = (n: DealNames, p: PlayerId) => (p === n.you ? "you" : n.player(p));
const Who = (n: DealNames, p: PlayerId) => (p === n.you ? "You" : n.player(p));

/** What one side of a trade gives, in words: "10 gold, 3 gold a turn and Ashfell". */
function sideWords(s: Extract<DealTerms, { kind: "trade" }>["give"], turns: number, n: DealNames): string {
  const parts: string[] = [];
  if (s.gold) parts.push(gold(s.gold));
  if (s.perTurn) parts.push(`${gold(s.perTurn)} a turn for ${turnsWord(turns)}`);
  if (s.land?.length) parts.push(s.land.map(n.place).join(", "));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "nothing");
}

/**
 * A deal card in one line, between `a` (who proposed) and `b`: "a truce everywhere for 3 turns", "a joint war on Baron
 * Krell for 4 turns", "a trade: Lady Morwen gives 10 gold, and you give Ashfell".
 */
export function describeTerms(t: DealTerms, a: PlayerId, b: PlayerId, n: DealNames): string {
  switch (t.kind) {
    case "truce": {
      const where = t.scope.kind === "all" ? "everywhere" : t.scope.kind === "province" ? `in ${n.province(t.scope.province)}` : `on ${t.scope.borders.length === 1 ? "one border" : `${t.scope.borders.length} borders`}`;
      return t.until ? `a truce ${where} until ${who(n, t.until)} ${t.until === n.you ? "are" : "is"} knocked out (${turnsWord(t.turns)} at most)` : `a truce ${where} for ${turnsWord(t.turns)}`;
    }
    case "war":
      return `a joint war on ${who(n, t.target)} for ${turnsWord(t.turns)}`;
    case "passage":
      return `right of passage for ${turnsWord(t.turns)}${t.mutual ? " (both ways)" : ` (${who(n, a)} through ${who(n, b)}'s land)`}`;
    case "trade": {
      const turns = tradeTotals(t).turns;
      const giveA = sideWords(t.give, turns, n), giveB = sideWords(t.get, turns, n);
      return `a trade: ${who(n, a)} ${a === n.you ? "give" : "gives"} ${giveA}, and ${who(n, b)} ${b === n.you ? "give" : "gives"} ${giveB}`;
    }
  }
}

const DEAL_PROBLEM: Record<DealProblem, string> = {
  invalid: "its terms don't fit the rules",
  gone: "one side is out of the game",
  exists: "you already have a deal of that kind",
  gold: "one side didn't have the gold for it",
  land: "the land can't be handed over (a capital, a Leader there, or it doesn't border the other side)",
  target: "its target isn't a rival still in the game",
  pact: "it clashes with a truce or joint war already in force",
};
/** Why an accepted offer couldn't start, in words. */
export const dealProblemWords = (p: DealProblem) => DEAL_PROBLEM[p];

type DealEvent = Extract<GameEvent, { type: "dealStarted" | "dealEnded" | "dealBroken" | "dealFailed" | "offerLapsed" | "tribute" }>;

/** A line for a deal event in the turn report (or the simulator's log), from `n.you`'s side. Null: nothing to say. */
export function dealLine(e: DealEvent, n: DealNames): string | null {
  switch (e.type) {
    case "dealStarted": {
      const d = e.deal;
      const mine = n.you !== null && isParty(d, n.you);
      const bond = d.bond === "binding" ? "binding pact" : "handshake deal";
      if (!mine) return d.terms.kind === "trade" ? `${n.player(d.a)} and ${n.player(d.b)} made a trade.` : `${n.player(d.a)} and ${n.player(d.b)} agreed ${describeTerms(d.terms, d.a, d.b, n)} (a ${bond}).`;
      const other = otherSide(d, n.you!);
      const paid = e.paid[n.you!] ? ` You paid ${gold(e.paid[n.you!]!)} for the binding pact.` : "";
      return `You and ${n.player(other)} agreed ${describeTerms(d.terms, d.a, d.b, n)} (a ${bond}).${paid}`;
    }
    case "dealEnded": {
      const kind = DEAL_NAME[e.kind];
      const pair = n.you && (e.a === n.you || e.b === n.you) ? `Your ${kind} with ${n.player(e.a === n.you ? e.b : e.a)}` : `The ${kind} between ${n.player(e.a)} and ${n.player(e.b)}`;
      if (e.why === "knockedOut") return `${pair} is over: a side was knocked out.`;
      if (e.why === "goal") return `${pair} is over: its goal is met.`;
      const idle = e.idle?.length && n.you && (e.a === n.you || e.b === n.you) ? ` ${e.idle.map((p) => Who(n, p)).join(" and ")} never struck the target.` : "";
      return `${pair} has run its course.${idle}`;
    }
    case "dealBroken": {
      const kind = DEAL_NAME[e.kind];
      const wronged = e.a === e.by ? e.b : e.a;
      const at = e.at ? ` at ${n.place(e.at)}` : "";
      const how = e.how === "payment" ? " by missing a payment" : e.how === "renounced" ? "" : e.how === "truceWithTarget" ? " by making a truce with the target" : at;
      const head = e.by === n.you ? `You broke your ${kind} with ${n.player(wronged)}${how}` : `${n.player(e.by)} broke their ${kind} with ${who(n, wronged)}${how}`;
      const costs = [`Oathbreaker until turn ${e.mark}`];
      if (e.fine) costs.push(`a fine of ${gold(e.fine)}`);
      if (e.unrest) costs.push(`${e.unrest} troop${e.unrest === 1 ? "" : "s"} deserted`);
      const note = e.note ? ` "${e.note}"` : "";
      return `${head}: ${costs.join(", ")}.${note}`;
    }
    case "dealFailed": {
      const o = e.offer;
      const other = o.from === n.you ? o.to : o.from;
      return `The ${DEAL_NAME[o.terms.kind]} with ${n.player(other)} couldn't start: ${DEAL_PROBLEM[e.why]}.`;
    }
    case "offerLapsed": {
      const o = e.offer;
      const kind = DEAL_NAME[o.terms.kind];
      const whose = o.from === n.you ? `Your offer of a ${kind} to ${n.player(o.to)}` : `${n.player(o.from)}'s offer of a ${kind}`;
      if (e.why === "voided") return `${whose} is void: you fought each other this turn.`;
      if (e.why === "declined") return `${whose} was declined.`;
      return `${whose} lapsed: nobody accepted it this turn.`;
    }
    case "tribute": {
      const head = e.from === n.you ? `You paid ${n.player(e.to)} ${gold(e.gold)}` : `${n.player(e.from)} paid ${who(n, e.to)} ${gold(e.gold)}`;
      return `${head} under your trade${e.short ? `, ${gold(e.short)} short (troops deserted for it)` : ""}.`;
    }
  }
}
