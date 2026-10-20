/**
 * Session 34b: one set of worker processes shared by several searches at once. Each search asks for games
 * (`play(spec, i)`); any free worker takes the next one, so nine tables' searches keep all the cores busy together
 * instead of each waiting for its own slowest worker. Game `i` of a spec is the same game whichever worker plays it.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { TournamentSpec } from "./tournament";

/** What a search needs from a game: who sat where and won, how long it ran, and the CPU it took a turn. */
export interface LiteResult {
  seed: string;
  turns: number;
  seats: { capital: string; won: boolean }[];
  /** Resolving plus every seat's planning, per turn (ms): the average and the worst turn. */
  turnMsAvg: number;
  turnMsMax: number;
}

interface Pending {
  resolve(r: LiteResult): void;
  reject(e: Error): void;
}

export class GamePool {
  private readonly workers: { child: ChildProcess; busy: boolean; buf: string; job?: number }[] = [];
  private readonly queue: { id: number; spec: TournamentSpec; i: number }[] = [];
  private readonly pending = new Map<number, Pending>();
  private next = 1;

  constructor(n: number) {
    const file = fileURLToPath(new URL("./poolWorker.ts", import.meta.url));
    for (let w = 0; w < n; w++) {
      const child = spawn(process.execPath, ["--import", "tsx", file], { stdio: ["pipe", "pipe", "inherit"] });
      const me = { child, busy: false, buf: "" as string, job: undefined as number | undefined };
      child.stdout!.on("data", (d: Buffer) => {
        me.buf += d.toString();
        for (let nl = me.buf.indexOf("\n"); nl >= 0; nl = me.buf.indexOf("\n")) {
          const line = me.buf.slice(0, nl);
          me.buf = me.buf.slice(nl + 1);
          const { id, r } = JSON.parse(line) as { id: number; r: LiteResult };
          this.pending.get(id)?.resolve(r);
          this.pending.delete(id);
          me.busy = false;
          me.job = undefined;
          this.pump();
        }
      });
      child.on("exit", (code) => {
        if (me.job !== undefined) this.pending.get(me.job)?.reject(new Error(`a pool worker exited ${code}`));
      });
      this.workers.push(me);
    }
  }

  play(spec: TournamentSpec, i: number): Promise<LiteResult> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.queue.push({ id, spec, i });
      this.pump();
    });
  }

  /** Every game of a spec, sorted by seed (as `runTournament` returns them). */
  async run(spec: TournamentSpec): Promise<LiteResult[]> {
    const rs = await Promise.all(Array.from({ length: spec.games }, (_, i) => this.play(spec, i)));
    return rs.sort((a, b) => a.seed.localeCompare(b.seed, "en", { numeric: true }));
  }

  private pump() {
    for (const w of this.workers) {
      if (w.busy) continue;
      const job = this.queue.shift();
      if (!job) return;
      w.busy = true;
      w.job = job.id;
      w.child.stdin!.write(`${JSON.stringify(job)}\n`);
    }
  }

  close() {
    for (const w of this.workers) w.child.stdin!.end();
  }
}
