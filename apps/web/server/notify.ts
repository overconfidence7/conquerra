import { pushRequest, type PushSub, type Vapid } from "./webPush";

/**
 * "Your turn" (session 29): the room calls this when a planning window opens for people whose page isn't open, once a
 * turn each. A push to every browser they turned it on in, and, in a long game (1 h turns and up), an email if they
 * asked for one. Nothing fogged ever goes in either: the map's name and the turn number, and a link to the game.
 *
 * The room hands this to `waitUntil`, so it never holds up a turn. No Cloudflare-only imports here (the email itself is
 * sent by `mail`, which the room passes in), so tests run it in Node with a fake push service and database.
 */

export interface TurnNotice {
  gameId: string;
  turn: number;
  /** The map's name ("Embervale"). */
  map: string;
  /** The accounts to tell. */
  users: string[];
  /** The turn's length (s): a long game (an hour or more) may email too, and a push waits at most this long. */
  turnSeconds: number;
}

/** The words, exactly (the voice guide applies; nothing fogged). */
export const TURN_TEXT = {
  title: "Your turn in Conquerra",
  line: (map: string, turn: number) => `Your turn in Conquerra: ${map}, turn ${turn}`,
  body: (map: string, turn: number) => `${map}, turn ${turn}`,
  emailOff: "You asked for these emails in the game's Settings. You can turn them off there.",
} as const;

/** An email of an hour's turns or longer. */
export const LONG_TURN_S = 3600;
export const FROM = "conquerra@overconfidenceonline.com";
const SITE = "https://conquerra.overconfidenceonline.com";

export interface NotifyDeps {
  db: D1Database;
  vapid: Vapid | null;
  fetch: (req: Request) => Promise<Response>;
  /** Send one plain-text email (null: no email binding). */
  mail: ((to: string, subject: string, raw: string) => Promise<void>) | null;
  now: number;
  log: (line: string) => void;
}

/** A plain-text email, as raw MIME (Email Routing's `send_email` takes the message whole). */
export function turnEmail(to: string, map: string, turn: number, gameId: string, now: number): { subject: string; raw: string } {
  const subject = TURN_TEXT.line(map, turn);
  const id = `<turn-${gameId}-${turn}-${now}@overconfidenceonline.com>`;
  const body = [TURN_TEXT.line(map, turn), "", `${SITE}/?game=${gameId}`, "", TURN_TEXT.emailOff, ""].join("\r\n");
  const raw = [`From: Conquerra <${FROM}>`, `To: <${to}>`, `Subject: ${subject}`, `Message-ID: ${id}`, `Date: ${new Date(now).toUTCString()}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", body].join("\r\n");
  return { subject, raw };
}

/** Addresses an email to couldn't reach (not verified yet, on the Free plan): logged once each, then quietly skipped. */
const failedOnce = new Set<string>();

export async function notifyTurn(n: TurnNotice, d: NotifyDeps): Promise<{ pushed: number; removed: number; emailed: number }> {
  let pushed = 0, removed = 0, emailed = 0;
  if (!n.users.length) return { pushed, removed, emailed };
  const marks = n.users.map(() => "?").join(",");
  if (d.vapid) {
    const subs = await d.db.prepare(`SELECT endpoint, p256dh, auth FROM push_subs WHERE user IN (${marks})`).bind(...n.users).all<PushSub>();
    const message = JSON.stringify({ title: TURN_TEXT.title, body: TURN_TEXT.body(n.map, n.turn), url: `/?game=${n.gameId}`, tag: `turn-${n.gameId}` });
    for (const sub of subs.results ?? []) {
      try {
        const res = await d.fetch(await pushRequest(sub, message, d.vapid, Math.floor(d.now / 1000), Math.min(n.turnSeconds, 24 * 3600), `turn-${n.gameId}`));
        // Gone (the browser unsubscribed, or the app was removed): the subscription goes too.
        if (res.status === 404 || res.status === 410) {
          await d.db.prepare("DELETE FROM push_subs WHERE endpoint = ?").bind(sub.endpoint).run();
          removed++;
        } else if (res.ok) pushed++;
        else d.log(`push to ${new URL(sub.endpoint).hostname} answered ${res.status}`);
      } catch (e) {
        d.log(`push failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  if (n.turnSeconds >= LONG_TURN_S && d.mail) {
    const rows = await d.db.prepare(`SELECT email FROM users WHERE id IN (${marks}) AND turn_email = 1`).bind(...n.users).all<{ email: string }>();
    for (const { email } of rows.results ?? []) {
      if (failedOnce.has(email)) continue;
      const m = turnEmail(email, n.map, n.turn, n.gameId, d.now);
      try {
        await d.mail(email, m.subject, m.raw);
        emailed++;
      } catch (e) {
        // (The Free plan delivers only to addresses verified in Email Routing: anyone else fails here, once.)
        failedOnce.add(email);
        d.log(`turn email to ${email.replace(/^(.).*@/, "$1…@")} couldn't be sent: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { pushed, removed, emailed };
}
