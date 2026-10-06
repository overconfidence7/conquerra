import { partnersOf, type Deal, type Instruction, type InstructionKind, type PlayerId, type PlayerView } from "@conquerra/engine";
import { useState } from "react";
import { INSTRUCTIONS } from "../logic/generals";
import { useGame } from "../store";
import { colorOf } from "./colors";

/**
 * Command's menu: the four instructions (and "You give the orders"), then a rival or a place on the map if the
 * instruction needs one. Loaded the first time Command is opened.
 */
export default function CommandMenu({ view, general, current, onDone }: { view: PlayerView; general: PlayerId; current: Instruction | null; onDone(): void }) {
  const { setInstruction, pickPlace, pageDeals } = useGame();
  const [choosing, setChoosing] = useState<InstructionKind | null>(null);
  const done = (i: Instruction | null) => {
    void setInstruction(general, i);
    onDone();
  };
  // Rivals still in, the ones whose land you know of first.
  const known = new Set(Object.values(view.territories).map((t) => (t.detail === "full" ? t.owner : (t.lastSeen?.owner ?? null))));
  const rivals = view.players.filter((p) => p.id !== view.me.id && p.eliminatedTurn === null).sort((a, b) => Number(known.has(b.id)) - Number(known.has(a.id)));
  const choose = (kind: InstructionKind) => {
    const def = INSTRUCTIONS.find((x) => x.kind === kind)!;
    if (def.needs === "nothing") return done({ kind: "hold" });
    if (def.needs === "place") {
      pickPlace(general, "push");
      onDone();
      return;
    }
    setChoosing(kind);
  };
  if (!choosing)
    return (
      <div className="grid-buttons command-list" role="menu" aria-label="Instructions">
        {INSTRUCTIONS.map((i) => (
          <button key={i.kind} role="menuitem" className={current?.kind === i.kind ? "on" : ""} onClick={() => choose(i.kind)}>
            {i.name}
            <span className="small muted block">{i.help}</span>
          </button>
        ))}
        {current && (
          <button role="menuitem" onClick={() => done(null)}>
            You give the orders
            <span className="small muted block">No instruction: order its army yourself, as before.</span>
          </button>
        )}
      </div>
    );
  return (
    <div className="action">
      <p className="small">{choosing === "raid" ? "Raid which rival?" : "Defend the border with which rival?"}</p>
      <div className="chips" role="radiogroup" aria-label="Rival">
        {/* "Raid a rival" can't name a partner (a truce or a joint war of yours, in force or agreed this turn). */}
        {rivals.filter((p) => choosing !== "raid" || !partnersOf(pageDeals().filter((d) => d.terms) as Deal[], view.me.id).includes(p.id)).map((p) => (
          <button key={p.id} className="chip rival-chip" style={{ borderColor: colorOf(view, p.id) }} onClick={() => done(choosing === "raid" ? { kind: "raid", player: p.id } : { kind: "defend", player: p.id })}>
            {p.name}
          </button>
        ))}
        {choosing === "defend" && (
          <button
            className="chip"
            onClick={() => {
              pickPlace(general, "defend");
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
