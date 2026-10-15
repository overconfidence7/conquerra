import { applyOnlineUpdate, enterGame, useGame } from "../store";
import { ONLINE_TIMER_CHOICES, DEFAULT_TIMER } from "../logic/timer";
import { api, createRemoteHost, type RemoteHost } from "./remoteHost";
import type { HostStart, OnlineGameInfo, TableAct, TableView } from "./protocol";
import { applyTalks } from "../logic/peopleDeals";
import { applyChat, chatGame, resetChat } from "../ui/chat/chatStore";
import { pauseLine, usePause } from "../ui/pause/pause";

/**
 * The page's online actions (session 26): the lobby's Online block and a "?game=" link call these. They live apart
 * from the store so none of this (nor the online host) is in the start-up bundle: it loads with the Online block.
 *
 * Session 27, friends at the table: making a game makes a table (the table screen: the link, the seats, Start); a
 * friend's link ("?join=<code>") opens the same screen; the game starts when its host says so.
 */

/** The Online block's choices, remembered on this device: the 5-minute timer and "my leaders run my House" at first. */
const ONLINE_KEY = "conquerra.online";

export function rememberedOnline(): { turnSeconds: number; leadersRun: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(ONLINE_KEY) ?? "null") as { turnSeconds?: number; leadersRun?: boolean } | null;
    if (saved) return { turnSeconds: ONLINE_TIMER_CHOICES.includes(saved.turnSeconds as number) ? saved.turnSeconds! : DEFAULT_TIMER, leadersRun: saved.leadersRun !== false };
  } catch {
    // Nothing remembered.
  }
  return { turnSeconds: DEFAULT_TIMER, leadersRun: true };
}

export function setOnlineLobby(patch: Partial<{ turnSeconds: number; leadersRun: boolean }>) {
  const next = { ...useGame.getState().onlineLobby, ...patch };
  try {
    localStorage.setItem(ONLINE_KEY, JSON.stringify(next));
  } catch {
    // A private window: it's remembered for this visit only.
  }
  useGame.setState({ onlineLobby: next });
}

/** Your online games, from the server (the lobby's list). */
export async function refreshOnline() {
  try {
    const { games } = await api<{ games: OnlineGameInfo[] }>("/api/games");
    useGame.setState({ onlineGames: games, onlineProblem: null });
  } catch (e) {
    useGame.setState({ onlineProblem: e instanceof Error ? e.message : String(e) });
  }
}

/** You, as the server sends it (session 29: and what "your turn" needs). */
type Me = { name: string; colour: number | null; email?: string; push?: string; turnEmail?: boolean };
const meFrom = (me: Me) => ({ name: me.name, colour: me.colour, ...(me.email ? { email: me.email } : {}), ...(me.push ? { push: me.push } : {}), turnEmail: !!me.turnEmail });

/** You, as the server knows you (your name and usual colour). */
export async function refreshMe() {
  try {
    useGame.setState({ me: meFrom(await api<Me>("/api/me")) });
  } catch {
    // The lobby's list says what's wrong.
  }
}

/** Change your display name (Settings, the table screen). Throws a plain sentence if it can't. */
export async function setMyName(name: string) {
  const me = await api<Me>("/api/me", { method: "PATCH", body: JSON.stringify({ name }) });
  useGame.setState({ me: meFrom(me) });
  return me.name;
}

/** Session 29: an email when it's your turn in a long game, or not. */
export async function setTurnEmail(on: boolean) {
  useGame.setState({ me: meFrom(await api<Me>("/api/me", { method: "PATCH", body: JSON.stringify({ turnEmail: on }) })) });
}

/** Session 29: "your turn" pushes on this device: on, off, blocked by the browser, or not possible here (install the app). */
export type PushState = "checking" | "on" | "off" | "blocked" | "unsupported";

const pushable = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** The room's public key, as `pushManager.subscribe` takes it. */
function keyBytes(b64u: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (!pushable()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "unsupported";
  return (await reg.pushManager.getSubscription()) && Notification.permission === "granted" ? "on" : "off";
}

/** Ask the browser, subscribe this device with the room's key, and tell the server where to send. */
export async function pushOn(key: string): Promise<PushState> {
  if (!pushable() || !key) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return Notification.permission === "denied" ? "blocked" : "off";
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // (One made with another key, from an older room key, is replaced.)
  const made = sub?.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
  if (sub && made && made.join() !== keyBytes(key).join()) (await sub.unsubscribe(), (sub = null));
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await api("/api/push", { method: "POST", body: JSON.stringify(sub.toJSON()) });
  return "on";
}

export async function pushOff(): Promise<PushState> {
  const reg = pushable() ? await navigator.serviceWorker.getRegistration() : undefined;
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/api/push", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "off";
}

/** The table screen's host (the game's own host once it starts), and the opening it's waiting on. */
let tableHost: RemoteHost | null = null;
let entering: Promise<boolean> | null = null;

/**
 * Open an online game with a fresh online host. A table that hasn't started shows the table screen (it changes live
 * for everyone at it) until its host starts the game, then everyone seated goes straight into turn 1; a game under way
 * opens as before.
 */
function openWith(begin: (host: RemoteHost) => Promise<HostStart>): Promise<boolean> {
  const host = createRemoteHost();
  tableHost = host;
  host.onReady((ready) => tableHost === host && useGame.setState({ ready }));
  // Session 28: this game's chats (only yours), from the table screen into the game.
  resetChat(null, (a) => host.chatAct(a));
  host.onChat((sync) => {
    if (tableHost !== host) return;
    chatGame(host.gameId());
    applyChat(sync);
  });
  // Session 28: pause by vote: the cards and the header follow the room; the clock stops and starts with it.
  usePause.setState({ view: null, asking: false, act: (a) => host.pauseAct(a).catch((e: Error) => host.say(e.message, false)) });
  host.onPause((p, clock) => {
    if (tableHost !== host) return;
    const line = pauseLine(p, useGame.getState().view);
    usePause.setState({ view: p });
    if (clock !== undefined) useGame.setState({ clock });
    if (line) host.say(line);
  });
  // Session 28: offers between people as they change: the deal card and the map follow, and the news is said quietly.
  host.onTalks?.((talks) => {
    if (tableHost === host) for (const line of applyTalks(talks)) host.say(line);
  });
  host.onTable((t) => {
    if (tableHost !== host) return;
    const s = useGame.getState().screen;
    if (s !== "game" && s !== "over") useGame.setState({ table: t, screen: "table" });
  });
  const run = enterGame((h) => begin(h as RemoteHost), null, () => host).then((ok) => {
    if (ok && tableHost === host) useGame.setState({ table: null });
    // (Back mid-turn: your offers a person had already accepted count as agreed again.)
    if (ok && tableHost === host) applyTalks(useGame.getState().talks);
    return ok;
  });
  entering = run;
  return run;
}

/** Make an online table with the lobby's map, bots and rules (and the Online block's timer), and open its table screen. */
export function startOnline(): Promise<boolean> {
  const { lobby, onlineLobby } = useGame.getState();
  return openWith((host) => host.start({ ...lobby, turnSeconds: onlineLobby.turnSeconds, leadersRun: onlineLobby.leadersRun }));
}

/** Open one of your online games (Continue, a waiting table, or a "?game=" address). */
export function openOnline(id: string, code?: string): Promise<boolean> {
  return openWith((host) => host.load({ online: id, ...(code ? { code } : {}) }));
}

/** A friend's link ("?join=<code>"): the table it's for, or the reason you can't join it. */
export async function joinTable(code: string): Promise<boolean> {
  useGame.setState({ screen: "table", table: null, error: null });
  try {
    const { id } = await api<{ id: string }>(`/api/join/${encodeURIComponent(code)}`);
    return openOnline(id, code);
  } catch (e) {
    useGame.setState({ error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/** Something at the table: sit, change colour, get up; the host's remove, start and cancel. */
export async function tableAct(act: TableAct): Promise<TableView | null> {
  const host = tableHost;
  if (!host) return null;
  try {
    const t = await host.tableAct(act);
    useGame.setState({ error: null });
    return t;
  } catch (e) {
    useGame.setState({ error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** Back to the lobby from the table screen (the table stays, unless you left it or it was cancelled). */
export async function closeTable() {
  const host = tableHost;
  const opening = entering;
  tableHost = null;
  entering = null;
  host?.dispose();
  await opening?.catch(() => false);
  useGame.setState({ screen: "lobby", table: null, error: null, host: null });
  void refreshOnline();
}

/**
 * Resign (session 27): a Marshal plays your seat for the rest of the game. From the game (Settings) it answers with
 * the seat as it stands, and you watch; from the lobby's list ("Leave this game") the game moves to Finished.
 */
export async function resignHere(): Promise<void> {
  const host = useGame.getState().host as RemoteHost | null;
  if (!host || !("resign" in host)) return;
  try {
    applyOnlineUpdate(await host.resign());
  } catch (e) {
    useGame.setState({ error: e instanceof Error ? e.message : String(e) });
  }
}

export async function resignFromList(id: string): Promise<void> {
  try {
    await api(`/api/games/${encodeURIComponent(id)}/resign`, { method: "POST" });
  } catch (e) {
    useGame.setState({ onlineProblem: e instanceof Error ? e.message : String(e) });
  }
  await refreshOnline();
}

/** A finished online game (session 27): watch any turn again, your own view of it, then back to the result. */
export async function watchTurn(turn: number): Promise<void> {
  const host = useGame.getState().host as RemoteHost | null;
  if (!host || !("turnReplay" in host)) return;
  try {
    const r = await host.turnReplay(turn);
    useGame.setState({ screen: "game", replay: { before: r.before, report: r.report, key: Date.now() }, error: null });
  } catch (e) {
    useGame.setState({ error: e instanceof Error ? e.message : String(e) });
  }
}

/** A table's link, to send to friends. */
export const tableLink = (code: string) => `${location.origin}/?join=${code}`;

// While an online game is open the address says so ("?game=<id>"), so a refresh or a tab opened again lands back in
// it; at a table waiting for players, its link ("?join=<code>"), so a refresh lands back at the table.
useGame.setState({ onlineLobby: rememberedOnline() });
useGame.subscribe((s, prev) => {
  if ((s.online === prev.online && s.table?.code === prev.table?.code && s.screen === prev.screen) || typeof history === "undefined") return;
  const url = new URL(location.href);
  const join = s.screen === "table" && s.table?.status === "waiting" ? s.table.code : null;
  if (s.online) url.searchParams.set("game", s.online);
  else url.searchParams.delete("game");
  if (join && !s.online) url.searchParams.set("join", join);
  else if (s.screen !== "table") url.searchParams.delete("join");
  history.replaceState(history.state, "", url);
});
