import { mapNameOf } from "../logic/mapListing";
import { useEffect, useState } from "react";
import { closeTable, refreshMe, setMyName, setOnlineLobby, tableAct, tableLink } from "../host/onlineActions";
import { TABLE_TEXT } from "../host/roomText";
import type { BotChoice, TableView } from "../host/protocol";
import { DEFAULT_HOUSE, HOUSE_PLAIN, HOUSES } from "../map/houses";
import { timerLabel } from "../logic/timer";
import { useGame } from "../store";
import { useArtUrl } from "./art";
import { Frame } from "./Frame";
import "./online.css";
import ChatPanel from "./chat/ChatPanel";

/**
 * The table screen (session 27): an online game waiting for its players. The host sees the link to send (copy, or the
 * phone's share sheet), the seats, and Start; a friend who opened the link picks a free House colour and takes a seat.
 * It changes live for everyone at it (the room's WebSocket). When the host starts, everyone seated goes straight into
 * turn 1; empty seats become bots.
 */

const LEVEL: Record<BotChoice, string> = { marshal: "Marshals", captain: "Captains", recruit: "Recruits", mixed: "Marshals and Captains" };

/** The table's rules in one line: "Marshals, 5 min turns, normal luck, fog on, Fate on, diplomacy on, classic". */
export function tableRules(t: TableView): string {
  const luck = t.luck <= 0.15 ? "low luck" : t.luck >= 0.45 ? "high luck" : "normal luck";
  return `${LEVEL[t.botLevel]} in the empty seats, ${timerLabel(t.turnSeconds)} turns, ${luck}, fog ${t.fog ? "on" : "off"}, Fate ${t.fate ? "on" : "off"}, diplomacy ${t.diplomacy ? "on" : "off"}, ${t.mode}`;
}

/** The House colour someone sits down with: their usual one if it's free, else their lobby's, else the first free. */
export function defaultHouse(t: TableView, usual: number | null, lobby: number): number {
  const taken = new Set(t.seats.flatMap((s) => (s && !s.you ? [s.house] : [])));
  for (const h of [usual, lobby]) if (h !== null && h >= 0 && h < HOUSES.length && !taken.has(h)) return h;
  return HOUSES.findIndex((_, i) => !taken.has(i));
}

function Swatches({ t, chosen, onPick }: { t: TableView; chosen: number; onPick: (h: number) => void }) {
  const taken = new Map(t.seats.flatMap((s) => (s && !s.you ? [[s.house, s.name] as const] : [])));
  return (
    <span className="houses" role="radiogroup" aria-label="Your House colour">
      {HOUSES.map((h, i) => (
        <button
          key={h.name}
          role="radio"
          aria-checked={chosen === i}
          aria-label={`${h.name} (${HOUSE_PLAIN[i]})${taken.has(i) ? `, taken by ${taken.get(i)}` : ""}`}
          title={taken.has(i) ? `${h.name}: ${taken.get(i)}'s` : `${h.name} (${HOUSE_PLAIN[i]})`}
          className={`house-swatch ${chosen === i ? "on" : ""} ${taken.has(i) ? "taken" : ""}`}
          style={{ background: h.color }}
          disabled={taken.has(i)}
          onClick={() => onPick(i)}
        />
      ))}
    </span>
  );
}

function LinkBlock({ code }: { code: string }) {
  const link = tableLink(code);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="table-link">
      <span className="field-name">The link for your friends</span>
      <code className="link-text">{link}</code>
      <div className="table-buttons">
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "Copied" : "Copy the link"}
        </button>
        {canShare && <button onClick={() => void navigator.share({ title: "Conquerra", text: "Take a seat at my table.", url: link }).catch(() => undefined)}>Share</button>}
      </div>
      <span className="muted small">
        Your friend's Google email has to be on the guest list first. Nate adds it in Cloudflare.
      </span>
    </div>
  );
}

export default function TableScreen() {
  const { table: t, error, me, lobby, onlineLobby } = useGame();
  const emblem = useArtUrl("emblem");
  const [name, setName] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  useEffect(() => void refreshMe(), []);
  const run = async (f: () => Promise<unknown>) => {
    setWorking(true);
    try {
      await f();
    } finally {
      setWorking(false);
    }
  };
  const back = (
    <button className="link" onClick={() => void closeTable()}>
      Back to the lobby
    </button>
  );
  const header = (
    <div className="logo">
      {emblem && <img src={emblem} alt="" />}
      <h1>Conquerra</h1>
    </div>
  );
  if (!t)
    return (
      <div className="lobby table-screen">
        <Frame>
          {header}
          {error ? <p className="warn">{error}</p> : <p className="muted">Opening the table…</p>}
          {back}
        </Frame>
      </div>
    );
  const seated = t.you.seat !== null;
  const hostName = t.seats[0]?.name ?? "The host";
  const friends = t.seats.filter((s) => s && !s.host).length;
  const empty = t.seats.filter((s) => !s).length;
  const mine = seated ? t.seats[t.you.seat!]!.house : (pick ?? defaultHouse(t, me?.colour ?? null, lobby.house ?? DEFAULT_HOUSE));
  const closed = t.status === "cancelled" ? TABLE_TEXT.cancelled : t.you.removed ? TABLE_TEXT.removed : t.status === "started" && !seated ? TABLE_TEXT.started : null;
  return (
    <div className="lobby table-screen">
      <Frame>
        {header}
        <h2 className="table-title">
          {mapNameOf(t.mapId)} <span className="muted">· {t.seats.length} seats</span>
        </h2>
        <p className="muted small">{tableRules(t)}.</p>
        {closed ? (
          <p className="warn">{closed}</p>
        ) : (
          <>
            {t.you.host && <LinkBlock code={t.code} />}
            <ol className="table-seats" aria-label="The seats">
              {t.seats.map((s, i) => (
                <li key={i} className={`table-seat ${s?.you ? "yours" : ""} ${s ? "" : "empty"}`}>
                  <span className="seat-swatch" style={s ? { background: HOUSES[s.house]!.color } : undefined} aria-hidden />
                  {s ? (
                    <span className="seat-name">
                      {s.name}
                      {s.you && <span className="muted"> (you)</span>}
                      <span className="muted small block">
                        {HOUSES[s.house]!.name}
                        {s.host ? ", the host" : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="seat-name muted">
                      Empty seat
                      <span className="small block">A bot sits here if the game starts now.</span>
                    </span>
                  )}
                  {t.you.host && s && !s.host && (
                    <button className="link small" disabled={working} onClick={() => void run(() => tableAct({ do: "remove", seat: i }))} aria-label={`Take ${s.name} off the table`}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {!seated && (
              <div className="table-sit">
                <label className="field">
                  <span className="field-name">Your name</span>
                  <input className="name-input" value={name ?? me?.name ?? ""} maxLength={24} placeholder="Your name" onChange={(e) => setName(e.target.value)} />
                </label>
                <div className="field">
                  <span className="field-name">Your House colour</span>
                  <Swatches t={t} chosen={mine} onPick={setPick} />
                  <span className="muted small">
                    {HOUSES[mine]?.name} ({HOUSE_PLAIN[mine]}). Two people never share a colour, and the bots take what's left.
                  </span>
                </div>
                <label className="check small">
                  <input type="checkbox" checked={onlineLobby.leadersRun} onChange={(e) => setOnlineLobby({ leadersRun: e.target.checked })} />
                  If I miss a turn with no orders, my leaders run my House
                </label>
                <button
                  className="primary wide"
                  disabled={working || empty === 0 || mine < 0}
                  onClick={() =>
                    void run(async () => {
                      const typed = name?.trim();
                      if (typed && typed !== me?.name) await setMyName(typed).catch(() => undefined);
                      await tableAct({
                        do: "sit",
                        house: mine,
                        leadersRun: onlineLobby.leadersRun,
                        ...(typed ? { name: typed } : {}),
                        ...(lobby.leaderName ? { leaderName: lobby.leaderName } : {}),
                        ...(lobby.stewardName ? { stewardName: lobby.stewardName } : {}),
                        leaderPersonality: lobby.leaderPersonality ?? null,
                        stewardPersonality: lobby.stewardPersonality ?? null,
                      });
                    })
                  }
                >
                  {empty === 0 ? TABLE_TEXT.full : "Take a seat"}
                </button>
              </div>
            )}
            {seated && (
              <div className="field">
                <span className="field-name">Your House colour</span>
                <Swatches t={t} chosen={mine} onPick={(h) => void run(() => tableAct({ do: "colour", house: h }))} />
              </div>
            )}
            {/* Session 28: the table chat, so friends can talk while they wait (it carries into the game). */}
            {seated && (
              <div className="field table-chat">
                <span className="field-name">The table chat</span>
                <ChatPanel mode="table" />
              </div>
            )}
            {t.you.host ? (
              <div className="table-start">
                <button className="primary wide big" disabled={working || friends === 0} onClick={() => void run(() => tableAct({ do: "start" }))}>
                  Start
                  <span className="small block">{friends === 0 ? "Once a friend sits down" : `${friends + 1} people${empty ? ` and ${empty} bot${empty === 1 ? "" : "s"}` : ""}`}</span>
                </button>
                <div className="table-buttons">
                  {friends === 0 && (
                    <button className="link small" disabled={working} onClick={() => void run(() => tableAct({ do: "start", withBots: true }))}>
                      Start now with bots in every other seat
                    </button>
                  )}
                  <button className="link small" disabled={working} onClick={() => void run(() => tableAct({ do: "cancel" }))}>
                    Cancel the table
                  </button>
                </div>
              </div>
            ) : (
              seated && (
                <div className="table-start">
                  <p className="muted">Waiting for {hostName} to start the game.</p>
                  <button className="link small" disabled={working} onClick={() => void run(async () => (await tableAct({ do: "leave" })) && (await closeTable()))}>
                    Leave the table
                  </button>
                </div>
              )
            )}
          </>
        )}
        {error && !closed && <p className="warn small">{error}</p>}
        {back}
      </Frame>
    </div>
  );
}
