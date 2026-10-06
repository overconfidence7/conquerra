import type { SlotInfo } from "../host/saves";

/** "Embervale · 4 players · turn 12". */
export function slotLine(info: SlotInfo): string {
  const s = info.summary;
  return `${s.mapName} · ${s.players.length} players · turn ${s.turn}${s.fallen ? " · one of the Fallen" : ""}`;
}

/** "Today 14:05", "Yesterday 09:12", "3 Oct 18:40". */
export function savedWhen(at: number, now = Date.now()): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}
