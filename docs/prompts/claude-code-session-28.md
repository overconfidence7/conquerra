# Claude Code: Session 28 (M4, part three: deals between people, chat, pause by vote)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs Wrangler (logged in there), his browser and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session makes a table of friends a real game of diplomacy.** Session 27 put friends at the table: a game link, seats and colours, the clock for several people, takeover and resign. Now: **deals between people** (today an offer only works with a bot), **chat for people** (the table, one-to-one, and private group chats any player makes to scheme against the rest), and **pause by vote**. The plan is `docs/10-online-plan.md` (§5, §6 step one, "Nate's calls"). Chat for bots and leaders and notifications are session 29: don't start them.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1 to 3 each end with a deploy,** so the session is complete at any of those boundaries. Whatever isn't reached becomes session 28b; say what's left. Nate and his friends may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy** (the room's save keeps its shape; a new storage key is fine, a changed one needs a migration you describe).

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 14: Orchestrator review of session 27" (the blank-page cache bug, the gold line, the nits for Step 0), "Oct 14: Claude Code session 27", and any "Nate's play test" entry after 27
3. **`docs/10-online-plan.md`** (§5 deals and pause, §6 chat step one, §8 fair and safe, "Nate's calls"; the BUILT blocks for 26 and 27)
4. `docs/04-design-additions.md` §13 "Chat" (the look: a sidebar of chats, the selected chat, a small pop-up; two screens on a phone), §10 (pause), §2 (deals)
5. `docs/decisions.md`, the Oct 13 to 14 lines at the bottom
6. `docs/rules-reference.md` ("Online", "Deals")
7. `docs/voice-guide.md` (every line the game writes; players' own messages are theirs)
8. The code: `apps/web/src/host/roomCore.ts` (the room: the table, hello, lock-in, resolve, takeover), `localGame.ts` (`botTalks`, `propose`, `agreed` and `agreedIn`: how a deal needs a `propose` and an `answer` order from both sides; `pause()` for single player), `protocol.ts` (`RoomRequest`, `RoomMessage`, `offers` on an update), `remoteHost.ts` and `onlineActions.ts`, `apps/web/server/api.ts` and `gameRoom.ts`, `apps/web/src/ui/Deals.tsx` (the deals panel and the bots' offers), `GameScreen.tsx` (Settings, the header clock), `TopBar.tsx`, `Toasts.tsx`, `BottomSheet.tsx`, `TableScreen.tsx`, `apps/web/test/room.test.ts`, `fog-wire.test.ts` and `roomHelpers.ts` (extend these; never weaken the fog test), `scripts/table-harness.mjs` (plays a two-person table against `wrangler dev`), `packages/engine/src/diplomacy.ts` and `dealText.ts`, `packages/bots/src/diplomacy.ts` (`negotiate`)

## Step 0: sync and the fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **A missing asset must never be the HTML fallback.** The preview came up blank for the orchestrator: `apps/web/public/_headers` gives `/assets/*` a one-year immutable cache, and `not_found_handling: "single-page-application"` answers a missing `/assets/…` path with the lobby's HTML under that header, which Cloudflare's edge, the browser (for a year) and the service worker's precache then keep. Fix: the Worker runs first for `/assets/*` too (`run_worker_first`), asks the assets binding, and if the answer isn't the file (HTML for a `.js`, `.css`, `.woff2`… path, or a 404) answers **404 with `Cache-Control: no-store`**, never the fallback. A test with a fake assets binding. Then **a failed chunk load reloads the page once** (`vite:preloadError`, with a flag in `sessionStorage` so it never loops; a second failure shows a plain line, "Something didn't load. Reload the page."). Deploy this fix first, on its own, and check live: `/assets/nothing.js` answers 404 and the lobby, a table and a game load with a cleared cache. Say in the summary whether the poisoned entries at the edge are gone (the old URLs no longer answer HTML).
3. **The gold line, the rest of the fix:** the turn report card still says "Income +10: you now have 10 gold" with "Into purses: 1 gold to your Steward." on its own line, while the header says 9. `narrate.ts` folds the purses into `incomeLine` on the replay log's path only; the report card still goes through `narrate()` with `null`. One path for both, and a test on the report card with a Steward at 10% (20 gold, 10 recruits, income 10, 1 to the purse: "you now have 9 gold, after 1 to your Steward's purse").
4. **Settings online:** the "Leave this game" button's label wraps to three lines and collides with its note; "it goes on on the server" reads badly. Two short buttons with one-line notes under them ("Leave: the game goes on without you here. Open it again from the lobby." and "Resign: a Marshal takes your seat.").
5. **The Finished list:** a row for a game that has since ended says "You left this game on turn 17. It goes on without you." while its result screen shows the winner. The row says the result once the game is over ("Over: Lady Morwen won. You left on turn 2.") and the turn you left on, not the current turn.
6. **The Houses panel** truncates names ("Baron K…", "Queen I…") once the OUT badges and the Oathbreaker tag crowd it: let the badges wrap under the name, never the name.
7. **Small:** the single-player Start button reads "Starting…" while a table is being made (only "Make a game link" should go busy); the table screen's guest-list note shows a file path to players: make it the host's plain words ("Your friend's Google email has to be on the guest list first. Nate adds it in Cloudflare.") and keep the path in the infra doc only.
8. **If Nate's notes from his friend game are in `PROGRESS.md`**, do the small ones here; list the rest for the orchestrator.
9. **Commit, deploy, push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Only `viewFor` leaves the room, and now only your own chats and offers.** Extend `fog-wire.test.ts`: three people (Nate, Kit, Wren) and a watcher who never sat; Nate offers Kit a truce and Kit counters; Nate and Kit make a group chat and write in it; Wren asks for a pause. Whitelist the new fields, and search every page's messages for: the other chats' text and names, the existence of a group it isn't in, a trade's terms it isn't party to, and anyone's unanswered offer it isn't party to. A public deal (both sides agreed) reaches everyone the engine's events already reach, as a bot's deal does today.
- **The room is authoritative** for offers, chats and pauses: an offer is relayed by the room, an answer is an order the room holds, a message exists once the room stored it, a pause starts when the room says so. D1 mirrors nothing of chat (the game list needs none of it).
- **Players' own words are theirs:** the voice test doesn't read them, and the game never rewrites them. Every line the game adds (notices, buttons, cards) follows `docs/voice-guide.md`.
- **Nothing heavy in the Worker's handlers;** the room does the work. Chat storage is capped (below). Log CPU per turn as before and say if any limit error appeared.
- **Single player untouched** (its pause and saves as they are; chat with bots is 29). The start-up bundle **gets a new allowance: within 2 KB of 495.8 KB**; the deals-between-people, chat and pause code loads with the online code, after the lobby's first paint.
- **No new taps for a turn with chat ignored.** The chat button sits in the top bar with an unread count; nothing opens by itself except the small pop-up, which goes away on its own.

## Part 1: deals between people (the first deploy)
1. **An offer to a person** works like an offer to a bot on the proposer's side: the Deals panel's Propose lists people and bots, the proposer picks terms and the bond (handshake or binding) as today, may type **a short note** (120 characters, optional), and the `propose` order goes into their queue. **The room relays the offer at once** to the other person's page (`offers` on an update, as the bots' offers already arrive), with the note, as long as the window is open.
2. **The other person answers** in their Deals panel: accept (an `answer` order), **counter once** (terms of their own, back to the proposer, who accepts or declines; no second counter), or decline (the proposer is told at once, with no reason required: a person's decline is just "Kit said no"). Silence lapses at lock-in, as with bots. The deal starts at the resolution when both orders are there (`agreedIn`); the room checks the pair the way it checks a bot's.
3. **Withdrawing:** the proposer removing the `propose` order before lock-in withdraws it; the other page is told ("Nate withdrew the offer."). An offer to someone who has already locked in can't be answered: the Propose list says so next to the name ("locked in") and the offer isn't sent.
4. **Public as designed:** the turn report, the Chronicle and the players panel show deals between people as they show bots' deals today (trade terms private). Your leaders never answer for you (an away person's leaders decline nothing and accept nothing: the offer lapses).
5. **Bots and people together:** a bot's offers to each person, and each person's to a bot, as 26 built them; a person's offer to a person never goes through a bot's `negotiate`.
6. **Tests:** offer, accept, counter, decline, withdraw, lapse at lock-in, both orders make the deal, the fog test (an offer reaches its two parties only; the deal's news reaches the table). **Deploy. Commit and push.** Nate and a friend make a truce and a trade.

## Part 2: chat for people (the second deploy)
1. **Three kinds of chat**, all online only, all kept with the game in the room: **the table** (everyone, people and later bots), **one-to-one** (any two people), and **a group** any player makes by picking people at the table (the Houses panel or the chat's "New group"). A group is **private to its members: the others never see it, aren't told it exists, and can't join unless a member adds them;** members can add more people; anyone can start any number. A group's name is its members' names ("Nate, Kit") unless a member renames it (24 characters). A player who resigned or was taken over keeps reading the chats they're in but can't write ("You've left the game.").
2. **The table chat opens on the table screen**, before the game starts, so friends can talk while they wait, and the messages carry into the game.
3. **Messages:** plain text, 300 characters, no formatting, no links made clickable; at most one message every 2 seconds a person (the room refuses faster ones quietly). The room keeps up to **2,000 messages a game** under a `chat` key (the oldest dropped) and sends each seat only the chats it's in; on hello the page says the last message id it has (as `have` does for the Chronicle) and gets only the rest. A seat is told who's in a group it belongs to (names and colours), nothing else about anyone.
4. **The look (§13):** a chat button in the top bar with an unread count; on desktop a panel with **a sidebar listing your chats** (bold when unread, the table first, then groups, then one-to-one) and **the selected chat filling the rest**; on a phone **two screens** in the bottom sheet (the list, then the chat, with a back arrow). **A small pop-up** (the existing toasts, quiet style) when a message arrives while the panel is closed: who and the first words, tap to open, gone on its own in 6 s; never more than one on screen (the latest replaces it); none during the replay (they queue and show after). No sound this session.
5. **The Houses panel:** a chat bubble on each person (one-to-one) and "Group…" at the bottom (pick members with tick boxes).
6. **Tests:** the room stores and relays (table, one-to-one, group), membership (add, rename, the others never hear of it), the cap and the rate, the hello's `have`, a resigned seat reads only, the fog test (a group's text and existence reach its members only). **Deploy. Commit and push.** Screenshots: the chat on desktop (sidebar and a group), the two phone screens, the pop-up.

## Part 3: pause by vote (the third deploy)
1. **Asking:** online only, in the planning window only (not during a replay), from Settings ("Ask for a pause") and from a tap on the header's clock. **Everyone else at the table gets a card** ("Kit asks for a pause, 15 minutes at most. Agree?" with Agree and No); bots agree at once; a person's leaders never answer. **The pause starts only if everyone still playing agrees within 60 seconds;** one No, or the 60 s passing, and the asker is told ("Not everyone agreed." or "Wren didn't answer in time."). Only a pause that starts counts against the asker's three (a default; Nate can change it).
2. **Paused:** the room's clock stops (the deadline moves by the paused time, the alarm is set to the pause's end), **15 minutes at most, three a player a game, and it ends early when every person presses Ready** (the card stays up with "Ready", and shows who's ready). The header shows "Paused by Kit, 12:40 left" for everyone; orders can still be set and saved during a pause, but not locked in (lock-in presses Ready instead). A person who reconnects during a pause sees it.
3. **Deploys and restarts:** a paused game that wakes after a deploy is still paused with the right time left (the fake-clock tests cover it).
4. **Tests:** all agree, one declines, the 60 s pass, the clock shift, three a player, ends early on Ready, the alarm across the pause, a room that wakes paused, the fog test (a vote reaches the table, nothing else). **Deploy. Commit and push.** Nate and a friend pause once.

## Part 4 (can slip to 28b): the online polish from Nate's friend games, and the harness
1. If Nate's notes from games with friends are in `PROGRESS.md`, do the online ones here (the ones that fit in a part).
2. `scripts/table-harness.mjs` learns to make an offer, write in a chat and ask for a pause, so 29 can test bots' chat against it. **Commit and push.**

## Last: the write-up, the test list
- `docs/10-online-plan.md`: a BUILT block for 28 (deals between people as built, chat as built with its caps, pause as built, what changed from the plan). `docs/rules-reference.md` ("Online": deals with people, chat, pause, in plain words; the voice test reads it). `docs/decisions.md`: one line per decision.
- **"Things to test after session 28"** in `PROGRESS.md`, most important first (a truce and a trade with a friend; a counter; a group chat two friends make against you; the pop-up on the phone; a pause with three people; a blank page never again after a deploy). Carry over what Nate hasn't tried from "after session 27" and before.
- `PROGRESS.md` (sessions completed: 28), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (session 29 and after)
- Chat for bots and leaders (multiple-choice answers, the line library's voices, a bot in a group), notifications (push, email), sounds for chat (29).
- Spectators who aren't at the table, rankings, public sign-up (M5).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The fog-on-the-wire test passes with three people, an offer, a group chat and a pause vote; a missing asset answers 404; the start-up bundle within 2 KB of 495.8 KB; the lock check passes on every deploy.
- Nate and a friend have made a deal and written in a chat on the preview, or the test list says exactly what to try.
- Every deploy a working build with running games surviving it; the docs and the test list above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 28b)
- the asset fix: what a missing `/assets/` path answers now, and whether the old poisoned URLs still answer HTML at the edge
- deals between people in one paragraph (offer, answer, counter, withdraw, lapse), and chat in one (the three kinds, the caps, what a seat is told)
- pause by vote as built, and anything built differently from the plan, and why
- CPU per turn in the room, the size of a chat message on the wire and of the hello with chat, the start-up bundle
- whether Nate's friend game happened and what it found
- the deployed version
