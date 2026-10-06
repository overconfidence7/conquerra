import { maps } from "@conquerra/content/maps";
import type { Order, PlayerView } from "@conquerra/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import type { GameHost, LobbySettings } from "../src/host/protocol";
import { canGovernHere, generalIn, instructOrders, INSTRUCTIONS, takeControl, withGeneralOrders } from "../src/logic/generals";
import { generalDoing } from "../src/ui/Command";
import { setHostFactory, useGame } from "../src/store";
import { inProcessHost } from "./inProcessHost";

/** Just enough of a view for the pure helpers: your Leader at "a", a captured general at "c". */
const view = {
  me: { id: "you", leader: { alive: true, territory: "a" }, command: { kind: "hold" }, captured: [{ of: "bot2", territory: "c", instruction: null }] },
} as unknown as PlayerView;
const mv = (id: string, from: string, to: string, general?: string): Order => ({ id, kind: "move", from, to, troops: 3, ...(general ? { general } : {}) }) as Order;

describe("generals on the page", () => {
  it("knows which general stands where", () => {
    expect(generalIn(view, "a")).toBe("you");
    expect(generalIn(view, "c")).toBe("bot2");
    expect(generalIn(view, "b")).toBeNull();
  });

  it("an order of your own out of a general's territory takes its army back: all its orders go, and it's paused", () => {
    const queue = [mv("g1", "a", "x", "you"), mv("g2", "b", "a", "you"), mv("g3", "c", "y", "bot2")];
    const r = takeControl(view, queue, mv("own", "a", "z"), []);
    expect(r.queue.map((o) => o.id)).toEqual(["g3"]);
    expect(r.paused).toEqual(["you"]);
  });

  it("an order of your own out of a place a general meant to pull troops from drops just that order", () => {
    const queue = [mv("g1", "a", "x", "you"), mv("g2", "b", "a", "you")];
    const r = takeControl(view, queue, mv("own", "b", "z"), []);
    expect(r.queue.map((o) => o.id)).toEqual(["g1"]);
    expect(r.paused).toEqual([]);
  });

  it("fresh general orders go in front of yours, leaving out paused generals and places you've given orders", () => {
    const own = [mv("own", "b", "z")];
    const fresh = [mv("g1", "a", "x", "you"), mv("g2", "b", "a", "you"), mv("g3", "c", "y", "bot2")];
    expect(withGeneralOrders(own, fresh, ["bot2"]).map((o) => o.id)).toEqual(["g1", "own"]);
  });

  it("only instructions you changed go to the host", () => {
    expect(instructOrders(view, { you: { kind: "hold" }, bot2: null })).toEqual([]);
    expect(instructOrders(view, { you: null, bot2: { kind: "raid", player: "bot1" } })).toEqual([
      { id: "instruct-you", kind: "instruct", general: "you", instruction: null },
      { id: "instruct-bot2", kind: "instruct", general: "bot2", instruction: { kind: "raid", player: "bot1" } },
    ]);
  });
});


describe("giving your Leader an instruction (in a real game)", () => {
  beforeEach(() => {
    setHostFactory(() => inProcessHost("generals"));
    useGame.getState().playAgain();
    useGame.getState().setLobby({ mapId: "embervale", bots: 3 });
  });

  it("its orders appear in your queue at once, it keeps the instruction next turn and writes that turn's orders as planning starts", async () => {
    await useGame.getState().start();
    const v = useGame.getState().view!;
    const far = Object.keys(v.territories).find((t) => v.territories[t]!.detail === "fogged")!;
    await useGame.getState().setInstruction("you", { kind: "push", territory: far });
    const q = useGame.getState().queue;
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((o) => o.general === "you" && o.kind === "move")).toBe(true);
    expect(useGame.getState().turnOrders()[0]).toMatchObject({ kind: "instruct", general: "you" });
    await useGame.getState().lockIn();
    const s = useGame.getState();
    expect(s.view!.me.command).toEqual({ kind: "push", territory: far });
    expect(s.instructions).toEqual({});
    // The new turn's queue starts with what the general wrote (if its army can do anything).
    expect(s.queue.every((o) => o.general === "you")).toBe(true);
    // Its orders say so in the replay.
    expect(s.report!.events.some((e) => (e.type === "battle" || e.type === "moved") && e.general === "you")).toBe(true);
  });

  it("an order of your own for its army takes control back for the turn; one tap switches the instruction off", async () => {
    await useGame.getState().start();
    const v = useGame.getState().view!;
    const far = Object.keys(v.territories).find((t) => v.territories[t]!.detail === "fogged")!;
    await useGame.getState().setInstruction("you", { kind: "push", territory: far });
    const cap = v.me.capital;
    const nb = useGame.getState().ctx!.map.borders.find((b) => b.a === cap || b.b === cap)!;
    useGame.getState().select(cap);
    useGame.getState().tap(nb.a === cap ? nb.b : nb.a);
    useGame.getState().addDraft();
    const s = useGame.getState();
    expect(s.paused).toEqual(["you"]);
    expect(s.queue.some((o) => o.general)).toBe(false);
    await useGame.getState().setInstruction("you", null);
    // Set and switched off in the same turn: nothing to tell the host, and the general has no orders.
    expect(useGame.getState().turnOrders().some((o) => o.kind === "instruct" || o.general)).toBe(false);
    expect(useGame.getState().queue.some((o) => o.kind === "move" && !o.general)).toBe(true);
  });

  it("letting a captured general go sends a release order with the turn", async () => {
    await useGame.getState().start();
    useGame.getState().toggleRelease("bot2");
    expect(useGame.getState().turnOrders()[0]).toEqual({ id: "release-bot2", kind: "release", general: "bot2" });
    useGame.getState().toggleRelease("bot2");
    expect(useGame.getState().turnOrders().some((o) => o.kind === "release")).toBe(false);
  });
});

describe("Govern this province on the page (session 15)", () => {
  beforeEach(() => {
    setHostFactory(() => inProcessHost("govern-page"));
    useGame.getState().playAgain();
  });

  it("Command offers Govern only where you hold most of the province; the general's line shows its progress, never a gold total", async () => {
    useGame.getState().setLobby({ mapId: "embervale", bots: 3, turnSeconds: null });
    await useGame.getState().start();
    const { ctx, view: v } = useGame.getState();
    const cap = v!.me.capital;
    // At the start you hold one territory of your capital's province: not most of it.
    expect(canGovernHere(ctx!, v!, cap)).toBe(false);
    // Hold most of it (as far as your view goes) and you can.
    const province = ctx!.map.territories.find((t) => t.id === cap)!.province;
    const members = ctx!.map.territories.filter((t) => t.province === province).map((t) => t.id);
    const mine = structuredClone(v!) as PlayerView;
    for (const t of members.slice(0, Math.floor(members.length / 2) + 1).concat(cap)) {
      const x = mine.territories[t]!;
      mine.territories[t] = { ...(x.detail === "full" ? x : { detail: "full", seenBy: ["own"], specialists: [], building: null, construction: null, culture: 0, leaders: [], generals: [], capitalOf: null, troops: 1 }), owner: mine.me.id } as typeof x;
    }
    expect(canGovernHere(ctx!, mine, cap)).toBe(true);
    expect(INSTRUCTIONS.map((i) => i.name)).toContain("Govern this province");
    // What it's doing, and what it's saving toward.
    mine.me.command = { kind: "govern" };
    mine.me.purse = [{ general: mine.me.id, province, saved: 5, goal: { what: "fort", territory: cap, cost: 8 } }];
    const place = ctx!.map.territories.find((t) => t.id === cap)!.name;
    const pname = ctx!.map.provinces.find((p) => p.id === province)!.name;
    expect(generalDoing(ctx!, mine, mine.me.id, mine.me.command, false)).toBe(`Governing ${pname}. A fort at ${place}: 5 of 8 gold`);
  });
});
