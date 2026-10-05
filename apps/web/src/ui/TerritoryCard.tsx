import type { GameContext, PlayerView, TerritoryId } from "@conquerra/engine";
import { territoryCard } from "../map/card";
import { useArtUrl } from "./art";
import { ArtIcon } from "./ArtIcon";
import { Frame } from "./Frame";

/** Which vista picture suits a territory: capitals and towns get the city, coasts the harbour, else by terrain. */
export function vistaFor(ctx: GameContext, id: TerritoryId): string {
  const g = ctx.map.geometry;
  const t = g?.territories.find((x) => x.id === id);
  const def = ctx.map.territories.find((x) => x.id === id)!;
  if (t?.castle || ctx.map.capitalSlots?.includes(id)) return "vista-city";
  if (g?.seaLanes.some((l) => l.a === id || l.b === id)) return "vista-harbor";
  if (def.terrain === "forest" || def.terrain === "swamp") return "vista-forest";
  if (def.terrain === "mountains" || def.terrain === "hills") return "vista-mountain";
  return "vista-valley";
}

/**
 * The territory card in the gilded frame: vista art by terrain, owner, troops, building, culture, gold and
 * specialists. Fogged land shows what you last saw with "?" and how long ago, or "Unexplored".
 */
export function TerritoryCard({ ctx, view, id, compact = false }: { ctx: GameContext; view: PlayerView; id: TerritoryId; compact?: boolean }) {
  const info = territoryCard(ctx, view, id);
  const vista = useArtUrl(vistaFor(ctx, id));
  return (
    <Frame className={`tcard ${info.uncertain ? "uncertain" : ""}`}>
      {!compact && <div className="tcard-vista" style={vista ? { backgroundImage: `url(${vista})` } : undefined} />}
      <div className="tcard-title">{info.title}</div>
      <div className="tcard-sub">{info.subtitle}</div>
      {info.intel && <div className="tcard-intel">{info.intel}</div>}
      {/* One plain sentence per row, each with its icon (the label is for screen readers). */}
      <ul className="tcard-rows">
        {info.lines.map((l) => (
          <li key={l.label} aria-label={`${l.label}: ${l.value}`}>
            <span className="tcard-icon" aria-hidden>
              {l.color ? <span className="swatch" style={{ background: l.color }} /> : l.icon ? <ArtIcon name={l.icon} size={16} /> : null}
            </span>
            <span>{l.value}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
