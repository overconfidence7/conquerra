# 11. The public launch (M5): plan with defaults

*Written Oct 15 by the orchestrator, after session 29 closed M4's code. Everything here is a default Nate can cut or reorder; his calls are listed at the end. M4's plan (`10-online-plan.md`) says how the server works; this one says what 1.0 is and the order to build it.*

## 1. What 1.0 is

A stranger can find the game, sign in, play against the bots for free, and buy it once to play online with friends and on every map. Nothing in the game is ever for sale except the game itself (Nate's rule: never sell power).

- **Nate's call (Oct 15): everything is free until a launch date.** The purchase code is built (session 35) behind a date switch, so nothing is gated before the day Nate picks; the lines below describe what the switch turns on.
- **Free after the date:** single player against the bots on three maps (Embervale, The Shattered Isles, Wyrmland), every bot level, the tutorials, your council. Enough to know whether you like it.
- **Bought (one time, $9.99, Nate's call):** every map, random maps, online tables (hosting and joining), long turns, notifications. A friend without the purchase can still **join** a bought player's table for their first three online games, then they're asked to buy.
- **Not in 1.0:** ratings and matchmaking, spectators, replays by link, native apps, the player map builder (M6), 50-player tables (a stretch, §8).

## 2. The order (sessions 30 to 36, one usage window each)

| Session | What | Why this order |
|---|---|---|
| **30** | M4's close-out (Nate's solo notes), **random maps**, the **blackout fog** option | Playable things first while Nate tests alone; no launch decision needed |
| **31** | **Tutorials** (seven short saved games with goals and hints) and the first-game experience (a guided first turn) | Needed before any stranger plays; solo-friendly |
| **32** | **Bigger tables** (up to 10 people and 20 seats on the 200-territory maps), the sim's numbers for them, the map lab switched off in production, abuse limits (rate limits, a report button, a block list) | Scale and safety before strangers |
| **33** | **Launch polish**: the install flow on Android and iPhone (the installed app), the open-graph preview, the lobby for a newcomer, a last voice pass, a load test of 20 tables at once | Everything a stranger meets, before the doors open |
| **34** | **Workers Paid, public sign-in** (Google in the Worker, email magic links), accounts in D1, Access retired, the guest list becomes an invite-free sign-up | The launch's foundation; needs Nate's Google OAuth client (his step). Nate's order (Oct 15): sign-in and the purchase last, so the game stays private longer |
| **35** | **The purchase** (Stripe Checkout, the webhook, the launch date switch), the public site's front page, terms and privacy pages | Needs Nate's Stripe account (his step) |
| **36** (stretch) | **50-player battle royale** on a 400-territory map if the sim and the room's CPU allow it; otherwise it waits for M6 | Only with numbers |

Nate's play test with friends can land anywhere in this: a session of his notes before the next milestone session worked well in M3 and M4 (25b), so plan on one.

## 3. Sign-in (session 34; Nate's call: built in our Worker)

**The problem:** Cloudflare Access is a guest list, and its free plan stops at 50 users. A public game needs sign-up with no list.

**Nate's call (Oct 15): sign-in in our own Worker, two ways, accounts in D1.**
- **Google** ("Continue with Google"): OAuth 2.0 with PKCE in the Worker, no library (about 200 lines: the redirect, the code exchange, the id token's signature against Google's keys, the same WebCrypto check as Access's token today). Nate makes the OAuth client in Google Cloud (his step: a project, "OAuth consent screen" external, a web client with the redirect `https://conquerra.overconfidenceonline.com/api/auth/google/callback`, the client id in the config and the secret as a Wrangler secret).
- **Email magic link** (for anyone without Google): a signed, single-use link that expires in 15 minutes, sent through Email Sending (Workers Paid; the domain onboarded, Nate's step). Rate limited (three a day an address).
- **The session:** a signed cookie (HMAC, a secret), 30 days, refreshed on use; sign out everywhere from Settings. `users` keeps the email, the name, the colour, the purchase, the sign-in method; emails are never shown to other players (as now).
- **Access retired** for the game's address; it can stay on the map lab's address (or the lab goes off in production, §8).
- **Alternatives considered:** a third-party sign-in service (Clerk, Auth0: free tiers of 10,000 users, a dependency and a brand on the sign-in page); Cloudflare Access's own one-time-PIN login with "everyone" allowed (zero code, but 50 users on the free plan and $7 a user a month after). The Worker's own is the cheapest and the plainest.

## 4. Money (sessions 34 and 35)

- **Workers Paid, $5 a month** (session 34): the Worker's handlers get 30 s of CPU like the room, Email Sending to anyone, higher daily limits. The only running cost until R2 (replays by link, after 1.0).
- **The purchase:** Stripe Checkout (hosted page, no card data ever touches the Worker), a one-time price, the webhook (`checkout.session.completed`, the signature checked) marks `users.bought`; a receipt from Stripe. **$9.99 (Nate's call, Oct 15; the price lives in Stripe, not in the code).** Refunds by Nate in Stripe's dashboard; the webhook for a refund clears the flag.
- **What the purchase gates** (enforced in the API and the room, never only in the page): hosting a table, joining beyond the trial, maps beyond the free three, random maps, long turns, notifications. Everything else free.
- **Taxes:** Stripe Tax on, Nate's business details in Stripe (his step). Nate's accountant's call on the rest.

## 5. Random maps (session 30)

- **The lobby gets "Random map"** beside the twelve: a size (40, 80, 120, 200 territories), a shape (the map maker's masks: island, two realms, a ring sea, an archipelago), a seed shown as a word pair ("quiet-heron") that any player can type to get the same map again.
- **How:** the map maker (`packages/mapgen`) already builds every official map from a seed; split it into stages that can re-run on their own (`docs/07-map-tooling.md` says how) and run its quality checks (land, contacts, choke points, fair capitals, the exposure check) at generation, rerolling up to five times before giving up with a plain message. **Fairness:** the seat rule deals harder spots to bots first; the sim checks 100 random maps a size for win rates by seat within ±5 of fair before the feature is on by default.
- **Online:** the room keeps only the seed and the recipe, never the geometry (the wire never carries map data, as now); every page builds the map itself from the seed, and the room builds its slim copy the same way. A random map's generator version is pinned in the game so a save or a reconnect rebuilds the same map after a deploy.
- **The painting:** the renderer already paints any map the maker produces; names come from the maker's name lists; the Far picture is generated (Nate OKs the official maps' Far pictures by hand; random ones get the generated one).
- **BUILT (session 30):** "Random map" at the end of Change map: size (40, 80, 120, 200), shape (one island, archipelago, twin continents, crescent, inland sea), a two-word seed (Reroll, or type one), its picture. The map maker in stages (the twelve unchanged, on their own stream), checks plus an exposure band at generation, six tries then "That seed didn't make a fair map. Try another." Harder spots marked by exposure and dealt to bots first; no start bonus yet. Online: the room makes it once and keeps its slim copy; pages build their own in a worker; only the id and the version travel. **The sims miss the ±5 bar at 80 and 200** (the safest spot wins about twice what the most exposed does): a start bonus on the marked spots or a tighter band is the orchestrator's call (`docs/sim-results-m5-random-maps.md`). Live: a table on a random 80 made on the preview and two turns resolved.

## 6. Blackout fog (session 30)

- **A rules option** beside the fog switch: "Blackout: the map is hidden until you explore it." Anything not next to your land is hidden, geography included, until seen once; then it stays as "last seen" with standard fog's look. Scouts and watchtowers matter more; spies reveal as now.
- **How:** the engine's `viewFor` already has `fogged` and `last seen`; blackout adds "unknown" (no terrain, no name, no borders drawn), with the painting showing thick painted clouds (`docs/06-art-direction.md`). The bots play with it the same way they play fog (their own view only); the sim checks that games still end in 30 to 40 turns.
- **BUILT (session 30):** `settings.fog: "blackout"` (Rules: Fog of war, Blackout). Never-seen land is fog marked `unknown` with nothing else in the view; the replay drops fog news from it. Thick painted clouds (over the sea around unknown land too) in the display shader, no borders, gates or names over them, the minimap clouded, unknown land can't be tapped. The game itself is identical with blackout on or off, and so are the bots' games (300 all-Marshal games each on Embervale 4 and Wyrmland 6, game for game the same as standard fog: 23.1 and 39.9 turns), because the bots read the map's shape from the map as always. A question for the orchestrator: should the bots explore too (they know geography a person can't see)?

## 7. Tutorials and the first game (session 31)

- **Seven tutorials, each a saved game two or three turns from the end of its lesson,** with a goal card and one hint a turn: chaining attacks, recruiting and upkeep, culture and buildings, walls, cards (Spoils and Fate), treaties and deals, your leaders and their commands. Five to ten minutes each. On the free three maps, against a Recruit.
- **The first game:** a guided first turn in any new player's first single-player game (three prompts: tap your capital, recruit, lock in), skippable, never shown again.
- **Scenarios** (set pieces) on the same saved-game format: after 1.0.

## 8. Scale and safety (sessions 32 and 36)

- **Bigger tables:** today a table is the lobby's opponent count plus one, up to the map's suggested size. 1.0: up to 10 people and 20 seats on the 200-territory maps; the room's CPU per turn with 20 Marshals on Rootholm measured before the limit moves (M4's number: 22 to 38 ms a turn at a table of 4; the room has 30 s). Lock-in early keeps big tables moving.
- **50-player battle royale** (the design's `02-game-design-outline.md`): a 400-territory map, 50 seats, the Fallen's events scaled; only if the sim shows games ending in 40 turns and the room's turn stays under 5 s of CPU. A stretch for 36, else M6.
- **The map lab** is switched off in production (behind a build flag), on in `wrangler dev`.
- **Abuse limits:** the chat's rate limit already exists; add a report button on a message (it goes to Nate's email), a block list (a blocked player's messages don't reach you; deals still do), sign-in rate limits, and a daily cap on tables a player can host (20).
- **Anti-collusion** (the design's "fair"): nothing in 1.0 beyond the public deals; ratings and detection after.

## 9. The site

- **The front page** at the game's address for anyone signed out: the painting, one paragraph, Play (free), the price, three screenshots, the install note. The lobby after sign-in, as now.
- **Terms and privacy** pages (plain language, Nate's name and address as the seller: his step with his accountant), the cookie line (only the sign-in cookie: no banner needed).
- **Open-graph preview** for links shared in chat apps; the invite link's preview says "Nate invites you to a game of Conquerra".

## 10. What it costs at 1.0

Workers Paid $5 a month; Stripe's fee per purchase (about 3% plus 30 cents); the domain as now. R2 (replays by link) and Email Sending's volume come after 1.0. No other running cost until the game is popular, and then it's the good kind of problem (the Free plan's caps are far above a few hundred players a day).

## Nate's calls (asked and answered Oct 15)

1. **The free part:** **everything free until a launch date** (his pick). The gating lines in §1 describe what the purchase turns on after that date; the code is built behind a date switch.
2. **The price:** **$9.99 one time, and a buyer's friends get three free online games** (the default, confirmed).
3. **Sign-in:** **built in our Worker, Google plus email magic links** (the default, confirmed). His step when 34 comes: the Google OAuth client.
4. **The order:** **30 random maps and blackout, 31 tutorials, 32 scale and safety, 33 launch polish, then 34 sign-in and 35 the purchase last, 36 battle royale if the numbers allow** (his pick: keep it private longer, launch when everything else is done).
