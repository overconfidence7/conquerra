-- Session 28: the turn a person left their seat on (resigned, or a Marshal took it), so the lobby's Finished list can
-- say "You left on turn 2" rather than the game's current turn. Null for seats still in and for older games.
-- Applied by `pnpm deploy:preview`.
ALTER TABLE seats ADD COLUMN left_turn INTEGER;
