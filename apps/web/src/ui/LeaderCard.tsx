import type { GameContext, Order, PlayerView } from "@conquerra/engine";
import { standing } from "../logic/generals";
import { namer } from "../logic/text";
import { useGame } from "../store";
import { useArtUrl } from "./art";
import { generalDoing, GeneralLines } from "./Command";
import { Frame } from "./Frame";
import { portraitOf } from "./PlayersPanel";
import { CardStack } from "./CardStack";
import { missionGoal, rewardText, turnsLeft } from "../logic/cards";

/** Your Leader: where it is, and whether it's leading an army this turn. */
export function LeaderCard({ ctx, view, queue, onCards }: { ctx: GameContext; view: PlayerView; queue: readonly Order[]; /** Open your cards (Spoils and missions). */ onCards(): void }) {
  const { instructions, paused, select, showMission, mission } = useGame();
  const portrait = useArtUrl(portraitOf(Math.max(0, view.players.findIndex((p) => p.id === view.me.id))));
  const instruction = view.me.id in instructions ? instructions[view.me.id]! : standing(view, view.me.id);
  const n = namer(ctx, view);
  const { leader, cooldowns } = view.me;
  const leading = queue.find((o) => o.kind === "move" && o.withLeader);
  const ready = (k: number) => (k === 0 ? "ready" : `in ${k} turn${k === 1 ? "" : "s"}`);
  return (
    <Frame className="slim">
      <div className="leader">
        {portrait ? <img src={portrait} alt="Your Leader" /> : <span />}
        <div>
          <h3>Your Leader</h3>
          <div className="where">
            {!leader.alive
              ? "Fallen. Returns at the end of this turn."
              : instruction
                ? generalDoing(ctx, view, view.me.id, instruction, paused.includes(view.me.id))
                : leading && leading.kind === "move"
                ? `Leading the army from ${n.place(leading.from)} to ${n.place(leading.to)} (+20%).`
                : `At ${n.place(leader.territory!)}, not leading an army.`}
          </div>
          {leader.alive && (
            <div className="powers">
              Seize the Initiative {ready(cooldowns.seize)} · Lie in Wait {ready(cooldowns.lie)}
            </div>
          )}
        </div>
      </div>
      <CardStack ctx={ctx} view={view} onOpen={onCards} />
      {view.me.missions.length > 0 && (
        <ul className="mission-lines" aria-label="Your missions">
          {view.me.missions.map((m) => {
            const left = turnsLeft(m, view.turn);
            return (
              <li key={m.id}>
                <button className={`mission-line ${mission === m.id ? "on" : ""}`} onClick={() => showMission(mission === m.id ? null : m.id)} title="Light it up on the map" aria-pressed={mission === m.id}>
                  <span className="mission-mark" aria-hidden>
                    ◆
                  </span>
                  <span>
                    {missionGoal(ctx, m, n).replace(/ by the end of turn \d+$/, "")} <b>{rewardText(m)}</b>
                    <span className={`due ${left === 0 ? "last" : ""}`}>{left === 0 ? "last turn" : `${left + 1} turns`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <GeneralLines ctx={ctx} view={view} onShow={select} />
    </Frame>
  );
}
