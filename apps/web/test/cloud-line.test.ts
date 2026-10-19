import { maps } from "@conquerra/content/maps";
import { lines } from "@conquerra/content/lines";
import { defaultRules } from "@conquerra/content";
import { recruitBot } from "@conquerra/bots";
import type { GameContext, PlayerView } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { tableTalk, type ChatBot } from "../src/host/botChat";
import { LocalGame } from "../src/host/localGame";
import type { LobbySettings } from "../src/host/protocol";

/**
 * Session 33, Part 3: a Marshal's one line about the cloud. Under blackout, the turn its own map goes from mostly cloud
 * to mostly seen (once a game: seen land stays seen), it may say so in the table chat, within the chat's limits:
 * "Nothing but cloud past my border, until today." The line names nothing (no place, no border), so it holds nothing
 * the reader's own replay doesn't; the Captain never says it, and with standard fog nobody does.
 */
const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const names = maps.embervale!.territories.map((t) => new RegExp(`\\b${t.name}\\b`));
const players = ["p1", "bA", "bB"].map((id, i) => ({ id, name: `Name ${id}`, eliminatedTurn: null, eliminatedBy: null, spoils: 0, oathbreaker: 0, house: i }));
const view = { gameId: "g", turn: 6, me: { id: "p1", capital: "t00" }, players, deals: [], territories: {} } as unknown as PlayerView;
/** Every voice's cloud lines. */
const CLOUD_LINES = new Set(Object.values(lines.chat).flatMap((v) => ((v as { cloudLifts?: string[] }).cloudLifts ?? [])));
const BOTS: ChatBot[] = [
  { id: "bA", name: "Name bA", house: 1, voice: "turtle" },
  { id: "bB", name: "Name bB", house: 2, voice: "plain" },
];

describe("a Marshal's line about the cloud (session 33)", () => {
  it("the line library: every voice has it (the Captain's plain one too, though the Captain never says it), and none names anything", () => {
    for (const v of ["conqueror", "blitzer", "turtle", "schemer", "opportunist", "merchant", "neutral", "plain"] as const) {
      const xs = lines.chat[v].cloudLifts!;
      expect(xs.length, v).toBeGreaterThan(0);
      for (const x of xs) expect(x, v).not.toMatch(/\{/);
    }
  });

  it("said only by a bot the host names, the least of its lines, never by the Captain", () => {
    const talk = (cloud: string[], last: Record<string, number> = {}) => tableTalk({ ctx, game: "g", reader: "p1", before: view, after: view, events: [], bots: BOTS, last, cloud });
    expect(talk([])).toEqual([]);
    const [said] = talk(["bA", "bB"]);
    expect(said).toMatchObject({ bot: "bA", situation: "cloudLifts", deal: false });
    expect(lines.chat.turtle.cloudLifts).toContain(said!.text);
    expect(talk(["bB"])).toEqual([]);
    // Within the chat's limits: three turns since its last line to you.
    expect(talk(["bA"], { bA: 5 })).toEqual([]);
    // A bigger thing that turn wins (one line a bot).
    const took = { type: "battle", player: "bA", defender: "p1", to: "t05", from: "t40", captured: true } as never;
    const big = tableTalk({ ctx, game: "g", reader: "p1", before: view, after: view, events: [took], bots: BOTS, last: {}, cloud: ["bA"] });
    expect(big.map((s) => s.situation)).toEqual(["brag"]);
  });

  const play = (fog: true | "blackout") => {
    const settings: LobbySettings = { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog, mode: "classic", turnSeconds: null };
    const g = new LocalGame(maps.embervale!, settings, "cloud-line");
    let u = g.update();
    const said: { turn: number; bot: string; text: string }[] = [];
    const lifted: string[][] = [];
    for (let i = 0; i < 16 && !u.view.winner && u.view.me.eliminatedTurn === null; i++) {
      u = g.lockIn(recruitBot.plan(g.ctx, u.view));
      lifted.push([...g.cloudLifted]);
      for (const t of u.report?.table ?? []) said.push({ turn: u.report!.turn, bot: t.bot, text: t.text });
    }
    return { said, lifted };
  };

  it("in a blackout game: each Marshal's map clears past half once, it says so at most once, and the line names nothing", () => {
    const { said, lifted } = play("blackout");
    const all = lifted.flat();
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    const cloud = said.filter((s) => CLOUD_LINES.has(s.text));
    expect(cloud.length).toBeGreaterThan(0);
    expect(new Set(cloud.map((s) => s.bot)).size).toBe(cloud.length);
    for (const s of cloud) {
      expect(lifted[s.turn - 1]).toContain(s.bot);
      for (const re of names) expect(s.text).not.toMatch(re);
    }
  }, 240_000);

  it("with standard fog, never", () => {
    const { said, lifted } = play(true);
    expect(lifted.flat()).toEqual([]);
    expect(said.some((s) => CLOUD_LINES.has(s.text))).toBe(false);
  }, 240_000);
});
