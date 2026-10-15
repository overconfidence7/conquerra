import { DurableObject } from "cloudflare:workers";
import { MapDef } from "@conquerra/content";
import type { PlayerId } from "@conquerra/engine";
import { RoomCore, type RoomInfo, type RoomSetup, type RoomStore, type TableSetup, type Who } from "../src/host/roomCore";
import type { RoomMessage, RoomRequest, TableView } from "../src/host/protocol";
import { EmailMessage } from "cloudflare:email";
import slimMaps from "./maps.json";
import { mirrorGame, mirrorTable } from "./mirror";
import { FROM, notifyTurn } from "./notify";
import type { Env } from "./env";

/**
 * One online game (session 26): a Cloudflare Durable Object, one per game. It runs the game (`RoomCore`: the same
 * engine and bots as single player) and is the only thing that ever sees the whole board. Each player's page connects
 * over a WebSocket and gets only its own view. The room sleeps between messages (the WebSocket Hibernation API keeps
 * the connections open), its clock is an alarm, and the game is in its own SQLite storage, saved every turn.
 *
 * All the heavy work (the engine, the bots) happens here, where the Free plan allows 30 s of CPU per request; the
 * Worker in front only checks the sign-in and opens the room.
 */

/** Big saves are split into pieces this long (characters), under the storage's 2 MB a value. */
const CHUNK = 400_000;
/** A page's message larger than this is ignored (a turn's orders are a few KB). */
const MAX_MESSAGE = 256 * 1024;

const maps = slimMaps as unknown as Record<string, unknown>;

/** The maps the room plays on: the slim ones (no drawing data), checked as the page's are. */
async function loadSlimMap(id: string): Promise<MapDef> {
  const raw = maps[id];
  if (!raw) throw new Error(`Unknown map ${id}`);
  return MapDef.parse(raw);
}

/** The room's storage: values as JSON text, a big one in pieces. */
function storeOver(storage: DurableObjectStorage): RoomStore {
  return {
    async get(key) {
      const n = await storage.get<number>(key);
      if (typeof n !== "number") return null;
      const parts = await storage.get<string>(Array.from({ length: n }, (_, i) => `${key}#${i}`));
      let text = "";
      for (let i = 0; i < n; i++) text += parts.get(`${key}#${i}`) ?? "";
      return JSON.parse(text) as unknown;
    },
    async put(key, value) {
      const text = JSON.stringify(value);
      const n = Math.max(1, Math.ceil(text.length / CHUNK));
      const old = (await storage.get<number>(key)) ?? 0;
      const entries: Record<string, unknown> = { [key]: n };
      for (let i = 0; i < n; i++) entries[`${key}#${i}`] = text.slice(i * CHUNK, (i + 1) * CHUNK);
      await storage.put(entries);
      if (old > n) await storage.delete(Array.from({ length: old - n }, (_, i) => `${key}#${n + i}`));
    },
  };
}

/** What each connection is: the account (session 27), and for a game from session 26 the seat from the database. */
interface Attachment {
  user?: string;
  name?: string;
  colour?: number | null;
  seat?: PlayerId | null;
}

export class GameRoom extends DurableObject<Env> {
  private core: RoomCore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.core = new RoomCore(storeOver(ctx.storage), loadSlimMap, {
      send: (seat, msg) => this.send(seat, msg),
      sendUser: (user, msg) => this.sendTo((a) => a.user === user, msg),
      users: () => [...new Set(this.sockets().flatMap(([, a]) => (a.user ? [a.user] : [])))],
      // The database's copy, for the lobby's lists (./mirror.ts).
      tableChanged: (m) => ctx.waitUntil(mirrorTable(env.DB, m)),
      wakeAt: (at) => {
        if (at === null) void ctx.storage.deleteAlarm();
        else void ctx.storage.setAlarm(at);
      },
      listed: (info) => ctx.waitUntil(mirrorGame(env.DB, info)),
      log: (line) => console.log(line),
      // Session 29: "your turn", in the background (./notify.ts).
      notify: (n) => this.later(notifyTurn(n, {
        db: env.DB,
        vapid: env.VAPID_PUBLIC && env.VAPID_PRIVATE ? { publicKey: env.VAPID_PUBLIC, privateKey: env.VAPID_PRIVATE, subject: `mailto:${FROM}` } : null,
        fetch: (req) => fetch(req),
        mail: env.EMAIL ? async (to, _subject, raw) => void (await env.EMAIL!.send(new EmailMessage(FROM, to, raw))) : null,
        now: Date.now(),
        log: (line) => console.log(line),
      }).then((r) => console.log(`"your turn": ${r.pushed} pushed, ${r.removed} gone, ${r.emailed} emailed`))),
    });
  }

  /** Work that finishes after the answer (a push): kept alive, and waited for before the room sleeps. */
  private outbox: Promise<unknown>[] = [];
  private later(p: Promise<unknown>) {
    const kept = p.catch((e) => console.log(`notify failed: ${e instanceof Error ? e.message : String(e)}`));
    this.outbox.push(kept);
    this.ctx.waitUntil(kept);
  }
  private async drain() {
    const out = this.outbox;
    this.outbox = [];
    await Promise.allSettled(out);
  }

  private sockets(): [WebSocket, Attachment][] {
    return this.ctx.getWebSockets().map((ws) => [ws, (ws.deserializeAttachment() as Attachment | null) ?? {}]);
  }

  /** To the pages that match (never anyone else's). */
  private sendTo(match: (a: Attachment) => boolean, msg: RoomMessage): boolean {
    let sent = false;
    const text = JSON.stringify(msg);
    for (const [ws, a] of this.sockets()) {
      if (!match(a)) continue;
      try {
        ws.send(text);
        sent = true;
      } catch {
        // Closing: the next hello catches it up.
      }
    }
    return sent;
  }

  /** To a seat's page (the account sitting there; a game from session 26: the seat its connection came with). */
  private send(seat: PlayerId, msg: RoomMessage): boolean {
    const user = this.core.userOf(seat);
    return this.sendTo((a) => (user ? a.user === user : a.seat === seat), msg);
  }

  /** The lobby's "Leave this game" (session 27): this account resigns its seat. */
  async resignUser(user: string, seat: PlayerId | null): Promise<boolean> {
    const done = await this.core.resignUser(user, seat);
    await this.core.flush();
    return done;
  }

  /** Make a table (the Worker calls this once, right after writing the game's row). Session 27. */
  async createTable(setup: TableSetup): Promise<TableView> {
    return this.core.createTable(setup);
  }

  /** Session 26: make a game straight away (one person against bots). Kept for the tests' sake; the API makes tables now. */
  async create(setup: RoomSetup): Promise<{ info: RoomInfo; players: { id: string; name: string; house: number }[] }> {
    const info = await this.core.create(setup);
    const start = this.core.hello(setup.people[0]!.id);
    return { info, players: start.view.players.map((p) => ({ id: p.id, name: p.name, house: p.house })) };
  }

  /**
   * A page opens the game (the Worker has checked the sign-in: `X-User`, `X-Name`, `X-Colour`; and, for a game from
   * session 26, found the seat: `X-Seat`).
   */
  async fetch(request: Request): Promise<Response> {
    const user = request.headers.get("X-User") ?? "";
    const seat = request.headers.get("X-Seat");
    if (request.headers.get("Upgrade") !== "websocket" || (!user && !seat)) return new Response("Expected a WebSocket", { status: 426 });
    // One connection per account: a second one (another tab, the phone) replaces the first.
    for (const [old, a] of this.sockets()) {
      if (!(user ? a.user === user : a.seat === seat)) continue;
      try {
        old.close(4000, "Opened somewhere else");
      } catch {
        // Already closing.
      }
    }
    const colour = Number(request.headers.get("X-Colour"));
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ user, name: decodeName(request.headers.get("X-Name")), colour: request.headers.get("X-Colour") && Number.isInteger(colour) ? colour : null, seat } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  private who(ws: WebSocket): Who | null {
    const a = (ws.deserializeAttachment() as Attachment | null) ?? {};
    if (!a.user && !a.seat) return null;
    return { user: a.user ?? "", name: a.name ?? "Player", colour: a.colour ?? null, seat: a.seat ?? null };
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const who = this.who(ws);
    if (!who || typeof message !== "string" || message.length > MAX_MESSAGE) return;
    let req: RoomRequest;
    try {
      req = JSON.parse(message) as RoomRequest;
    } catch {
      return;
    }
    await this.core.receive(who, req);
    await this.core.flush();
    await this.drain();
  }

  async webSocketClose(ws: WebSocket) {
    const who = this.who(ws);
    const seat = who ? (this.core.seatOf(who.user) ?? who.seat) : null;
    if (seat) this.core.disconnected(seat);
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  /** The turn's clock ran out (whether anyone is connected or not). */
  async alarm() {
    await this.core.alarm();
    await this.core.flush();
    await this.drain();
  }
}

/** The account's name, as the Worker sent it (encoded: a header holds only plain characters). */
function decodeName(raw: string | null): string {
  try {
    return raw ? decodeURIComponent(raw) : "Player";
  } catch {
    return "Player";
  }
}
