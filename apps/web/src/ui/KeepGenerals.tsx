import type { GameContext, LeaderKind, PlayerView } from "@conquerra/engine";
import { namer } from "../logic/text";
import { overCap } from "../logic/generals";
import { useGame } from "../store";
import { Frame } from "./Frame";
import { LeaderPortrait } from "./LeadersPanel";

/**
 * One captured leader too many (of either kind): you may keep `maxOfKind - 1` captured Leaders and as many captured
 * Stewards. Pick which to let go; if you don't, the Leaders nearest your front and the Stewards with the fullest
 * purses stay when the turn plays (the engine's rule).
 */
export default function KeepGenerals({ ctx, view, onDone }: { ctx: GameContext; view: PlayerView; onDone(): void }) {
  const { releases, toggleRelease } = useGame();
  const n = namer(ctx, view);
  const max = ctx.rules.leaders.maxOfKind - 1;
  const over = overCap(ctx, view);
  // Release keys: a Leader by its player id (as before), a Steward as "steward:<id>".
  const keyFor = (kind: LeaderKind, of: string) => (kind === "steward" ? `steward:${of}` : of);
  const groups = (["leader", "steward"] as const)
    .filter((kind) => over[kind] > 0)
    .map((kind) => {
      const list =
        kind === "leader"
          ? view.me.captured.map((g) => ({ of: g.of, where: `at ${n.place(g.territory)}` }))
          : (view.me.leaders ?? []).filter((l) => l.kind === "steward" && l.of !== view.me.id).map((l) => ({ of: l.of, where: `purse ${l.purse} gold` }));
      const chosen = list.filter((x) => releases.includes(keyFor(kind, x.of))).length;
      return { kind, list, chosen, over: over[kind] };
    });
  /** Your own Leader's (or Steward's) name: the captured ones arrive reporting to it (session 20b). */
  const mine = (kind: LeaderKind) => `${(view.me.leaders ?? []).find((l) => l.kind === kind && l.of === view.me.id)?.name ?? `your ${kind === "steward" ? "Steward" : "Leader"}`}`;
  const nameOf = (kind: LeaderKind, of: string) => (view.me.leaders ?? []).find((l) => l.kind === kind && l.of === of)?.name ?? n.who(of);
  const done = groups.every((g) => g.chosen === g.over);
  const words = (k: LeaderKind, count: number) => (k === "leader" ? (count === 1 ? "Leader" : "Leaders") : count === 1 ? "Steward" : "Stewards");
  const title = groups.length === 2 ? `You may keep ${max} captured Leaders and ${max} Stewards` : `You may keep ${max} captured ${words(groups[0]?.kind ?? "leader", 2)}`;
  return (
    <div className="overlay">
      <Frame className="dialog" role="dialog" label="Choose your captured leaders" title={title}>
        {groups.map((g) => (
          <section key={g.kind}>
            <p>
              Choose {g.over === 1 ? "one" : g.over} {words(g.kind, g.over)} to let go. If you don't, {g.kind === "leader" ? `the ${max} nearest your front stay` : `the ${max} with the fullest purses stay (a Steward you let go hands its purse back to your treasury)`}.
            </p>
            <ul className="general-lines keep-list">
              {g.list.map((x) => {
                const key = keyFor(g.kind, x.of);
                const going = releases.includes(key);
                return (
                  <li key={key}>
                    <button className={`general-line keep ${going ? "going" : ""}`} aria-pressed={going} onClick={() => toggleRelease(key)} disabled={!going && g.chosen >= g.over}>
                      <LeaderPortrait view={view} l={{ kind: g.kind, of: x.of }} size={36} />
                      <span>
                        <b>{nameOf(g.kind, x.of)}</b> <span className="muted small">({g.kind === "steward" ? "Steward" : "Leader"} of {n.who(x.of)}, {x.where})</span>
                        <span className="block small">{going ? "Letting go" : "Keeping"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <p className="small muted">
          {`The ones you keep report to ${groups.map((g) => mine(g.kind)).join(" and ")} for now: they work with yours. One tap in the Leaders panel gives one a command of its own.`}
        </p>
        <button className="primary wide" onClick={onDone} disabled={!done}>
          Keep the others
        </button>
        <button className="link" onClick={onDone}>
          Decide later
        </button>
      </Frame>
    </div>
  );
}
