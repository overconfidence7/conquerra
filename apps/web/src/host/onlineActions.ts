import { applyOnlineUpdate, enterGame, useGame } from "../store";
import { ONLINE_TIMER_CHOICES, DEFAULT_TIMER } from "../logic/timer";
import { api, createRemoteHost, type RemoteHost } from "./remoteHost";
import type { HostStart, OnlineGameInfo, TableAct, TableView } from "./protocol";

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

/** You, as the server knows you (your name and usual colour). */
export async function refreshMe() {
  try {
    const me = await api<{ name: string; colour: number | null }>("/api/me");
    useGame.setState({ me: { name: me.name, colour: me.colour } });
  } catch {
    // The lobby's list says what's wrong.
  }
}

/** Change your display name (Settings, the table screen). Throws a plain sentence if it can't. */
export async function setMyName(name: string) {
  const me = await api<{ name: string; colour: number | null }>("/api/me", { method: "PATCH", body: JSON.stringify({ name }) });
  useGame.setState({ me: { name: me.name, colour: me.colour } });
  return me.name;
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
  host.onTable((t) => {
    if (tableHost !== host) return;
    const s = useGame.getState().screen;
    if (s !== "game" && s !== "over") useGame.setState({ table: t, screen: "table" });
  });
  const run = enterGame((h) => begin(h as RemoteHost), null, () => host).then((ok) => {
    if (ok && tableHost === host) useGame.setState({ table: null });
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
