# M4: Online with friends. The plan (Oct 12)

*Written by the orchestrator after session 25, at Nate's request, with concrete defaults he can cut or change. Everything here is a proposal until the "Nate's calls" block at the end says otherwise. Builds on `docs/03-build-plan.md` (M4), `docs/infra-cloudflare.md`, `docs/04-design-additions.md` §13 (chat), §10 (pause by vote), §2 (deals).*

## 1. What a player gets

- **A game with friends on phones and laptops**, from a link. You start a game in the lobby, pick the map, the bots and the timer, and send the link. Friends open it, sign in with Google once, pick a House colour, and sit down. Empty seats are bots.
- **Live turns.** Everyone plans in the same 5-minute window (or 3, 10, or a longer timer for games that run over days), then everyone watches the replay at the same time, each seeing only their own fog. A turn ends early when everyone has locked in.
- **Nothing is lost when you close the tab.** The game lives on the server. Open the link again (or the lobby's Continue) and you're back where it stands, in the planning window or watching the replay you missed.
- **Your leaders run your House while you're away.** Miss a turn and your Leader and Steward play it for you, in your own colours, the way they do when you delegate. Miss many and a Marshal takes the seat for good (bot takeover for quitters). The others never wait on an empty chair.
- **Deals between people:** the same preset deals (truce, trade, joint war, right of passage; handshake or binding) offered to a person, who answers in their planning window. Unanswered offers lapse at lock-in, as they do with bots.
- **Pause by vote** for a table of people: one asks, the rest confirm, the clock stops.
- **Chat** (§13): people chat normally; bots and your leaders talk in their own voices and you answer by multiple choice. It works in single player too.
- **Single player stays as it is:** on your device, offline, with pause and saved games. Nothing in M4 slows it down or needs a sign-in.

## 2. How it works, in plain words

- **One Worker, `conquerra`,** at `conquerra.overconfidenceonline.com`, serves the game as it does today **and** the online API.
- **One "game room" per online game** (a Cloudflare Durable Object, `GameRoom`). It holds the game, runs the clock, resolves the turn with the same engine and bots the browser runs today, and sends each player only `viewFor(state, playerId)` and their fog-trimmed replay. The room is the only one who ever sees the whole board, so **fog is respected by construction** and nobody can cheat from the client.
- **The same contract as today.** The browser already talks to its game through `apps/web/src/host/protocol.ts` and a Web Worker (`hostCore.ts`). Online, the same messages travel over a WebSocket to the room instead. That's the main reason M4 is tractable: the UI doesn't change its shape, it changes its wire.
- **Sign-in is Cloudflare Access with Google**, which the preview already uses. The Worker reads the signed identity Access attaches to every request and that's the account: no passwords, no sign-up form. Nate adds a friend's email to the "Conquerra players" policy and they're in (free up to 50 people, shared with Keel).
- **A small database (D1 `conquerra_db`)** keeps accounts (email, display name, colour), the list of games and who sits where, and results. Saved online games live in their room's own storage. R2 (replay files) waits for M5 unless it's needed sooner.
- **Deploys from GitHub** (Cloudflare's Workers Builds, the way the main site deploys): a push to `main` builds and deploys. `pnpm deploy:preview` stays as the manual fallback.
- **No upgrade needed (corrected Oct 13).** The Free plan's 10 ms of CPU per request applies to the Worker's own handlers, which do almost nothing. The game room is a Durable Object, and those get **30 seconds of CPU per request on the Free plan** (checked against Cloudflare's limits pages), so the engine and the bots run inside the room with room to spare (a turn with ten Marshals planning takes about 35 ms on a laptop). The Free plan's other caps (100,000 requests and 13,000 GB-seconds of room time a day, 5 GB of storage) are far above a table of friends. Workers Paid ($5/month) waits for the public launch. `docs/infra-cloudflare.md` has the numbers.

## 3. The turn clock online (defaults)

- **The planning window** starts when the room sends the turn. Lock in whenever you're ready; the turn resolves when everyone has, or when the clock runs out, whichever is first.
- **The replay** runs on each client at its own pace (pause, skip, "Watch again" as today). The next window opens **after the replay's length plus 10 s** for everyone, so nobody plans while another is still watching. Skip is yours alone; the clock doesn't move for it.
- **Timers (Nate, Oct 12):** 3, 5 (default), 10 minutes, and **long turns**: 1 hour, 8 hours or 24 hours, for games played across days ("your turn" notifications, §7). **A turn ends early when everyone has locked in.** "No timer" is single player only.
- **Away players (Nate, Oct 12):** when the clock runs out and you never locked in, **your queue as you left it** goes in. **Each player chooses when sitting down** whether, on a missed turn with no orders, **their leaders run the House** for that turn (on by default): the Leader and Steward at **Run the military 80% / Run the realm 20%**, from the **first** missed turn. The card tells the table: "Lady Morwen's leaders ran her House this turn." With the choice off, a missed turn with no orders is simply a turn where your House holds still.
- **Bot takeover (orchestrator default, Nate to confirm in play):** after **three missed turns in a row**, or when you resign, a Marshal with the Neutral personality takes the seat for the rest of the game, and the players panel says so. The seat keeps your colour and name with "(bot)" after it. You can take it back within the same game if you return before the takeover; after it, you watch.
- **Reconnect:** open the link and the room sends the current state: the planning window with your queue as you left it, or the replay you missed, then planning.

## 4. Seats, colours and the lobby

- **An online game is made in the lobby** as today, with one more block: **Online**, with "Make a game link" and the list of your online games ("Continue" shows them beside the local saves).
- **Seats:** the host sets the table size; friends take seats as they arrive; the rest are bots at the host's level. The host starts the game when at least one friend is seated (or at once, with bots, to test).
- **Colours:** each player picks a House colour from the ten palettes, first come first served; the host picks first. The seat rule (session 25) deals harder spots to bots before people, as in single player.
- **Who sees what:** the players panel shows people and bots the same way (no territory counts, as today); a person's display name is their Google first name unless they change it once in Settings.

## 5. Deals between people, pause by vote

- **Deals:** the presets and the two kinds (handshake, binding) as today. An offer to a person shows in their deals panel for the rest of the window; they accept, counter or decline, or it lapses at lock-in. Counters go back once. Deals are **public** (trade terms private), as with bots. Your leaders never answer for you, and a truce that would stop a finish still gets the warning card.
- **Pause by vote (§10; Nate, Oct 12):** anyone asks; everyone else gets a card; the pause starts only if all confirm within 60 s; **at most 15 minutes, three times a player a game, and it ends early when everyone says they're ready**. Bots always agree. Single player keeps its own pause.

## 6. Chat (§13, built in two steps)

- **Step one, people:** a chat with the table and one-to-one chats, a sidebar of chats (bold when unread), the selected chat in the main area, a small pop-up when a message arrives; two screens on a phone. Messages are kept for the game and go with it.
- **Step two, bots and leaders:** your leaders' group chat (what they did, in their voices, from the line library), bots that threaten, brag or needle **only when something calls for it** and with limits on how often each speaks, and your answers by **multiple choice** (a deal answer, a command, a budget, or just the mood). Every choice is an ordinary game action, so chat is never extra power, and a bot never mentions what's in your fog.
- **Not heavy:** no typing needed to play; a turn with chat ignored takes exactly the taps it takes today.

## 7. Notifications (last, can slip)

- **In the game:** the pop-up for a message, a deal, a pause vote, the turn's start.
- **"Your turn" when the tab is closed:** browser push on the installed app (Android and laptop), opt-in in Settings. Email ("conquerra@overconfidenceonline.com", Email Routing already exists) for the long-game timers, if push isn't enough.

## 8. Fair and safe

- **The room is authoritative;** the client never resolves anything. **Provably fair:** the room commits to the game's seed hash at the start and reveals the seed at the end (`docs/03-build-plan.md`).
- **Only `viewFor` leaves the room.** A test plays an online game with a listening client and checks that nothing fogged ever reaches it (the same idea as the fog tests in the engine).
- **Access only:** no public address, no sign-up; the Access policy is the guest list. M5 replaces it with real sign-in.
- **Resigning, leaving, kicking:** resign (your leaders then a Marshal, §3); the host can remove a player before the game starts, not after.

## 9. The sessions (each one playable at the end)

1. **26: the server skeleton.** Step 0: the wall cap comes off (Nate, Oct 12; `rules.walls.stackMax: null`, tests and re-pins), plus his play-test nits. Then: the Worker gains an API, the `GameRoom` Durable Object runs `HostCore` and the clock, the WebSocket speaks `protocol.ts`, sign-in through Access's identity, D1 with accounts and games, **one person against bots playing an online game end to end on the preview**, the lobby's Online block, Workers Builds connected (Nate), the fog-on-the-wire test. Exit: Nate plays an online game against Marshals on his phone and laptop, closes the tab mid-game and comes back.
2. **27: friends at the table.** Invite links, seats and colours, the live clock for several people, lock-in early, the replay in step, reconnect, away players run by their leaders, bot takeover, resign. Exit: Nate and one friend finish a game.
3. **28: deals between people, pause by vote, chat for people.**
4. **29: chat for bots and leaders, notifications, the online polish pass** (what Nate's games with friends found).
5. **Nate's play test with friends,** then M4 is done; M5 (public launch) planning follows.

## 10. What it costs

- **Nothing** (corrected Oct 13): Workers, Durable Objects, D1 and Access all stay on their free tiers at a table of friends' size. Workers Paid ($5/month) comes with the public launch (M5).

## 11. Out of scope for M4 (where it goes)

- Public sign-up, payments, 50-player games, random maps, blackout fog, tutorials: **M5**.
- Spectators, rankings, friends lists, replays shared by link: **after M5** (needs R2 and a public site).
- Native apps: **M6**.

## Nate's calls (Oct 12)
- **Away players:** a per-player choice at the start, "If I miss a turn with no orders, my leaders run my House" (on by default), from the first missed turn. The Marshal takeover after three misses stays an orchestrator default until his friends' games say otherwise.
- **Timers:** 3, 5 and 10 minutes, long turns of 1, 8 and 24 hours, and a turn ends early when everyone has locked in.
- **Pause by vote:** all must agree within 60 s; 15 minutes at most; three a player a game; it ends early when everyone says they're ready.
- **Order:** 26 the server, 27 friends, 28 deals, pause and chat for people, 29 chat for bots and leaders and notifications.
