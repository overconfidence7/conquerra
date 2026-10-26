import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";
// (Session 35: at most 14 test workers. On a 20-core laptop vitest's default of one a core left the heaviest map
// tests starved enough that one ran past vitest's own one-minute call between a worker and the runner, now and then.
// Orchestrator, Oct 26: and never more workers than the machine has cores, less one: a fixed 14 on GitHub's 2-core
// runner starved the suite into timeouts on every push of session 35, with every test passing on the laptop.)
const workers = Math.max(1, Math.min(14, availableParallelism() - 1));
export default defineConfig({
  test: { include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"], maxWorkers: workers },
});
