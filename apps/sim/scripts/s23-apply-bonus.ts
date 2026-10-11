/**
 * Session 23: puts the start bonuses the sims chose (the "recipe" lines of docs/sims/s23-bonus-*.txt) into the map
 * maker's recipes (packages/mapgen/src/configs.ts, beside the pinned capital layouts). Then `pnpm build-maps`.
 *   npx tsx apps/sim/scripts/s23-apply-bonus.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const cfg = "packages/mapgen/src/configs.ts";
const bonus = new Map<string, Record<number, Record<string, number>>>();
for (const f of readdirSync("docs/sims").filter((x) => /^s23-bonus-.*\.txt$/.test(x))) {
  for (const line of readFileSync(`docs/sims/${f}`, "utf8").split("\n")) {
    const m = /^recipe ([a-z-]+):(\d+): (\{[^}]*\})/.exec(line);
    if (!m) continue;
    const chosen = JSON.parse(m[3]!) as Record<string, number>;
    if (!Object.keys(chosen).length) continue;
    const per = bonus.get(m[1]!) ?? {};
    per[Number(m[2])] = chosen;
    bonus.set(m[1]!, per);
  }
}
// (Run again, it replaces what it put there before: the comment line, and the setting on its own line or inline.)
let src = readFileSync(cfg, "utf8")
  .replace(/ *\/\/ Session 23: extra troops[^\n]*\n/g, "")
  .replace(/^ *startBonus: \{(?:[^{}]|\{[^{}]*\})*\},\n/gm, "")
  .replace(/ startBonus: \{(?:[^{}]|\{[^{}]*\})*\},/g, "");
for (const [id, per] of [...bonus].sort()) {
  const text = `startBonus: ${JSON.stringify(per)},`;
  const multi = `    id: "${id}",\n`;
  const single = `{id: "${id}",`;
  if (src.includes(multi)) src = src.replace(multi, `${multi}    // Session 23: extra troops at a harder spot's capital, sized by the sims (docs/sims/s23-bonus-*.txt).\n    ${text}\n`);
  else if (src.includes(single)) src = src.replace(single, `${single} ${text}`);
  else throw new Error(`no recipe for ${id}`);
  console.log(id, JSON.stringify(per));
}
writeFileSync(cfg, src);
