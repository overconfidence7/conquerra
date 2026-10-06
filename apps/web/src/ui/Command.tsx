import type { GameContext, Instruction, InstructionKind, PlayerId, PlayerView, TerritoryId } from "@conquerra/engine";
import { useState } from "react";
import { Frame } from "./Frame";
import { generalAt, INSTRUCTIONS, standing } from "../logic/generals";
import { generalName, instructionDoing, namer } from "../logic/text";
import { useGame } from "../store";
import { useArtUrl } from "./art";
import { colorOf } from "./colors";
import { portraitOf } from "./PlayersPanel";

/** A general's portrait: its Leader's (yours, or the knocked-out player's for a captured general). */
export function GeneralPortrait({ view, general, size = 36 }: { view: PlayerView; general: PlayerId; size?: number }) {
  const seat = Math.max(0, view.players.findIndex((p) => p.id === general));
  const url = useArtUrl(portraitOf(seat));
  return url ? <img className="gen-portrait" src={url} alt="" width={size} height={size} /> : null;
}

/** What a general is doing this turn, in one line ("Pushing toward Old March", "You give its army orders"). */
export function generalDoing(ctx: GameContext, view: PlayerView, general: PlayerId, instruction: Instruction | null, paused: boolean): string {
  const n = namer(ctx, view);
  const at = generalAt(view, general);
  if (general === view.me.id && !view.me.leader.alive) return "Fallen: returns at the end of this turn.";
  if (!instruction) return "No instruction: you give its army orders.";
  const doing = instructionDoing(instruction, n, at);
  if (paused) return `${doing}, but you gave its army an order: yours to command this turn.`;
  if (instruction.kind === "push" && at === instruction.territory) return `Holding ${n.place(at)}: it got there.`;
  return doing;
}

/**
 * The general standing in the selected territory: who, what it's doing, and Command. Command, an instruction, then
 * (if it needs one) a rival or a place on the map: three taps at most. Shown only on a territory where one of your
 * generals stands.
 */
export function CommandRow({ ctx, view, general }: { ctx: GameContext; view: PlayerView; general: PlayerId }) {
  const { instructions, paused, picking, setInstruction, pickPlace, cancelPick } = useGame();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState<InstructionKind | null>(null);
  const n = namer(ctx, view);
  const current = general in instructions ? instructions[general]! : standing(view, general);
  const isPaused = paused.includes(general);
  const captured = general !== view.me.id;
  const done = (i: Instruction | null) => {
    void setInstruction(general, i);
    setOpen(false);
    setChoosing(null);
  };
  // Rivals still in, the ones whose land you know of first.
  const known = new Set(Object.values(view.territories).map((t) => (t.detail === "full" ? t.owner : (t.lastSeen?.owner ?? null))));
  const rivals = view.players.filter((p) => p.id !== view.me.id && p.eliminatedTurn === null).sort((a, b) => Number(known.has(b.id)) - Number(known.has(a.id)));
  const choose = (kind: InstructionKind) => {
    const def = INSTRUCTIONS.find((x) => x.kind === kind)!;
    if (def.needs === "nothing") return done({ kind: "hold" });
    if (def.needs === "place") {
      pickPlace(general, "push");
      setOpen(false);
      return;
    }
    setChoosing(kind);
  };
  const pickingHere = picking?.general === general;
  return (
    <div className="command">
      <div className="command-head">
        <GeneralPortrait view={view} general={general} />
        <div className="command-who">
          <b>{generalName(n, general)}</b>
          {captured && <span className="muted small"> · captured general</span>}
          <span className="block small">{generalDoing(ctx, view, general, current, isPaused)}</span>
        </div>
        <button className={`command-btn ${open || pickingHere ? "on" : ""}`} aria-expanded={open} onClick={() => (pickingHere ? cancelPick() : (setOpen((o) => !o), setChoosing(null)))}>
          {pickingHere ? "Cancel" : "Command"}
        </button>
      </div>
      {pickingHere && <p className="arriving">Tap the place on the map to {picking!.kind === "push" ? "push toward" : "defend toward"}.</p>}
      {open && !choosing && (
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
      )}
      {open && choosing && (
        <div className="action">
          <p className="small">{choosing === "raid" ? "Raid which rival?" : "Defend the border with which rival?"}</p>
          <div className="chips" role="radiogroup" aria-label="Rival">
            {rivals.map((p) => (
              <button key={p.id} className="chip rival-chip" style={{ borderColor: colorOf(view, p.id) }} onClick={() => done(choosing === "raid" ? { kind: "raid", player: p.id } : { kind: "defend", player: p.id })}>
                {p.name}
              </button>
            ))}
            {choosing === "defend" && (
              <button
                className="chip"
                onClick={() => {
                  pickPlace(general, "defend");
                  setOpen(false);
                  setChoosing(null);
                }}
              >
                A place on the map…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** For the Leader card: one line per general (your Leader, then captured ones), with what it's doing. */
export function GeneralLines({ ctx, view, onShow }: { ctx: GameContext; view: PlayerView; onShow(t: TerritoryId): void }) {
  const { instructions, paused } = useGame();
  const n = namer(ctx, view);
  if (!view.me.captured.length) return null;
  return (
    <ul className="general-lines" aria-label="Captured generals">
      {view.me.captured.map((g) => {
        const i = g.of in instructions ? instructions[g.of]! : g.instruction;
        return (
          <li key={g.of}>
            <button className="link general-line" onClick={() => onShow(g.territory)} title="Show where it stands">
              <GeneralPortrait view={view} general={g.of} size={30} />
              <span>
                <b>{n.who(g.of)}</b> <span className="muted small">captured, at {n.place(g.territory)}</span>
                <span className="block small">{generalDoing(ctx, view, g.of, i, paused.includes(g.of))}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A third captured general arrived: you may keep two (rules.generals.maxCaptured). Pick which to let go; if you
 * don't, the ones nearest your front stay when the turn plays.
 */
export function KeepGenerals({ ctx, view, onDone }: { ctx: GameContext; view: PlayerView; onDone(): void }) {
  const { releases, toggleRelease } = useGame();
  const n = namer(ctx, view);
  const max = ctx.rules.generals.maxCaptured;
  const over = view.me.captured.length - max;
  const chosen = releases.filter((g) => view.me.captured.some((c) => c.of === g)).length;
  return (
    <div className="overlay">
      <Frame className="dialog" role="dialog" label="Choose your captured generals" title={`You may keep ${max} captured generals`}>
        <p>Choose {over === 1 ? "one" : over} to let go. If you don't, the {max} nearest your front stay.</p>
        <ul className="general-lines keep-list">
          {view.me.captured.map((g) => {
            const going = releases.includes(g.of);
            return (
              <li key={g.of}>
                <button className={`general-line keep ${going ? "going" : ""}`} aria-pressed={going} onClick={() => toggleRelease(g.of)} disabled={!going && chosen >= over}>
                  <GeneralPortrait view={view} general={g.of} size={36} />
                  <span>
                    <b>{n.who(g.of)}</b> <span className="muted small">at {n.place(g.territory)}</span>
                    <span className="block small">{going ? "Letting go" : "Keeping"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button className="primary wide" onClick={onDone} disabled={chosen !== over}>
          Keep the other {max}
        </button>
        <button className="link" onClick={onDone}>
          Decide later
        </button>
      </Frame>
    </div>
  );
}
