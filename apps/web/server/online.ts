import { defaultRules, mapCatalog } from "@conquerra/content";
import { LEADER_STYLES, STEWARD_STYLES, type LeaderStyle } from "@conquerra/engine";
import { HOUSES } from "../src/map/houses";
import type { BotChoice, LobbySettings, NewOnlineGame } from "../src/host/protocol";
import { ONLINE_TIMER_CHOICES } from "../src/logic/timer";

/**
 * What the API accepts when someone makes an online game (session 26): the lobby's settings, checked and cleaned (a
 * page can send anything). No Cloudflare here, so it's tested in Node.
 */

const LEVELS: readonly BotChoice[] = ["recruit", "captain", "marshal", "mixed"];

/** A name for someone who just signed in, from their email ("nkurtz@gmail.com" → "Nkurtz"); they can change it later. */
export function nameFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").replace(/[._+-]+/g, " ").replace(/\d+/g, "").trim();
  const first = local.split(" ")[0] || "Player";
  return (first[0]!.toUpperCase() + first.slice(1)).slice(0, 24);
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const styleOf = (v: unknown, allowed: readonly string[]): LeaderStyle | null => (typeof v === "string" && allowed.includes(v) ? (v as LeaderStyle) : null);

/** The game's settings from a page's request, or a sentence saying what's wrong. */
export function cleanNewGame(body: unknown): { settings: LobbySettings; leadersRun: boolean } | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Partial<NewOnlineGame>;
  const s = (b.settings && typeof b.settings === "object" ? b.settings : {}) as Partial<LobbySettings>;
  const map = mapCatalog.find((m) => m.id === s.mapId);
  if (!map) return { error: "That map isn't one of the game's maps." };
  const bots = Math.floor(Number(s.bots));
  if (!Number.isFinite(bots) || bots < 1 || bots > map.maxPlayers - 1) return { error: `${map.name} takes 1 to ${map.maxPlayers - 1} bots.` };
  if (!ONLINE_TIMER_CHOICES.includes(s.turnSeconds as number)) return { error: "Online games use a timer of 3, 5 or 10 minutes, or 1, 8 or 24 hours." };
  const level: BotChoice = LEVELS.includes(s.botLevel as BotChoice) ? (s.botLevel as BotChoice) : "marshal";
  const luck = typeof s.luck === "number" && s.luck >= 0 && s.luck <= 1 ? s.luck : defaultRules.combat.luck;
  const house = Number.isInteger(s.house) && s.house! >= 0 && s.house! < HOUSES.length ? s.house! : 0;
  const leaderName = str(s.leaderName, 40);
  const stewardName = str(s.stewardName, 40);
  const settings: LobbySettings = {
    mapId: map.id,
    bots,
    botLevel: level,
    ...(level === "mixed" ? { marshals: Math.max(0, Math.min(bots, Math.floor(Number(s.marshals) || Math.ceil(bots / 2)))) } : {}),
    showPersonalities: !!s.showPersonalities,
    luck,
    fog: s.fog !== false,
    mode: s.mode === "conquest" ? "conquest" : "classic",
    turnSeconds: s.turnSeconds as number,
    fate: s.fate !== false,
    diplomacy: s.diplomacy !== false,
    house,
    ...(leaderName ? { leaderName } : {}),
    ...(stewardName ? { stewardName } : {}),
    leaderPersonality: styleOf(s.leaderPersonality, LEADER_STYLES),
    stewardPersonality: styleOf(s.stewardPersonality, STEWARD_STYLES),
  };
  return { settings, leadersRun: b.leadersRun !== false };
}

/** A short game id for links ("k3f9q2m8w1xz"): 12 letters and digits from a random source. */
export function newGameId(): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => abc[b % abc.length]).join("");
}
