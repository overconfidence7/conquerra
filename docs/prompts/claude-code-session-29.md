# Claude Code: Session 29 (M4, part four: chat for bots and your leaders, notifications, the polish pass)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs Wrangler (logged in there), his browser and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session gives the bots and your leaders a voice in the chat, and tells you when it's your turn.** Session 28 built chat for people (the table, one-to-one, private groups), deals between people and pause by vote. Now: **bots that speak in the table chat when something calls for it, answer you in a one-to-one or a group with their limited lines, and commit only through a deal; your leaders' own chat ("Your council"), where they report in their voices and sometimes ask you something you answer by multiple choice; notifications (pop-ups in the game, "your turn" on the installed app, email for long turns); and the polish pass from Nate's solo play.** The design is `docs/04-design-additions.md` §13 "Chat" and the plan is `docs/10-online-plan.md` §6 step two and §7. **Nate is testing alone for now** (friends come later): every check here is yours, with two accounts against `wrangler dev` where two people are needed. This is M4's last build session; M5 (public launch) is planned after it.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1 to 3 each end with a deploy,** so the session is complete at any of those boundaries. Whatever isn't reached becomes session 29b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy** (a new storage key is fine; a changed one needs a migration you describe).

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 15: Orchestrator review of session 28" (the nits for Step 0), "Oct 15: Claude Code session 28", and any "Nate's play test" entry after 28
3. **`docs/04-design-additions.md` §13** (chat: bots and leaders never chat like an open-ended AI; multiple choice; grudges; threats and brags only when something calls for it; fair; not heavy), **`docs/10-online-plan.md`** §6 step two, §7 notifications, §8, the BUILT blocks for 26 to 28
4. `docs/voice-guide.md` and `docs/voice/` (Nate's picks; every new line in the voice of its speaker), `packages/content/data/lines.json` (the line library: `limits`, `bots`, `reasons`, `leaders`, `captured`, `screens`) and `packages/content/src/lines.ts`
5. `docs/decisions.md`, the Oct 14 to 15 lines at the bottom
6. `docs/rules-reference.md` ("Online", "What your leaders say")
7. `docs/infra-cloudflare.md` (the Free plan; "Nate's steps")
8. The code: `apps/web/src/host/chatRoom.ts` (the chats as 28 built them), `roomCore.ts` (`chatMessage`, resolve, the pause, the takeover), `localGame.ts` (`botTalks`, `propose`, the leaders' voices after a turn), `apps/web/src/logic/voices.ts` (your leaders' lines: fair by construction, from `before`, `after` and your own replay), `packages/bots/src/say.ts` and `diplomacy.ts` (how a bot speaks and negotiates today), `apps/web/src/ui/` (`Chat*.tsx`, `Deals.tsx`, `Toasts.tsx`, `GameScreen.tsx` Settings, `PlayersPanel.tsx`), `apps/web/server/` (`api.ts`, `access.ts`, `gameRoom.ts`, `index.ts`), `apps/web/vite.config.ts` (the service worker is Workbox's generated one through the PWA plugin: a push handler needs a custom `sw.ts` with `injectManifest`, or a second worker; pick and say why), `apps/web/test/room.test.ts`, `fog-wire.test.ts`, `roomHelpers.ts`, `scripts/table-harness.mjs`

## Step 0: sync and the fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **A watcher can't deal:** a resigned or taken-over seat still sees "Propose a deal" on a rival's row in the Houses panel. Hide it (the chat bubble stays).
3. **A counter isn't a decline:** the report says your offer "was declined" when the other side countered. Give the engine's `dealLine` (`packages/engine/src/dealText.ts`) countered wording ("Kit countered your truce: …", and for bots the personality's own line if the library has one, else the plain one). Words only: the same seeded sim before and after must give the same winners, turns and deal counts (say the command and the numbers).
4. **Quiet notices are queued, not dropped:** a deal's answer (quiet) vanished while a warning was on screen. Queue quiet notices behind the warning and show them when it goes; never more than one on screen, as 28 built the chat pop-up.
5. **The Worker's CPU:** the resign-from-the-lobby handler measured 9 ms against the Free plan's 10. `access.ts` caches Access's public keys but verifies the RS256 signature on every call. Cache the verified identity by the token's SHA-256 until the token's `exp` (in the isolate's memory, bounded, say 500 entries), and the imported key. Measure the same handler before and after (`wrangler tail`) and report both numbers. Never cache a failed check.
6. **If Nate's play-test notes after 28 are in `PROGRESS.md`**, do the small ones here; list the rest for Part 4.
7. **Commit and push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Only `viewFor` leaves the room, and a bot's line never says more than its reader could know.** A bot's line in a chat is written **for its reader**: it's built from events that appear in that reader's own `replayFor` (a capture of their land, a deal made public, a broken deal, a capital taken) and from the public players panel, never from the bot's own view. Extend `fog-wire.test.ts`: a bot speaks in the table chat and in a group, a leader asks a question; search every page's messages for the names of fogged territories and the troop counts the reader can't see. Words only: bots' decisions are unchanged (the same seeded sims before and after).
- **Every choice is an ordinary game action.** A multiple-choice answer either sends an order that already exists (a deal through `propose`, a command through the leaders' commands, a budget) or sets the mood. **No new commands or orders this session**, and **a bot in a group only ever commits through a deal.**
- **Not heavy, not every turn:** limits in `lines.json` (`limits`), below. Chat can be ignored; a turn with chat ignored takes the taps it takes today.
- **Every line follows `docs/voice-guide.md`** and its speaker's voice (the six personalities and the dry Neutral; the Captain and the Recruit plain). The voice test reads the new lines; **a bot or a leader may now ask a real question** in a chat, so lift the no-question rule for the new `chat` and `council` sections only, never for the old ones.
- **Nothing heavy in the Worker's handlers;** the room sends pushes and emails itself (`waitUntil`), and logs CPU per turn as before.
- **Single player untouched** unless Part 4 reaches it. The start-up bundle **gets a new allowance: within 2 KB of 496.1 KB**; the bots' chat and the council load with the online chat code; the line library is already with the game screen.
- **A notification carries nothing fogged:** "Your turn in Conquerra: Embervale, turn 12" and nothing else.

## Part 1: bots in the chat (the first deploy)
1. **The table chat:** a bot speaks when something calls for it, from a new `chat` section of the library with 3 to 5 versions per personality per situation: it took land from the reader ("brag"), the reader took its land ("needle", never nasty), a truce or trade was agreed with the reader, the reader broke a deal with it ("the broken-deal lines already exist: reuse them"), a capital changed hands at the table, a rival was finished, the bot came back from the brink (a comeback the reader saw). A line goes to each reader it concerns, built from that reader's replay (one bot line may read differently to two people). **Limits (defaults in `limits`, Nate can cut):** at most one line per bot a turn, two bot lines in the table chat a turn, a bot's lines at least 3 turns apart unless a deal was made or broken; the Recruit never speaks, the Captain rarely (its plain voice).
2. **One-to-one with a bot:** the chat bubble on a bot's row opens a chat where **you answer by multiple choice** (the bot never reads free text; there's no text box): a deal offer answered here does what the Deals panel does (accept, counter, decline, with the bot's answer line), **"Say something" offers three cheeky lines** picked from the library for the situation (no effect but the bot's reply, in character, one line), and "Propose a deal" opens the Deals panel. A bot answers at most two free messages a turn, then "{bot} has nothing more to say this turn."
3. **A bot in a group:** a member can add a bot (the picker lists them); it answers the group's multiple-choice prompts in character ("Join us against Morwen?" → "Make it a deal and I'm in." with a Joint war offer prefilled for the asker), and **commits only through a deal**: its words never bind it. Its lines in a group are built for the group's members from what **all of them** could know (the intersection: public events only, when the members differ).
4. **Deals in chat:** when a bot proposes to you, the offer shows in your one-to-one chat too (the same card as the Deals panel; one answer in either place).
5. **Tests:** the limits, the per-reader line (two readers, two lines, nothing fogged), the group's intersection, the two-free-messages rule, the fog test, the voice test, the same seeded sims before and after. **Deploy. Commit and push.** Check live with your account: a bot brags in the table chat after taking your land; a one-to-one with a bot; a group with a bot. Screenshots: the table chat with a bot's line (desktop), the one-to-one choices (phone).

## Part 2: your council (the second deploy)
1. **"Your council"** is a chat only you can see (your Leader, your Steward, your captured leaders; online and in single player's host when Part 4 reaches it): after each turn their lines from `voices.ts` appear here as messages (the report and the Chronicle keep showing them too; the council is where they pile up as a conversation). Their names in their House colour, your Leader first.
2. **Questions:** from a new `council` section of the library, a leader **asks you something when a situation calls for it**, and you answer by **multiple choice, each choice an existing command or budget**: a rival wiped out its army or took its home province → "Do we go after {rival}?" with "Yes, take it back" (`pushBack {rival}`), "Raid them" (`raid {rival}`), "Hold for now" (`hold`); your capital threatened → "Shall I hold {capital}?" with "Yes, hold it" (`defend {capital}`), "Stay as you are"; the Steward with nothing to build → "Fortify the border or raise culture?" (`fortify` / `culture {province}` / "Your call" = `realm`); an empty purse → a budget chip. **At most one question a turn, from one leader, and only when the leader has no command yet or the situation changes the command's sense;** none in the first two turns; your answer sets the command through the Leaders panel's own path (the panel shows it as yours). Unanswered, the question lapses at lock-in and the leader says one line about it next turn ("I took that as a no.").
3. **Grudges** (already in `VoiceMemory`): a leader with a grudge asks about it once, then needles every few turns ("Still not going after Morwen? Fine.") within the limits.
4. **Tests:** the question rules (one a turn, none early, lapses), each answer sends the right command, nothing in a line the player couldn't know, the fog test (the council never leaves its seat), the voice test, the same seeded sims. **Deploy. Commit and push.** Check live: a council question answered, the command showing in the Leaders panel. Screenshots: the council on desktop and the phone.

## Part 3: notifications (the third deploy)
1. **In the game:** a pop-up (the quiet toast, queued) for a message, a deal offer, a pause vote and the window opening, when the thing isn't already on screen; never during the replay (they queue).
2. **"Your turn" push:** Settings gets "Tell me when it's my turn" (shown only where push can work: the installed app on Android, Chrome on the desktop; a line says to install the app otherwise). It asks the browser's permission, stores the subscription in D1 (`push_subs`: user, endpoint, keys, made; a migration), and the room sends a push when a window opens for a seat whose page isn't connected, **once a turn, for every timer**; a 410 from the push service removes the subscription. The room signs with VAPID (ES256 through WebCrypto) and encrypts the payload (RFC 8291, `aes128gcm`): write it with WebCrypto or take one small dependency with no Node built-ins, and say which. The keys: `VAPID_PUBLIC` as a Wrangler variable, `VAPID_PRIVATE` a secret you set with `wrangler secret put` (generate them in the session; put the public key in the config and the private one nowhere else; say so in the summary).
3. **Email for long turns:** opt-in in Settings ("Email me when it's my turn in a long game": 1 h and up only), sent by the room through a `send_email` binding from `conquerra@overconfidenceonline.com`, once a turn, plain text, nothing fogged. **On the Free plan Cloudflare delivers only to addresses verified in Nate's account** (Email Routing's destination addresses), so for M4 that's Nate's own Gmail (his step: verify it, below) and later each friend's; an unverified address fails quietly and is logged once. M5's Workers Paid opens it to anyone.
4. **Nate's step** (write it into `docs/infra-cloudflare.md`, "Nate's steps", step 4, copy-paste simple): Cloudflare dashboard → Compute → Email Service → Email Routing → Destination addresses → add `nkurtz@gmail.com` (if it isn't there already from the routing rule) → the verification mail.
5. **Tests:** the push message (a fake push service: the right endpoint, a valid VAPID header, a payload that decrypts to the plain line), once a turn, the connected page gets none, 410 removes, the email once a turn for long timers only, nothing fogged in either. **Deploy. Commit and push.** Check live: install the app in Chrome on Nate's laptop (or use Chrome's own permission), turn the setting on, leave a 3-minute game, see the push arrive; an email to Nate's Gmail from a 1 h game (if his step is done; if not, say so).

## Part 4 (can slip to 29b): the polish pass, and single player's council
1. **Nate's solo notes** from "Things to test after session 28" and after, the online ones first.
2. **Single player:** the council chat in the local host (the same code, no server), behind the chat button; the bots' table-chat lines in single player too (your leaders and the bots at the table). Single player stays offline and local; its saves unchanged or migrated and said so.
3. **A soft tick** for a new chat message, from the packs already in `packages/sound/data/credits.json` if one fits (the bench's "most at once" must not rise); none otherwise.
4. `scripts/table-harness.mjs` answers a bot's prompt and a council question, for M5's tests. **Commit and push.**

## Last: the write-up, the test list, and M4's close
- `docs/10-online-plan.md`: a BUILT block for 29 (the bots' chat with its limits, the council's questions and what each answer sends, notifications as built, what changed from the plan) and **an "M4 as built" paragraph at the top of §9** (what a player gets now, in ten lines). `docs/rules-reference.md` ("Online": bots in the chat, your council, notifications, in plain words; the voice test reads it). `docs/infra-cloudflare.md` (push keys, the email binding, Nate's step 4). `docs/decisions.md`: one line per decision.
- **"Things to test after session 29"** in `PROGRESS.md`, most important first, split into alone and with a friend. Carry over what Nate hasn't tried.
- `PROGRESS.md` (sessions completed: 29; the Phase line says M4's code is done and waits on Nate's solo play test), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (M5 and after)
- Public sign-in replacing Access, Workers Paid, Stripe, random maps, blackout fog, 50 players, tutorials and scenarios, rankings, spectators who aren't at the table, leaders' temperaments, bots that chat about anything beyond the library.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The fog-on-the-wire test passes with a bot's chat line, a group with a bot and a council question; the same seeded sims before and after (words only); the start-up bundle within 2 KB of 496.1 KB; the lock check passes on every deploy.
- A bot has spoken in the table chat, a council question has been answered, and a push has arrived on Nate's laptop, on the preview; the test list says exactly what Nate tries alone and what waits for a friend.
- Every deploy a working build with running games surviving it; the docs and the test list above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 29b)
- the bots' chat in one paragraph (when a bot speaks, the limits, how a line is kept fair for its reader) and the council in one (the questions, what each answer sends)
- notifications as built: push (the library or your own code), email (to whom it can go on the Free plan), the keys and where they live
- the Worker's CPU on the resign handler before and after Step 0, CPU per turn in the room, the start-up bundle
- the seeded sims before and after (the command, the numbers)
- the deployed version
