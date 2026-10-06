import type { StepEvent } from "./types";

/**
 * Spies in plain words (session 15), shared by the page, the simulator and the tests. A fooled spy's news reads exactly
 * like a real infiltration: the event carries nothing else.
 */
export interface SpyNames {
  place(t: string): string;
  province(id: string): string;
}

type SpyEvent = Extract<StepEvent, { type: "spyHired" | "spy" | "spyCaught" }>;

const yours = (n: number) => (n === 1 ? "Your spy" : `Your ${n} spies`);

/** "Your spy slipped into the Oak Downs", "Your spy was turned back at Old March", "A spy was caught in Old March". */
export function spyLine(e: SpyEvent, n: SpyNames): string {
  switch (e.type) {
    case "spyHired":
      return `You hired a spy at ${n.place(e.territory)}.`;
    case "spy": {
      const who = yours(e.spies.length);
      const prov = n.province(e.province);
      const were = e.spies.length === 1 ? "was" : "were";
      switch (e.outcome) {
        case "in":
          return `${who} slipped into ${prov}.`;
        case "blocked":
          return `${who} ${were} turned back at ${prov}, and ${e.spies.length === 1 ? "is" : "are"} home again.`;
        case "killed":
          return `${who} ${were} killed in ${prov}.`;
        case "home":
          return `${who} ${e.spies.length === 1 ? "is" : "are"} back at ${n.place(e.territory)}.`;
      }
      break;
    }
    case "spyCaught":
      return `${e.spies === 1 ? "A spy was" : `${e.spies} spies were`} caught in ${n.province(e.province)}${e.outcome === "killed" ? " and killed" : " and turned back"}.`;
  }
  return "";
}
