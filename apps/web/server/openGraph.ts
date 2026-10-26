import { parseRandomId, RANDOM_PREFIX } from "@conquerra/mapgen/randomId";
import type { Env } from "./env";
import { mapNameOf } from "./online";
import { joinGate } from "./safety";

/**
 * Session 35: the preview a chat app shows for a shared link. The lobby's tags sit in index.html (the painting, the
 * tagline); for a crawler fetching an invite link (`/?join=<code>`) the Worker fills in the table's own words: the
 * host's name, the map and the seats, which anyone with the link sees on the table screen anyway. A person gets the
 * page as it is. The work is one database lookup and a few string replacements (the Free plan's 10 ms).
 *
 * Cloudflare Access sits in front of the preview until session 36, so a chat app's crawler gets Access's sign-in page,
 * not this, until then.
 */

/** The link-preview fetchers of the chat apps and social sites (their user agents). */
const CRAWLERS = /facebookexternalhit|facebot|meta-externalagent|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|skypeuripreview|microsoftpreview|applebot|redditbot|pinterest|embedly|iframely|mastodon|bluesky|cardyb|signal|vkshare|googlebot|bingbot|duckduckbot|snapchat|line\//i;
export const isCrawler = (ua: string | null | undefined) => !!ua && CRAWLERS.test(ua);

export const OG_TEXT = {
  title: (host: string) => `${host} invites you to Conquerra`,
  description: (host: string, map: string, seats: number) => `${host} invites you to a game of Conquerra on ${map}, ${seats} seats.`,
  friend: "A friend",
} as const;

/** The map as a sentence names it: "Rootholm", or "a random map of 300 territories". */
export function mapWords(mapId: string): string {
  const r = mapId.startsWith(RANDOM_PREFIX) ? parseRandomId(mapId) : null;
  return r ? `a random map of ${r.size} territories` : mapNameOf(mapId);
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The lobby's HTML with the title and description tags (and <title>) replaced. */
export function withTags(html: string, title: string, description: string): string {
  const t = escape(title), d = escape(description);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta (?:property|name)="(?:og|twitter):title" content=")[^"]*(")/g, `$1${t}$2`)
    .replace(/(<meta (?:property|name)="(?:og|twitter):description" content=")[^"]*(")/g, `$1${d}$2`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`);
}

/** A crawler's request for the game's page: an invite link gets its table's words, anything else the lobby's tags. */
export async function openGraph(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new Request(new URL("/", url), { headers: request.headers }));
  const code = url.searchParams.get("join") ?? "";
  if (!/^[a-z0-9]{6,24}$/.test(code) || page.status !== 200) return page;
  // (Looking a code up counts against the address's 10 a minute, as the invite link itself does: a crawler's user
  // agent is no way round the cap on guessing codes.)
  if (await joinGate(env.DB, request.headers.get("CF-Connecting-IP") ?? "local", Date.now())) return page;
  const table = await env.DB.prepare("SELECT g.map AS map, g.size AS size, g.status AS status, u.name AS host FROM games g LEFT JOIN users u ON u.id = g.host_user WHERE g.invite = ?")
    .bind(code)
    .first<{ map: string; size: number | null; status: string; host: string | null }>();
  if (!table || table.status !== "waiting") return page;
  const host = table.host?.trim() || OG_TEXT.friend;
  const html = withTags(await page.text(), OG_TEXT.title(host), OG_TEXT.description(host, mapWords(table.map), table.size ?? 0));
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
