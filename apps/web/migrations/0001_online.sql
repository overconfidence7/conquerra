-- Session 26 (M4): accounts, online games and who sits where. Each game itself lives in its room (a Durable Object);
-- this is the list the lobby shows. Applied by `pnpm deploy:preview` (wrangler d1 migrations apply --remote).

-- People who have signed in (through Cloudflare Access: the email is the account).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- Their House colour (an index into the ten Houses), null until they pick one.
  colour INTEGER,
  created INTEGER NOT NULL
);

-- Online games (one room each).
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  map TEXT NOT NULL,
  -- The lobby's settings, as JSON.
  settings TEXT NOT NULL,
  -- 'playing' or 'over'.
  status TEXT NOT NULL,
  host_user TEXT NOT NULL REFERENCES users(id),
  created INTEGER NOT NULL,
  turn INTEGER NOT NULL,
  -- What the game list shows between turns: who the table is waiting on (JSON list of seats) and the clock.
  waiting TEXT NOT NULL DEFAULT '[]',
  deadline INTEGER,
  updated INTEGER NOT NULL,
  -- Provably fair: the seed's hash from the start, the seed itself and the winner's seat at game over.
  seed_hash TEXT NOT NULL,
  seed TEXT,
  winner TEXT
);

-- Who sits where: a person (user) or a bot (its level), with the House colour and name the game gave the seat.
CREATE TABLE seats (
  game TEXT NOT NULL REFERENCES games(id),
  seat TEXT NOT NULL,
  user TEXT REFERENCES users(id),
  bot TEXT,
  colour INTEGER NOT NULL,
  name TEXT NOT NULL,
  -- A person's choice: "If I miss a turn with no orders, my leaders run my House" (1 = on).
  leaders_run INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (game, seat)
);

CREATE INDEX seats_by_user ON seats(user);
