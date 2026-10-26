import { defineConfig } from "vitest/config";
export default defineConfig({
  // (Session 35: at most 14 test workers. On a 20-core laptop vitest's default of one a core left the heaviest map
  // tests starved enough that one ran past vitest's own one-minute call between a worker and the runner, now and then.)
  test: { include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"], maxWorkers: 14 },
});
