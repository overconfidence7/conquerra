import type { Answer } from "@conquerra/bots";
import type { MapDef } from "@conquerra/content";
import type { Order } from "@conquerra/engine";
import type { GameHost, HostStart, HostUpdate, LeaderOrders, LobbySettings, NewOnlineGame, RoomBody, RoomMessage, RoomRequest, RoomStart, TableAct, TableView } from "./protocol";

/**
 * The online host (session 26): the same `GameHost` the page uses for single player, but the game runs in its room
 * on the server and every request travels over a WebSocket. The page doesn't know which host it has.
 *
 *  - A lost connection (a phone switching networks, the laptop sleeping) reconnects by itself, waiting a little longer
 *    each time, and asks the room "where are we": if turns resolved meanwhile, the page gets the last one as if it had
 *    just happened (its replay plays), and requests still waiting are sent again.
 *  - The room's clock is the clock: every message carries the room's time, and the countdown is moved onto this
 *    device's clock, so a phone whose clock is a minute off still counts down to the room's deadline.
 */

type Body = RoomBody;

interface Pending {
  body: Body;
  resolve: (u: unknown) => void;
  reject: (e: Error) => void;
}

export interface RemoteHostOptions {
  /** Where the API is ("" for this site). */
  base?: string;
  /** The page's own maps (with drawing data); the room sends only the map's id. */
  loadMap?: (id: string) => Promise<MapDef>;
  /** For tests. */
  WebSocketImpl?: typeof WebSocket;
  fetchImpl?: typeof fetch;
  /** Waits before each reconnect (ms); the last one repeats. */
  backoff?: readonly number[];
}

/** The page's sentences for what can go wrong online. */
export const ONLINE_TEXT = {
  elsewhere: "This game is open somewhere else (another tab or device). Reload this page to play it here.",
  reconnecting: "Lost the connection to the game. Reconnecting…",
  reconnected: "Reconnected. You're back in the game.",
  notHere: "That works in single player only.",
  mapChanged: "This game's map has changed since your copy of the game. Reload the page to update.",
} as const;

/** Ask the API something; a plain sentence if it says no. */
export async function api<T>(path: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch, base = ""): Promise<T> {
  let res: Response;
  try {
    // (No following redirects: with the sign-in run out, Access answers with one to its sign-in page.)
    res = await fetchImpl(`${base}${path}`, { credentials: "same-origin", redirect: "manual", ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  // Access's sign-in page instead of an answer: the sign-in has run out.
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400) || (res.headers.get("content-type") ?? "").includes("text/html")) throw new Error("Your sign-in has run out. Reload the page to sign in again.");
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(body.error ?? `The server said no (${res.status}).`);
  return body;
}

/** The online host: a `GameHost`, plus the table screen before the game starts (session 27). */
export interface RemoteHost extends GameHost {
  gameId(): string | null;
  /** The table as it changes (seats, colours, started, cancelled), until the game starts. */
  onTable(listener: (table: TableView) => void): void;
  /** Sit down, change colour, get up; the host's remove, start and cancel. Answers with the table, or a sentence. */
  tableAct(act: TableAct): Promise<TableView>;
}

export function createRemoteHost(opts: RemoteHostOptions = {}): RemoteHost {
  const base = opts.base ?? "";
  const WS = opts.WebSocketImpl ?? WebSocket;
  const fetchImpl = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const backoff = opts.backoff ?? [500, 1000, 2000, 4000, 8000, 15000];
  const loadMap = opts.loadMap ?? (async (id: string) => (await import("@conquerra/content/loadMap")).loadMap(id));

  let gameId: string | null = null;
  /** The table's invite code (someone without a seat yet opens the table with it). */
  let code: string | null = null;
  /** The hello that opens the game: an error in answer to it (the game has started without you) ends the opening. */
  let helloId = 0;
  const tables: ((t: TableView) => void)[] = [];
  let ws: WebSocket | null = null;
  let disposed = false;
  let attempts = 0;
  /** The connection dropped after the game opened (the next hello says "Reconnected"). */
  let lost = false;
  let nextId = 1;
  /** The turn the page has (a reconnect that finds a later one delivers it). */
  let knownTurn = 0;
  let map: MapDef | null = null;
  /** The first "where are we", which opens the game. */
  let opening: { resolve: (s: HostStart) => void; reject: (e: Error) => void } | null = null;
  const pending = new Map<number, Pending>();
  /** The latest queue to keep, if the socket was down when the page sent it. */
  let unsentQueue: Body | null = null;
  const autoLock: ((u: HostUpdate) => void)[] = [];
  const notices: ((m: string, calm?: boolean) => void)[] = [];
  const tell = (m: string, calm = false) => notices.forEach((f) => f(m, calm));

  const wsUrl = (id: string) => {
    const where = base ? new URL(base) : new URL(location.href);
    return `${where.protocol === "https:" ? "wss" : "ws"}://${where.host}/api/games/${encodeURIComponent(id)}/ws${code ? `?code=${encodeURIComponent(code)}` : ""}`;
  };

  /** The room's deadline, on this device's clock. */
  const onOurClock = <T extends HostUpdate>(u: T, roomNow: number): T => (u.clock ? { ...u, clock: { ...u.clock, endsAt: u.clock.endsAt - roomNow + Date.now() } } : u);

  const send = (msg: RoomRequest) => {
    if (ws && ws.readyState === WS.OPEN) ws.send(JSON.stringify(msg));
  };

  async function startFrom(s: RoomStart, roomNow: number): Promise<HostStart> {
    if (!map || map.id !== s.mapId) map = await loadMap(s.mapId);
    if ((map.generator?.version ?? null) !== s.mapVersion) throw new Error(ONLINE_TEXT.mapChanged);
    const { gameId: _id, mapId: _m, mapVersion: _v, ...rest } = s;
    return onOurClock({ ...rest, map }, roomNow);
  }

  async function onHello(s: RoomStart, roomNow: number) {
    const reconnect = !opening;
    if (opening) {
      const o = opening;
      opening = null;
      try {
        const start = await startFrom(s, roomNow);
        knownTurn = start.view.turn;
        o.resolve(start);
      } catch (e) {
        o.reject(e instanceof Error ? e : new Error(String(e)));
      }
    } else if (s.view.turn > knownTurn) {
      // Turns went by while we were away: the last one arrives as if it had just resolved (its replay plays from
      // where you last saw the board).
      knownTurn = s.view.turn;
      const u: HostUpdate = onOurClock(
        {
          playerId: s.playerId,
          view: s.view,
          report: s.replay?.report ?? null,
          fastForwarded: s.fastForwarded,
          clock: s.clock,
          generalOrders: s.generalOrders,
          ...(s.leaderNotes ? { leaderNotes: s.leaderNotes } : {}),
          ...(s.offers ? { offers: s.offers } : {}),
          ...(s.seats ? { seats: s.seats } : {}),
          ...(s.fair ? { fair: s.fair } : {}),
          ...(s.people ? { people: s.people } : {}),
          ...(s.replay ? { before: s.replay.before } : {}),
          ...(s.leadersBack ? { leadersBack: s.leadersBack } : {}),
          autoLocked: !s.lockedIn,
        },
        roomNow,
      );
      autoLock.forEach((f) => f(u));
    }
    if (reconnect && lost) tell(ONLINE_TEXT.reconnected, true);
    lost = false;
    // Whatever was still waiting goes again (a lock-in for a turn that's gone just answers with where we are).
    for (const [id, p] of pending) send({ ...p.body, id } as RoomRequest);
    if (unsentQueue) {
      send({ ...unsentQueue, id: nextId++ } as RoomRequest);
      unsentQueue = null;
    }
  }

  function onMessage(e: MessageEvent) {
    let m: RoomMessage;
    try {
      m = JSON.parse(String(e.data)) as RoomMessage;
    } catch {
      return;
    }
    if ("start" in m) {
      void onHello(m.start, m.now);
      return;
    }
    // The table screen (session 27): an answer to an act, or the table as it changed (a push, or the hello's answer).
    if ("table" in m && (m.id === 0 || m.id === helloId || !pending.has(m.id))) {
      if (lost) tell(ONLINE_TEXT.reconnected, true);
      lost = false;
      tables.forEach((f) => f(m.table));
      return;
    }
    // The game started without you (or isn't yours): the hello's answer ends the opening.
    if (!m.ok && m.id === helloId && opening) {
      const o = opening;
      opening = null;
      o.reject(new Error(m.error));
      return;
    }
    if ("pushed" in m) {
      const u = onOurClock(m.pushed, m.now);
      knownTurn = Math.max(knownTurn, u.view.turn);
      autoLock.forEach((f) => f(u));
      return;
    }
    if ("notice" in m) {
      tell(m.notice);
      return;
    }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (!m.ok) {
      p.reject(new Error(m.error));
      return;
    }
    if ("update" in m) {
      const u = onOurClock(m.update, m.now);
      knownTurn = Math.max(knownTurn, u.view.turn);
      p.resolve(u);
    } else if ("table" in m) {
      tables.forEach((f) => f(m.table));
      p.resolve(m.table);
    } else p.resolve("orders" in m ? m.orders : "plan" in m ? m.plan : "answer" in m ? m.answer : "save" in m ? m.save : "slot" in m ? m.slot : null);
  }

  function connect() {
    if (disposed || !gameId) return;
    const sock = new WS(wsUrl(gameId));
    ws = sock;
    sock.onopen = () => {
      attempts = 0;
      helloId = nextId++;
      sock.send(JSON.stringify({ id: helloId, type: "hello" } satisfies RoomRequest));
    };
    sock.onmessage = onMessage;
    sock.onclose = (e: CloseEvent) => {
      if (ws !== sock || disposed) return;
      ws = null;
      // Opened in another tab or on another device: that one has the seat now.
      if (e.code === 4000) {
        disposed = true;
        opening?.reject(new Error(ONLINE_TEXT.elsewhere));
        opening = null;
        tell(ONLINE_TEXT.elsewhere);
        return;
      }
      // Never got in: the sign-in ran out, or the game isn't yours. Say so instead of retrying forever.
      if (opening && attempts >= 2) {
        opening.reject(new Error("Couldn't open the game. Check your connection, or reload the page to sign in again."));
        opening = null;
        return;
      }
      if (!lost && !opening) tell(ONLINE_TEXT.reconnecting, true);
      if (!opening) lost = true;
      const wait = backoff[Math.min(attempts, backoff.length - 1)]!;
      attempts++;
      setTimeout(connect, wait);
    };
  }

  function open(id: string, invite: string | null = null): Promise<HostStart> {
    gameId = id;
    code = invite;
    disposed = false;
    attempts = 0;
    return new Promise<HostStart>((resolve, reject) => {
      opening = { resolve, reject };
      connect();
    });
  }

  const ask = <T = HostUpdate>(body: Body) =>
    new Promise<T>((resolve, reject) => {
      if (disposed) return reject(new Error("This game is closed."));
      const id = nextId++;
      pending.set(id, { body, resolve: resolve as (u: unknown) => void, reject });
      send({ ...body, id } as RoomRequest);
    });
  const notHere = () => Promise.reject(new Error(ONLINE_TEXT.notHere));

  return {
    gameId: () => gameId,
    onTable: (f) => void tables.push(f),
    tableAct: (act) => ask<TableView>({ type: "table", act }),
    /** Make a table with these settings and open its table screen (the game starts when its host says so). */
    async start(settings: LobbySettings) {
      const { leadersRun, ...rest } = settings;
      const body: NewOnlineGame = { settings: rest, leadersRun: leadersRun !== false };
      const made = await api<{ id: string; code: string }>("/api/games", { method: "POST", body: JSON.stringify(body) }, fetchImpl, base);
      return open(made.id, made.code);
    },
    load(source) {
      if (!("online" in source)) return notHere();
      return open(source.online, source.code ?? null);
    },
    lockIn: (orders, turn) => ask({ type: "lockIn", orders, turn }),
    saveOrders(orders, turn, paused, now) {
      const body: Body = { type: "saveOrders", orders, turn, ...(paused?.length ? { paused } : {}), ...(now ? { now } : {}) };
      if (ws && ws.readyState === WS.OPEN) send({ ...body, id: nextId++ } as RoomRequest);
      else unsentQueue = body;
    },
    onAutoLock: (f) => void autoLock.push(f),
    watchNext: (orders?: Order[]) => ask({ type: "watchNext", ...(orders ? { orders } : {}) }),
    finish: () => ask({ type: "finish" }),
    suggest: () => ask<Order[]>({ type: "suggest" }),
    propose: (offer) => ask<Answer>({ type: "propose", offer }),
    planGenerals: (instructions, purses) => ask<LeaderOrders>({ type: "planGenerals", instructions, ...(purses ? { purses } : {}) }),
    saveTo: notHere,
    exportSave: notHere,
    pause: notHere,
    resume: notHere,
    onNotice: (f) => void notices.push(f),
    dispose() {
      disposed = true;
      opening?.reject(new Error("This game is closed."));
      opening = null;
      for (const p of pending.values()) p.reject(new Error("This game is closed."));
      pending.clear();
      const sock = ws;
      ws = null;
      sock?.close(1000, "Left the game");
    },
  };
}
