import type { GameContext, PlayerView } from "@conquerra/engine";
import { namer } from "../logic/text";
import { useGame } from "../store";
import { GeneralPortrait } from "./Command";
import { Frame } from "./Frame";

/**
 * A third captured general arrived: you may keep two (rules.generals.maxCaptured). Pick which to let go; if you
 * don't, the ones nearest your front stay when the turn plays.
 */
export default function KeepGenerals({ ctx, view, onDone }: { ctx: GameContext; view: PlayerView; onDone(): void }) {
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
