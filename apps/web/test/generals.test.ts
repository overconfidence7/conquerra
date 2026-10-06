import { maps } from "@conquerra/content/maps";
import type { Order, PlayerView } from "@conquerra/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import type { GameHost, LobbySettings } from "../src/host/protocol";
import { generalIn, instructOrders, takeControl, withGeneralOrders } from "../src/logic/generals";
import { setHostFactory, useGame } from "../src/store";

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

/** The real game, run in-process instead of in a Web Worker. */
function inProcessHost(seed: string): GameHost {
  let game: LocalGame | null = null;
  return {
    start: async (s: LobbySettings) => (game = new LocalGame(maps[s.mapId]!, s, seed)).start(),
    lockIn: async (orders, turn) => game!.lockIn(orders, turn),
    saveOrders: (orders, turn) => game?.saveOrders(orders, turn),
    onAutoLock: () => {},
    watchNext: async () => game!.watchNext(),
    finish: async () => game!.finish(),
    suggest: async () => game!.suggest(),
    planGenerals: async (instructions) => game!.generalOrders(instructions),
    save: async (notes) => game!.save(notes),
    dispose: () => {},
  };
}

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
});
