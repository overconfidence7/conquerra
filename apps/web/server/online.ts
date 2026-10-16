import type { MapListing } from "@conquerra/content";
// Session 30: the raw files, not the content package's checked copies, so a cold request to the API doesn't build
// every schema first (the room still checks everything it loads).
import catalogJson from "@conquerra/content/data/maps/catalog.json";
import rulesJson from "@conquerra/content/data/rules.json";
import { LEADER_STYLES, STEWARD_STYLES, type LeaderStyle } from "@conquerra/engine/src/types";
import { parseRandomId, randomPlayers, RANDOM_PREFIX } from "@conquerra/mapgen/randomId";
import { HOUSES } from "../src/map/houses";
import type { BotChoice, LobbySettings, NewOnlineGame } from "../src/host/protocol";
import { ONLINE_TIMER_CHOICES } from "../src/logic/timer";

/**
 * What the API accepts when someone makes an online game (session 26): the lobby's settings, checked and cleaned (a
 * page can send anything). No Cloudflare here, so it's tested in Node.
 */

/** The official maps' listings (the API's copy; see above). */
export const mapCatalog: MapListing[] = catalogJson;

/** Session 30: a game's map from its id, an official one or a random one ("random:80-crescent-quiet-heron"), or null. */
export function mapListing(mapId: unknown): MapListing | null {
  if (typeof mapId !== "string") return null;
  if (mapId.startsWith(RANDOM_PREFIX)) {
    const r = parseRandomId(mapId);
    if (!r) return null;
    const p = randomPlayers(r.size, r.shape);
    // (The id as the map maker reads it: lower case, the seed's words joined by a hyphen.)
    return { id: `${RANDOM_PREFIX}${r.size}-${r.shape}-${r.seed}`, name: `Random, ${r.size} territories`, territories: r.size, minPlayers: p.min, maxPlayers: p.max, recommendedPlayers: p.recommended };
  }
  return mapCatalog.find((m) => m.id === mapId) ?? null;
}

/** A game's map as the lists name it: "Embervale", or "Random, 80 territories (quiet-heron)". */
export function mapNameOf(mapId: string): string {
  const r = mapId.startsWith(RANDOM_PREFIX) ? parseRandomId(mapId) : null;
  return r ? `Random, ${r.size} territories (${r.seed})` : (mapCatalog.find((m) => m.id === mapId)?.name ?? mapId);
}

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
  const map = mapListing(s.mapId);
  if (!map) return { error: "That map isn't one of the game's maps." };
  const bots = Math.floor(Number(s.bots));
  if (!Number.isFinite(bots) || bots < 1 || bots > map.maxPlayers - 1) return { error: `${map.name} takes 1 to ${map.maxPlayers - 1} bots.` };
  if (!ONLINE_TIMER_CHOICES.includes(s.turnSeconds as number)) return { error: "Online games use a timer of 3, 5 or 10 minutes, or 1, 8 or 24 hours." };
  const level: BotChoice = LEVELS.includes(s.botLevel as BotChoice) ? (s.botLevel as BotChoice) : "marshal";
  const luck = typeof s.luck === "number" && s.luck >= 0 && s.luck <= 1 ? s.luck : rulesJson.combat.luck;
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
    // (Session 30: or "blackout", the map hidden until you explore it.)
    fog: s.fog === "blackout" ? "blackout" : s.fog !== false,
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

/** An invite code for a table's link ("/?join=k3f9q2m8w1"): 10 letters and digits from a random source (about 50 bits). */
export function newInviteCode(): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => abc[b % abc.length]).join("");
}

/** A display name someone typed (session 27): the same rule as the room uses. */
export { cleanName } from "../src/host/names";
