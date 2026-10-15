import type { RoomInfo, TableMirror } from "../src/host/roomCore";

/**
 * The database's copy of what the room decides (session 26's game line, session 27's table). The room is the
 * authority; this copy is what the lobby's lists read. No Cloudflare-only imports, so tests run it on a real SQLite
 * database with the migrations applied.
 */

/** The game list's line: the turn, who it's waiting on, the clock, and at the end the winner and the seed. */
export async function mirrorGame(db: D1Database, info: RoomInfo, now = Date.now()): Promise<void> {
  try {
    await db
      .prepare("UPDATE games SET turn = ?, status = ?, waiting = ?, deadline = ?, updated = ?, seed = ?, winner = ?, seed_hash = ? WHERE id = ?")
      .bind(info.turn, info.status, JSON.stringify(info.waitingOn), info.deadline, now, info.seed ?? null, info.winner, info.seedHash, info.gameId)
      .run();
  } catch (e) {
    console.log(`game list update failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The table: its state, and who sits where (people, then bots once it starts). */
export async function mirrorTable(db: D1Database, m: TableMirror, now = Date.now()): Promise<void> {
  try {
    await db.batch([
      db.prepare("UPDATE games SET status = ?, size = ?, updated = ? WHERE id = ?").bind(m.status, m.size, now, m.gameId),
      db.prepare("DELETE FROM seats WHERE game = ?").bind(m.gameId),
      ...m.seats.map((s) => db.prepare("INSERT INTO seats (game, seat, user, bot, colour, name, leaders_run, state, left_turn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(m.gameId, s.seat, s.user, s.bot, s.colour, s.name, s.leadersRun ? 1 : 0, s.state ?? "in", s.leftTurn ?? null)),
      // The colour each person last picked is their usual one (the default when they next sit down).
      ...m.seats.flatMap((s) => (s.user && m.status === "waiting" ? [db.prepare("UPDATE users SET colour = ? WHERE id = ?").bind(s.colour, s.user)] : [])),
    ]);
  } catch (e) {
    console.log(`table copy failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
