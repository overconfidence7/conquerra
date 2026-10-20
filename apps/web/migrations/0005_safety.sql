-- Session 34: abuse limits. Applied by `pnpm deploy:preview`.

-- A chat line someone reported (it also goes to Nate's email). Only the line itself is kept: who wrote it, the words,
-- the reason; nothing else of the game. A person reports a line once (the primary key), three a day at most.
CREATE TABLE reports (
  game TEXT NOT NULL,
  -- The line's id in the game's chat (the time it was written, ms).
  line INTEGER NOT NULL,
  reporter TEXT NOT NULL REFERENCES users(id),
  -- The account that wrote the line, and the name it went by then.
  author TEXT NOT NULL,
  author_name TEXT NOT NULL,
  -- 'table', 'pair' or 'group': which kind of chat it was in.
  chat TEXT NOT NULL,
  text TEXT NOT NULL,
  -- 'abuse', 'spam', 'cheating' or 'other', and the reporter's own words (120 characters at most).
  reason TEXT NOT NULL,
  words TEXT,
  made INTEGER NOT NULL,
  PRIMARY KEY (reporter, game, line)
);
CREATE INDEX reports_by_day ON reports(reporter, made);

-- Who a person blocked: the blocked person's chat lines never reach them (the room filters on the way out). Deals
-- still do. The blocked person is never told. A block outlives the game; Settings lists them (by the name they had).
CREATE TABLE blocks (
  user TEXT NOT NULL REFERENCES users(id),
  blocked TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  made INTEGER NOT NULL,
  PRIMARY KEY (user, blocked)
);

-- Joins by invite code, counted by address and minute (10 a minute at most); old minutes are cleared as it goes.
CREATE TABLE join_hits (
  ip TEXT NOT NULL,
  minute INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (ip, minute)
);

-- The daily cap on tables a person hosts counts their games made today.
CREATE INDEX games_by_host ON games(host_user, created);
