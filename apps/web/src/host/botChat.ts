import { chatLine, lines, reasonLine, botLine, youLines, VOICES, type ChatSituation, type ChatVoice, type Vars, type VoiceId, type YouSituation } from "@conquerra/content/lines";
import { DEAL_NAME, indexMap, type GameContext, type PlayerId, type PlayerView, type ReplayEvent, type TerritoryId } from "@conquerra/engine";

/**
 * Session 29: the bots in the chat (design §13). Words only: nothing here decides anything, and nothing reads a bot's
 * own view. Every line is written for one reader, from what that reader knows: the events in their own replay
 * (`replayFor`, their seat), their own views before and after the turn, and the public players panel. So one bot's
 * line can read differently to two people, and a bot never brags about land in your fog.
 *
 * Not heavy: a bot speaks in the table chat only when something calls for it (it took your land, you took its land, a
 * deal between you started or broke, it took a capital you saw fall, it finished a rival, it took its own capital back),
 * at most once a turn to you, at most two bots to you a turn, and the same bot at least three turns apart unless a deal
 * was made or broken. The Captain speaks only of big things, and rarely; the Recruit never chats.
 */

/** A bot at the table, as chat knows it. `voice`: how it talks (null: the Recruit, which never chats). */
export interface ChatBot {
  id: PlayerId;
  name: string;
  house: number;
  voice: ChatVoice | null;
}

/** A line a bot says to one reader. `deal`: about a deal made or broken (those don't wait the three turns). */
export interface BotSaid {
  bot: PlayerId;
  text: string;
  situation: string;
  deal: boolean;
}

const L = () => lines.limits;

/** The voice a bot's seat talks in: a Marshal's personality, the Neutral of a seat a Marshal took, the Captain's plain one, or none (the Recruit). */
export function chatVoiceOf(level: "recruit" | "captain" | "marshal", personality?: string): ChatVoice | null {
  if (level === "recruit") return null;
  if (level === "captain") return "plain";
  if (personality && (VOICES as readonly string[]).includes(personality)) return personality as VoiceId;
  return "neutral";
}

/** A personality's own voice for the line library's older sections (the Neutral and plain voices use the plain one). */
const personaOf = (v: ChatVoice): VoiceId | null => ((VOICES as readonly string[]).includes(v) ? (v as VoiceId) : null);

/** "Ashfell", "Ashfell and Pinemark", "Ashfell, Pinemark and 2 more". */
function list(xs: string[]): string {
  if (xs.length > 3) return `${xs.slice(0, 2).join(", ")} and ${xs.length - 2} more`;
  return xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? "");
}

interface Candidate {
  bot: PlayerId;
  priority: number;
  situation: string;
  text: string | null;
  deal: boolean;
}

/**
 * What the bots say to one reader in the table chat after a turn. `last`: when each bot last spoke to this reader (by
 * bot id, the turn). Returns at most `chatPerTurn` lines, one a bot, the big moments first.
 */
export function tableTalk(input: { ctx: GameContext; game: string; reader: PlayerId; before: PlayerView; after: PlayerView; events: readonly ReplayEvent[]; bots: readonly ChatBot[]; last: Readonly<Record<PlayerId, number>>; cloud?: readonly PlayerId[] }): BotSaid[] {
  const { ctx, game, reader, before, events, bots, last } = input;
  const turn = before.turn;
  const idx = indexMap(ctx.map);
  const place = (t: TerritoryId) => idx.byId.get(t)?.name ?? t;
  const name = (p: PlayerId) => input.after.players.find((x) => x.id === p)?.name ?? before.players.find((x) => x.id === p)?.name ?? p;
  // (What the reader saw before the turn: whose capital a territory was, as far as they could see.)
  const capitalOf = (t: TerritoryId) => {
    const v = before.territories[t];
    return v?.detail === "full" ? v.capitalOf : null;
  };
  const byId = new Map(bots.map((b) => [b.id, b]));
  const out: Candidate[] = [];
  const add = (bot: PlayerId, priority: number, situation: string, text: string | null, deal = false) => {
    if (text) out.push({ bot, priority, situation, text, deal });
  };
  const say = (b: ChatBot, s: ChatSituation, vars: Vars) => chatLine({ game, turn, who: `${b.id}>${reader}`, voice: b.voice! }, s, vars);
  // (Battles here are the full ones the reader saw: a fight in the fog reaches them only as "a battle in Northreach".)
  const battles = events.filter((e): e is Extract<ReplayEvent, { type: "battle" }> => e.type === "battle" && e.captured);
  for (const b of bots) {
    if (!b.voice) continue;
    const persona = personaOf(b.voice);
    const sp = { game, turn, who: `${b.id}>${reader}`, voice: persona };
    // A deal between you broke (it broke it, or you did).
    for (const e of events) {
      if (e.type !== "dealBroken" || !((e.a === reader && e.b === b.id) || (e.b === reader && e.a === b.id))) continue;
      const deal = DEAL_NAME[e.kind];
      if (e.by === b.id && e.at) add(b.id, 9, "breaks", persona ? botLine({ ...sp, voice: persona }, "breaks", { place: place(e.at) }) : say(b, "breaks", { place: place(e.at) }), true);
      if (e.by === reader) add(b.id, 9, "broke", e.at ? reasonLine(sp, "brokeOurAt", { deal, place: place(e.at) }) : reasonLine(sp, "brokeOur", { deal }), true);
    }
    // A deal between you started.
    for (const e of events)
      if (e.type === "dealStarted" && ((e.deal.a === reader && e.deal.b === b.id) || (e.deal.b === reader && e.deal.a === b.id))) add(b.id, 7, "dealMade", say(b, "dealMade", { deal: DEAL_NAME[e.deal.terms.kind] }), true);
    // Land it took from you, your capital among it.
    const fromYou = battles.filter((e) => e.player === b.id && e.defender === reader);
    const yourCapital = fromYou.find((e) => e.to === before.me.capital);
    if (yourCapital) add(b.id, 10, "bragCapital", say(b, "bragCapital", { capital: place(yourCapital.to) }));
    else if (fromYou.length) add(b.id, 6, "brag", say(b, "brag", { places: list([...new Set(fromYou.map((e) => place(e.to)))]) }));
    // A capital it took from someone else, or its own taken back (a comeback), in a fight you saw.
    for (const e of battles) {
      if (e.player !== b.id || e.defender === reader) continue;
      const cap = capitalOf(e.to);
      if (cap === b.id) add(b.id, 8, "comeback", say(b, "comeback", { place: place(e.to) }));
      else if (cap && e.defender === cap) add(b.id, 8, "capitalTaken", say(b, "capitalTaken", { capital: place(e.to), rival: name(cap) }));
    }
    // Land you took from it: a needle, never nasty.
    const fromIt = battles.find((e) => e.player === reader && e.defender === b.id);
    if (fromIt) add(b.id, 5, "needle", say(b, "needle", { place: place(fromIt.to) }));
    // A rival it finished (public).
    for (const e of events) if (e.type === "eliminated" && e.by === b.id && e.player !== reader) add(b.id, 8, "finished", say(b, "finished", { rival: name(e.player) }));
    // Session 33, blackout: its own map went from mostly cloud to mostly seen this turn (`cloud`, the host's list: once
    // a game for each bot, since seen land stays seen). The one line here not from the reader's own replay, so it names
    // nothing: no place, no border, nothing about what it found. The least of its lines (the Captain never says it).
    if (input.cloud?.includes(b.id)) add(b.id, 2, "cloudLifts", say(b, "cloudLifts", {}));
  }
  // One line a bot (its biggest), the biggest first, within the limits.
  const best = new Map<PlayerId, Candidate>();
  for (const c of out) if (!best.has(c.bot) || best.get(c.bot)!.priority < c.priority) best.set(c.bot, c);
  const said: BotSaid[] = [];
  for (const c of [...best.values()].sort((a, b) => b.priority - a.priority || (a.bot < b.bot ? -1 : 1))) {
    if (said.length >= L().chatPerTurn) break;
    const plain = byId.get(c.bot)!.voice === "plain";
    // The Captain: only the big things (a capital, a deal broken, a rival finished), and rarely.
    if (plain && c.priority < 8) continue;
    const gap = plain ? L().captainGap : L().chatGap;
    if (!c.deal && turn - (last[c.bot] ?? -99) < gap) continue;
    said.push({ bot: c.bot, text: c.text!, situation: c.situation, deal: c.deal });
  }
  return said.slice(0, L().chatPerTurn);
}

/** What's between you and a bot, for "Say something": from your own last replay and the deals you can see. */
export function youAndBot(reader: PlayerId, bot: PlayerId, view: PlayerView, events: readonly ReplayEvent[], ctx: GameContext): { situation: YouSituation; vars: Vars } {
  const idx = indexMap(ctx.map);
  const place = (t: TerritoryId) => idx.byId.get(t)?.name ?? t;
  const battles = events.filter((e): e is Extract<ReplayEvent, { type: "battle" }> => e.type === "battle" && e.captured);
  const took = battles.find((e) => e.player === bot && e.defender === reader);
  if (took) return { situation: "theyTook", vars: { place: place(took.to) } };
  const gave = battles.find((e) => e.player === reader && e.defender === bot);
  if (gave) return { situation: "youTook", vars: { place: place(gave.to) } };
  const deal = view.deals.find((d) => (d.a === reader && d.b === bot) || (d.b === reader && d.a === bot));
  if (deal) return { situation: "allies", vars: { deal: DEAL_NAME[deal.kind] } };
  return { situation: "calm", vars: {} };
}

/** The bot's answer to each of your "Say something" situations. */
const REPLY: Record<YouSituation, ChatSituation> = { calm: "replyCalm", theyTook: "replyTheyTook", youTook: "replyYouTook", allies: "replyAllies" };

/** Your three lines for "Say something" to this bot this turn (the same three all turn), and what the bot answers. */
export function sayOptions(game: string, turn: number, reader: PlayerId, bot: ChatBot, between: { situation: YouSituation; vars: Vars }): string[] {
  return youLines(between.situation, `${game}|${turn}|${reader}|${bot.id}`, { ...between.vars, bot: bot.name });
}

export function botReply(game: string, turn: number, reader: PlayerId, bot: ChatBot, between: { situation: YouSituation; vars: Vars }, pick: number): string | null {
  if (!bot.voice) return null;
  return chatLine({ game, turn, who: `${bot.id}>${reader}`, voice: bot.voice }, REPLY[between.situation], between.vars, `say${pick}`);
}

/** The bot's line when you accept (or decline) its offer in your chat with it. */
export function offerAnswered(game: string, turn: number, reader: PlayerId, bot: ChatBot, kind: keyof typeof DEAL_NAME, accept: boolean): string | null {
  if (!bot.voice) return null;
  return chatLine({ game, turn, who: `${bot.id}>${reader}`, voice: bot.voice }, accept ? "offerTaken" : "offerRefused", { deal: DEAL_NAME[kind] });
}

/**
 * A bot's answer in a group to "Join us against {rival}?" or "Peace among us?". Built for every member from what they
 * all know (names only: a group's lines carry no event at all, so they hold nothing one member could see and another
 * couldn't). It never binds the bot: its answer comes with the deal to send it.
 */
export function groupAnswer(game: string, turn: number, bot: ChatBot, ask: "war" | "peace", rival: string | null, extra: string): string | null {
  if (!bot.voice) return null;
  return chatLine({ game, turn, who: `${bot.id}>group`, voice: bot.voice }, ask === "war" ? "groupWar" : "groupPeace", rival ? { rival } : {}, extra);
}

/** Your own line in a group's prompt (the words every member sees you send). */
export const ASK_TEXT = {
  war: (rival: string) => `Join us against ${rival}?`,
  peace: "Peace among us?",
} as const;
