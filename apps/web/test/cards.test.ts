import { maps } from "@conquerra/content/maps";
import type { PlayerView } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import type { LobbySettings } from "../src/host/protocol";
import { planQueue } from "../src/logic/orders";
import { dueTurnIn, handFull, setChoices, withTurnIn } from "../src/logic/spoils";
import { namer } from "../src/logic/text";

const settings: LobbySettings = { mapId: "embervale", bots: 3, botLevel: "captain", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 };

function start() {
  const g = new LocalGame(maps.embervale!, settings, "cards-ui");
  const view = JSON.parse(JSON.stringify(g.update().view)) as PlayerView;
  return { ctx: g.ctx, view, n: namer(g.ctx, view) };
}

describe("the Spoils hand on screen", () => {
  it("offers each set you can turn in, with where its windfall goes", () => {
    const { ctx, view, n } = start();
    view.me.spoils = ["tower", "tower", "tower", "sword", "laurel"];
    const c = setChoices(ctx, view, null, n);
    expect(c.map((x) => x.set)).toEqual(["tower", "mixed"]);
    expect(c[0]!.territory).toBe(view.me.capital);
    expect(c[0]!.label).toMatch(/^Three Towers: a fort and 3 troops at /);
    expect(c[1]!.label).toBe("One of each: 4 troops at your capital and 6 gold");
    view.me.spoils = ["sword", "tower"];
    expect(setChoices(ctx, view, null, n)).toEqual([]);
  });

  it("turning in is 2 taps (the stack, then a set): the order goes first in the queue, and its troops count from there", () => {
    const { ctx, view } = start();
    view.me.spoils = ["sword", "sword", "sword"];
    const before = planQueue(ctx, view, []).army.get(view.me.capital)!;
    const q = withTurnIn([{ id: "r", kind: "recruit", territory: view.me.capital, count: 1 }], { set: "sword" }, "s1");
    expect(q.map((o) => o.kind)).toEqual(["spoils", "recruit"]);
    expect(planQueue(ctx, view, q).army.get(view.me.capital)).toBe(before + ctx.rules.spoils.sword.troops + 1);
    // Choosing again replaces it.
    expect(withTurnIn(q, { set: "mixed" }, "s2").filter((o) => o.kind === "spoils")).toEqual([{ id: "s2", kind: "spoils", set: "mixed" }]);
  });

  it("a full hand can't be missed: the sensible set is already in your queue when the turn starts", () => {
    const { ctx, view, n } = start();
    view.me.spoils = ["laurel", "sword", "laurel", "sword", "laurel"];
    expect(handFull(ctx, view)).toBe(true);
    const q = dueTurnIn(ctx, view, [], n, "auto");
    expect(q).toEqual([{ id: "auto", kind: "spoils", set: "laurel", territory: view.me.capital }]);
    view.me.spoils = ["laurel", "sword", "tower", "sword", "laurel"];
    expect(dueTurnIn(ctx, view, [], n, "auto")[0]).toMatchObject({ set: "mixed" });
    // Not full: nothing is added. With the deck off: nothing either.
    view.me.spoils = ["laurel", "sword", "tower"];
    expect(dueTurnIn(ctx, view, [], n, "auto")).toEqual([]);
  });
});
