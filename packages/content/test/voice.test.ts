import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collect, failures, problems, ROOT } from "./voiceScan";

/**
 * The voice test (session 22): every player-facing string the scan can reach (voiceScan.ts says what it reaches and
 * what it can't) against the voice guide's hard rules: no em or en dashes, no spaced hyphen, no semicolons or arrows
 * in prose, none of the banned words, never "champs", and no question mark in a bot's or leader's line.
 *
 * `voice-expected.json` lists the failures still waiting for their rewrite. Each part of the language pass shrinks
 * it, and the test fails both ways: a new failure, or a listed one that's been fixed (take it off the list).
 */
const expected: string[] = JSON.parse(readFileSync(join(ROOT, "packages/content/test/voice-expected.json"), "utf8"));

describe("the voice guide's hard rules", () => {
  const found = collect();
  const now = failures(found);

  it("reaches the game's words", () => {
    expect(found.length).toBeGreaterThan(3000);
    for (const where of ["apps/web/src/ui/", "apps/web/src/logic/", "packages/bots/src/", "packages/engine/src/", "packages/content/data/lines.json", "docs/rules-reference.md"])
      expect(found.some((f) => f.file.startsWith(where)), where).toBe(true);
  });

  it("no new failures", () => {
    expect(now.filter((f) => !expected.includes(f))).toEqual([]);
  });

  it("the expected failures list only holds lines that still fail (take fixed ones off it)", () => {
    expect(expected.filter((f) => !now.includes(f))).toEqual([]);
  });

  it("the checks catch what they should, and leave alone what they should", () => {
    const bad = (text: string, speaker = false) => problems({ file: "x", text, speaker });
    expect(bad("My war is elsewhere — peace suits me.")).toContain("dash");
    expect(bad("Turn order: Gules → Azure")).toContain("arrow");
    expect(bad("Peace suits me; my walls aren't finished.")).toContain("semicolon");
    expect(bad("Took it - easily.")).toContain("spaced hyphen");
    expect(bad("A long journey.")).toContain('banned word "journey"');
    expect(bad("Good game, champs.")).toContain('banned word "champs"');
    expect(bad("Why fight?", true)).toContain("question");
    expect(bad("Why fight?", false)).toEqual([]);
    expect(bad("A half-built wall, 3 to 5 turns, −3 troops, ×2.")).toEqual([]);
    expect(bad("The realm's gold.")).toEqual([]);
  });
});
