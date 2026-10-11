/**
 * `--rules a.b=1,c.d=2`: any number in the rules, by its JSON path (for tuning). `null` sets a rule to null (session 25:
 * `walls.stackMax=null`, no cap). Shared by the CLI (which changes its copy of the rules in place) and the scripts
 * (which hand a tournament the changes to merge in).
 */
export type RuleChange = { path: string[]; value: number | null };

export function parseRuleArgs(spec: string): RuleChange[] {
  return spec
    .split(",")
    .filter(Boolean)
    .map((kv) => {
      const [path, value] = kv.split("=");
      const v = value === "null" ? null : Number(value);
      if (v !== null && Number.isNaN(v)) throw new Error(`--rules ${kv}: not a number`);
      return { path: path!.split("."), value: v };
    });
}

/** Change `rules` in place; every path must already exist in them. */
export function applyRuleArgs(rules: object, spec: string): void {
  for (const { path, value } of parseRuleArgs(spec)) {
    let o = rules as Record<string, unknown>;
    for (const k of path.slice(0, -1)) o = o[k] as Record<string, unknown>;
    if (!o || !(path[path.length - 1]! in o)) throw new Error(`No rule ${path.join(".")}`);
    o[path[path.length - 1]!] = value;
  }
}

/** The changes as a nested object, for `TournamentSpec.rules` (merged into the game's rules). */
export function ruleOverrides(spec: string, base: object): Record<string, unknown> {
  // Checked against a copy of the real rules, so a typo fails loudly instead of being ignored.
  applyRuleArgs(JSON.parse(JSON.stringify(base)), spec);
  const out: Record<string, unknown> = {};
  for (const { path, value } of parseRuleArgs(spec)) {
    let o = out;
    for (const k of path.slice(0, -1)) o = (o[k] ??= {}) as Record<string, unknown>;
    o[path[path.length - 1]!] = value;
  }
  return out;
}
