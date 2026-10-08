import { leaderKey, partnersOf, type Deal, type GameContext, type Instruction, type InstructionKind, type LeaderKind, type PlayerView } from "@conquerra/engine";
import { useState } from "react";
import { useGame, type PickKind } from "../store";
import { colorOf } from "./colors";

/**
 * A leader's Command menu (session 18): the commands for its kind, in plain words, then (where a command needs one) a
 * rival from a short list or a place or provinces on the map. Loaded the first time Command is opened.
 *
 * Taps from the Leaders panel: the leader, Command, the command, then (if it needs one) the place on the map or a
 * rival: 4 at most, 5 for a front (its provinces, then Confirm), 3 for a command that needs nothing. Session 20: Clean
 * up 3 (offered once you hold `rules.leaders.cleanUpShare` of the map), Push back 4 (the rival), Report to 4 (the senior).
 */
interface Item {
  kind: InstructionKind;
  name: string;
  help: string;
  /** What else it needs: nothing, a place or province on the map (and which pick), or a rival. */
  needs: "nothing" | { pick: PickKind } | "rival" | "rivalOrPlace" | "rivalOrAnywhere" | "senior";
  /** Offered only once you hold most of the map (Clean up). */
  late?: boolean;
}

export const MILITARY_ITEMS: { group: string; items: Item[] }[] = [
  {
    group: "Lead its army",
    items: [
      { kind: "hold", name: "Hold here", help: "Keep this territory, pulling in troops from next door if it's threatened.", needs: "nothing" },
      { kind: "defend", name: "Defend this border", help: "Guard the border with a rival (or toward a place): hold it and hit back.", needs: "rivalOrPlace" },
      { kind: "push", name: "Push toward a place", help: "March toward a place you pick, taking land along the way.", needs: { pick: "push" } },
      { kind: "raid", name: "Raid a rival", help: "Take a rival's weakly held land and keep clear of its big armies.", needs: "rival" },
    ],
  },
  {
    group: "Bigger commands",
    items: [
      { kind: "expand", name: "Expand our empire in this direction", help: "Pick a target. Fast through weak land, careful where it's contested, taking whole provinces on the way.", needs: { pick: "expand" } },
      { kind: "front", name: "Command this front", help: "Mark provinces on the map: it commands every army of yours there and recruits for them.", needs: { pick: "front" } },
      { kind: "military", name: "Run the military", help: "Every army and all the recruiting (except armies another leader commands, or that you order).", needs: "nothing" },
      { kind: "pushBack", name: "Push back a rival", help: "One rival only: its weakly held land, breaking its chains, clear of its big armies until it can beat them.", needs: "rival" },
      { kind: "cleanup", name: "Clean up", help: "Finish off the rivals that are left: every leader on Clean up shares them out, surrounds them and sweeps them up.", needs: "nothing", late: true },
      { kind: "report", name: "Report to another Leader", help: "Works under a Leader who runs the military, expands or commands a front: its army and budget go to them.", needs: "senior" },
    ],
  },
];

export const STEWARD_ITEMS: { group: string; items: Item[] }[] = [
  {
    group: "Build and grow",
    items: [
      { kind: "realm", name: "Run the realm", help: "Forts where you're threatened, markets where they pay, culture where it protects.", needs: "nothing" },
      { kind: "buildUp", name: "Build up this province", help: "Forts, markets and a barracks where they help, in a province you pick.", needs: { pick: "buildUp" } },
      { kind: "fortify", name: "Fortify this frontier", help: "Forts and garrisons where you're most threatened (facing anyone, or one rival).", needs: "rivalOrAnywhere" },
      { kind: "culture", name: "Raise culture here", help: "Culture across a province you pick: it defends, protects and unlocks specialists.", needs: { pick: "culture" } },
      { kind: "economy", name: "Grow the economy", help: "Markets and culture, whichever pays back fastest, on land that's safe.", needs: "nothing" },
      { kind: "report", name: "Report to another Steward", help: "Works under the Steward who runs the realm: its budget goes to them.", needs: "senior" },
    ],
  },
];

/** Commands a junior can report to (a leader that directs more than its own army; a Steward running the realm). */
const SENIOR_COMMANDS: Record<LeaderKind, readonly string[]> = { leader: ["military", "expand", "front", "cleanup", "pushBack"], steward: ["realm"] };

/** Do you hold enough of the map for Clean up (as far as you can see your own land: always)? */
export function cleanUpOffered(ctx: GameContext, view: PlayerView): boolean {
  const held = Object.values(view.territories).filter((t) => t.detail === "full" && t.owner === view.me.id).length;
  return held >= ctx.rules.leaders.cleanUpShare * ctx.map.territories.length;
}

export default function CommandMenu({ view, general, kind = "leader", current, onDone }: { view: PlayerView; general: string; kind?: LeaderKind; current: Instruction | null; onDone(): void }) {
  const { setInstruction, pickPlace, pageDeals, ctx, instructions } = useGame();
  const key = general.includes(":") ? general : `${kind}:${general}`;
  const [choosing, setChoosing] = useState<Item | null>(null);
  const done = (i: Instruction | null) => {
    void setInstruction(key, i);
    onDone();
  };
  // Rivals still in, the ones whose land you know of first.
  const known = new Set(Object.values(view.territories).map((t) => (t.detail === "full" ? t.owner : (t.lastSeen?.owner ?? null))));
  const rivals = view.players.filter((p) => p.id !== view.me.id && p.eliminatedTurn === null).sort((a, b) => Number(known.has(b.id)) - Number(known.has(a.id)));
  const choose = (item: Item) => {
    if (item.needs === "nothing") return done({ kind: item.kind } as Instruction);
    if (typeof item.needs === "object") {
      pickPlace(key, item.needs.pick);
      onDone();
      return;
    }
    setChoosing(item);
  };
  // Clean up only once you hold most of the map (or it's already the command).
  const late = !!ctx && cleanUpOffered(ctx, view);
  // Seniors: your other leaders of this kind whose command (this turn's change included) directs more than one army.
  const seniors = (view.me.leaders ?? []).filter((l) => {
    if (l.kind !== kind || leaderKey(l) === key) return false;
    const c = leaderKey(l) in instructions ? instructions[leaderKey(l)] : l.command;
    return !!c && SENIOR_COMMANDS[kind].includes(c.kind);
  });
  const groups = (kind === "leader" ? MILITARY_ITEMS : STEWARD_ITEMS).map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.late || late || current?.kind === i.kind) && (i.needs !== "senior" || seniors.length > 0 || current?.kind === i.kind)),
  }));
  if (!choosing)
    return (
      <div className="command-list" role="menu" aria-label="Commands">
        {groups.map((g) => (
          <div key={g.group} className="command-group">
            <p className="field-name small">{g.group}</p>
            <div className="grid-buttons">
              {g.items.map((i) => (
                <button key={i.kind} role="menuitem" className={current?.kind === i.kind ? "on" : ""} onClick={() => choose(i)}>
                  {i.name}
                  <span className="small muted block">{i.help}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {current && (
          <button role="menuitem" onClick={() => done(null)}>
            {kind === "leader" ? "You give the orders" : "No command"}
            <span className="small muted block">{kind === "leader" ? "No command: order its army yourself." : "It waits, saving its purse."}</span>
          </button>
        )}
      </div>
    );
  // "Raid a rival" and "Push back" can't name a partner (a truce or a joint war of yours, in force or agreed this turn).
  const partners = partnersOf(pageDeals().filter((d) => d.terms) as Deal[], view.me.id);
  if (choosing.needs === "senior")
    return (
      <div className="action">
        <p className="small">Report to whom?</p>
        <div className="chips" role="radiogroup" aria-label="Senior">
          {seniors.map((l) => (
            <button key={leaderKey(l)} className="chip" onClick={() => done({ kind: "report", to: l.of })}>
              {l.name}
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <div className="action">
      <p className="small">{choosing.kind === "raid" ? "Raid which rival?" : choosing.kind === "pushBack" ? "Push back which rival?" : choosing.kind === "fortify" ? "Fortify the frontier facing whom?" : "Defend the border with which rival?"}</p>
      <div className="chips" role="radiogroup" aria-label="Rival">
        {choosing.needs === "rivalOrAnywhere" && (
          <button className="chip" onClick={() => done({ kind: "fortify" })}>
            Wherever most threatened
          </button>
        )}
        {rivals
          .filter((p) => (choosing.kind !== "raid" && choosing.kind !== "pushBack") || !partners.includes(p.id))
          .map((p) => (
            <button
              key={p.id}
              className="chip rival-chip"
              style={{ borderColor: colorOf(view, p.id) }}
              onClick={() => done(choosing.kind === "raid" ? { kind: "raid", player: p.id } : choosing.kind === "pushBack" ? { kind: "pushBack", player: p.id } : choosing.kind === "fortify" ? { kind: "fortify", player: p.id } : { kind: "defend", player: p.id })}
            >
              {p.name}
            </button>
          ))}
        {choosing.needs === "rivalOrPlace" && (
          <button
            className="chip"
            onClick={() => {
              pickPlace(key, "defend");
              onDone();
            }}
          >
            A place on the map…
          </button>
        )}
      </div>
    </div>
  );
}
