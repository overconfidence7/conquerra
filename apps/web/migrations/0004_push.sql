-- Session 29: "your turn" notifications. A browser's push subscription (one row each: a person can have the phone and
-- the laptop), and whether a person wants an email when it's their turn in a long game (1 h turns and up).
-- Applied by `pnpm deploy:preview`.
CREATE TABLE push_subs (
  -- The push service's address for this browser (unique: a browser that subscribes again replaces its row).
  endpoint TEXT PRIMARY KEY,
  user TEXT NOT NULL REFERENCES users(id),
  -- The browser's public key and auth secret (base64url): the room encrypts each message for this browser only.
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  made INTEGER NOT NULL
);
CREATE INDEX push_subs_user ON push_subs (user);

ALTER TABLE users ADD COLUMN turn_email INTEGER NOT NULL DEFAULT 0;
