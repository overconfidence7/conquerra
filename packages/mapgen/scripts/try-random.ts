/**
 * Session 30: how random maps fare: for each size and shape, `n` seeds in a row (seedWords), which try passed (or why
 * none did) and how long it took. In parallel, one process per size and shape.
 *
 *   pnpm --filter @conquerra/mapgen exec tsx scripts/try-random.ts [n=10] [sizes=40,80,120,200] [shapes=all] [--start 0]
 *     [--seats N] [--paper N] [--band-above 12:5.5 | none]
 * Session 34b: `--band-above 12:5.5` judges the layouts above 12 players by the band 5.5 (version 7's rule), `none` one
 * band for every count (passed to the workers as BAND_ABOVE).
 * Session 35: `--list` names the seeds that passed (and the try), under each size and shape's line.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultRules } from "@conquerra/content";
import { randomMap, RandomMapFailed, randomMapId, RANDOM_SHAPE_IDS, seedWords, type RandomShape, type RandomSize } from "../src/index";

const args = process.argv.slice(2);
if (args[0] === "--one") {
  const [, size, shape, n, start, seats, paper] = args;
  for (let i = 0; i < Number(n); i++) {
    const id = randomMapId(Number(size) as RandomSize, shape as RandomShape, seedWords(Number(start) + i));
    const t0 = performance.now();
    try {
      const above = process.env.BAND_ABOVE;
      const bandAbove = above === "none" ? null : above ? { players: Number(above.split(":")[0]), band: Number(above.split(":")[1]) } : undefined;
      const r = randomMap(id, defaultRules, { ...(seats && seats !== "-" ? { seats: Number(seats) } : {}), ...(paper ? { paperUpTo: Number(paper) } : {}), ...(bandAbove !== undefined ? { bandAbove } : {}) });
      console.log(JSON.stringify({ id, ok: true, attempt: r.attempt, ms: Math.round(performance.now() - t0) }));
    } catch (e) {
      console.log(JSON.stringify({ id, ok: false, ms: Math.round(performance.now() - t0), why: e instanceof RandomMapFailed ? e.tries.map((t) => t.split(": ").slice(1).join(": ")) : String(e) }));
    }
  }
  process.exit(0);
}
const pos = args.filter((a) => !a.startsWith("--"));
const n = Number(pos[0] ?? 10);
const sizes = (pos[1] ?? "40,80,120,200").split(",").map(Number);
const shapes = pos[2] && pos[2] !== "all" ? pos[2].split(",") : RANDOM_SHAPE_IDS;
const si = args.indexOf("--start");
const start = si >= 0 ? Number(args[si + 1]) : 0;
// Session 34: `--seats 12`: the most seats on the big sizes (a layout for every count up to it), else the version's.
const ti = args.indexOf("--seats");
const seatsArg = ti >= 0 ? args[ti + 1] : undefined;
// `--paper 10`: above this many players a layout needs only the exposure band (version 6's rule), for comparing.
const pi = args.indexOf("--paper");
const paperArg = pi >= 0 ? args[pi + 1] : undefined;
const bi = args.indexOf("--band-above");
if (bi >= 0) process.env.BAND_ABOVE = args[bi + 1];
const self = fileURLToPath(import.meta.url);
const jobs = sizes.flatMap((size) => shapes.map((shape) => ({ size, shape })));
const results = await Promise.all(
  jobs.map(
    (j) =>
      new Promise<{ size: number; shape: string; rows: { id: string; ok: boolean; attempt?: number; ms: number; why?: string[] }[] }>((resolve) => {
        const child = spawn(process.execPath, ["--import", "tsx", self, "--one", String(j.size), j.shape, String(n), String(start), ...(seatsArg || paperArg ? [seatsArg ?? "-"] : []), ...(paperArg ? [paperArg] : [])], { stdio: ["ignore", "pipe", "inherit"] });
        let out = "";
        child.stdout.on("data", (d: Buffer) => (out += d.toString()));
        child.on("exit", () => resolve({ ...j, rows: out.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) }));
      }),
  ),
);
for (const r of results) {
  const ok = r.rows.filter((x) => x.ok);
  const ms = r.rows.map((x) => x.ms).sort((a, b) => a - b);
  const why = new Map<string, number>();
  for (const x of r.rows) for (const w of x.why ?? []) {
    const k = w.replace(/[0-9.]+/g, "#");
    why.set(k, (why.get(k) ?? 0) + 1);
  }
  const line = `${String(r.size).padStart(3)} ${r.shape.padEnd(11)} passed ${ok.length}/${r.rows.length}, tries ${ok.map((x) => x.attempt).join(",")}; time median ${ms[Math.floor(ms.length / 2)]} ms, worst ${ms.at(-1)} ms${why.size ? `; rejected for: ${[...why].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} (${v})`).join("; ")}` : ""}`;
  console.log(line);
  if (args.includes("--list")) console.log(`    passed: ${ok.map((x) => `${x.id}${x.attempt! > 1 ? ` (try ${x.attempt})` : ""}`).join(", ")}`);
}
