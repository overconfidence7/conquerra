import { beforeEach, describe, expect, it } from "vitest";
import { planQueue, spyHireOption } from "../src/logic/orders";
import { describeOrder, namer } from "../src/logic/text";
import { setHostFactory, useGame } from "../src/store";
import { buildScene } from "../src/ui/MapView";
import { inProcessHost } from "./inProcessHost";

const s = () => useGame.getState();

describe("spies on the page (session 15)", () => {
  beforeEach(() => {
    setHostFactory(() => inProcessHost("spies-page-1"));
    useGame.getState().playAgain();
  });

  it("nothing about spies shows until you hire one; Hire offers a spy at your capital; then Send is 3 taps", async () => {
    useGame.getState().setLobby({ mapId: "embervale", bots: 3, botLevel: "captain", turnSeconds: null });
    await useGame.getState().start();
    const { ctx, view } = s();
    const cap = view!.me.capital;
    expect(view!.spies).toEqual([]);
    expect(buildScene(ctx!, view!, [], cap, null, true).spies).toEqual([]);
    // Hire (from Spend at the capital).
    const opt = spyHireOption(ctx!, view!, planQueue(ctx!, view!, []), cap)!;
    expect(opt).toMatchObject({ cost: 8, ok: true });
    s().add({ kind: "hireSpy", territory: cap });
    expect(describeOrder(s().queue.at(-1)!, namer(ctx!, view!), false)).toMatch(/^Hire a spy at /);
    await s().lockIn();
    s().endReplay();
    const spy = s().view!.spies[0]!;
    expect(spy).toMatchObject({ at: cap, target: null });
    expect(s().report!.events.some((e) => e.type === "spyHired")).toBe(true);
    // It shows on your map (only yours).
    expect(buildScene(ctx!, s().view!, [], null, null, false).spies).toEqual([{ territory: cap, status: spy.status, count: 1 }]);
    // Send: tap the capital (1), Send (2), tap a province on the map (3).
    const far = ctx!.map.territories.find((t) => t.province !== ctx!.map.territories.find((x) => x.id === cap)!.province)!;
    s().tap(cap);
    s().sendSpy(spy.id);
    s().tap(far.id);
    const order = s().queue.find((o) => o.kind === "spy")!;
    expect(order).toMatchObject({ kind: "spy", spy: spy.id, to: far.province });
    expect(s().spyPick).toBeNull();
    // Sending again replaces the order; Recall too (one order per spy).
    s().recallSpy(spy.id);
    expect(s().queue.filter((o) => o.kind === "spy")).toMatchObject([{ spy: spy.id, to: null }]);
    expect(describeOrder(s().queue.find((o) => o.kind === "spy")!, namer(ctx!, view!), false)).toBe("Call your spy home");
  });

  it("at most 5 spies (counting the ones queued this turn)", async () => {
    useGame.getState().setLobby({ mapId: "embervale", bots: 3, botLevel: "captain", turnSeconds: null });
    await useGame.getState().start();
    const { ctx, view } = s();
    const cap = view!.me.capital;
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `h${i}`, kind: "hireSpy" as const, territory: cap }));
    const rich = { ...view!, me: { ...view!.me, gold: 200 } };
    expect(spyHireOption(ctx!, rich, planQueue(ctx!, rich, many), cap)).toMatchObject({ ok: false, why: "You may have at most 5 spies" });
  });

  it("with fog off there are no spies to hire", async () => {
    useGame.getState().setLobby({ mapId: "embervale", bots: 3, botLevel: "captain", turnSeconds: null, fog: false });
    await useGame.getState().start();
    const { ctx, view } = s();
    expect(spyHireOption(ctx!, view!, planQueue(ctx!, view!, []), view!.me.capital)).toBeNull();
    useGame.getState().setLobby({ fog: true });
  });
});
