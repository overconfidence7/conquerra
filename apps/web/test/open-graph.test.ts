import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { worker } from "../server/api";
import type { Env } from "../server/env";
import { isCrawler, mapWords, OG_TEXT, withTags } from "../server/openGraph";
import { problems } from "../../../packages/content/test/voiceScan";

/**
 * Session 35: the preview a chat app shows for a shared link. A crawler fetching an invite link gets the table's own
 * words (the host, the map, the seats, which anyone with the link sees anyway); a person gets the page as it is.
 */
const web = join(__dirname, "..");
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
const lobby = readFileSync(join(web, "index.html"), "utf8");

function d1() {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(web, "migrations")).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(web, "migrations", f), "utf8"));
  type V = string | number | null;
  const stmt = (sql: string, params: V[] = []) => ({
    bind: (...p: V[]) => stmt(sql, p),
    first: async <T>() => (db.prepare(sql).get(...params) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
    run: async () => ({ success: true, results: db.prepare(sql).all(...params) }),
  });
  return { db, d1: { prepare: (sql: string) => stmt(sql), batch: async (list: { run(): Promise<unknown> }[]) => { const out = []; for (const s of list) out.push(await s.run()); return out; } } };
}

function setup() {
  const { db, d1: DB } = d1();
  db.prepare("INSERT INTO users (id, email, name, created) VALUES (?, ?, ?, ?)").run("u1", "nkurtz@gmail.com", "Nate", 1);
  db.prepare("INSERT INTO users (id, email, name, created) VALUES (?, ?, ?, ?)").run("u2", "kit@example.com", 'Kit <b>"the bold"</b>', 1);
  const game = db.prepare("INSERT INTO games (id, map, settings, status, host_user, created, turn, updated, seed_hash, invite, size) VALUES (?, ?, '{}', ?, ?, 1, 1, 1, '', ?, ?)");
  game.run("g1", "rootholm", "waiting", "u1", "k3f9q2m8w1", 8);
  game.run("g2", "random:300-island-quiet-heron", "waiting", "u2", "zz9q2m8w1k", 20);
  game.run("g3", "embervale", "playing", "u1", "aa9q2m8w1k", 4);
  const asked: string[] = [];
  const ASSETS = { fetch: async (req: Request) => (asked.push(new URL(req.url).pathname), new Response(lobby, { status: 200, headers: { "content-type": "text/html" } })) };
  const env = { ASSETS, DB } as unknown as Env;
  const get = (path: string, ua: string, ip = "1.2.3.4") => worker.fetch(new Request(`https://conquerra.overconfidenceonline.com${path}`, { headers: { "user-agent": ua, "CF-Connecting-IP": ip } }), env);
  return { db, get, asked };
}
const SLACK = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const tag = (html: string, name: string) => new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`).exec(html)?.[1];

describe("the open-graph tags (session 35)", () => {
  it("the lobby's own: a title, the tagline, the 1200 by 630 painting, the twitter card", () => {
    expect(tag(lobby, "og:title")).toBe("Conquerra");
    expect(tag(lobby, "og:description")).toBe("A fantasy strategy game: set your orders, lock in, and watch everyone's plans collide.");
    expect(tag(lobby, "og:image")).toBe("https://conquerra.overconfidenceonline.com/og/conquerra.jpg");
    expect([tag(lobby, "og:image:width"), tag(lobby, "og:image:height")]).toEqual(["1200", "630"]);
    expect(tag(lobby, "twitter:card")).toBe("summary_large_image");
    const image = readFileSync(join(web, "public/og/conquerra.jpg"));
    expect(image.length).toBeLessThan(300 * 1024);
    // (A JPEG's own size, from its frame header.)
    const sof = image.findIndex((b, i) => b === 0xff && (image[i + 1] === 0xc0 || image[i + 1] === 0xc2));
    expect([image.readUInt16BE(sof + 7), image.readUInt16BE(sof + 5)]).toEqual([1200, 630]);
  });

  it("a crawler fetching an invite link gets the table's words: the host, the map, the seats", async () => {
    const { get } = setup();
    const html = await (await get("/?join=k3f9q2m8w1", SLACK)).text();
    expect(tag(html, "og:title")).toBe("Nate invites you to Conquerra");
    expect(tag(html, "og:description")).toBe("Nate invites you to a game of Conquerra on Rootholm, 8 seats.");
    expect(tag(html, "twitter:description")).toBe("Nate invites you to a game of Conquerra on Rootholm, 8 seats.");
    expect(html).toContain("<title>Nate invites you to Conquerra</title>");
    // The rest of the page is the page (the image, the scripts).
    expect(tag(html, "og:image")).toBe(tag(lobby, "og:image"));
    expect(html.replace(/<meta[^>]*>|<title>[^<]*<\/title>/g, "")).toBe(lobby.replace(/<meta[^>]*>|<title>[^<]*<\/title>/g, ""));
    // A random map by its size; a name with markup in it is escaped, never markup.
    const random = await (await get("/?join=zz9q2m8w1k", "facebookexternalhit/1.1")).text();
    expect(tag(random, "og:description")).toBe("Kit &lt;b&gt;&quot;the bold&quot;&lt;/b&gt; invites you to a game of Conquerra on a random map of 300 territories, 20 seats.");
    expect(random).not.toContain("<b>");
  });

  it("nothing that isn't already on the invite: no email, no seed, nobody else at the table; a game under way, a wrong code or no code get the lobby's tags", async () => {
    const { get } = setup();
    const html = await (await get("/?join=k3f9q2m8w1", SLACK)).text();
    expect(html).not.toContain("nkurtz");
    expect(html).not.toContain("quiet-heron");
    for (const path of ["/?join=aa9q2m8w1k", "/?join=nosuchcode1", "/?join=BAD!", "/"]) expect(await (await get(path, SLACK)).text(), path).toBe(lobby);
  });

  it("a person gets the page exactly as it is, the invite link too", async () => {
    const { get, asked } = setup();
    expect(await (await get("/?join=k3f9q2m8w1", CHROME)).text()).toBe(lobby);
    expect(asked).toEqual(["/"]);
  });

  it("a crawler's lookups count against the address's 10 a minute, as the invite link's do: the 11th gets the lobby's tags", async () => {
    const { get } = setup();
    for (let i = 0; i < 10; i++) expect(tag(await (await get("/?join=k3f9q2m8w1", SLACK, "9.9.9.9")).text(), "og:title")).toBe("Nate invites you to Conquerra");
    expect(await (await get("/?join=k3f9q2m8w1", SLACK, "9.9.9.9")).text()).toBe(lobby);
    // Another address isn't held up by it.
    expect(tag(await (await get("/?join=k3f9q2m8w1", SLACK, "8.8.8.8")).text(), "og:title")).toBe("Nate invites you to Conquerra");
  });

  it("knows the chat apps' crawlers, not a browser; the words are in the voice", () => {
    for (const ua of [SLACK, "facebookexternalhit/1.1", "Twitterbot/1.0", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)", "WhatsApp/2.23.20.0", "TelegramBot (like TwitterBot)", "LinkedInBot/1.0", "Mozilla/5.0 (Macintosh) AppleWebKit (KHTML, like Gecko) Applebot/0.1"]) expect(isCrawler(ua), ua).toBe(true);
    for (const ua of [CHROME, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", "", null]) expect(isCrawler(ua)).toBe(false);
    expect(mapWords("krakenmere")).toBe("Krakenmere");
    for (const text of [OG_TEXT.title("Nate"), OG_TEXT.description("Nate", "Rootholm", 8), OG_TEXT.friend]) expect(problems({ file: "openGraph.ts", text, speaker: false })).toEqual([]);
    expect(withTags('<meta property="og:title" content="x" />', "A & B", "d")).toBe('<meta property="og:title" content="A &amp; B" />');
  });
});
