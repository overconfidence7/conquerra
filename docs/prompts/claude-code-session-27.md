# Claude Code: Session 27 (M4, part two: friends at the table)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs Wrangler (logged in there), his browser and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session puts friends at the table.** Session 26 built the server: a game room per game, one person against bots, reconnecting, the clock, missed turns run by the leaders. Now: **a game link, friends taking seats with their own colours, the host starting the game, several people's clocks, bot takeover for quitters, resigning, a display name, and a games list that stays tidy.** At the end Nate and one friend finish a game on the preview. The plan is `docs/10-online-plan.md` (§3 to §5, §8, and "Nate's calls" at the end). Deals between people, pause by vote and chat are sessions 28 and 29: don't start them.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1 to 3 each end with a deploy,** so the session is complete at any of those boundaries. Whatever isn't reached becomes session 27b; say what's left. Nate may be playing the preview while you work (and friends may be, after Part 1), so every deploy must be a working build, and **a game already running on the server must survive a deploy** (the room's save is the same between versions, or you migrate it and say so).

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 14: Orchestrator review of sessions 25b and 26" (the nits for Step 0, the orchestrator's online test, his answers to your two questions), "Oct 13 and 14: Claude Code session 26", and any "Nate's play test" entry after 26
3. **`docs/10-online-plan.md`** (§3 the clock and away players, §4 seats, colours and the lobby, §8 fair and safe, "Nate's calls"; the BUILT block for 26)
4. `docs/infra-cloudflare.md` (the M4 section as 26 left it; "Nate's steps": Workers Builds may or may not be connected by now, and friends' emails go into the Access policy "Conquerra players")
5. `docs/decisions.md`, the Oct 13 to 14 lines at the bottom
6. `docs/rules-reference.md` ("Online")
7. The code: `apps/web/server/` (`api.ts`: the routes; `gameRoom.ts`; `access.ts`; `online.ts`), `apps/web/src/host/roomCore.ts` (the room's logic), `localGame.ts` (a table of people: `PersonSeat`), `remoteHost.ts` and `onlineActions.ts` (the page's side), `protocol.ts`, `apps/web/migrations/0001_online.sql` (users, games, seats), `apps/web/test/room.test.ts`, `fog-wire.test.ts` and `roomHelpers.ts` (extend these; never weaken the fog test), `apps/web/src/ui/Lobby.tsx` (the Online block and the colour row under Your House), the players panel (`PlayersPanel.tsx`), Settings (`GameScreen.tsx`'s popover)

## Step 0: sync and the small fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **The lobby's version label lags one commit** (the build runs before the deploy's commit exists): show the Wrangler version id beside the commit, or make `pnpm deploy:preview` build after committing; either way the label must identify the build that's live.
3. **The header clock during a replay** sits at a frozen "5:00": while the next window hasn't opened, show the replay's own state ("Replay") and start the countdown only when the window opens. Online and single player alike.
4. **The turn report's gold line:** "Income +12, upkeep –0: you now have 23 gold" when the header shows 22, because the purse's take comes off after the line is written. Write the line after the purses (or say "22, after 1 to your Steward's purse"), and drop "upkeep –0" when upkeep is zero. The voice test applies.
5. **After a missed turn, the budgets return to the player's own** (the orchestrator's answer to your question; Nate can overrule): the leaders' 80/20 was a stand-in for that turn, and the player's own Run the military / Run the realm settings and budgets come back when they lock in a turn themselves. The card for the missed turn says what happened, as now. A test.
6. **If Nate's phone notes after 26 are in `PROGRESS.md`**, do the small ones here; list the rest for the orchestrator.
7. **Commit and push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Only `viewFor` leaves the room.** Extend `fog-wire.test.ts` to a table with three people (one who never joins, so her seat becomes a bot) and keep it passing; the new messages (seats, colours, names, the invite state, takeover notices) go through its whitelist and its text search. Anything a seat is sent about another seat is what the players panel already shows (name, colour, in or out, person or bot), never territory counts, orders or the queue.
- **The room is authoritative** for seats as for turns: the host's Start, a seat taken, a colour picked, a resignation, a takeover all happen in the room (and are mirrored to D1 for the lists), never only in D1.
- **Sign-in is Access, nothing else;** a friend whose email isn't in the policy can't reach the page at all, and that's the guest list. The invite code grants a seat, not sign-in.
- **The Free plan stays:** nothing heavy in the Worker's handlers; the room's CPU per turn logged as in 26; say in the summary if any limit error appeared.
- **Single player untouched;** the start-up bundle **gets a new allowance: within 2 KB of 494.5 KB** (26 used the old one up); the online code keeps loading after the lobby's first paint.
- **Every new line a player reads** follows `docs/voice-guide.md` (the test enforces the hard rules).

## Part 1: a game link, seats and colours, the host starts (the first deploy)
1. **Making a game** no longer starts it. "New online game" makes a **table** with the lobby's settings and an **invite code** (short, unguessable), and shows the host **the table screen**: the link to copy or share (the phone's share sheet where it exists), the seats (the host in the first, with their colour), the timer, the missed-turn choice, "Start" (enabled once at least one friend is seated, or at once with "Start with bots" for testing), and "Cancel the table".
2. **Joining:** a friend opens the link (`/?join=<code>`), signs in through Access (they must already be in the policy: write the host-facing line, "Ask Nate to add your email" won't do for strangers later, but for M4 the host is Nate), lands on the table screen, **picks a House colour** from the ten (the ones still free; the host picked first), and takes a seat. The table screen updates live for everyone at it (the room's WebSocket, the same contract). A friend can leave before the start; the host can remove a seat before the start (never after).
3. **Starting:** the host presses Start; empty seats become bots at the lobby's level; the room deals capitals with the seat rule (harder spots to bots first); everyone at the table screen goes straight into turn 1. Late friends with the link after the start get "This game has started" and a spectator-free "no": they can't join a started game in M4.
4. **Colours:** `users.colour` is the player's usual colour, used as the default when they sit; the seat's colour is what the game uses; two people never share one; a bot takes from the rest.
5. **Display name:** Settings gets a "Your name" field (saved to `users.name`); the table screen and the players panel use it; the default stays the email's first part.
6. **The lobby's "Your online games"** lists tables waiting to start ("Waiting for players, 2 of 4 seated"), games in play ("Turn 8, waiting on you, 3 min left"), and hides finished ones under "Finished" (or after a week); **"Leave this game"** on a running game resigns (Part 2's rule) and takes it off your list.
7. **Tests:** the table's life (made, seats taken, colours unique, a seat left, the host removes one, Start fills bots, a late join refused), the invite code (unguessable, one table), the fog test with three people, the D1 mirror. **Deploy. Commit and push.** Then **Nate's first real table:** he makes a game, sends the link to one friend (after adding the friend's email to the Access policy: the steps in the infra doc), and they play turn 1. Screenshots: the table screen (host and guest, desktop and phone), the players panel with two people.

## Part 2: the clocks for several people, bot takeover, resign (the second deploy)
1. **The clocks:** the window ends when every person still in has locked in, or at the deadline; the next window opens after the longest replay plus 10 s (as 26 built it for one person); a person who reconnects mid-window sees the true time left. Check the two-people test in `room.test.ts` against a third person who never connects.
2. **Missed turns:** as 26 built them, per seat (the choice is each player's). **Bot takeover:** after **three missed turns in a row**, or on resign, a Marshal with the Neutral personality takes the seat for the rest of the game; the players panel shows "(bot)" after the name, in the seat's colour; a notice tells the table ("Lady Morwen's seat is a Marshal's now."). Before the third miss the player can come back and the counter resets. After it, they can open the game and watch (their own view as the seat sees it; no orders). A resigned or taken-over seat's "Your online games" entry moves to Finished.
3. **The game-over screen** names people and bots as they were, and the result row in D1 says who resigned or was taken over.
4. **"Where are we" trimmed:** the Chronicle no longer travels whole with every hello (26's 104 KB by turn 31 on Rootholm); the page keeps its own Chronicle and asks only for the turns it lacks.
5. **Tests:** three missed turns then the takeover, the reset on return, resign, watching after, the trimmed hello (bytes bounded by the turn's own size). **Deploy. Commit and push.** Nate and his friend play on; one of them leaves for three turns on purpose.

## Part 3: deploys from GitHub, if still not connected, and the online polish (the third deploy)
1. **Workers Builds:** if Nate has connected it (his step), check one deploy made that way shows the right version in the lobby; if not, leave his steps as they are and say so.
2. **The polish an online table shows up:** the "Reconnected" notice never stacks; a friend's late lock-in shows in the players panel ("locked in" ticks per person, as the design's "no territory counts" allows); the turn-sweep says whose turn it's waiting on in the lobby list; the table screen on the phone.
3. **Deploy. Commit and push.**

## Part 4 (can slip to 27b): spectating a finished game, and the test harness for a table
1. A finished online game opens to its game-over screen and lets you watch any turn's replay (your own view), as single player's "Watch again" does.
2. A script that plays a table of two people and bots against the preview headlessly (two signed-in sessions are Nate's problem: the script can use `wrangler dev` locally with the Access check stubbed in dev only, never in the deployed Worker), for the next sessions' tests. **Commit and push.**

## Last: the write-up, the test list
- `docs/10-online-plan.md`: a BUILT block for 27 (the table's life, the clock rules as built, takeover, what changed from the plan). `docs/rules-reference.md` ("Online": a game link, seats, colours, resign and takeover, in plain words). `docs/infra-cloudflare.md` if anything changed (Workers Builds, the Access policy steps for friends). `docs/decisions.md`: one line per decision.
- **"Things to test after session 27"** in `PROGRESS.md`, most important first (a game with two friends on phones; a friend joining from the link; colours; leaving for three turns; resigning; the lists). Carry over what Nate hasn't tried from "after session 26" and before (the phone online test, the overnight game, holding a wall, a weak spot).
- `PROGRESS.md` (sessions completed: 27), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 28 and 29)
- Deals between people, pause by vote, chat for people (28); chat for bots and leaders, notifications (29).
- Spectators who aren't at the table, rankings, public sign-up, R2 (M5 and after).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The fog-on-the-wire test passes with three people; the room's table tests pass; the start-up bundle within 2 KB of 494.5 KB; the lock check passes on every deploy.
- Nate and one friend have finished a game, or at least played several turns, on the preview from a link.
- Every deploy a working build with running games surviving it; the docs and the test list above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 27b)
- the table's life in one paragraph (made, joined, started), and the invite link's shape
- the clock and takeover rules as built, and anything built differently from the plan, and why
- CPU per turn in the room with two people, the hello's size after the trim, the start-up bundle
- whether Nate's friend joined and what happened; whether Workers Builds is connected
- the deployed version
