import { beforeEach, describe, expect, it } from "vitest";
import { keyIntent } from "../src/logic/keys";
import { moveTargets } from "../src/logic/orders";
import { setHostFactory, useGame } from "../src/store";
import { inProcessHost } from "./inProcessHost";

/** A stand-in for a focused element (the event's target). */
const el = (tagName: string, inMenu = false) => ({ tagName, isContentEditable: false, closest: (sel: string) => (inMenu && sel.includes("menu") ? {} : null) });

describe("keys (session 20): Enter confirms, Esc cancels", () => {
  it("Enter confirms and Esc cancels, from anywhere on the page but a text field or a command menu", () => {
    expect(keyIntent({ key: "Enter" })).toBe("confirm");
    expect(keyIntent({ key: "Escape" })).toBe("cancel");
    expect(keyIntent({ key: "Enter", target: el("BUTTON") })).toBe("confirm");
    expect(keyIntent({ key: "Enter", target: el("DIV") })).toBe("confirm");
    // A text field keeps its Enter (the leader's name, the exact-amount box), and its Esc.
    for (const tag of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
      expect(keyIntent({ key: "Enter", target: el(tag) })).toBeNull();
      expect(keyIntent({ key: "Escape", target: el(tag) })).toBeNull();
    }
    expect(keyIntent({ key: "Enter", target: { tagName: "DIV", isContentEditable: true } })).toBeNull();
    // In a command menu, Enter picks the highlighted command (the focused button), not the box.
    expect(keyIntent({ key: "Enter", target: el("BUTTON", true) })).toBeNull();
    // Held keys, modifiers and other keys: nothing.
    expect(keyIntent({ key: "Enter", repeat: true })).toBeNull();
    expect(keyIntent({ key: "Enter", ctrlKey: true })).toBeNull();
    expect(keyIntent({ key: "Enter", shiftKey: true })).toBeNull();
    expect(keyIntent({ key: "a" })).toBeNull();
  });

  describe("on the game screen", () => {
    beforeEach(async () => {
      setHostFactory(() => inProcessHost("keys"));
      useGame.getState().playAgain();
      useGame.getState().setLobby({ mapId: "embervale", bots: 3 });
      await useGame.getState().start();
    });
    /** Open an attack box from your capital to its first neighbour you could attack, set as you like. */
    const openAttack = () => {
      const { ctx, view } = useGame.getState();
      const from = view!.me.capital;
      const to = moveTargets(ctx!, view!, from).map((m) => m.to)[0]!;
      useGame.setState({ selected: from, draft: { from, to, amount: 3, preset: "onlyIfStronger", withLeader: false, timing: null } as never });
      return { from, to };
    };

    it("Enter adds the open attack exactly as shown (amount, Leader stays, backup plan); the box closes", () => {
      const { from, to } = openAttack();
      const before = useGame.getState().queue.length;
      expect(useGame.getState().pressKey({ key: "Enter" })).toBe(true);
      const s = useGame.getState();
      expect(s.draft).toBeNull();
      expect(s.queue.length).toBe(before + 1);
      const o = s.queue[s.queue.length - 1]!;
      expect(o).toMatchObject({ kind: "move", from, to, troops: 3 });
      expect("withLeader" in o && o.withLeader).toBeFalsy();
      expect(o.preset).toEqual({ id: "onlyIfStronger" });
    });

    it("Esc cancels it (nothing added); with no box open, the keys do nothing", () => {
      openAttack();
      const before = useGame.getState().queue.length;
      expect(useGame.getState().pressKey({ key: "Escape" })).toBe(true);
      expect(useGame.getState().draft).toBeNull();
      expect(useGame.getState().queue.length).toBe(before);
      expect(useGame.getState().pressKey({ key: "Enter" })).toBe(false);
      expect(useGame.getState().pressKey({ key: "Escape" })).toBe(false);
    });

    it("typing in the exact-amount box, Enter is the box's own (nothing is added)", () => {
      openAttack();
      const before = useGame.getState().queue.length;
      expect(useGame.getState().pressKey({ key: "Enter", target: { tagName: "INPUT" } })).toBe(false);
      expect(useGame.getState().draft).not.toBeNull();
      expect(useGame.getState().queue.length).toBe(before);
    });

    it("the path box: Enter adds its orders (the count it shows), Esc closes it", async () => {
      const { ctx, view } = useGame.getState();
      const from = view!.me.capital;
      const far = ctx!.map.territories.map((t) => t.id).find((t) => t !== from && !moveTargets(ctx!, view!, from).some((m) => m.to === t) && view!.territories[t]!.detail === "full")!;
      useGame.setState({ path: { from, to: far, kind: "shortest" } });
      const { planPath } = await import("../src/logic/paths");
      const shown = planPath(ctx!, view!, useGame.getState().queue, useGame.getState().pageDeals(), [], { from, to: far, kind: "shortest" }).orders.length;
      const before = useGame.getState().queue.length;
      expect(useGame.getState().pressKey({ key: "Enter" })).toBe(true);
      await new Promise((r) => setTimeout(r, 0));
      expect(useGame.getState().queue.length).toBe(before + shown);
      useGame.setState({ path: { from, to: far, kind: "sweep" } });
      useGame.getState().pressKey({ key: "Escape" });
      expect(useGame.getState().path).toBeNull();
    });
  });
});
