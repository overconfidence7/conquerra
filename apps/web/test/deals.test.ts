import type { Offer } from "@conquerra/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { agreedThisTurn, attackCheck, canProposeTo, changedTerms, counterFrom, dealMarks, dealsNow, markText, newOffer, truceLines, waitingOffers } from "../src/logic/deals";
import { setHostFactory, useGame } from "../src/store";
import { inProcessHost } from "./inProcessHost";

/** A 4-player Embervale game, with a rival that borders you (for the truce warnings). */
async function start() {
  useGame.getState().setLobby({ mapId: "embervale", bots: 3, turnSeconds: null });
  await useGame.getState().start();
  return useGame.getState();
}
const s = () => useGame.getState();
/** A rival next to you (and the border between you): play on until one shows up. */
async function neighbour() {
  for (let i = 0; i < 12; i++) {
    const { ctx, view } = s();
    const idx = ctx!.map.borders;
    for (const b of idx) {
      const A = view!.territories[b.a], B = view!.territories[b.b];
      if (A?.detail !== "full" || B?.detail !== "full") continue;
      if (A.owner === view!.me.id && B.owner && B.owner !== view!.me.id) return { from: b.a, to: b.b, rival: B.owner };
      if (B.owner === view!.me.id && A.owner && A.owner !== view!.me.id) return { from: b.b, to: b.a, rival: A.owner };
    }
    await s().autoPlan();
    s().closeDeal();
    await s().lockIn();
    s().endReplay();
  }
  throw new Error("no neighbour in 12 turns");
}

describe("diplomacy on the page", () => {
  beforeEach(() => {
    setHostFactory(() => inProcessHost("deals-page-1"));
    useGame.getState().playAgain();
  });

  it("nothing new shows until there's an offer or a deal, apart from Propose in the Players panel", async () => {
    const g = await start();
    const v = g.view!;
    expect(v.deals).toEqual([]);
    expect(waitingOffers(g.offers, g.diplomacy)).toEqual([]);
    expect(truceLines(g.pageDeals())).toEqual([]);
    for (const p of v.players) expect(dealMarks(v, g.pageDeals(), p.id)).toEqual([]);
    // Propose is offered for every living rival, never for yourself.
    expect(v.players.filter((p) => canProposeTo(v, p.id)).map((p) => p.id)).toEqual(v.players.filter((p) => p.id !== v.me.id).map((p) => p.id));
  });

  it("the Propose card comes with a plain truce ready to send; the bot answers at once with its reason; the deal starts as the turn plays", async () => {
    await start();
    const to = s().view!.players.find((p) => p.id !== s().view!.me.id)!.id;
    s().openPropose(to);
    const offer = (s().deal as { offer: Offer }).offer;
    expect(offer).toMatchObject({ from: "you", to, bond: "handshake", terms: { kind: "truce", scope: { kind: "all" }, turns: 3 } });
    const answer = (await s().sendOffer(offer))!;
    expect(answer.reason.length).toBeGreaterThan(5);
    expect(s().answers[offer.id]).toEqual(answer);
    // Your offer goes in with your orders (no slot); it isn't in the visible queue.
    expect(s().turnOrders().some((o) => o.kind === "propose" && o.offer.id === offer.id)).toBe(true);
    expect(s().queue.some((o) => o.kind === "propose")).toBe(false);
    if (answer.accept) {
      expect(dealMarks(s().view!, s().pageDeals(), to).map((m) => markText(s().view!, m))).toEqual(["Truce (starts this turn)"]);
      s().closeDeal();
      await s().lockIn();
      s().endReplay();
      expect(s().view!.deals).toMatchObject([{ kind: "truce", a: "you", b: to }]);
      expect(s().report!.events.some((e) => e.type === "dealStarted")).toBe(true);
    }
  });

  it("an offer to you: a toast until you answer; Accept is one tap and the deal counts as agreed", async () => {
    await start();
    const from = s().view!.players.find((p) => p.id !== s().view!.me.id)!.id;
    const offer: Offer = { id: "o-test", from, to: "you", terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake", note: "Let's have peace on our border." };
    useGame.setState({ offers: [offer] });
    expect(waitingOffers(s().offers, s().diplomacy)).toEqual([offer]);
    s().openOffer(offer);
    s().answerOffer(offer, true);
    expect(waitingOffers(s().offers, s().diplomacy)).toEqual([]);
    expect(s().deal).toBeNull();
    expect(agreedThisTurn(s().view!, s().diplomacy, s().answers, s().offers)).toEqual([offer]);
    expect(s().turnOrders()).toContainEqual({ id: `answer-${from}-o-test`, kind: "answer", from, offer: "o-test", accept: true });
  });

  it("Counter declines the offer and opens the same card from your side, with a trade's sides swapped", async () => {
    await start();
    const from = s().view!.players.find((p) => p.id !== s().view!.me.id)!.id;
    const offer: Offer = { id: "o-trade", from, to: "you", terms: { kind: "trade", give: { gold: 5 }, get: { perTurn: 3 }, turns: 4 }, bond: "handshake" };
    useGame.setState({ offers: [offer] });
    s().counterOffer(offer);
    expect(s().diplomacy).toContainEqual({ id: `answer-${from}-o-trade`, kind: "answer", from, offer: "o-trade", accept: false });
    const mine = (s().deal as { mode: string; offer: Offer }).offer;
    expect(mine).toMatchObject({ from: "you", to: from, counterTo: "o-trade", terms: { kind: "trade", give: { perTurn: 3 }, get: { gold: 5 }, turns: 4 } });
    // The changes on a counteroffer are marked.
    const back = { ...counterFrom(s().view!, offer, 9), terms: { kind: "truce" as const, scope: { kind: "all" as const }, turns: 2 } };
    expect([...changedTerms({ ...offer, terms: { kind: "truce", scope: { kind: "all" }, turns: 5 } }, back)]).toEqual(["turns"]);
    expect([...changedTerms(offer, { ...offer, bond: "binding" })]).toEqual(["bond"]);
  });

  it("an attack across a handshake truce warns what breaking it costs; across a binding pact it can't be queued", async () => {
    await start();
    const { from, to, rival } = await neighbour();
    const v = s().view!;
    const ctx = s().ctx!;
    const agreed = (bond: Offer["bond"]): Offer => ({ id: `t-${bond}`, from: "you", to: rival, terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond });
    const name = v.players.find((p) => p.id === rival)!.name;
    const warn = attackCheck(ctx, v, dealsNow(ctx, v, [agreed("handshake")]), from, to);
    expect(warn).toEqual({ warn: expect.stringMatching(new RegExp(`^This breaks your truce with ${name}: Oathbreaker, about \\d+ gold and unrest\\.$`)) });
    const block = attackCheck(ctx, v, dealsNow(ctx, v, [agreed("binding")]), from, to);
    expect(block).toEqual({ block: `You have a binding pact with ${name}: the game won't let this attack go.` });
    // With no deal: nothing to say.
    expect(attackCheck(ctx, v, dealsNow(ctx, v, []), from, to)).toBeNull();
    // The truce border shows on the map.
    expect(truceLines(dealsNow(ctx, v, [agreed("binding")])).some((l) => (l.a === from && l.b === to) || (l.a === to && l.b === from))).toBe(true);
    // In the store: a binding pact agreed this turn blocks the attack draft from being added.
    useGame.setState({ diplomacy: [{ id: "p", kind: "propose", offer: agreed("binding") }], answers: { "t-binding": { accept: true, reason: "ok" } } });
    s().select(from);
    s().tap(to);
    expect(s().draft).not.toBeNull();
    const before = s().queue.length;
    s().addDraft();
    expect(s().queue.length).toBe(before);
  });

  it("a new offer's defaults: a truce, a joint war on another rival, a trade of some of your gold", async () => {
    await start();
    const { ctx, view } = s();
    const to = view!.players.find((p) => p.id !== view!.me.id)!.id;
    expect(newOffer(ctx!, view!, to).terms).toEqual({ kind: "truce", scope: { kind: "all" }, turns: ctx!.rules.diplomacy.truce.defaultTurns });
    const war = newOffer(ctx!, view!, to, "war").terms;
    expect(war.kind === "war" && war.target !== to && war.target !== "you").toBe(true);
    expect(newOffer(ctx!, view!, to, "trade").terms).toEqual({ kind: "trade", give: { gold: Math.min(10, view!.me.gold) }, get: {} });
  });
});
