import type { PlayerView } from "@conquerra/engine";
import { botLine, reasonLine, VOICES, type BotSituation, type ReasonKey, type Speaker, type Vars, type VoiceId } from "@conquerra/content/lines";

/**
 * What a bot says (session 22): its lines come from the line library (`@conquerra/content/lines`), in its
 * personality's voice (the Captain and the Recruit: the plain voice). Which version it says is picked from the game's
 * public id, the turn and the bot, so a reload or a replay says the same. Words only: nothing here decides anything.
 */
export type { Speaker };

/** The speaker for this bot's view this turn: `voice` its personality, if it has one with a voice. */
export function speakerOf(view: PlayerView, voice: string | null = null): Speaker {
  return { game: view.gameId, turn: view.turn, who: view.me.id, voice: VOICES.includes(voice as VoiceId) ? (voice as VoiceId) : null };
}

/** A shared reason, in the speaker's voice. `extra` tells apart two of the same reason in one turn (an offer's id). */
export const say = (s: Speaker, key: ReasonKey, vars?: Vars, extra?: string) => reasonLine(s, key, vars, extra);

/** A personality's own line (only for a speaker with a voice). */
export const sayOwn = (s: Speaker, situation: BotSituation, vars?: Vars, extra?: string) => (s.voice ? botLine({ ...s, voice: s.voice }, situation, vars, extra) : null);
