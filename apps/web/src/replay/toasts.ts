import type { GameContext, PlayerView, ReplayEvent } from "@conquerra/engine";
import { houseOf } from "../map/houses";
import { fateName, MARK_NAME, SET_NAME } from "../logic/cards";

export interface Toast {
  text: string;
  tone: "good" | "bad" | "info" | "quiet";
  /** House colour to trim the toast with (null for fogged or neutral events). */
  house: string | null;
  /** A Fate or Fallen event on your own land (session 16): a big banner that stays longer. */
  banner?: boolean;
}

/**
 * The short gilded pop-ups during and after the replay ("Gules captures Oakcrest"). Fogged events only ever say
 * what kind of thing happened and in which province ("A battle in Northreach"): no names, no numbers.
 * Small things (marches, recruits) don't get a toast; they're on the map and in the turn report.
 */
export function toastFor(ctx: GameContext, view: Pick<PlayerView, "players" | "me">, e: ReplayEvent): Toast | null {
  const place = (id: string) => ctx.map.territories.find((t) => t.id === id)?.name ?? id;
  const me = (id: string | null) => id === view.me.id;
  const house = (id: string | null) => (id ? houseOf(view, id) : null);
  const name = (id: string | null) => (me(id) ? "You" : (house(id)?.name ?? "Neutral"));
  switch (e.type) {
    case "surface": {
      const prov = ctx.map.provinces.find((p) => p.id === e.province)?.name ?? "the fog";
      if (e.what === "fate") return { text: `Something stirs in ${prov}`, tone: "quiet", house: null };
      return { text: e.what === "battle" ? `A battle in ${prov}` : `A Leader fell in ${prov}`, tone: "quiet", house: null };
    }
    case "fate":
      return {
        text: `${me(e.holder) ? "Fate on your land: " : ""}${e.shrugged ? `${fateName(e.card)} is seen off at ${place(e.at)}` : e.tone === "good" ? `${fateName(e.card)} at ${place(e.at)}` : `${fateName(e.card)} strikes ${place(e.at)}`}`,
        tone: !me(e.holder) || e.shrugged ? "info" : e.tone === "good" ? "good" : "bad",
        house: house(e.holder)?.color ?? null,
        ...(me(e.holder) ? { banner: true } : {}),
      };
    case "spoilsEarned":
      return { text: `A Spoils card: ${MARK_NAME[e.mark]}`, tone: "good", house: house(e.player)?.color ?? null };
    case "spoilsTurnedIn":
      return { text: `${me(e.player) ? "Your" : `${name(e.player)}'s`} Spoils: ${SET_NAME[e.set].toLowerCase()}`, tone: me(e.player) ? "good" : "info", house: house(e.player)?.color ?? null };
    case "missionDone":
      return me(e.player) ? { text: "Mission done!", tone: "good", house: house(e.player)?.color ?? null } : null;
    case "battle": {
      if (e.captured)
        return {
          text: `${name(e.player)} ${me(e.player) ? "capture" : "captures"} ${place(e.to)}`,
          tone: me(e.player) ? "good" : me(e.defender) ? "bad" : "info",
          house: house(e.player)?.color ?? null,
        };
      return {
        text: `${place(e.to)} holds against ${me(e.player) ? "you" : name(e.player)}`,
        tone: me(e.player) ? "bad" : me(e.defender) ? "good" : "info",
        house: house(e.defender)?.color ?? null,
      };
    }
    case "leaderKilled":
      return { text: `${me(e.player) ? "Your" : `${name(e.player)}'s`} Leader falls at ${place(e.territory)}`, tone: me(e.player) ? "bad" : "good", house: house(e.player)?.color ?? null };
    case "eliminated":
      return { text: me(e.player) ? "You have been knocked out" : `${name(e.player)} is knocked out`, tone: me(e.player) ? "bad" : me(e.by) ? "good" : "info", house: house(e.player)?.color ?? null };
    case "worldEvent": {
      const what = { plague: "A plague", storm: "A storm", uprising: "An uprising", mercenaries: "Mercenaries", famine: "A famine" }[e.event];
      if (me(e.against)) return { text: `The Fallen have turned on you: ${what.toLowerCase()} in ${place(e.target)}`, tone: "bad", house: house(e.against)?.color ?? null, banner: true };
      return { text: `${what} from the Fallen strikes ${name(e.against)} at ${place(e.target)}`, tone: "info", house: house(e.against)?.color ?? null };
    }
    case "generalCaptured":
      return me(e.player) ? { text: `${view.players.find((p) => p.id === e.general)?.name ?? "A Leader"} joins you as a captured general`, tone: "good", house: house(e.general)?.color ?? null } : null;
    case "gameOver":
      return { text: e.winner === "draw" ? "The game ends in a draw" : me(e.winner) ? "You win!" : `${name(e.winner)} wins the game`, tone: me(e.winner) ? "good" : "info", house: e.winner === "draw" ? null : (house(e.winner)?.color ?? null) };
    // Diplomacy (session 14): your own deals, a joint war aimed at you (you're told who's coming), and Oathbreakers.
    case "dealStarted": {
      const d = e.deal;
      const kind = d.terms.kind === "war" ? "joint war" : d.terms.kind === "passage" ? "right of passage" : d.terms.kind;
      if (me(d.a) || me(d.b)) return { text: `Your ${kind} with ${name(me(d.a) ? d.b : d.a)} starts`, tone: "good", house: house(me(d.a) ? d.b : d.a)?.color ?? null };
      if (d.terms.kind === "war" && me(d.terms.target)) return { text: `${name(d.a)} and ${name(d.b)} declare a joint war on you`, tone: "bad", house: house(d.a)?.color ?? null };
      return null;
    }
    case "dealBroken": {
      const kind = e.kind === "war" ? "joint war" : e.kind;
      if (me(e.by)) return { text: `You broke your ${kind}: Oathbreaker`, tone: "bad", house: house(e.by)?.color ?? null };
      if (me(e.a) || me(e.b)) return { text: `${name(e.by)} broke their ${kind} with you`, tone: "bad", house: house(e.by)?.color ?? null };
      return { text: `${name(e.by)} is an Oathbreaker`, tone: "info", house: house(e.by)?.color ?? null };
    }
    case "dealEnded":
      return me(e.a) || me(e.b) ? { text: `Your ${e.kind === "war" ? "joint war" : e.kind} with ${name(me(e.a) ? e.b : e.a)} has ended`, tone: "info", house: house(me(e.a) ? e.b : e.a)?.color ?? null } : null;
    default:
      return null;
  }
}
