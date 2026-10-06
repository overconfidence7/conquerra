import { goalLine, type GameContext, type Instruction, type PlayerId, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { lazy, Suspense, useState } from "react";
import { generalAt, standing } from "../logic/generals";
import { generalName, instructionDoing, namer } from "../logic/text";
import { useGame } from "../store";
import { useArtUrl } from "./art";
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
  // Governing: what it's saving toward, as progress on the province (never a second gold total).
  const purse = instruction.kind === "govern" ? view.me.purse?.find((p) => p.general === general) : undefined;
  if (purse?.goal) return `${doing}. ${goalLine({ ...purse.goal, saved: purse.saved }, n)}`;
  return doing;
}

/** The instruction menu (opened by Command): loaded the first time it's needed. */
const CommandMenu = lazy(() => import("./CommandMenu"));

/**
 * The general standing in the selected territory: who, what it's doing, and Command. Command, an instruction, then
 * (if it needs one) a rival or a place on the map: three taps at most. Shown only on a territory where one of your
 * generals stands.
 */
export function CommandRow({ ctx, view, general }: { ctx: GameContext; view: PlayerView; general: PlayerId }) {
  const { instructions, paused, picking, cancelPick } = useGame();
  const [open, setOpen] = useState(false);
  const n = namer(ctx, view);
  const current = general in instructions ? instructions[general]! : standing(view, general);
  const isPaused = paused.includes(general);
  const captured = general !== view.me.id;
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
        <button className={`command-btn ${open || pickingHere ? "on" : ""}`} aria-expanded={open} onClick={() => (pickingHere ? cancelPick() : setOpen((o) => !o))}>
          {pickingHere ? "Cancel" : "Command"}
        </button>
      </div>
      {pickingHere && <p className="arriving">Tap the place on the map to {picking!.kind === "push" ? "push toward" : "defend toward"}.</p>}
      {open && (
        <Suspense fallback={null}>
          <CommandMenu view={view} general={general} current={current} onDone={() => setOpen(false)} />
        </Suspense>
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
