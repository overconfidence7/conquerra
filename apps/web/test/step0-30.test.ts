import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { viewFor, type Offer, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import type { ChatLine, ChatSync, OnlineGameInfo, RoomMessage } from "../src/host/protocol";
import { finishedShown, SOLO_KEPT_MS } from "../src/ui/OnlineBlock";
import { offerKey } from "../src/host/roomCore";
import { newOffer } from "../src/logic/deals";
import { applyChat, CHAT_UI, resetChat, useChat } from "../src/ui/chat/chatStore";
import { hostSeat, KIT, NATE, settings, testRoom, WREN } from "./roomHelpers";

/**
 * Session 30, Step 0: an offer's note in chat says when the offer ended with no answer (a bot's and a person's), and
 * the Worker's API starts without the room's code.
 */

const chatsIn = (msgs: RoomMessage[]): ChatSync[] => msgs.flatMap((m) => ("chat" in m && m.chat ? [m.chat] : []));
const answerOf = (m: RoomMessage | null): ChatSync => (m && m.ok && "chat" in m && m.chat ? m.chat : { chats: [], lines: [], canWrite: false });

async function table() {
  const t = testRoom();
  await t.room.createTable({ gameId: "lapse", code: "l4ps3dn0te", settings: { ...settings, bots: 3 }, seed: "lapsed-notes", host: hostSeat(NATE, 0) });
  await t.table(NATE);
  await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
  await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
  await t.act(NATE, { do: "start" });
  return t;
}

describe("an offer's note in chat, once the offer ends unanswered (session 30)", () => {
  it("a bot's offer you locked in without answering: its note says it lapsed, at once and for a page that comes later", async () => {
    const t = await table();
    const g = t.room.table!;
    const bot = g.chatBots()[0]!;
    const o: Offer = { id: `${bot.id}-t1-o0`, from: bot.id, to: "p1", terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake", note: "Peace on our border." };
    // (As `negotiate` makes one: the offer to the person, and the bot's own propose order.)
    const talk = (g as unknown as { talk: { toHuman: Offer[]; orders: Record<string, Order[]> } }).talk;
    talk.toHuman.push(o);
    (talk.orders[bot.id] ??= []).push({ id: `propose-${o.id}`, kind: "propose", offer: o });
    await (t.room as unknown as { botsTalk(): Promise<void> }).botsTalk();
    const note = (await t.hello("p1")).chat!.lines.find((l) => l.text === o.note)!;
    expect(note).toMatchObject({ offer: offerKey(o) });
    expect(note.ended).toBeUndefined();
    t.clear();
    for (const s of ["p1", "p2", "p3"]) await t.ask(s, { type: "lockIn", orders: [], turn: 1 });
    await t.room.flush();
    // Nate's page is told (only Nate: it was his offer).
    expect(chatsIn(t.inbox(NATE.user)).some((c) => c.ended?.[offerKey(o)] === "lapsed")).toBe(true);
    expect(JSON.stringify(t.inbox(KIT.user))).not.toContain(offerKey(o));
    // A page opened later gets the line marked.
    expect((await t.hello("p1")).chat!.lines.find((l) => l.text === o.note)).toMatchObject({ ended: "lapsed" });
  });

  it("an answered bot offer stays as it was (no mark)", async () => {
    const t = await table();
    const g = t.room.table!;
    const bot = g.chatBots()[0]!;
    const o: Offer = { id: `${bot.id}-t1-o0`, from: bot.id, to: "p1", terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake", note: "Peace on our border." };
    (g as unknown as { talk: { toHuman: Offer[] } }).talk.toHuman.push(o);
    await (t.room as unknown as { botsTalk(): Promise<void> }).botsTalk();
    const pair = (await t.hello("p1")).chat!.chats.find((c) => c.kind === "pair")!;
    await t.askAs(NATE, { type: "chat", act: { do: "answered", chat: pair.id, offer: o.id, accept: false } });
    await t.ask("p1", { type: "lockIn", orders: [{ id: `answer-${o.from}-${o.id}`, kind: "answer", from: o.from, offer: o.id, accept: false }], turn: 1 });
    for (const s of ["p2", "p3"]) await t.ask(s, { type: "lockIn", orders: [], turn: 1 });
    await t.room.flush();
    expect((await t.hello("p1")).chat!.lines.find((l) => l.text === o.note)!.ended).toBeUndefined();
  });

  it("a person's offer with a note: the note goes in your one-to-one (both of you), and says so when it lapses or is withdrawn", async () => {
    const t = await table();
    const g = t.room.table!;
    const o = { ...newOffer(g.ctx, viewFor(g.ctx, g.fullState, "p1"), "p2", "truce", 1), note: "Peace in the east?" };
    await t.ask("p1", { type: "propose", offer: o });
    const kitLine = (await t.hello("p2")).chat!.lines.find((l) => l.text === o.note);
    expect(kitLine).toMatchObject({ from: { name: "Nate" }, offer: offerKey(o) });
    expect((await t.hello("p1")).chat!.lines.find((l) => l.text === o.note)).toMatchObject({ from: { you: true } });
    // Wren never hears of it.
    expect(JSON.stringify(t.inbox(WREN.user))).not.toContain(o.note);
    t.clear();
    await t.ask("p2", { type: "lockIn", orders: [], turn: 1 });
    await t.room.flush();
    for (const who of [NATE, KIT]) expect(chatsIn(t.inbox(who.user)).some((c) => c.ended?.[offerKey(o)] === "lapsed")).toBe(true);
    // Withdrawn: Kit offers Wren a truce with a note, then takes it back.
    const w = { ...newOffer(g.ctx, viewFor(g.ctx, g.fullState, "p3"), "p1", "truce", 1), note: "Shall we?" };
    await t.ask("p3", { type: "propose", offer: w });
    await t.ask("p3", { type: "withdraw", offer: w.id });
    await t.room.flush();
    expect((await t.hello("p1")).chat!.lines.find((l) => l.text === w.note)).toMatchObject({ ended: "withdrawn" });
    // An offer with no note writes nothing.
    const before = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "pair", with: "p3" } }));
    expect(before.chats).toHaveLength(1);
  });

  it("the page marks the lines an ended offer's news names, and the words are the quiet ones", () => {
    resetChat("g", null);
    const line: ChatLine = { id: 5, chat: "c1", from: { name: "Baron Krell", house: 2, seat: "p2", bot: true }, text: "A truce?", at: 1, offer: "p2:o1" };
    applyChat({ chats: [], lines: [line, { ...line, id: 6, offer: "p2:o2" }], canWrite: true });
    applyChat({ chats: [], lines: [], canWrite: true, ended: { "p2:o1": "lapsed" } });
    expect(useChat.getState().lines.map((l) => l.ended ?? null)).toEqual(["lapsed", null]);
    expect(CHAT_UI.ended).toEqual({ lapsed: "(lapsed at lock-in)", withdrawn: "(withdrawn)" });
  });
});

describe("the Worker's cold start (session 30)", () => {
  const server = join(dirname(fileURLToPath(import.meta.url)), "../server");
  /** Every file the Worker's API reaches by static imports (dynamic `import()` loads on demand, so it doesn't count). */
  const reach = (entry: string) => {
    const seen = new Set<string>();
    const specs: string[] = [];
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      for (const m of code.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm)) {
        const spec = m[1] ?? m[2]!;
        specs.push(spec);
        if (!spec.startsWith(".")) continue;
        const base = resolve(dirname(file), spec);
        const hit = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((p) => existsSync(p) && /\.(ts|tsx)$/.test(p));
        if (hit) visit(hit);
      }
    };
    visit(entry);
    return { files: [...seen], specs };
  };

  it("the API never loads the room's code, the slim maps or the content package's schemas when the Worker starts", () => {
    const { files, specs } = reach(join(server, "index.ts"));
    expect(files.length).toBeGreaterThan(5);
    expect(files.filter((f) => /roomCore|localGame|slimMaps|chatRoom|botChat/.test(f))).toEqual([]);
    expect(specs.filter((s) => s === "@conquerra/content" || s === "@conquerra/engine" || s === "@conquerra/bots" || s.endsWith("maps.json"))).toEqual([]);
    // The room loads them itself, the first time it wakes.
    expect(readFileSync(join(server, "gameRoom.ts"), "utf8")).toMatch(/import\("\.\.\/src\/host\/roomCore"\), import\("\.\/slimMaps"\)/);
  });
});

describe("the Finished list (session 30)", () => {
  const game = (id: string, created: number, people: number, over = true): OnlineGameInfo => ({
    id,
    mapId: "embervale",
    mapName: "Embervale",
    turn: 4,
    status: over ? "over" : "playing",
    waitingOn: [],
    deadline: null,
    players: [{ name: "Nate", bot: false, you: true }, ...Array.from({ length: people - 1 }, (_, i) => ({ name: `Kit${i}`, bot: false, you: false })), { name: "Baron Krell", bot: true, you: false }],
    created,
    leadersRun: true,
  });
  const DAY = SOLO_KEPT_MS;
  const now = 10 * DAY;

  it("a game you played alone with bots leaves after a day; one with a friend stays its week; Clear finished hides the rest here", () => {
    const games = [game("solo-old", now - DAY - 1, 1), game("solo-new", now - 1000, 1), game("friend-old", now - 3 * DAY, 2), game("going", now - 3 * DAY, 1, false)];
    expect(finishedShown(games, now, new Set()).map((g) => g.id)).toEqual(["solo-new", "friend-old"]);
    expect(finishedShown(games, now, new Set(["solo-new"])).map((g) => g.id)).toEqual(["friend-old"]);
  });
});
