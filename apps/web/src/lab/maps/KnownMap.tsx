import { defaultRules, mapCatalog, type MapDef } from "@conquerra/content";
import { loadMap } from "@conquerra/content/loadMap";
import type { GameContext } from "@conquerra/engine";
import { StrictMode, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { OrderArrow } from "../../render/types";
import type { KnownRequest, KnownResponse } from "./knownWorker";
import { MapPreview, type MapPreviewHandle } from "./MapPreview";
import "./lab.css";

/**
 * Session 32: what a bot knew (dev only, `?lab=known`; session 34 switches the labs off in production). Plays a blackout
 * game with Marshals to turn N (or opens a saved game) and shows one seat's view as the game paints it for a person in
 * that seat: the land it has seen, the cloud over the rest, its explore frontier (known land with borders into the cloud)
 * glowing, and the orders its Marshal gives that turn as arrows, planned from that view alone. The game is played in a
 * worker (`knownWorker.ts`), so none of it joins the game's start-up code.
 */

type Shot = Extract<KnownResponse, { type: "shot" }> & { ctx: GameContext };

function KnownMap() {
  const [mapId, setMapId] = useState("embervale");
  const [players, setPlayers] = useState(4);
  const [seed, setSeed] = useState("s32-known");
  const [seat, setSeat] = useState(0);
  const [turn, setTurn] = useState(4);
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const preview = useRef<MapPreviewHandle>(null);
  const worker = useMemo(() => new Worker(new URL("./knownWorker.ts", import.meta.url), { type: "module" }), []);
  const listing = mapCatalog.find((m) => m.id === mapId)!;

  const ask = (req: KnownRequest) => {
    setBusy(true);
    setProblem(null);
    worker.onmessage = async (e: MessageEvent<KnownResponse>) => {
      setBusy(false);
      if (e.data.type === "error") return setProblem(e.data.error);
      const map: MapDef = await loadMap(e.data.mapId);
      setMapId(e.data.mapId);
      setShot({ ...e.data, ctx: { map, rules: defaultRules } });
    };
    worker.postMessage(req);
  };

  const facts = useMemo(() => {
    if (!shot) return null;
    // (Its own small arrows and lines: the page keeps clear of the game screen's code.)
    const name = (t: string) => shot.ctx.map.territories.find((x) => x.id === t)?.name ?? t;
    const mine = (t: string) => {
      const v = shot.view.territories[t];
      return v?.detail === "full" && v.owner === shot.view.me.id;
    };
    const taken = new Set<string>();
    const arrows: OrderArrow[] = [];
    const lines = shot.orders.map((o, i) => {
      if (o.kind === "move") {
        const attack = !mine(o.to) && !taken.has(o.to);
        taken.add(o.to);
        const hop = arrows.some((a) => a.to === o.from) ? arrows.filter((a) => a.to === o.from).length : null;
        arrows.push({ key: o.id, from: o.from, to: o.to, n: i + 1, hop, attack, draft: false });
        return `${attack ? "Attack" : "Move to"} ${name(o.to)} from ${name(o.from)} with ${o.troops === "all" ? "all" : typeof o.troops === "number" ? o.troops : "a share"}`;
      }
      const at = "territory" in o && typeof o.territory === "string" ? ` at ${name(o.territory)}` : "";
      if (o.kind === "recruit") return `Recruit${at}`;
      if (o.kind === "build") return `Build a ${o.building}${at}`;
      if (o.kind === "hire") return `Hire ${o.specialist}${at}`;
      if (o.kind === "spy") return `Send a spy to ${shot.ctx.map.provinces.find((p) => p.id === o.to)?.name ?? "home"}`;
      return `${o.kind}${at}`;
    });
    return { scene: { arrows, glow: shot.edge.map((x) => x.id) }, lines, name };
  }, [shot]);

  return (
    <div className="lab">
      <header className="lab-top">
        <h1>What a bot knew</h1>
        <span className="lab-status">
          {busy
            ? "Playing the game in the background…"
            : shot
              ? `${shot.ctx.map.name}, turn ${shot.view.turn}, ${shot.view.players.find((p) => p.id === shot.view.me.id)?.name}: knows ${shot.known} of ${shot.ctx.map.territories.length} territories; ${shot.edge.length} on the cloud's edge`
              : "Blackout fog, a seat's own view"}
        </span>
        <span className="lab-actions">
          <button onClick={() => preview.current?.fit()}>Fit</button>
        </span>
      </header>
      <aside className="lab-recipe">
        <label>
          Map
          <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
            {mapCatalog.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Players
          <input type="number" min={listing.minPlayers} max={listing.maxPlayers} value={players} onChange={(e) => setPlayers(Number(e.target.value))} />
        </label>
        <label>
          Seed
          <input value={seed} onChange={(e) => setSeed(e.target.value)} />
        </label>
        <label>
          Seat (1 to {players})
          <input type="number" min={1} max={players} value={seat + 1} onChange={(e) => setSeat(Number(e.target.value) - 1)} />
        </label>
        <label>
          Turn
          <input type="number" min={1} max={60} value={turn} onChange={(e) => setTurn(Number(e.target.value))} />
        </label>
        <button className="on" disabled={busy} onClick={() => ask({ type: "play", mapId, players, seed, seat, turn })}>
          Play to that turn
        </button>
        <label>
          Or a saved game (blackout)
          <input type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0] && void e.target.files[0].text().then((text) => ask({ type: "save", text, seat }))} />
        </label>
        {problem && <p className="bad">{problem}</p>}
        <small>The cloud is drawn as the page draws it. Gold glow: known land with borders into the cloud (the explore frontier). Arrows: this seat's orders this turn, planned from this view alone.</small>
      </aside>
      <main className="lab-main">
        {shot && facts ? (
          <MapPreview ref={preview} map={shot.ctx.map} options={{ players, capitals: false, names: true, chokes: false, tactical: false }} given={{ ctx: shot.ctx, view: shot.view }} extra={facts.scene} />
        ) : (
          <div className="lab-empty">Pick a game and a turn, then Play to that turn.</div>
        )}
      </main>
      <aside className="lab-side">
        {shot && facts && (
          <>
            <h3>{shot.bot}'s orders</h3>
            <ol className="lab-orders">
              {facts.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
            <h3>The cloud's edge</h3>
            <p>{shot.edge.map((x) => `${facts.name(x.id)} (${x.borders})`).join(", ") || "None: the whole map is known."}</p>
          </>
        )}
      </aside>
    </div>
  );
}

export function runKnownMap(root: HTMLElement) {
  document.title = "What a bot knew · Conquerra";
  createRoot(root).render(
    <StrictMode>
      <KnownMap />
    </StrictMode>,
  );
}
