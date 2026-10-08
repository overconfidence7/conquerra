import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, viewFor, type GameContext, type ReplayEvent } from "@conquerra/engine";
import { marshalData } from "@conquerra/content";
import { beforeEach, describe, expect, it } from "vitest";
import { arrangeQueue, takeControl } from "../src/logic/generals";
import { commandArea } from "../src/logic/leaderArea";
import { planQueue } from "../src/logic/orders";
import { setHostFactory, useGame } from "../src/store";
import { inProcessHost } from "./inProcessHost";
import type { Order } from "@conquerra/engine";
import { chronicleOf } from "../src/logic/chronicleKeep";
import { narrateTurn } from "../src/logic/narrate";
import { budgetLabel, instructionName, namer } from "../src/logic/text";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const t = (i: number) => ctx.map.territories[i]!.id;
const name = (i: number) => ctx.map.territories[i]!.name;
const army = (troops: number) => ({ troops, specialists: [] });

/** A person's game: your Leader is Aldric (expanding toward territory 5), your Steward Odo (running the realm). */
function game() {
  const s = createGame(ctx, { gameId: "g", seed: "leaders-page", players: [{ id: "you", name: "You", leaderName: "Aldric", stewardName: "Odo", delegate: true }, { id: "b1", name: "Lady Morwen" }, { id: "b2", name: "Baron Krell" }] });
  s.players[0]!.leaders[0]!.command = { kind: "expand", territory: t(5) };
  return viewFor(ctx, s, "you");
}

const win = (step: number, to: number, general = "you"): ReplayEvent => ({
  type: "battle", step, player: "you", orderId: `o${step}`, from: t(0), to: t(to), defender: null, attackers: army(6), withLeader: true, general,
  defenders: army(1), result: { attackStrength: 6, defenseStrength: 1, expectedDefenderLosses: 1, expectedAttackerLosses: 1, defenderLosses: 1, attackerLosses: 1 }, captured: true, specialistsLost: [], defense: { fort: false, culture: 0, leader: false },
});

describe("leaders in the report (session 18)", () => {
  it("a leader's chain of captures reads as one line, with its name and what it's doing", () => {
    const view = game();
    const lines = narrateTurn(ctx, [win(1, 1), win(2, 2), win(3, 3)], namer(ctx, view)).map((l) => l.text);
    expect(lines).toEqual([`Your Leader, Aldric, expanding toward ${name(5)}, took three territories: ${name(1)}, ${name(2)} and ${name(3)} (you lost 3, they lost 3).`]);
    // One capture alone reads as before, with the leader's name.
    expect(narrateTurn(ctx, [win(1, 1)], namer(ctx, view))[0]!.text).toMatch(/^Your Leader, Aldric, expanding toward .+, took /);
  });

  it("the Steward's purchases from its purse say who and what it cost", () => {
    const view = game();
    const ev: ReplayEvent[] = [
      { type: "built", step: 1, player: "you", orderId: "s1", territory: t(4), building: "market", cost: 6, doneAtEndOfTurn: 3, by: { kind: "steward", of: "you" } },
      { type: "built", step: 2, player: "you", orderId: "s2", territory: t(4), building: "fort", cost: 8, doneAtEndOfTurn: 4, by: { kind: "steward", of: "you" } },
      { type: "invested", step: 3, player: "you", orderId: "s3", territory: t(4), culture: 2, cost: 4, by: { kind: "steward", of: "you" } },
      { type: "income", step: 4, player: "you", income: 14, upkeep: 0, goldAfter: 12, deserted: 0, deserters: [] },
      { type: "purses", step: 5, player: "you", upkeep: [], paid: [{ kind: "steward", of: "you", gold: 2 }], goldAfter: 12, purses: [{ kind: "leader", of: "you", purse: 0 }, { kind: "steward", of: "you", purse: 2 }] },
    ];
    expect(narrateTurn(ctx, ev, namer(ctx, view)).map((l) => l.text)).toEqual([
      `Your Steward, Odo, running the realm, finished a market at ${name(4)} (6 gold).`,
      `Your Steward, Odo, running the realm, began a fort at ${name(4)} (8 gold).`,
      `Your Steward, Odo, running the realm, raised culture at ${name(4)} to 2 (4 gold).`,
      "Income +14, upkeep −0: you now have 12 gold.",
      "Into purses: 2 gold to your Steward.",
    ]);
    // The Chronicle keeps what your leaders bought, and not your own purchases.
    expect(chronicleOf({ turn: 3, events: [...ev, { type: "built", step: 6, player: "you", orderId: "x", territory: t(4), building: "market", cost: 6, doneAtEndOfTurn: 3 }] }).events.filter((e) => e.type === "built")).toHaveLength(2);
  });

  it("purses paying upkeep, gold taken back, and a captured Steward, in plain words", () => {
    const view = game();
    const n = namer(ctx, view);
    const lines = narrateTurn(
      ctx,
      [
        { type: "purseTaken", step: 1, player: "you", leader: { kind: "steward", of: "you" }, gold: 9 },
        { type: "stewardCaptured", step: 2, player: "you", steward: "b1" },
        { type: "income", step: 3, player: "you", income: 10, upkeep: 20, goldAfter: 0, deserted: 0, deserters: [], fromPurses: 6 },
      ],
      n,
    ).map((l) => l.text);
    expect(lines[0]).toBe("You took 9 gold back from Odo's purse (your Steward).");
    // It arrives reporting to your own Steward (session 20b).
    expect(lines[1]).toMatch(/^.+, Lady Morwen's Steward, joins you too, reporting to Odo\./);
    expect(lines[2]).toContain("Your leaders' purses paid 6 of it.");
  });

  it("every command and budget has plain words", () => {
    const n = namer(ctx, game());
    expect(instructionName({ kind: "expand", territory: t(5) }, n)).toBe(`Expand toward ${name(5)}`);
    expect(instructionName({ kind: "military" }, n)).toBe("Run the military");
    expect(instructionName({ kind: "realm" }, n)).toBe("Run the realm");
    expect(instructionName({ kind: "fortify" }, n)).toBe("Fortify the frontier");
    expect(instructionName({ kind: "front", provinces: [ctx.map.provinces[0]!.id] }, n)).toBe(`Command the front in ${ctx.map.provinces[0]!.name}`);
    expect([budgetLabel({ share: 0.2 }), budgetLabel({ gold: 8 }), budgetLabel({ share: 0 })]).toEqual(["20% of income", "8 gold a turn", "no budget"]);
  });
});

describe("the Leaders panel's logic (session 18)", () => {
  beforeEach(() => {
    setHostFactory(() => inProcessHost("leaders-page"));
    useGame.getState().playAgain();
    useGame.getState().setLobby({ mapId: "embervale", bots: 3, botLevel: "captain", turnSeconds: null, leaderName: "Aldric", stewardName: "Odo" });
  });

  it("the lobby's names reach the game; your Steward starts running the realm on 20% (10% on a crowded table)", async () => {
    await useGame.getState().start();
    const { view: v, ctx: c } = useGame.getState();
    const share = c!.map.territories.length / v!.players.length <= c!.rules.leaders.crowdedTerritories ? 0.1 : 0.2;
    expect(v!.me.leaders.map((l) => [l.kind, l.name, l.command, l.budget])).toEqual([
      ["leader", "Aldric", null, { share: 0 }],
      ["steward", "Odo", { kind: "realm" }, { share }],
    ]);
  });

  it("a front: tap its provinces on the map (a second tap takes one back), then Confirm", async () => {
    await useGame.getState().start();
    const { ctx, view } = useGame.getState();
    // Two territories in different provinces.
    const a = ctx!.map.territories[0]!;
    const b = ctx!.map.territories.find((t) => t.province !== a.province)!;
    useGame.getState().pickPlace(`leader:${view!.me.id}`, "front");
    useGame.getState().tap(a.id);
    useGame.getState().tap(b.id);
    useGame.getState().tap(b.id);
    expect(useGame.getState().picking?.provinces).toEqual([a.province]);
    useGame.getState().tap(b.id);
    useGame.getState().confirmPick();
    await new Promise((r) => setTimeout(r, 0));
    expect(useGame.getState().instructions[`leader:${view!.me.id}`]).toEqual({ kind: "front", provinces: [a.province, b.province] });
    expect(useGame.getState().turnOrders()[0]).toMatchObject({ kind: "instruct", general: view!.me.id, instruction: { kind: "front" } });
  });

  it("a province command picks the province of the territory you tap; Expand picks the territory", async () => {
    await useGame.getState().start();
    const { ctx, view } = useGame.getState();
    const t = ctx!.map.territories[7]!;
    useGame.getState().pickPlace(`steward:${view!.me.id}`, "culture");
    useGame.getState().tap(t.id);
    useGame.getState().pickPlace(`leader:${view!.me.id}`, "expand");
    useGame.getState().tap(t.id);
    await new Promise((r) => setTimeout(r, 0));
    expect(useGame.getState().instructions).toEqual({ [`steward:${view!.me.id}`]: { kind: "culture", province: t.province }, [`leader:${view!.me.id}`]: { kind: "expand", territory: t.id } });
  });

  it("budgets and Take back go with the turn as orders; the purse taken back counts as empty for this turn's plans", async () => {
    await useGame.getState().start();
    for (let i = 0; i < 2; i++) await useGame.getState().lockIn();
    useGame.getState().endReplay();
    const me = useGame.getState().view!.me;
    const steward = me.leaders.find((l) => l.kind === "steward")!;
    expect(steward.purse).toBeGreaterThan(0);
    await useGame.getState().setBudget(`leader:${me.id}`, { share: 0.3 });
    await useGame.getState().takeBack(`steward:${me.id}`);
    const orders = useGame.getState().turnOrders();
    expect(orders).toContainEqual({ id: `budget-leader-${me.id}`, kind: "budget", general: me.id, budget: { share: 0.3 } });
    expect(orders).toContainEqual({ id: `budget-steward-${me.id}`, kind: "budget", general: me.id, role: "steward", takeBack: steward.purse });
    // The Steward writes nothing it would pay for with the purse you're taking back.
    expect(useGame.getState().queue.some((o) => o.steward && (o.kind === "build" || o.kind === "invest" || o.kind === "recruit"))).toBe(false);
    const gold = me.gold;
    await useGame.getState().lockIn();
    expect(useGame.getState().report!.events.find((e) => e.type === "purseTaken")).toMatchObject({ gold: steward.purse });
    expect(useGame.getState().view!.me.leaders.find((l) => l.kind === "leader")!.budget).toEqual({ share: 0.3 });
    expect(gold).toBeGreaterThanOrEqual(0);
  });

  it("Mixed in or After mine: the setting arranges the queue that plays (and is remembered)", async () => {
    await useGame.getState().start();
    const mine = [1, 2].map((i) => ({ id: `y${i}`, kind: "invest", territory: "x" }) as Order);
    const theirs = [1, 2, 3].map((i) => ({ id: `s${i}`, kind: "invest", territory: "z", steward: "you" }) as Order);
    useGame.setState({ queue: [...theirs, ...mine] });
    useGame.getState().setLeaderPlacement("mixed");
    expect(useGame.getState().arranged().map((o) => o.id)).toEqual(["y1", "s1", "y2", "s2", "s3"]);
    useGame.getState().setLeaderPlacement("after");
    expect(useGame.getState().arranged().map((o) => o.id)).toEqual(["y1", "y2", "s1", "s2", "s3"]);
    expect(useGame.getState().leaderPlacement).toBe("after");
    useGame.getState().setLeaderPlacement("mixed");
    // Moving one of your orders up moves it among yours.
    useGame.getState().shift("y2", -1);
    expect(arrangeQueue(useGame.getState().queue, "mixed").map((o) => o.id)).toEqual(["y2", "s1", "y1", "s2", "s3"]);
  });

  it("a build or culture of yours takes that place back from your Steward; leaders' purchases don't touch your treasury's gold left", async () => {
    await useGame.getState().start();
    const { ctx, view } = useGame.getState();
    const cap = view!.me.capital;
    const queue = [{ id: "s1", kind: "invest", territory: cap, steward: view!.me.id } as Order];
    expect(takeControl(view!, queue, { id: "y", kind: "invest", territory: cap }, []).queue).toEqual([]);
    const v = structuredClone(view!);
    v.me.leaders[1]!.purse = 5;
    const plan = planQueue(ctx!, v, queue);
    expect(plan.goldLeft).toBe(v.me.gold);
    expect(plan.pursesLeft.get(`steward:${v.me.id}`)).toBe(5 - ctx!.rules.culture.investCost[0]!);
  });

  it("an open leader's command is outlined: Expand's target and the provinces on the way; a front's provinces", async () => {
    await useGame.getState().start();
    const { ctx, view } = useGame.getState();
    const far = ctx!.map.territories[ctx!.map.territories.length - 1]!.id;
    const a = commandArea(ctx!, view!, `leader:${view!.me.id}`, { kind: "expand", target: undefined, territory: far } as never);
    expect(a.glow).toEqual([far]);
    expect(a.provinces).toContain(ctx!.map.territories.find((t) => t.id === view!.me.capital)!.province);
    expect(a.provinces).toContain(ctx!.map.territories.find((t) => t.id === far)!.province);
    expect(commandArea(ctx!, view!, "leader:you", { kind: "front", provinces: ["p1", "p2"] }).provinces).toEqual(["p1", "p2"]);
    // (The page outlines the same way the leader plans: the same width.)
    expect(marshalData.leaders.expand.width).toBe(1);
  });
});

describe("keep or let go (session 19)", () => {
  it("counts captured Stewards over the cap as well as captured Leaders", async () => {
    const { overCap } = await import("../src/logic/generals");
    const view = game();
    const max = ctx.rules.leaders.maxOfKind - 1;
    const steward = (of: string) => ({ kind: "steward" as const, of, name: `S-${of}`, personality: null, command: null, budget: { share: 0 }, purse: 0 });
    const leaders = [...view.me.leaders, ...Array.from({ length: max + 1 }, (_, i) => steward(`x${i}`))];
    expect(overCap(ctx, { ...view, me: { ...view.me, leaders } })).toEqual({ leader: 0, steward: 1 });
    expect(overCap(ctx, view)).toEqual({ leader: 0, steward: 0 });
    const captured = Array.from({ length: max + 2 }, (_, i) => ({ of: `y${i}`, territory: t(i) }));
    expect(overCap(ctx, { ...view, me: { ...view.me, captured } as typeof view.me })).toEqual({ leader: 2, steward: 0 });
  });
});

describe("session 20: Clean up, Push back, Report to, finishing, the 100% cap", () => {
  it("Clean up is offered once you hold 75% of the map, not before", async () => {
    const { cleanUpOffered } = await import("../src/ui/CommandMenu");
    const s = createGame(ctx, { gameId: "g", seed: "cleanup", players: [{ id: "you", name: "You", delegate: true }, { id: "b1", name: "Lady Morwen" }] });
    const ids = ctx.map.territories.map((x) => x.id);
    const hold = (k: number) => ids.forEach((id, i) => (s.territories[id]!.owner = i < k ? "you" : "b1"));
    hold(Math.ceil(ids.length * 0.75) - 1);
    expect(cleanUpOffered(ctx, viewFor(ctx, s, "you"))).toBe(false);
    hold(Math.ceil(ids.length * 0.75));
    expect(cleanUpOffered(ctx, viewFor(ctx, s, "you"))).toBe(true);
  });

  it("the new commands and the leaders' reasons read plainly", async () => {
    const { leaderNoteLine } = await import("../src/logic/text");
    const view = game();
    const n = namer(ctx, view);
    expect(instructionName({ kind: "cleanup" }, n)).toBe("Clean up");
    expect(instructionName({ kind: "pushBack", player: "b2" }, n)).toBe("Push back Baron Krell");
    expect(instructionName({ kind: "report", to: "you" }, n)).toBe("Report to Aldric");
    expect(instructionName({ kind: "report", to: "you" }, n, "steward")).toBe("Report to Odo");
    expect(leaderNoteLine({ kind: "finishing", rivals: [{ rival: "b1", land: 3 }] }, n)).toBe("Finishing them off: Lady Morwen (3 territories left)");
    expect(leaderNoteLine({ kind: "pushBack", rival: "b2", going: [t(4)], avoiding: { at: t(7), troops: 40 }, striking: false }, n)).toBe(`Going for ${name(4)}; Baron Krell's main army at ${name(7)} (40) is too big for now`);
    expect(leaderNoteLine({ kind: "saving", gold: 14, for: "barracks", at: t(2) }, n)).toBe(`Saving 14 gold: nowhere to recruit until the barracks at ${name(2)} is up`);
  });

  it("the report: 'Your Leader, Aldric, finished Lady Morwen'", () => {
    const view = game();
    const lines = narrateTurn(ctx, [{ type: "eliminated", step: 9, player: "b1", by: "you", leader: { kind: "leader", of: "you" } } as ReplayEvent], namer(ctx, view)).map((l) => l.text);
    expect(lines).toEqual(["Your Leader, Aldric, finished Lady Morwen."]);
  });
});
