import type { LineReport } from "../src/host/roomCore";
import { SAFETY_LIMITS, SAFETY_TEXT } from "../src/host/safetyText";
import { FROM } from "./notify";
import { mapNameOf } from "./online";

/**
 * Session 34, abuse limits, on the server's side: reports (kept in D1's `reports` and sent to Nate's email), blocks
 * (D1's `blocks`, read by the room on hello), the daily cap on tables a person makes, and the cap on joins by invite
 * code from one address. Every check here is one or two small queries: the handlers stay far under their 10 ms of CPU.
 */

const DAY_MS = 24 * 3600 * 1000;
const CHAT_KIND: Record<LineReport["chat"], string> = { table: "the table chat", pair: "a one-to-one", group: "a group chat" };

/** The email a report sends Nate: the line, who wrote it, who reported it, the reason and when; nothing else of the game. */
export function reportEmail(r: LineReport, emails: { author: string | null; reporter: string | null }, to: string): { subject: string; raw: string } {
  const subject = `Conquerra report: ${r.reason} (${r.authorName})`;
  const when = (t: number) => new Date(t).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  // (A header holds one line: anything a player typed is kept out of the headers.)
  const body = [
    "A chat line was reported.",
    "",
    `Line: "${r.text}"`,
    `Written by: ${r.authorName}${emails.author ? ` (${emails.author})` : ""}, ${when(r.writtenAt)}`,
    `In: ${CHAT_KIND[r.chat]}, game ${r.gameId} (${mapNameOf(r.map)})`,
    `Reason: ${r.reason}`,
    ...(r.words ? [`Their words: "${r.words}"`] : []),
    `Reported by: ${r.reporterName}${emails.reporter ? ` (${emails.reporter})` : ""}, ${when(r.at)}`,
    "",
  ].join("\r\n");
  const raw = [`From: Conquerra <${FROM}>`, `To: <${to}>`, `Subject: ${subject.replace(/[\r\n]+/g, " ")}`, `Message-ID: <report-${r.gameId}-${r.line}-${r.at}@overconfidenceonline.com>`, `Date: ${new Date(r.at).toUTCString()}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", body].join("\r\n");
  return { subject, raw };
}

export interface SafetyDeps {
  db: D1Database;
  /** Send an email (the `send_email` binding), or null where there's none (`wrangler dev`). */
  mail: ((to: string, raw: string) => Promise<void>) | null;
  /** Nate's address (the `REPORTS_TO` secret); unset, a report is kept and logged but not mailed. */
  reportsTo: string | undefined;
  log(line: string): void;
}

/** What the room's shell gives the room (`RoomIO.safety`). */
export function roomSafety(d: SafetyDeps) {
  return {
    async blocksOf(user: string): Promise<string[]> {
      const rows = await d.db.prepare("SELECT blocked FROM blocks WHERE user = ?").bind(user).all<{ blocked: string }>();
      return (rows.results ?? []).map((r) => r.blocked);
    },
    async block(user: string, blocked: string, name: string): Promise<void> {
      await d.db.prepare("INSERT INTO blocks (user, blocked, name, made) VALUES (?, ?, ?, ?) ON CONFLICT(user, blocked) DO UPDATE SET name = excluded.name").bind(user, blocked, name, Date.now()).run();
    },
    async report(r: LineReport): Promise<string | null> {
      const day = await d.db.prepare("SELECT COUNT(*) AS n FROM reports WHERE reporter = ? AND made > ?").bind(r.reporter, r.at - DAY_MS).first<{ n: number }>();
      if ((day?.n ?? 0) >= SAFETY_LIMITS.reportsPerDay) return SAFETY_TEXT.reportsToday;
      const kept = await d.db
        .prepare("INSERT INTO reports (game, line, reporter, author, author_name, chat, text, reason, words, made) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(reporter, game, line) DO NOTHING")
        .bind(r.gameId, r.line, r.reporter, r.author, r.authorName, r.chat, r.text, r.reason, r.words ?? null, r.at)
        .run();
      if (!kept.meta.changes) return SAFETY_TEXT.reportedAlready;
      if (!d.mail || !d.reportsTo) {
        d.log(`report kept (no email: ${d.mail ? "REPORTS_TO isn't set" : "no email binding"})`);
        return null;
      }
      const who = await d.db.prepare("SELECT id, email FROM users WHERE id IN (?, ?)").bind(r.author, r.reporter).all<{ id: string; email: string }>();
      const emailOf = (id: string) => (who.results ?? []).find((u) => u.id === id)?.email ?? null;
      try {
        await d.mail(d.reportsTo, reportEmail(r, { author: emailOf(r.author), reporter: emailOf(r.reporter) }, d.reportsTo).raw);
      } catch (e) {
        // (The report is kept either way: a session can list them from D1.)
        d.log(`report email failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      return null;
    },
  };
}

/** The 21st table in 24 hours is refused (the sentence), else null. */
export async function tableCap(db: D1Database, user: string, now: number): Promise<string | null> {
  const made = await db.prepare("SELECT COUNT(*) AS n FROM games WHERE host_user = ? AND created > ?").bind(user, now - DAY_MS).first<{ n: number }>();
  return (made?.n ?? 0) >= SAFETY_LIMITS.tablesPerDay ? SAFETY_TEXT.tablesToday : null;
}

/** A join by invite code from this address: counted by the minute; the 11th in a minute is refused (the sentence). */
export async function joinGate(db: D1Database, ip: string, now: number): Promise<string | null> {
  const minute = Math.floor(now / 60_000);
  const [, hit] = await db.batch<{ n: number }>([
    db.prepare("DELETE FROM join_hits WHERE ip = ? AND minute < ?").bind(ip, minute),
    db.prepare("INSERT INTO join_hits (ip, minute, n) VALUES (?, ?, 1) ON CONFLICT(ip, minute) DO UPDATE SET n = n + 1 RETURNING n").bind(ip, minute),
  ]);
  return (hit?.results?.[0]?.n ?? 0) > SAFETY_LIMITS.joinsPerMinute ? SAFETY_TEXT.joinsTooFast : null;
}

/** Settings' "Blocked players": the people you blocked, by the name they had (never their account). */
export async function blockList(db: D1Database, user: string): Promise<{ id: number; name: string; made: number }[]> {
  const rows = await db.prepare("SELECT rowid AS id, name, made FROM blocks WHERE user = ? ORDER BY made DESC").bind(user).all<{ id: number; name: string; made: number }>();
  return rows.results ?? [];
}

/** Unblock one (by the list's id: your own rows only). */
export async function unblock(db: D1Database, user: string, id: number): Promise<void> {
  await db.prepare("DELETE FROM blocks WHERE rowid = ? AND user = ?").bind(id, user).run();
}
