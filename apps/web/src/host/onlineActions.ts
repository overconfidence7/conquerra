import { enterGame, useGame } from "../store";
import { ONLINE_TIMER_CHOICES, DEFAULT_TIMER } from "../logic/timer";
import { api, createRemoteHost } from "./remoteHost";
import type { OnlineGameInfo } from "./protocol";

/**
 * The page's online actions (session 26): the lobby's Online block and a "?game=" link call these. They live apart
 * from the store so none of this (nor the online host) is in the start-up bundle: it loads with the Online block.
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

/** Make an online game with the lobby's map, bots and rules (and the Online block's timer), and open it. */
export function startOnline(): Promise<boolean> {
  const { lobby, onlineLobby } = useGame.getState();
  return enterGame((host) => host.start({ ...lobby, turnSeconds: onlineLobby.turnSeconds, leadersRun: onlineLobby.leadersRun }), null, createRemoteHost);
}

/** Open one of your online games (Continue, or a link). */
export function openOnline(id: string): Promise<boolean> {
  return enterGame((host) => host.load({ online: id }), null, createRemoteHost);
}

// While an online game is open the address says so ("?game=<id>"), so a refresh or a tab opened again lands back in it.
useGame.setState({ onlineLobby: rememberedOnline() });
useGame.subscribe((s, prev) => {
  if (s.online === prev.online || typeof history === "undefined") return;
  const url = new URL(location.href);
  if (s.online) url.searchParams.set("game", s.online);
  else url.searchParams.delete("game");
  history.replaceState(history.state, "", url);
});
