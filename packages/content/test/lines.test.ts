import { describe, expect, it } from "vitest";
import { BOT_SITUATIONS, CAPTURED_SITUATIONS, CHAT_SITUATIONS, CHAT_VOICES, chatLine, fill, YOU_SITUATIONS, youLines, SCREEN_SITUATIONS, LEADER_SITUATIONS, LEADER_VOICES, leaderLine, lines, pickVersion, placeholders, REASONS, reasonLine, VOICES, type Speaker } from "../src/lines";

/** The line library (session 22): enough versions, every placeholder known and filled, and a deterministic pick. */
const sample = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, `<${k}>`]));
/** The fewest versions a situation may have: three, or one where Nate picked his own (`picked` in the data). */
const least = (path: string) => (lines.picked.includes(path) ? 1 : 3);

describe("the line library", () => {
  it("every personality has three to five versions of each of its own lines", () => {
    for (const v of VOICES)
      for (const k of Object.keys(BOT_SITUATIONS) as (keyof typeof BOT_SITUATIONS)[]) {
        const n = lines.bots[v][k].length;
        expect(n, `${v}.${k}`).toBeGreaterThanOrEqual(least(`bots.${v}.${k}`));
        expect(n, `${v}.${k}`).toBeLessThanOrEqual(5);
      }
  });

  it("a leaders' situation one personality has, all six have, three to five versions each (a Neutral leader at least one)", () => {
    const had = new Set(LEADER_VOICES.flatMap((v) => Object.keys(lines.leaders[v] ?? {})));
    for (const k of had)
      for (const v of LEADER_VOICES) {
        const n = lines.leaders[v]?.[k as keyof typeof LEADER_SITUATIONS]?.length ?? 0;
        if (v === "neutral") {
          if (lines.leaders.neutral) expect(n, `${v}.${k}`).toBeGreaterThanOrEqual(1);
          continue;
        }
        expect(n, `${v}.${k}`).toBeGreaterThanOrEqual(least(`leaders.${v}.${k}`));
        expect(n, `${v}.${k}`).toBeLessThanOrEqual(5);
      }
  });

  it("a personality's own version of a shared reason has at least three versions", () => {
    for (const v of VOICES) for (const [k, xs] of Object.entries(lines.reasons.voiced[v])) expect(xs!.length, `${v}.${k}`).toBeGreaterThanOrEqual(3);
  });

  it("every line uses only its situation's placeholders, and filling them leaves none behind", () => {
    const check = (allowed: readonly string[], xs: readonly string[] | undefined, where: string) => {
      for (const line of xs ?? []) {
        for (const p of placeholders(line)) expect(allowed, `${where}: ${line}`).toContain(p);
        expect(fill(line, sample(allowed)), where).not.toMatch(/[{}]/);
      }
    };
    for (const v of VOICES) for (const [k, allowed] of Object.entries(BOT_SITUATIONS)) check(allowed, lines.bots[v][k as keyof typeof BOT_SITUATIONS], `${v}.${k}`);
    for (const [k, allowed] of Object.entries(REASONS)) {
      check(allowed, lines.reasons.plain[k as keyof typeof REASONS], `plain.${k}`);
      for (const v of VOICES) check(allowed, lines.reasons.voiced[v][k as keyof typeof REASONS], `${v}.${k}`);
    }
    for (const v of LEADER_VOICES) for (const [k, allowed] of Object.entries(LEADER_SITUATIONS)) check(allowed, lines.leaders[v]?.[k as keyof typeof LEADER_SITUATIONS], `leader ${v}.${k}`);
    for (const [k, allowed] of Object.entries(CAPTURED_SITUATIONS)) check(allowed, lines.captured[k as keyof typeof CAPTURED_SITUATIONS], `captured.${k}`);
    for (const [k, allowed] of Object.entries(SCREEN_SITUATIONS)) check(allowed, lines.screens[k as keyof typeof SCREEN_SITUATIONS], `screens.${k}`);
  });

  it("session 29, the chat: each personality has three to five versions of every situation (the Neutral and the Captain's plain voice at least one), placeholders known", () => {
    for (const v of CHAT_VOICES)
      for (const [k, allowed] of Object.entries(CHAT_SITUATIONS)) {
        const xs = lines.chat[v][k as keyof typeof CHAT_SITUATIONS] ?? [];
        // (A personality breaks a deal in its own `bots.breaks` lines: only the Neutral and plain voices have chat ones.)
        if (k === "breaks" && (VOICES as readonly string[]).includes(v)) {
          expect(xs, `${v}.${k}`).toEqual([]);
          continue;
        }
        expect(xs.length, `chat.${v}.${k}`).toBeGreaterThanOrEqual((VOICES as readonly string[]).includes(v) ? 3 : 1);
        expect(xs.length, `chat.${v}.${k}`).toBeLessThanOrEqual(5);
        for (const line of xs) {
          for (const p of placeholders(line)) expect(allowed, `chat.${v}.${k}: ${line}`).toContain(p);
          expect(fill(line, sample(allowed))).not.toMatch(/[{}]/);
        }
      }
    for (const [k, allowed] of Object.entries(YOU_SITUATIONS)) {
      const xs = lines.chat.you[k as keyof typeof YOU_SITUATIONS];
      expect(xs.length, `you.${k}`).toBeGreaterThanOrEqual(3);
      for (const line of xs) for (const p of placeholders(line)) expect(allowed).toContain(p);
    }
    // Three different lines of yours a turn, the same three for the same seed.
    const three = youLines("calm", "g|4|p1|bot2", { bot: "Lady Morwen" });
    expect(new Set(three).size).toBe(3);
    expect(youLines("calm", "g|4|p1|bot2", { bot: "Lady Morwen" })).toEqual(three);
    expect(chatLine({ game: "g", turn: 3, who: "bot1", voice: "merchant" }, "brag", { places: "Ashfell" })).toMatch(/Ashfell/);
    expect(chatLine({ game: "g", turn: 3, who: "bot1", voice: "conqueror" }, "breaks", { place: "Ashfell" })).toBeNull();
  });

  it("a captured leader has three to five versions of each line", () => {
    for (const k of Object.keys(CAPTURED_SITUATIONS) as (keyof typeof CAPTURED_SITUATIONS)[]) {
      expect(lines.captured[k].length, k).toBeGreaterThanOrEqual(least(`captured.${k}`));
      expect(lines.captured[k].length, k).toBeLessThanOrEqual(5);
    }
  });

  it("every situation Nate picked exists and keeps at least one version", () => {
    for (const path of lines.picked) {
      const xs = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], lines);
      expect(Array.isArray(xs) && xs.length > 0, path).toBe(true);
    }
    for (const [k, xs] of Object.entries(lines.screens)) expect(xs.length, k).toBeGreaterThanOrEqual(1);
  });

  it("the pick is deterministic (the game, the turn, the speaker), and a long game hears more than one version", () => {
    const xs = ["a", "b", "c", "d"];
    expect(pickVersion(xs, "g|3|p2|truceYes|")).toBe(pickVersion(xs, "g|3|p2|truceYes|"));
    const seen = new Set(Array.from({ length: 30 }, (_, t) => pickVersion(xs, `g|${t}|p2|truceYes|`)));
    expect(seen.size).toBeGreaterThan(2);
    const s: Speaker = { game: "local-abc", turn: 7, who: "p3", voice: "merchant" };
    expect(reasonLine(s, "cantSpare", { n: 12 })).toBe(reasonLine({ ...s }, "cantSpare", { n: 12 }));
    expect(reasonLine(s, "cantSpare", { n: 12 })).toContain("12 gold");
    expect(reasonLine({ ...s, voice: null }, "cantSpare", { n: 12 })).toBe("I can't spare 12 gold for a binding pact.");
    expect(leaderLine({ game: "g", turn: 4, who: "leader:p1", voice: "blitzer" }, "took", { places: "Ashfell", rival: "the locals" })).toContain("Ashfell");
  });
});
