import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { allMasks, LAND_SHAPES, MAP_CONFIGS, recipeFor, recipeFromJson, recipeToJson, SHAPE_NAMES, SIZES, type LandShape, type Recipe } from "@conquerra/mapgen";
import type { SimReport } from "@conquerra/simcore";
import type { TerritoryId } from "@conquerra/engine";
import { LabClient } from "./client";
import { randomSeed, type LabMade } from "./core";
import { SeedGallery, type GalleryItem } from "./Gallery";
import { MapPreview, type MapPreviewHandle, type PreviewOptions } from "./MapPreview";
import { AttemptsPanel, ChecksPanel, FairnessTable, SimResults, SizeSpreadPanel } from "./panels";
import "./lab.css";

/**
 * The map lab (`?lab=maps`, on the private preview only): make a map from a recipe, look at it with the game's
 * renderer, check it, sim it, compare seeds, and copy the recipe. See docs/07-map-tooling.md.
 */

type NumKey = "territories" | "provinces" | "water" | "seas" | "lakes" | "islandChains" | "islands" | "mountainRanges" | "straits" | "seaLanes" | "minSeaLanes" | "rivers" | "minChokePoints" | "aspect" | "roughness" | "laneReach" | "maxAttempts";

/** Every knob, with a plain label and a hint. Empty means "let the map maker decide". */
const KNOBS: { key: NumKey; label: string; hint: string; step?: number; only?: LandShape[] }[] = [
  { key: "provinces", label: "Provinces", hint: "About 4.5 territories each is usual" },
  { key: "water", label: "Share of water", hint: "0.2–0.8. Empty: the shape decides", step: 0.01 },
  { key: "roughness", label: "Coast roughness", hint: "0 = the bare shape, 1 = mostly noise", step: 0.05 },
  { key: "islands", label: "Islands", hint: "Archipelago: how many. Inland sea, crescent: isles in the middle", only: ["archipelago", "inlandSea", "crescent"] },
  { key: "seas", label: "Inland seas and gulfs", hint: "Dents pushed into the land" },
  { key: "lakes", label: "Lakes", hint: "" },
  { key: "islandChains", label: "Island chains off the coast", hint: "Each 2–3 small islands" },
  { key: "mountainRanges", label: "Mountain ranges", hint: "Each has at least one pass" },
  { key: "straits", label: "Straits", hint: "A channel cutting in, leaving a land bridge" },
  { key: "rivers", label: "Rivers", hint: "" },
  { key: "seaLanes", label: "Extra sea lanes", hint: "Beyond the ones that join up islands" },
  { key: "minSeaLanes", label: "Sea lanes, at least", hint: "Rejects maps with fewer" },
  { key: "minChokePoints", label: "Choke points, at least", hint: "Passes + sea lanes + land bridges" },
  { key: "laneReach", label: "Longest sea lane", hint: "In map cells (16 = about 220 map units)" },
  { key: "aspect", label: "Width ÷ height", hint: "Empty: the shape's own", step: 0.05 },
  { key: "maxAttempts", label: "Tries before giving up", hint: "Each try is the next seed: seed#2, seed#3…" },
];

const GALLERY_TRIES = 8;
const PARAMS = new URLSearchParams(location.search);
/** `full=1`: just the map (for screenshots and the phone measurements); `hold=1`: don't paint until `__labGo()`. */
const FULL = PARAMS.has("full");
const PRESETS = MAP_CONFIGS.map((c) => ({ id: c.id, name: c.name, recipe: { ...c, shape: c.shape ?? ("continent" as const) } as Recipe }));

function readStart(): Recipe {
  const q = new URLSearchParams(location.search);
  // `preset=embervale`: a built-in map's own recipe.
  const preset = PRESETS.find((p) => p.id === q.get("preset"));
  if (preset) return structuredClone(preset.recipe);
  // `recipe=<JSON>`: a whole recipe (the candidate links in docs/maps/candidates.md use this).
  const json = q.get("recipe");
  if (json)
    try {
      return recipeFromJson(json);
    } catch {
      // Not a recipe: fall back to shape, size and seed.
    }
  const shape = (q.get("shape") ?? "continent") as LandShape;
  const size = Number(q.get("size") ?? 60);
  return recipeFor(LAND_SHAPES.includes(shape) ? shape : "continent", size, q.get("seed") ?? "lab-1", q.get("mask") ? { mask: q.get("mask")! } : {});
}

function RecipePanel({ recipe, setRecipe, onMake, busy }: { recipe: Recipe; setRecipe(r: Recipe): void; onMake(): void; busy: boolean }) {
  const shape = recipe.shape ?? "continent";
  const reset = (s: LandShape, size: number, mask?: string) => setRecipe(recipeFor(s, size, recipe.seed, s === "mask" ? { mask: mask ?? recipe.mask ?? "dragon" } : {}));
  const setNum = (k: NumKey, v: string) => {
    const next = { ...recipe } as Record<string, unknown>;
    if (v.trim() === "") delete next[k];
    else next[k] = Number(v);
    setRecipe(next as unknown as Recipe);
  };
  const setPlayers = (path: "min" | "max" | "rmin" | "rmax", v: number) => {
    const p = structuredClone(recipe.players);
    if (path === "min") p.min = v;
    if (path === "max") p.max = v;
    if (path === "rmin") p.recommended.min = v;
    if (path === "rmax") p.recommended.max = v;
    setRecipe({ ...recipe, players: p });
  };
  return (
    <aside className="lab-recipe" data-panel="recipe">
      <h2>Recipe</h2>
      <label>
        Seed
        <span className="row">
          <input value={recipe.seed} onChange={(e) => setRecipe({ ...recipe, seed: e.target.value })} onKeyDown={(e) => e.key === "Enter" && onMake()} />
          <button onClick={() => setRecipe({ ...recipe, seed: randomSeed() })} title="A new random seed">
            🎲
          </button>
        </span>
      </label>
      <label>
        Shape
        <select value={shape} onChange={(e) => reset(e.target.value as LandShape, recipe.territories)}>
          {LAND_SHAPES.map((s) => (
            <option key={s} value={s}>
              {SHAPE_NAMES[s]}
            </option>
          ))}
        </select>
      </label>
      {shape === "mask" && (
        <label>
          Silhouette
          <select value={recipe.mask ?? "dragon"} onChange={(e) => setRecipe({ ...recipe, mask: e.target.value })}>
            {allMasks().map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Size (territories)
        <span className="row">
          {SIZES.map((s) => (
            <button key={s} className={recipe.territories === s ? "on" : ""} onClick={() => reset(shape, s)}>
              {s}
            </button>
          ))}
        </span>
      </label>
      <p className="lab-note">Changing the shape or size resets the settings below to suit it.</p>
      <div className="row">
        <button className="primary wide" onClick={onMake} disabled={busy}>
          {busy ? "Making…" : "Make this map"}
        </button>
      </div>
      <div className="lab-start">
        Start from:{" "}
        {PRESETS.map((p) => (
          <button key={p.id} className="link" onClick={() => setRecipe(structuredClone(p.recipe))}>
            {p.name}
          </button>
        ))}
      </div>
      <details open>
        <summary>All settings</summary>
        <div className="lab-players">
          Players
          <span className="row">
            <input type="number" min={2} max={10} value={recipe.players.min} onChange={(e) => setPlayers("min", Number(e.target.value))} title="Fewest" />
            to
            <input type="number" min={2} max={10} value={recipe.players.max} onChange={(e) => setPlayers("max", Number(e.target.value))} title="Most" />
          </span>
          <small>Every count gets a fair capital layout. Suggested in the lobby:</small>
          <span className="row">
            <input type="number" min={2} max={10} value={recipe.players.recommended.min} onChange={(e) => setPlayers("rmin", Number(e.target.value))} />
            to
            <input type="number" min={2} max={10} value={recipe.players.recommended.max} onChange={(e) => setPlayers("rmax", Number(e.target.value))} />
          </span>
        </div>
        {shape === "twinContinents" && (
          <label className="check">
            <input
              type="checkbox"
              checked={recipe.landBridge ?? false}
              ref={(el) => {
                if (el) el.indeterminate = recipe.landBridge === undefined;
              }}
              onChange={(e) => setRecipe({ ...recipe, landBridge: e.target.checked })}
            />
            Land bridge between the twins {recipe.landBridge === undefined && <small>(now: a coin toss per seed)</small>}
          </label>
        )}
        {KNOBS.filter((k) => !k.only || k.only.includes(shape)).map((k) => (
          <label key={k.key} className="knob">
            <span>
              {k.label}
              {k.hint && <small>{k.hint}</small>}
            </span>
            <input type="number" step={k.step ?? 1} value={(recipe[k.key] as number | undefined) ?? ""} placeholder="auto" onChange={(e) => setNum(k.key, e.target.value)} />
          </label>
        ))}
        <label className="knob">
          <span>Name</span>
          <input value={recipe.name} onChange={(e) => setRecipe({ ...recipe, name: e.target.value })} />
        </label>
        <label className="knob">
          <span>Id</span>
          <input value={recipe.id} onChange={(e) => setRecipe({ ...recipe, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} />
        </label>
      </details>
    </aside>
  );
}

function SimPanel({ client, made }: { client: LabClient; made: LabMade }) {
  const map = made.map!;
  const [players, setPlayers] = useState(map.recommendedPlayers.max);
  const [games, setGames] = useState(200);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ report: SimReport; ms: number; crashed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setResult(null);
    setProgress(null);
    setPlayers(map.recommendedPlayers.max);
    client.stopSim();
  }, [map, client]);
  const run = async () => {
    setResult(null);
    setError(null);
    setProgress({ done: 0, total: games });
    try {
      const r = await client.simulate(map, players, games, "lab", (done, total) => setProgress({ done, total }));
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    }
    setProgress(null);
  };
  const counts = Array.from({ length: map.maxPlayers - map.minPlayers + 1 }, (_, i) => map.minPlayers + i);
  return (
    <section className="lab-card" data-panel="sim">
      <h3>Sim this map</h3>
      <p className="lab-note">Captain bots at every seat, fog on, normal luck, Classic (the same as `pnpm sim`).</p>
      <div className="row">
        <select value={players} onChange={(e) => setPlayers(Number(e.target.value))} aria-label="Players">
          {counts.map((n) => (
            <option key={n} value={n}>
              {n} players
            </option>
          ))}
        </select>
        <select value={games} onChange={(e) => setGames(Number(e.target.value))} aria-label="Games">
          {[50, 100, 200, 400].map((n) => (
            <option key={n} value={n}>
              {n} games
            </option>
          ))}
        </select>
        {progress ? (
          <button onClick={() => (client.stopSim(), setProgress(null))}>Stop</button>
        ) : (
          <button className="primary" onClick={run}>
            Sim this map
          </button>
        )}
      </div>
      {progress && (
        <div className="lab-progress" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
          <i style={{ width: `${(100 * progress.done) / progress.total}%` }} />
          <span>
            {progress.done} of {progress.total} games
          </span>
        </div>
      )}
      {error && <p className="bad">{error}</p>}
      {result && <SimResults {...result} />}
    </section>
  );
}

function MapLab() {
  const client = useMemo(() => new LabClient(), []);
  const [recipe, setRecipe] = useState<Recipe>(readStart);
  const [made, setMade] = useState<LabMade | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"preview" | "gallery">(new URLSearchParams(location.search).get("tab") === "gallery" ? "gallery" : "preview");
  // Toggles can be set in the address too (capitals=0, names=0, chokes=1, tactical=1, players=6), for screenshots.
  const flag = (k: string, d: boolean) => (PARAMS.has(k) ? PARAMS.get(k) !== "0" : d);
  const [opts, setOpts] = useState<PreviewOptions>({ players: Number(PARAMS.get("players") ?? 4), capitals: flag("capitals", true), names: flag("names", true), chokes: flag("chokes", false), tactical: flag("tactical", false) });
  const [picked, setPicked] = useState<TerritoryId | null>(null);
  const [galleryStart, setGalleryStart] = useState(1);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const preview = useRef<MapPreviewHandle>(null);
  const [go, setGo] = useState(!PARAMS.has("hold"));
  useEffect(() => {
    // For the measuring scripts (pnpm map-check lab / labperf).
    Object.assign(window, { __labGo: () => setGo(true), __labMade: made });
  }, [made]);
  const latest = useRef(recipe);
  latest.current = recipe;

  const make = async (r: Recipe = latest.current) => {
    setBusy(true);
    const m = await client.make(r);
    setBusy(false);
    setMade(m);
    if (m.map && !PARAMS.has("players")) setOpts((o) => ({ ...o, players: Math.max(m.map!.minPlayers, Math.min(m.map!.maxPlayers, m.map!.recommendedPlayers.max)) }));
    // So Nate can share or reload exactly this map.
    const q = new URLSearchParams(location.search);
    // The whole recipe too, so a copied link opens exactly this map (shape, size and seed are just easier to read).
    q.delete("preset");
    q.set("recipe", JSON.stringify(r));
    q.set("shape", r.shape ?? "continent");
    q.set("size", String(r.territories));
    q.set("seed", r.seed);
    if (r.mask) q.set("mask", r.mask);
    else q.delete("mask");
    history.replaceState(null, "", `?${q}`);
  };
  useEffect(() => {
    // (The workers live as long as the page, so React's double start in development is harmless.)
    void make();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The gallery: 12 seeds made from the current recipe, numbered from the base seed.
  const base = recipe.seed.replace(/-\d+$/, "");
  const galleryKey = `${recipeToJson({ ...recipe, seed: "" })}|${base}|${galleryStart}`;
  useEffect(() => {
    if (tab !== "gallery") return;
    const seeds = Array.from({ length: 12 }, (_, i) => `${base}-${galleryStart + i}`);
    setGallery(seeds.map((seed) => ({ seed, made: null })));
    client.galleryOf(
      seeds.map((seed) => ({ ...recipe, seed, maxAttempts: Math.min(recipe.maxAttempts ?? 40, GALLERY_TRIES) })),
      (i, m) => setGallery((g) => g.map((x, k) => (k === i ? { ...x, made: m } : x))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, galleryKey]);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2500);
  };
  const copyRecipe = async () => {
    const text = recipeToJson(recipe);
    try {
      await navigator.clipboard.writeText(text);
      flash("Recipe copied: paste it into MAP_CONFIGS in packages/mapgen/src/configs.ts");
    } catch {
      prompt("Copy the recipe:", text);
    }
  };
  const pasteRecipe = () => {
    const text = prompt("Paste a recipe (JSON):");
    if (!text) return;
    try {
      const r = recipeFromJson(text);
      setRecipe(r);
      void make(r);
    } catch (e) {
      flash((e as Error).message);
    }
  };
  const saveImage = () => {
    const url = preview.current?.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recipe.id}.png`;
    a.click();
  };

  const map = made?.map ?? null;
  const pickedT = map && picked ? map.territories.find((t) => t.id === picked) : null;
  const limits = useMemo(() => ({ minChokePoints: (made?.recipe ?? recipe).minChokePoints ?? 5, minSeaLanes: (made?.recipe ?? recipe).minSeaLanes ?? 1 }), [made, recipe]);

  return (
    <div className={`lab${FULL ? " full" : ""}`}>
      <header className="lab-top">
        <h1>Map lab</h1>
        <nav>
          <button className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>
            Preview
          </button>
          <button className={tab === "gallery" ? "on" : ""} onClick={() => setTab("gallery")}>
            Seed gallery
          </button>
        </nav>
        <span className="lab-status">
          {busy ? "Making the map in the background…" : map ? `${map.name} · ${map.territories.length} territories · ${map.provinces.length} provinces · ${map.minPlayers}–${map.maxPlayers} players` : made ? "No map passed the checks" : ""}
        </span>
        <span className="lab-actions">
          <button onClick={copyRecipe}>Copy recipe</button>
          <button onClick={pasteRecipe}>Paste recipe</button>
          <button onClick={saveImage} disabled={!map || tab !== "preview"}>
            Save image
          </button>
        </span>
      </header>
      <RecipePanel recipe={recipe} setRecipe={setRecipe} onMake={() => void make()} busy={busy} />
      {tab === "preview" ? (
        <main className="lab-main">
          {map ? (
            <>
              {go && <MapPreview ref={preview} map={map} options={opts} onPick={setPicked} />}
              <div className="lab-toolbar">
                <span className="group">
                  {(["far", "mid", "near"] as const).map((z) => (
                    <button key={z} onClick={() => preview.current?.zoom(z)}>
                      {z[0]!.toUpperCase() + z.slice(1)}
                    </button>
                  ))}
                  <button onClick={() => preview.current?.fit()} title="Fit the whole map">
                    ⤢
                  </button>
                </span>
                <span className="group">
                  {(
                    [
                      ["tactical", "Tactical"],
                      ["names", "Names"],
                      ["chokes", "Choke points"],
                      ["capitals", "Capitals"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="check">
                      <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />
                      {label}
                    </label>
                  ))}
                  <select value={opts.players} onChange={(e) => setOpts({ ...opts, players: Number(e.target.value) })} aria-label="Capitals for how many players" disabled={!opts.capitals}>
                    {Array.from({ length: map.maxPlayers - map.minPlayers + 1 }, (_, i) => map.minPlayers + i).map((n) => (
                      <option key={n} value={n}>
                        {n} players
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              {pickedT && (
                <div className="lab-picked">
                  <b>{pickedT.name}</b> · {pickedT.terrain} · {map.provinces.find((p) => p.id === pickedT.province)?.name} · neighbours:{" "}
                  {map.borders
                    .filter((b) => b.a === picked || b.b === picked)
                    .map((b) => `${map.territories.find((t) => t.id === (b.a === picked ? b.b : b.a))?.name}${b.type === "normal" ? "" : ` (${b.type})`}`)
                    .join(", ")}
                </div>
              )}
            </>
          ) : (
            <div className="lab-empty">{busy ? "Making the map…" : "No map to show: see why on the right, then change the recipe or the seed."}</div>
          )}
        </main>
      ) : (
        <main className="lab-main gallery">
          <div className="lab-gallery-bar">
            <span>
              Seeds <b>{base}-{galleryStart}</b> to <b>{base}-{galleryStart + 11}</b> with this recipe (each allowed {GALLERY_TRIES} tries). Click one to open it.
            </span>
            <button onClick={() => setGalleryStart(Math.max(1, galleryStart - 12))} disabled={galleryStart === 1}>
              Previous 12
            </button>
            <button onClick={() => setGalleryStart(galleryStart + 12)}>Next 12</button>
          </div>
          <SeedGallery
            items={gallery}
            onPick={(seed) => {
              const r = { ...recipe, seed };
              setRecipe(r);
              setTab("preview");
              void make(r);
            }}
          />
        </main>
      )}
      <aside className="lab-side">
        {made && <AttemptsPanel made={made} />}
        {map && (
          <>
            <ChecksPanel map={map} limits={limits} />
            <FairnessTable map={map} />
            <SizeSpreadPanel map={map} />
            <SimPanel client={client} made={made!} />
          </>
        )}
      </aside>
      {toast && <div className="lab-toast">{toast}</div>}
    </div>
  );
}

export function runMapLab(root: HTMLElement) {
  document.title = "Map lab · Conquerra";
  createRoot(root).render(
    <StrictMode>
      <MapLab />
    </StrictMode>,
  );
}
