import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * The voice test's collector (session 22): every player-facing string it can reach, checked against the voice
 * guide's hard rules (docs/voice-guide.md). It reads the source with the TypeScript parser, so comments never count.
 *
 * Reached: string literals, template literals (each `${...}` read as "{}") and JSX text and labels in the web app
 * (apps/web/src, the map lab and art bench left out: developer tools), the bots (packages/bots/src), the engine's
 * text (packages/engine/src), the line library and the personalities' blurbs (packages/content/data), and the rules
 * reference (docs/rules-reference.md).
 *
 * Can't reach: words built at run time from names in the maps (territory, province and House names), the names
 * lists themselves (leader-names.json, mapgen's names), anything the browser draws itself (the date and number
 * formats), and the update notices' service-worker text from Workbox. Error messages thrown for developers
 * (`throw new Error`, console) and code-only strings (class names, keys, ids, styles, imports) are skipped.
 */

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export interface Found {
  file: string;
  text: string;
  /** A bot's or leader's line (a question mark there is a rhetorical question: they ask no real ones until M4). */
  speaker: boolean;
}

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-types", "lab", "test"]);
const CODE_ATTRS = new Set(["className", "style", "key", "id", "href", "src", "role", "type", "viewBox", "d", "fill", "stroke", "points", "transform", "htmlFor", "name", "value", "rel", "target", "accept", "inputMode", "autoComplete", "lang", "dir", "width", "height", "x", "y", "cx", "cy", "r", "rx", "ry", "x1", "x2", "y1", "y2", "strokeWidth", "strokeLinecap", "strokeLinejoin", "fillRule", "clipRule", "preserveAspectRatio", "gradientTransform", "offset", "stopColor", "opacity", "mode", "loading", "decoding", "draggable", "tabIndex", "pattern", "step", "min", "max"]);

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, ext));
    else if (ext.test(name) && !/\.d\.ts$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Is this node inside something that isn't player-facing (an import, an Error, a console call, a comparison, a key)? */
function codeOnly(node: ts.Node): boolean {
  const p = node.parent;
  if (!p) return false;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) || ts.isImportTypeNode(p) || ts.isLiteralTypeNode(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return true;
  if (ts.isJsxAttribute(p)) {
    const name = p.name.getText();
    return CODE_ATTRS.has(name) || name.startsWith("data-") || name.startsWith("on");
  }
  for (let a: ts.Node | undefined = p; a; a = a.parent) {
    if (ts.isNewExpression(a) && /Error$/.test(a.expression.getText())) return true;
    if (ts.isThrowStatement(a)) return true;
    if (ts.isCallExpression(a)) {
      const callee = a.expression.getText();
      if (/^console\./.test(callee) || /^(querySelector|querySelectorAll|getElementById|matchMedia|addEventListener|removeEventListener|getItem|setItem|removeItem|fetch|import|require|postMessage|setAttribute|getAttribute|classList\.\w+|createElement)$/.test(callee.split(".").pop()!) || /\.(querySelector|querySelectorAll|matchMedia|addEventListener|getItem|setItem|removeItem|setProperty|getPropertyValue|classList\.\w+)$/.test(callee)) return true;
      if (/\b(includes|startsWith|endsWith|replace|split|match|test|has|get|set|delete|indexOf)$/.test(callee) && a.arguments[0] === node) return true;
    }
    if (ts.isJsxAttribute(a)) {
      const name = a.name.getText();
      if (CODE_ATTRS.has(name) || name.startsWith("data-")) return true;
    }
    if (ts.isStatement(a) || ts.isFunctionLike(a)) break;
  }
  return false;
}

function scanTs(file: string, speaker: boolean, out: Found[]) {
  const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const add = (node: ts.Node, text: string) => {
    if (!text.trim() || codeOnly(node)) return;
    out.push({ file: rel, text, speaker });
  };
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, node.text);
    else if (ts.isTemplateExpression(node)) {
      add(node, node.head.text + node.templateSpans.map((s) => `{}${s.literal.text}`).join(""));
    } else if (ts.isJsxText(node)) add(node, node.text.replace(/\s+/g, " ").trim());
    ts.forEachChild(node, visit);
  };
  visit(src);
}

function scanJson(file: string, keep: (path: string[]) => boolean, speaker: (path: string[]) => boolean, out: Found[]) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const walk = (v: unknown, path: string[]) => {
    if (typeof v === "string") {
      if (keep(path)) out.push({ file: `${rel}:${path.join(".")}`, text: v, speaker: speaker(path) });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, String(i)]));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, [...path, k]);
  };
  walk(JSON.parse(readFileSync(file, "utf8")), []);
}

/** The rules reference: prose lines (tables' cells too), code spans left out. */
function scanMarkdown(file: string, out: Found[]) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  let fence = false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.startsWith("```")) fence = !fence;
    if (fence || !line.trim() || /^\|?\s*-{3,}/.test(line)) continue;
    out.push({ file: rel, text: line.replace(/`[^`]*`/g, "{}"), speaker: false });
  }
}

export function collect(): Found[] {
  const out: Found[] = [];
  // (The map's shaders are GLSL in strings: code, not words.)
  for (const f of files(join(ROOT, "apps/web/src"), /\.tsx?$/)) if (!/shaders\.ts$/.test(f)) scanTs(f, false, out);
  for (const f of files(join(ROOT, "packages/bots/src"), /\.ts$/)) scanTs(f, true, out);
  for (const f of files(join(ROOT, "packages/engine/src"), /\.ts$/)) scanTs(f, false, out);
  const lines = join(ROOT, "packages/content/data/lines.json");
  try {
    statSync(lines);
    // (Session 29: a bot in the chat and a leader in your council may ask a real question, so those two sections
    // aren't held to the no-question rule. Every older section still is.)
    scanJson(lines, (p) => p[0] !== "limits", (p) => p[0] !== "chat" && p[0] !== "council", out);
  } catch {
    // (Before the line library exists.)
  }
  scanJson(join(ROOT, "packages/content/data/personalities.json"), (p) => ["title", "summary"].includes(p.at(-1)!) || p.includes("voice"), (p) => p.includes("voice"), out);
  // Session 31: the tutorials' words (names, blurbs, openings, goals, hints, closings).
  const lessons = join(ROOT, "packages/content/data/tutorials");
  for (const f of readdirSync(lessons)) if (f.endsWith(".json")) scanJson(join(lessons, f), (p) => p[0] === "words", () => false, out);
  scanMarkdown(join(ROOT, "docs/rules-reference.md"), out);
  return out;
}

const BANNED = ["journey", "journeys", "leverage", "robust", "seamless", "seamlessly", "embark", "unleash", "unleashes", "epic", "delve", "tapestry", "elevate", "in the realm of", "it's worth noting", "circle back", "touch base", "champs"];
/** Arrows in prose (the ones on buttons and icons are allowed by name, below). */
const ARROWS = /[→←⇒⟶➜➔↦]|->/;

/** The hard rules a string breaks (empty: none). Only prose is held to the semicolon and spaced-hyphen rules. */
export function problems(f: Found): string[] {
  const t = f.text;
  const out: string[] = [];
  if (/[—–]/.test(t)) out.push("dash");
  if (/[A-Za-z0-9.,)'’”}] - [A-Za-z0-9({'‘“]/.test(t)) out.push("spaced hyphen");
  if (/[A-Za-z)'’”}%] ?; +[A-Za-z{'‘“]/.test(t) && !/^\s*[a-z-]+\s*:/.test(t)) out.push("semicolon");
  if (ARROWS.test(t)) out.push("arrow");
  const lower = t.toLowerCase();
  for (const w of BANNED) if (new RegExp(`(^|[^a-z])${w.replace(/'/g, "['’]")}([^a-z]|$)`).test(lower)) out.push(`banned word "${w}"`);
  if (f.speaker && /[A-Za-z)'’”}] ?\?/.test(t)) out.push("question");
  return out;
}

/** Every failure as "file | text | rule", for the expected-failures list. */
export function failures(found = collect()): string[] {
  const out = new Set<string>();
  for (const f of found) if (!(`${f.file} | ${f.text}` in ALLOWED)) for (const p of problems(f)) out.add(`${f.file} | ${f.text} | ${p}`);
  return [...out].sort();
}

/**
 * Arrows and dashes that aren't prose: icons on buttons and the like ("Skip ▸▸" uses triangles, not arrows, so it
 * needs no entry). Each says why.
 */
export const ALLOWED: Record<string, string> = {
  "apps/web/src/ui/TopBar.tsx | →": "the gold counter: gold now, then after this turn's orders (\"245→226\"), a number display, not prose",
};
