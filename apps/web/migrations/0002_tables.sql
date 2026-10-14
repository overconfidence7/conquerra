-- Session 27 (M4): friends at the table. A game is made as a table waiting for players (status 'waiting'), with an
-- invite code for its link, and starts when its host says so. Games from session 26 keep working: they have no code
-- and no size, and every seat in them is 'in'. Applied by `pnpm deploy:preview`.

-- The invite code (the link is /?join=<code>): unguessable, one table each. Null for games from session 26.
ALTER TABLE games ADD COLUMN invite TEXT;
CREATE UNIQUE INDEX games_by_invite ON games(invite);
-- How many seats the table has (the host and the opponents the lobby asked for).
ALTER TABLE games ADD COLUMN size INTEGER;
-- games.status now also takes 'waiting' (a table not started yet) and 'cancelled' (its host cancelled it).

-- A person's seat: 'in', 'resigned' (they left the game) or 'taken' (a Marshal took it after three missed turns).
ALTER TABLE seats ADD COLUMN state TEXT NOT NULL DEFAULT 'in';
