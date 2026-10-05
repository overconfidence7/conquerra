import { defaultRules, type MapDef } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { indexMap } from "@conquerra/engine";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArtBook } from "../../art/book";
import { HOUSES } from "../../map/houses";
import { housesSwatch } from "../houseLab";
import { MapPreview, type MapPreviewHandle, type PreviewOptions } from "../maps/MapPreview";
import { benchView, GROUNDS, groundSamplerMap, houseGridMap, SHEET_COLUMNS, SPECIALISTS, spriteSheetMap } from "./benchMaps";
import "../maps/lab.css";
import "./bench.css";

/**
 * The art test bench (`?lab=bench`, private preview only). Every House on every ground, every pair of grounds,
 * every sprite at game size on every ground, and the map symbols, all drawn by the game's own renderer; plus a
 * sheet of the known redo items and the House colours for colour-blind players. `pnpm map-check bench` saves the
 * set to docs/art/screens/bench/ (session 11's "before" pictures).
 */

type Part = "houses" | "grounds" | "sprites" | "symbols" | "redo";
const PARTS: { id: Part; label: string; note: string }[] = [
  { id: "houses", label: "Houses on grounds", note: "One row per House, one column per ground: the House tint, borders and pills over each ground, with its usual trees, hills or peaks. Each row's first tile is that House's capital." },
  { id: "grounds", label: "Grounds", note: "Every pair of grounds meeting along a wavy line (names read 'left | right'), then a row of coasts and a river running down through hills to the sea." },
  { id: "sprites", label: "Sprites", note: "One row per ground. Columns: conifers, broadleaf trees, peaks, hills, villages, towns (every variant, left to right), the four buildings, the four buildings being built, then a capital with an army and every specialist (figures show at Near). Rows take turns at each House's colours." },
  { id: "symbols", label: "Map symbols", note: "Embervale, with a territory next to a pass selected: neighbour chevrons, the pass gate, sea lanes, province plaques, culture laurels (levels 1–5), buildings and a fort being built." },
  { id: "redo", label: "Redo list & colours", note: "What session 11's new art should fix, shown big, plus the House colours as colour-blind players see them." },
];

const PARAMS = new URLSearchParams(location.search);

/** The symbols view: Embervale, your realm around a pass, with culture, buildings and a fort being built. */
function symbolsScene() {
  const map = maps.embervale!;
  const idx = indexMap(map);
  const pass = map.borders.find((b) => b.type === "pass")!;
  const mine = new Set([pass.a, ...(idx.neighbors.get(pass.a) ?? []).filter((n) => idx.border(pass.a, n) !== "pass")]);
  const ids = [...mine];
  const given = benchView(map, defaultRules, (id) => {
    const k = ids.indexOf(id);
    if (k < 0) return {};
    return {
      seat: 0,
      culture: Math.min(5, k + 1),
      building: k === 1 ? "market" : k === 2 ? "barracks" : k === 4 ? "watchtower" : null,
      construction: k === 3 ? { building: "fort", doneAtEndOfTurn: 2 } : null,
      specialists: k === 0 ? [{ id: "s1", type: "cavalry" }, { id: "s2", type: "siege" }] : [],
      troops: 14 - k,
    };
  });
  return { map, given, select: pass.a };
}

function benchScene(part: Exclude<Part, "redo">): { map: MapDef; given: ReturnType<typeof benchView>; select?: string } {
  if (part === "symbols") return symbolsScene();
  if (part === "houses") {
    const map = houseGridMap(HOUSES.map((h) => h.name));
    const cols = GROUNDS.length;
    return { map, given: benchView(map, defaultRules, (_, i) => ({ seat: Math.floor(i / cols), culture: (i % cols) % 6 })) };
  }
  if (part === "grounds") {
    const map = groundSamplerMap();
    return { map, given: benchView(map, defaultRules, () => ({ seat: null, troops: 2 })) };
  }
  const map = spriteSheetMap();
  const cols = SHEET_COLUMNS.length;
  return {
    map,
    given: benchView(map, defaultRules, (_, i) => {
      const row = Math.floor(i / cols), col = SHEET_COLUMNS[i % cols]!;
      if ("decor" in col) return { seat: null, troops: 2 };
      const seat = row % map.maxPlayers;
      if ("building" in col) return col.built ? { seat, building: col.building } : { seat, construction: { building: col.building, doneAtEndOfTurn: 2 } };
      return { seat, troops: 18, specialists: SPECIALISTS.map((type, k) => ({ id: `s${k}`, type })) };
    }),
  };
}

/** The redo sheet: ground textures tiled as the game tiles them (to show big built-in shapes repeating), and the trees big. */
function RedoSheet() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    let gone = false;
    void ArtBook.load().then(async (art) => {
      if (gone) return;
      await document.fonts.load("700 16px Cinzel");
      el.replaceChildren();
      const W = 1400;
      const c = document.createElement("canvas");
      c.id = "redo";
      c.width = W;
      c.height = 1180;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#0f1620";
      ctx.fillRect(0, 0, c.width, c.height);
      const title = (t: string, x: number, y: number, size = 18, color = "#e3c77e") => {
        ctx.font = `700 ${size}px Cinzel, serif`;
        ctx.fillStyle = color;
        ctx.fillText(t, x, y);
      };
      const note = (t: string, x: number, y: number) => {
        ctx.font = "15px Spectral, Georgia, serif";
        ctx.fillStyle = "#9aa3ae";
        ctx.fillText(t, x, y);
      };
      // 1. Ground textures at Far zoom (a texture repeats every 170 map units; a typical territory is 48 px wide at Far).
      title("Ground textures, tiled as at Far zoom (redo: rock, snow and hills have big built-in shapes that repeat)", 20, 34);
      const far = 48 / 90; // px per map unit at Far
      const grounds = ["terrain-rock", "terrain-snow", "terrain-hills", "terrain-grass"] as const;
      grounds.forEach((name, i) => {
        const img = art.get(name)!.image;
        const x = 20 + i * 340, y = 52, w = 320, h = 260, tile = 170 * far * 2; // shown at 2x Far so the shapes are clear
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        for (let ty = 0; ty < h; ty += tile) for (let tx = 0; tx < w; tx += tile) ctx.drawImage(img, x + tx, y + ty, tile, tile);
        ctx.restore();
        ctx.strokeStyle = name === "terrain-grass" ? "#6fbf73" : "#e0705a";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        note(`${name.replace("terrain-", "")}${name === "terrain-grass" ? " (for comparison: reads as even ground)" : ": redo"}`, x, y + h + 22);
      });
      // 2. The same four at Mid zoom (one repeat is 227 px).
      title("The same at Mid zoom (one repeat)", 20, 370);
      grounds.forEach((name, i) => {
        const img = art.get(name)!.image;
        ctx.drawImage(img, 20 + i * 340, 386, 320, 320);
      });
      // 3. Trees, big: the pines read as round bushes next to the broadleaf trees.
      title("Trees at 4x game size (redo: tree-conifer-1 and -2 read as round bushes, not pines)", 20, 760);
      const trees = ["tree-conifer-1", "tree-conifer-2", "tree-conifer-3", "tree-broadleaf-1", "tree-broadleaf-2", "tree-broadleaf-3"];
      trees.forEach((name, i) => {
        const img = art.get(name)!.image;
        const size = 17 * 4 * 1.6; // game size 17 map units at Near (about 1.6 px a unit there), times 4
        const x = 40 + i * 225, y = 790;
        ctx.fillStyle = "#4f6b3a";
        ctx.fillRect(x - 10, y - 10, 200, 230);
        ctx.drawImage(img, x + 100 - size / 2, y + 200 - size, size, size * (img.height / img.width));
        const redo = name === "tree-conifer-1" || name === "tree-conifer-2";
        ctx.strokeStyle = redo ? "#e0705a" : "rgba(201,164,92,0.5)";
        ctx.lineWidth = redo ? 3 : 1;
        ctx.strokeRect(x - 10, y - 10, 200, 230);
        note(`${name}${redo ? ": redo" : ""}`, x - 6, y + 245);
      });
      // 4. The same trees at true game size, in a row (as they stand in a forest at Mid zoom).
      title("…and at true size at Mid zoom", 20, 1090);
      for (let k = 0; k < 18; k++) {
        const name = trees[k % 6]!;
        const img = art.get(name)!.image;
        const s = 17 * 1.33;
        ctx.drawImage(img, 30 + k * 30, 1150 - s, s, s * (img.height / img.width));
      }
      el.append(c);
      const sw = document.createElement("div");
      sw.id = "houses";
      el.append(sw);
      housesSwatch(sw, art);
      document.body.dataset.ready = "1";
    });
    return () => {
      gone = true;
    };
  }, []);
  return <div className="bench-redo" ref={host} />;
}

function Bench() {
  const [part, setPart] = useState<Part>((PARAMS.get("part") as Part) ?? "houses");
  const [opts, setOpts] = useState<PreviewOptions>({ players: 2, capitals: true, names: true, chokes: false, tactical: false });
  const preview = useRef<MapPreviewHandle>(null);
  const scene = useMemo(() => (part === "redo" ? null : benchScene(part)), [part]);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    q.set("part", part);
    history.replaceState(null, "", `?${q}`);
    document.body.dataset.ready = "";
    // For the screenshot script: the map on show.
    Object.assign(window, { __bench: { part, map: scene?.map ?? null } });
  }, [part, scene]);
  const info = PARTS.find((p) => p.id === part)!;
  return (
    <div className="bench">
      <header className="lab-top">
        <h1>Art test bench</h1>
        <nav>
          {PARTS.map((p) => (
            <button key={p.id} className={p.id === part ? "on" : ""} onClick={() => setPart(p.id)}>
              {p.label}
            </button>
          ))}
        </nav>
        {scene && (
          <span className="lab-actions">
            {(["far", "mid", "near"] as const).map((z) => (
              <button key={z} onClick={() => preview.current?.zoom(z)}>
                {z[0]!.toUpperCase() + z.slice(1)}
              </button>
            ))}
            <button onClick={() => preview.current?.fit()}>⤢</button>
            <label className="check">
              <input type="checkbox" checked={opts.tactical} onChange={(e) => setOpts({ ...opts, tactical: e.target.checked })} /> Tactical
            </label>
            <label className="check">
              <input type="checkbox" checked={opts.names} onChange={(e) => setOpts({ ...opts, names: e.target.checked })} /> Names
            </label>
          </span>
        )}
      </header>
      <p className="bench-note">{info.note}</p>
      <main className="bench-main">{scene ? <MapPreview key={part} ref={preview} map={scene.map} given={scene.given} select={scene.select ?? null} options={opts} /> : <RedoSheet />}</main>
    </div>
  );
}

export function runBench(root: HTMLElement) {
  document.title = "Art test bench · Conquerra";
  createRoot(root).render(
    <StrictMode>
      <Bench />
    </StrictMode>,
  );
}

