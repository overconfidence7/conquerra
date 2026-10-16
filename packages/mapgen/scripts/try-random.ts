/**
 * Session 30: how random maps fare: for each size and shape, `n` seeds in a row (seedWords), which try passed (or why
 * none did) and how long it took. In parallel, one process per size and shape.
 *
 *   pnpm --filter @conquerra/mapgen exec tsx scripts/try-random.ts [n=10] [sizes=40,80,120,200] [shapes=all] [--start 0]
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultRules } from "@conquerra/content";
import { randomMap, RandomMapFailed, randomMapId, RANDOM_SHAPE_IDS, seedWords, type RandomShape, type RandomSize } from "../src/index";

const args = process.argv.slice(2);
if (args[0] === "--one") {
  const [, size, shape, n, start] = args;
  for (let i = 0; i < Number(n); i++) {
    const id = randomMapId(Number(size) as RandomSize, shape as RandomShape, seedWords(Number(start) + i));
    const t0 = performance.now();
    try {
      const r = randomMap(id, defaultRules);
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
const self = fileURLToPath(import.meta.url);
const jobs = sizes.flatMap((size) => shapes.map((shape) => ({ size, shape })));
const results = await Promise.all(
  jobs.map(
    (j) =>
      new Promise<{ size: number; shape: string; rows: { id: string; ok: boolean; attempt?: number; ms: number; why?: string[] }[] }>((resolve) => {
        const child = spawn(process.execPath, ["--import", "tsx", self, "--one", String(j.size), j.shape, String(n), String(start)], { stdio: ["ignore", "pipe", "inherit"] });
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
  console.log(`${String(r.size).padStart(3)} ${r.shape.padEnd(11)} passed ${ok.length}/${r.rows.length}, tries ${ok.map((x) => x.attempt).join(",")}; time median ${ms[Math.floor(ms.length / 2)]} ms, worst ${ms.at(-1)} ms${why.size ? `; rejected for: ${[...why].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} (${v})`).join("; ")}` : ""}`);
}
