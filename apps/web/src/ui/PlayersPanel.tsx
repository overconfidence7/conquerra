import type { PlayerView } from "@conquerra/engine";
import { HOUSES, houseOf } from "../map/houses";
import { useArtUrl, useShield } from "./art";
import { Frame } from "./Frame";

const portraitOf = (seat: number) => `leader-${String((seat % 10) + 1).padStart(2, "0")}`;

function PlayerRow({ view, id, seat }: { view: PlayerView; id: string; seat: number }) {
  const p = view.players.find((x) => x.id === id)!;
  const house = houseOf(view, id);
  const shield = useShield(house);
  const portrait = useArtUrl(portraitOf(seat));
  const out = p.eliminatedTurn !== null;
  return (
    <li className={`player ${out ? "out" : ""}`}>
      {shield ? <img className="shield" src={shield} alt="" /> : <span />}
      {portrait ? <img className="portrait" src={portrait} alt="" /> : <span />}
      <span>
        <span className="pname">{id === view.me.id ? "You" : p.name}</span>
        <span className="house">House {house.name}</span>
      </span>
      <span className="state">{out ? `Out (turn ${p.eliminatedTurn})` : "In"}</span>
    </li>
  );
}

/** Every House: shield (colour and pattern), name, Leader portrait, and whether they're still in. Nothing more (decided). */
export function PlayersPanel({ view }: { view: PlayerView }) {
  return (
    <Frame title="Houses" className="slim">
      <ul className="players">
        {view.players.slice(0, HOUSES.length).map((p, i) => (
          <PlayerRow key={p.id} view={view} id={p.id} seat={i} />
        ))}
      </ul>
    </Frame>
  );
}

export { portraitOf };
