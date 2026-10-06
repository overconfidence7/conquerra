import type { GameContext, Order, PlayerView } from "@conquerra/engine";
import { standing } from "../logic/generals";
import { namer } from "../logic/text";
import { useGame } from "../store";
import { useArtUrl } from "./art";
import { generalDoing, GeneralLines } from "./Command";
import { Frame } from "./Frame";
import { portraitOf } from "./PlayersPanel";

/** Your Leader: where it is, and whether it's leading an army this turn. */
export function LeaderCard({ ctx, view, queue }: { ctx: GameContext; view: PlayerView; queue: readonly Order[] }) {
  const { instructions, paused, select } = useGame();
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
      <GeneralLines ctx={ctx} view={view} onShow={select} />
    </Frame>
  );
}
