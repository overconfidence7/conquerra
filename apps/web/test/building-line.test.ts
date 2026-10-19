import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TABLE_TEXT } from "../src/host/roomText";
import { buildingLine } from "../src/ui/TableScreen";

/**
 * Session 33b: the orchestrator saw a blank table page for a few seconds while a random 120 was built. Now every wait
 * says what's happening: the lobby's button while the room builds its copy, the table page while its code loads, and
 * the table page after Start while this page builds the map.
 */
const here = dirname(fileURLToPath(import.meta.url));

describe("the waits while a random map is built (session 33b)", () => {
  it("the table page after Start: a random map's line by size, an official map's start", () => {
    expect(buildingLine("random:80-island-quiet-heron")).toBe("Building the map…");
    expect(buildingLine("random:400-inland-quiet-heron")).toBe("Building the map… A big map takes a while, longer on a phone.");
    expect(buildingLine("embervale")).toBe(TABLE_TEXT.starting);
    expect(TABLE_TEXT.starting).toBe("Starting the game…");
  });

  it("the lobby's button says so while the room builds, and the table page never loads blank", () => {
    const block = readFileSync(join(here, "../src/ui/OnlineBlock.tsx"), "utf8");
    expect(block).toContain('lobby.mapId.startsWith("random:") ? "Building the map…" : "Making the table…"');
    // A random map's table waits for the lobby's picture (it says which try passed, so the room makes only that one).
    expect(block).toContain("disabled={busy || off || !mapReady}");
    expect(block).toContain("s.randomPreview?.mapId === s.lobby.mapId && !!s.randomPreview.preview");
    const main = readFileSync(join(here, "../src/main.tsx"), "utf8");
    expect(main).toContain('<Suspense fallback={<p className="muted loading-line">Opening the table…</p>}>');
  });
});
