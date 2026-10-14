import { DurableObject } from "cloudflare:workers";
import { MapDef } from "@conquerra/content";
import type { PlayerId } from "@conquerra/engine";
import { RoomCore, type RoomInfo, type RoomSetup, type RoomStore } from "../src/host/roomCore";
import type { RoomMessage, RoomRequest } from "../src/host/protocol";
import slimMaps from "./maps.json";
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

interface Attachment {
  seat: PlayerId;
}

export class GameRoom extends DurableObject<Env> {
  private core: RoomCore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.core = new RoomCore(storeOver(ctx.storage), loadSlimMap, {
      send: (seat, msg) => this.send(seat, msg),
      wakeAt: (at) => {
        if (at === null) void ctx.storage.deleteAlarm();
        else void ctx.storage.setAlarm(at);
      },
      listed: (info) => ctx.waitUntil(this.list(info)),
      log: (line) => console.log(line),
    });
  }

  /** To a seat's page (if it's connected; never anyone else's). */
  private send(seat: PlayerId, msg: RoomMessage): boolean {
    let sent = false;
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets(seat)) {
      try {
        ws.send(text);
        sent = true;
      } catch {
        // Closing: the next hello catches it up.
      }
    }
    return sent;
  }

  /** The game list's line in the database (the lobby's "Your online games"). */
  private async list(info: RoomInfo) {
    try {
      await this.env.DB.prepare("UPDATE games SET turn = ?, status = ?, waiting = ?, deadline = ?, updated = ?, seed = ?, winner = ? WHERE id = ?")
        .bind(info.turn, info.status, JSON.stringify(info.waitingOn), info.deadline, Date.now(), info.seed ?? null, info.winner, info.gameId)
        .run();
    } catch (e) {
      console.log(`game list update failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Make the game (the Worker calls this once, right after writing the game's row). */
  async create(setup: RoomSetup): Promise<{ info: RoomInfo; players: { id: string; name: string; house: number }[] }> {
    const info = await this.core.create(setup);
    const start = this.core.hello(setup.people[0]!.id);
    return { info, players: start.view.players.map((p) => ({ id: p.id, name: p.name, house: p.house })) };
  }

  /** A page opens the game (the Worker has checked the sign-in and found the seat: `X-Seat`). */
  async fetch(request: Request): Promise<Response> {
    const seat = request.headers.get("X-Seat");
    if (request.headers.get("Upgrade") !== "websocket" || !seat) return new Response("Expected a WebSocket", { status: 426 });
    // One connection per seat: a second one from the same account (another tab, the phone) replaces the first.
    for (const old of this.ctx.getWebSockets(seat)) {
      try {
        old.close(4000, "Opened somewhere else");
      } catch {
        // Already closing.
      }
    }
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [seat]);
    server.serializeAttachment({ seat } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const seat = (ws.deserializeAttachment() as Attachment | null)?.seat;
    if (!seat || typeof message !== "string" || message.length > MAX_MESSAGE) return;
    let req: RoomRequest;
    try {
      req = JSON.parse(message) as RoomRequest;
    } catch {
      return;
    }
    await this.core.message(seat, req);
    await this.core.flush();
  }

  async webSocketClose(ws: WebSocket) {
    const seat = (ws.deserializeAttachment() as Attachment | null)?.seat;
    if (seat) this.core.disconnected(seat);
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  /** The turn's clock ran out (whether anyone is connected or not). */
  async alarm() {
    await this.core.alarm();
    await this.core.flush();
  }
}
