# Conquerra: Progress Log

*Plain-language record of where the project stands. Every session reads this first and adds a short entry at the end. Newest entries at the bottom.*

## How we work
- **Nate** decides what the game is and approves each step.
- **The orchestrator** (a Cowork session) plans the work, writes the prompts for Claude Code, reviews what comes back, and keeps this file and the design docs up to date.
- **Claude Code** writes the code, one milestone at a time, and ends every session with: what's done, what's next, and questions for Nate.
- **Every 3 Claude Code sessions**, the orchestrator writes a fresh orchestrator prompt (so a new orchestrator session can pick up cleanly) along with the next Claude Code prompt.

## Where things live
- Code and docs: `C:\Users\nkurt\Claude\Projects\Strategy Game` (and GitHub `overconfidence7/conquerra` once connected)
- Design: `docs/02-game-design-outline.md`, plus the newer ideas in `docs/04-design-additions.md`
- Build plan: `docs/03-build-plan.md`
- Decisions: `docs/decisions.md`
- Website (later): conquerra.overconfidenceonline.com

## Status right now
**Phase: M5 (the public launch), session 33 done and reviewed (Oct 18): random map version 4 (a head start graded by exposure, every spot but the safest; k = 8 is the best setting, inside ±5 on average at three sizes but not at 80 territories with 4 players, where the safest spot's room wins), the Turtle and the Opportunist tuned under blackout (every personality within 5 points of its standard number, the delegating seat within 0.2), a Marshal's one line about the cloud, the Rules fold's Blackout line with nothing about bots, and no outline, word or arrow that names or places cloud land (a third page leak found in the review: the living map's boats, sails, flags and smoke show through the cloud; 33b). M4 still closes on Nate's solo play test. The plan is `docs/11-launch-plan.md`: **33b random maps (an income head start for the exposed spots, sizes 300 and 400)**, 34 scale and safety, 35 polish, 36 sign-in, 37 the purchase. Next: **session 33b** (`docs/prompts/claude-code-session-33b.md`). **Orchestrator-12 is current** (`docs/prompts/orchestrator-12.md`); orchestrator-13 is due after session 35.**

Claude Code sessions completed: **33** (a new orchestrator prompt is due after sessions 3, 6, 9, 12, 15, 18, ...)

---

## Log

### Oct 1: Research and first design
- Researched Risk, War.app, Diplomacy, Supremacy 1914, Polytopia and others: what players love and the top complaints.
- Interviewed Nate; wrote the design outline v0.1 and the build plan.
- Picked hosting: Nate's existing Cloudflare account.

### Oct 2: Name, setup, early prototype
- Name chosen: **Conquerra**. Domain: overconfidenceonline.com. GitHub: overconfidence7.
- Claude (the planner, not Claude Code) built an early engine prototype ahead of plan:
  - turn system with order queues and backups, combat, economy, fog, a basic bot, and a simulator
  - 37 tests; 3,000 bot games with no crashes
  - It's in the folder, but it was built before the v0.2 design changes below. Nate will decide whether Claude Code keeps it as a starting point or starts fresh.
- **Correction from Nate:** the planner shouldn't write code. From here on, Claude Code writes code and the orchestrator writes prompts.
- **Correction from Nate:** turns are **5 minutes** to set orders, followed by a shared "what happened" replay where each player sees the results in their own visible area. (v0.1 assumed multi-day turns.)
- Nate shared a big batch of new ideas: easy-click diplomacy with counteroffers, contingency presets, generals you give instructions to, military vs. culture, three kinds of cards, and an event/mission deck. These are captured in `docs/04-design-additions.md`, with open decisions.
- Waiting on: Nate connecting GitHub, then a round of questions, then the kickoff prompts.

### Oct 2 (later): Decisions
- Turn timer: 5 minutes by default; longer timers available for extended campaigns.
- Troops: **troops + specialists**. How players get specialists is still open.
- Culture stays light. The game is military and conquest first, with cultural flair; it is not Civilization.
- Claude Code will review the early prototype and decide whether to keep it, change it, or start over.
- GitHub is connected, but the `conquerra` repo still needs to be created.
- More decisions:
  - Specialists come from gold at a barracks, with light culture unlocks and occasional free Spoils cards.
  - Your Leader is a general: you can control it directly or give it standing instructions. Captured leaders become your generals.
  - Cards: map bonuses, plus a Spoils deck and a Fate deck.
  - Fate: everyone draws one card per turn. Events land anywhere on the board, mostly mild with a few extreme ones; missions go to whoever drew them.
- Build plan milestones revised for v0.2.
- Kickoff prompts written: `docs/prompts/claude-code-session-01.md` and `docs/prompts/orchestrator-01.md`.
- GitHub repo is live: `overconfidence7/conquerra` (code, docs and prompts pushed).
- Checked Nate's Cloudflare account (no changes made):
  - The domain, Google login (via Cloudflare Access) and the pieces we need are already familiar territory from Keel and Curse of Stats.
  - Nothing to set up until M2 (an optional private preview) or M4 (the real backend).
  - Plan to switch to the $5/month Workers plan at M4.
  - Details in `docs/infra-cloudflare.md`.
- New design: fog of war and spies (`docs/04-design-additions.md` §8).
  - With fog on (the default), you only see details on your own and neighboring land; the rest of the map shows just outlines and bonuses.
  - Spies can sneak into whole countries to see inside. Whoever holds an entire country can station up to 3 spies at its capital to block, kill or fool incoming spies.
  - Spies are planned for M3.

### Oct 2: Claude Code session 1 (Milestone 1 done)
- Connected this folder to GitHub without losing anything. Restored the CI check and the newer `CLAUDE.md` from the repo.
- Reviewed the planner's prototype: kept the solid foundation (fair luck, turn order, backups) and rebuilt the parts the v0.2 design changed. Write-up: `docs/05-prototype-review.md`.
- The engine now has:
  - **troops + specialists** (cavalry, siege, scouts, engineers, healers; up to 2 per army)
  - **light culture** (one number per territory: income, protection, specialist unlocks; the conqueror keeps it)
  - **five one-tap presets** for backups
  - the **v0.2 fog rule** and a **fog-trimmed replay** with "surface details"
  - the **turn timer** and turn limit settings
- The Recruit bot uses all of it.
- **Games now last about 22–24 turns** (target 15–25; the prototype ran 80–110). 3,000 bot games, no crashes, fair seats.
- **Speed:** a turn takes under 1 ms of computer time on average. The plan to move to the $5/month Cloudflare plan at M4 stands.
- Plain-language rules: `docs/rules-reference.md`. Numbers: `docs/sim-results-m1.md`.
- 70 automated tests, all passing.

### Oct 2: Orchestrator review of session 1
- Checked the work: it matches the design and stays inside M1. GitHub's automatic checks pass.
- Nate's calls:
  - Specialists are **lost** when their army dies.
  - A fallen **Leader comes back for free** on its owner's next turn. Knock a player out and you get their Leader as a general (built in M3).
  - **Big games:** maps list the player counts they suit, and the lobby suggests Conquest mode for 8+ players.
  - Engineers finish any building instantly; recruiting more than you can afford buys what you can pay for.
  - At the end of M2, put the game online privately at conquerra.overconfidenceonline.com so Nate can play on his phone.
- M2 is split in two: session 2 builds a playable game in the browser; session 3 adds the replay, timer, phone layout and the private preview.
- Next prompt: `docs/prompts/claude-code-session-02.md`.

### Oct 2: Claude Code session 2 (M2, part 1: the game is playable in a browser)
- Housekeeping: committed the orchestrator's docs and added a line-endings setting (`.gitattributes`). The repo was already clean, so nothing else changed.
- Engine updates:
  - Fallen **Leaders come back for free** at the end of the turn they fell: at the capital, or the strongest territory if the capital is gone. The 15-gold "Raise Leader" order is gone.
  - The game records **who knocked each player out**, ready for M3's generals.
  - Each map lists the **player counts it suits** (Embervale 4–6), and the lobby suggests **Conquest for 8+ players**.
  - Re-ran the simulator: games still last about 24 turns, seats are still fair, and 10-player Conquest ends on turn 20.
- **The browser game** (`apps/web`): a lobby, the game screen and a game-over screen. You play against 1–5 bots on Embervale.
  - Tap your territory, tap a neighbour, and you have an attack, with the odds shown before you add it. "Just enough" picks a sensible troop count, and presets are one tap each.
  - One-tap recruit (defaults to all your gold), hire, build, raise culture and retreat. Leader controls: lead an army (+20%), Seize the Initiative, Lie in Wait.
  - The order list shows the order things will happen, lets you delete or reorder, and shows the gold left.
  - **Lock in** plays the turn and shows a plain-text report of what you could see. Fighting in the fog is summed up in one line.
  - The game runs in a background "host" inside the browser, and the screen only ever gets your fogged view. In M4 we swap that host for the real server.
- **A typical early turn takes 10 taps** (recruit, two attacks with presets, lock in).
- How to play it: see "How to play it locally" in the README (`pnpm dev`).
- 93 automated tests pass (18 new for the web app), and GitHub's checks now build the web game too.

### Oct 2: Orchestrator review of session 2
- Checked the work: it matches the plan, the screen only ever sees your own fogged view, and GitHub's checks pass.
- New direction from Nate: **maps should look and play like War.app or a good Risk map.** That means organic borders, seas and lakes, mountain ranges, rivers, and real choke points. Written up in `docs/04-design-additions.md` §9.
- Nate's calls:
  - The map rebuild comes **next** (session 3), before the phone work, since tap sizes and zoom depend on the map. M2 is now three sessions.
  - **Random maps** and **"blackout" fog** (you see nothing past your borders until you explore) come later with the big game modes. We build so they're easy to add.
  - Attacks start with **"Only if still stronger"** switched on.
  - When you're knocked out, choose **"Watch to the end"** or **"See the result."**
- Saved for session 4 (phone polish): Claude Code's ideas to tuck two presets behind "More" and merge hire and build into one "Spend" button, plus odds that account for your earlier queued orders.
- Next prompt: `docs/prompts/claude-code-session-03.md`.
- **Art direction, take two ("Gilded Atlas"):** Nate found the first style too simple and shared a mockup of the look he wants: a richly painted world with navy-and-gold menus. The new direction (`docs/06-art-direction.md`) keeps that look but fits it to our game (gold only, no research, troops + specialists).
  - **Readability:** a clean info layer always sits on top of the painting (House borders, troop banners, building and specialist icons). Zooming out flattens the map toward plain colors, and a one-tap "Tactical view" removes the painting entirely.
  - **Art:** AI-generated. Nate makes it with the prompt pack in `docs/art/asset-list-and-prompts.md` and drops it into `art/incoming/`. The game uses placeholders until it arrives.
  - **M2 is now four sessions:** 3 map maker, 4 painted map, 5 menus, replay, timer, phone and private preview.
- **Art style settled:** Nate compared his realistic mockup with two Gemini versions and chose **illustrated, with relief lighting**. It's a storybook-painted map, made deeper with hill and mountain shading from a height map, under the gilded navy-and-gold menus. It suits random maps, keeps AI art consistent and reads well on phones. From the Gemini version we take the glowing House borders, troop pills, tap cards, specialist figures on the map, event pop-ups and a players panel. The art prompt pack now uses the illustrated style.

### Oct 2: Claude Code session 3 (M2, part 2: the map maker and real geography)
- Housekeeping: committed the orchestrator's docs (twice, as the art direction moved to v0.3 "illustrated" mid-session) and added `art/incoming/` for Nate's art.
- **The map maker** (`packages/mapgen`): give it a seed and some sizes, and it makes a whole map. The same seed always gives the same map.
  - natural coastlines with bays and peninsulas, a sea, lakes and islands
  - impassable mountain ranges with passes, and rivers running downhill to the sea
  - sea lanes over water, with a new `sea` border (attacks across one are weaker)
  - territories of about even size grouped into provinces, and fair capital spots for every table size
  - everything the illustrated map will need: outlines, a ground-type grid, a height map for hill shading, label points, and where trees, peaks, villages, towns, castles and buildings go
  - every map is checked (connected, no slivers, sensible provinces, fair capitals, enough choke points), and a failing map is thrown away for the next seed
- **Embervale and Greatmarch were rebuilt** with it (same sizes as before). Previews: `docs/maps/embervale.png` and `docs/maps/greatmarch.png`.
- **Simulator** (`docs/sim-results-m2-maps.md`): no crashes, seats still fair. Games run 1–2 turns longer at 4–6 players (typical game 24–25 turns), because bots are cautious around passes and sea lanes. Changing the rules didn't help, so the rules are unchanged; teaching the bots to fight for choke points belongs in M3.
- **The browser game** draws the new maps simply (outlines, water, mountains, rivers, passes, sea lanes) and offers both maps. The game screen now gets the map from the game host, not from the code.
- **Nate's two changes:** attacks start with "Only if still stronger" on (a typical turn is now **8 taps**, was 10), and when you're knocked out you choose **Watch to the end** or **See the result**.
- Plain-language rules for water, mountains, passes, sea lanes and choke points: `docs/rules-reference.md` §12. Map data notes for session 4: `docs/map-data.md`.
- 127 automated tests pass (34 new).

### Oct 2: Orchestrator review of session 3
- Checked the work: both maps look like real geography, the scope held, and GitHub's checks pass.
- Nate's calls:
  - Games at 4–6 players run about a turn long. We'll fix that with **smarter bots in M3**, not rule changes.
  - **Generated place names stay**; Nate can rename any of them.
  - **"Last seen" intel:** fog shows what you last saw there, marked "?" with its age. Built in session 4.
  - The players panel **won't show territory counts**; you scout to learn how big rivals are.
- Next prompt: `docs/prompts/claude-code-session-04.md`. Three Claude Code sessions are done, so there's also a fresh orchestrator prompt: `docs/prompts/orchestrator-02.md`.

### Oct 2: Claude Code session 4 (M2, part 3: the illustrated map)
- Housekeeping: committed the orchestrator's docs and the session 4 prompt.
- **"Last seen" intel** (engine): each player remembers what they last saw on every territory (owner, troops, building, and when). Fogged land now shows that memory marked "?", and the tap card says how old it is ("Seen 2 turns ago") or "Unexplored". It never holds anything you couldn't have seen, and a fooled spy (M3) can write into it later. Rules: `docs/rules-reference.md` §11.
- **The illustrated map** replaces the plain one (the panels are unchanged):
  - the painted world: blended ground, hill and mountain shading lit from the upper left, darker impassable ranges with peaks, shallows fading to deep water, rivers that widen toward the sea, passes with a road, curved sea lanes with a ship, and trees, peaks, hills, villages, towns and castles where the map maker put them
  - the info layer on top: glowing House borders, troop pills with banners, crowns, buildings, specialists, culture dots, capital plaques, gold selection glow, gold-trimmed order arrows and the four-pip odds badge
  - fog: greyed, darkened land with drifting mist, showing only last-seen markers
  - Far / Mid / Near zoom with smooth fades, wheel, drag, pinch, double tap, and the hover / tap-and-hold card
  - **Tactical view** (one tap): flat House colours with every detail. Browsers without WebGL get a plain version automatically.
- **Art:** Nate's first four textures (grass, farmland, forest, hills) are already in the game. Everything else uses placeholders painted in code. `pnpm art:import` brings in new art by file name and reports what's missing.
- **Names:** any place can be renamed in `packages/mapgen/names/<map>.json` (then `pnpm build-maps`).
- **Speed** (phone emulation with the processor slowed 4x): 60 frames a second while panning at every zoom on both maps; the map appears about 2.2–2.4 seconds after pressing Start.
- Full games played to the end on a laptop and in phone emulation (with Tactical view on).
- Screenshots: `docs/art/screens/`. 159 automated tests pass (32 new).

### Oct 2: Orchestrator review of session 4
- Checked the work: it matches the plan, GitHub's checks pass, and the screenshots look like a real illustrated atlas.
- Small things to fix in session 5:
  - In the fog, one territory showed **your own colour with "0?"**, probably an old memory of land you lost.
  - Region names run over army markers at Mid zoom.
  - At Far zoom on a laptop the map only fills about two-thirds of the screen.
- **Nate's second art batch** (18 files: the rest of the ground and water textures, mountains, hills and trees) arrived after the session. It's on-style. To redo: `tree-conifer-1` and `-2` (round bushes, not pines) and `tree-broadleaf-3` (a smudge). Rock, snow and hills textures have big built-in shadows that repeat. The prompt pack now asks for flat, even lighting.
- Nate's calls:
  - The seventh House colour becomes **Teal** (Celeste looked like Azure).
  - **Lighter fog**: a soft haze you can see the land through.
  - Raw art stays out of GitHub; Nate backs it up to **Google Drive**.
  - **Session 5 waits for the art batch Nate is generating now**, so the menus use real icons and portraits.
- Next prompt: `docs/prompts/claude-code-session-05.md`.

### Oct 3: Map builder idea, and making the art blend
- Nate raised a **custom map builder** as a future add-on, and asked how the art will blend and how House borders will show.
- **Map builder:** it shares a real foundation with random maps (the map maker's cells, outlines, quality checks, placement and the renderer), so they're planned together but built in order: a dev-only **map lab** early in M3, **random maps** in M5 (after splitting the map maker into stages that can be re-run and pinned), then the **builder** in M6 or sooner. Plan: `docs/07-map-tooling.md`.
- **Blending:** every map is data that one renderer paints, so blending gets fixed once and works for every map. Session 5 adds colour matching in the art importer, natural edges between ground types, and one final colour grade.
- **Borders:** the session 4 screenshots showed the glow straddling the line (where two Houses meet, one colour wins), spilling onto water, and the flat tint muddying the ground. New rules in `docs/06-art-direction.md`: each House's band sits inside its own land, an edge wash instead of a flat fill, tints that keep the House colour true, and a selection style that can't be mistaken for a House. Added to session 5 Part A, with a House-on-every-ground check image.
- Question for Nate: is the builder for him only (a desktop tool) or for players too?

### Oct 3: Art session 2 (Gemini): Tier 1 and Tier 2 art finished
- Claude drove Gemini through Chrome and reviewed every image before keeping it. **44 new files** are in `art/incoming/` (79 in total), each listed in `_source-map.txt`:
  - **Tier 1:** figure-cavalry, -siege, -scouts, -engineers, -healers, banner-flag, ship, bridge, cloud-1..3.
  - **Tier 2:** shield-base, banner-base, 13 icons (crown, gold, culture, troops, fort, market, barracks, watchtower, cavalry, siege, scouts, engineers, healers), emblem, seal, frame-corner, leader-01..10 (navy backgrounds) and five vistas (city, valley, forest, mountain, harbor).
- **Rejected:** a flag with a fort wall blended in from a reference image, a ship with a tiny fort tower on it, a bridge with a ghost ship under the arch, and a cloud with a stray orb. The last two were fixed by asking Gemini to remove the stray piece. Rejects are in `art/incoming/_review/rejected/` or left unused in Downloads.
- **Small compromises:** the bottom coin in `icon-gold` fades slightly into the background (invisible at 24px). `icon-barracks` is a touch more cartoon-like than the others. Most figures are at a lower camera angle than 45°, matching `figure-army`. Vistas are 16:9 (Gemini's widest), so the importer trims a little off the top and bottom to make 2:1.
- **Lessons** (now in the prompt pack): pick reference images that don't share subjects with the new image, name the last subject in each prompt ("no ship"), review the downloaded file rather than the preview, scrub Gemini's corner watermark from PNG downloads, and start a new chat every 8–10 images.
- `docs/art/asset-list-and-prompts.md` now has the current semi-realistic style line and the prompts that worked (the project copy is updated too).
- Next: run `pnpm art:import` and check the results in the game (session 5).

### Oct 3: Claude Code session 5 (M2, part 4: menus, replay, timer, phone, installable app, preview)
- **Missing inputs:** the orchestrator's Oct 3 doc updates and Nate's art batches 2 and 3 weren't on GitHub, so this session worked from the pasted prompt (saved as `docs/prompts/claude-code-session-05.md`) and the 4 textures already in the game. Everything else uses painted placeholders, including new ones for Leader portraits, card vistas and the wax seal.
- **The "Azure 0?" bug:** two engine bugs together. A battle that killed everyone on both sides left the defender holding land with 0 troops, and your memory never noted land you lost. Now the last defender holds with 1 troop, and you remember who took your land. Both have tests.
- **Map fixes:**
  - "Fit map" fills the screen around the menus, with open sea painted beyond the edges.
  - Province names fade where an army marker sits.
  - **Teal replaces Celeste**, checked with colourblind simulations (`houses.png`).
  - Fog is a pale haze you can see the land through.
  - House borders: each House's band sits inside its own land, with an ink line between neighbours and a soft wash inward. Selection is a pulsing gold double rule; remembered land has a dashed outline (`house-on-ground.png`).
  - Natural ground edges, beaches on the coasts, rock and snow on high ground, one colour grade, and soft shadows under trees, peaks and towns.
- **Art import makes the art match:** it evens out baked-in light and dark patches and nudges colours toward a small palette (`packages/art/src/palette.ts`); before/after in `art-matching-before-after.png`. It also no longer deletes art when run on a computer that doesn't have the originals.
- **Turn timer:** 1, 3, 5 or 10 minutes, or No timer. It turns gold at 1 minute and red at 15 seconds. When it runs out, your orders lock in as they are. It's kept by the game host (the server in M4), not the rules.
- **Animated replay:** after Lock in, armies march, battles clash and show the result, land changes colour, and recruits pop in. Fog shows only a pulse and "A battle in Northreach". About 10–20 seconds. Skip, and Watch again from the report.
- **Gilded menus:** top bar (gold +N per turn, turn, timer), Houses panel (shield, Leader portrait, in or out), round action buttons, army panel, order queue, wax seal, territory card with vista, Leader card, pop-ups, a grouped turn report, minimap, and gilded lobby and game-over screens.
  - Recruit is now one tap and Hire and Build became "Spend", so **a typical turn takes 7 taps** (was 8).
- **Phone:** full-screen map, action bar at the bottom, and a bottom sheet you drag between half and full. Checked at 412×915 and 360×740.
- **Installable app:** installs from Chrome, works offline for single player, and shows "Update ready" instead of reloading mid-game.
- **Private preview:** `pnpm deploy:preview` uploads the game, then checks that the site still asks for the Google sign-in. There's no public workers.dev address. Nate's one-time steps are in the README. This cloud session couldn't reach Cloudflare or the domain, so it isn't live yet.
- Full games played to the end on a laptop screen and in phone emulation, each with a real timer auto-lock (`pnpm ui-check play`). 198 automated tests pass (39 new). Screenshots: `docs/art/screens/ui-*.png` and the map shots.

### Oct 4: Orchestrator review of session 5
- Checked the work: GitHub's checks pass, the scope held, and the new screens look good (gilded menus, replay, phone layout). A typical turn is now **7 taps**.
- **Lesson: session 5 ran in the cloud**, so it couldn't see Nate's art (it stays on his computer, out of GitHub) or reach Cloudflare. It also worked on a side branch. From now on, sessions that need the art, the browser or Cloudflare run **locally on Nate's computer**.
- Tidied up:
  - Merged the Oct 3 docs (art direction, map tooling, the art list), which were still sitting uncommitted on Nate's computer, with session 5's docs, and moved everything onto `main`.
  - **Created the Cloudflare Access lock** ("Conquerra": Google sign-in only, policy "Conquerra players" = Nate's email, sign-in lasts a month). Nothing is online yet: no Conquerra Worker exists.
- Nate's call: **keep Purpure**. Azure and Purpure look alike to colourblind players, but their banner patterns tell them apart.
- Small things for session 6: the Leader card's text runs into the bottom bar on desktop, and the army panel's hint line is clipped.
- Next prompt: `docs/prompts/claude-code-session-06.md` (run it in Claude Code on Nate's computer, not in the cloud).

### Oct 4: Claude Code session 6 (M2 finish: real art, polish, the preview goes live)
- **Computer in sync:** Nate's old local doc copies were checked line by line against `main`. Nothing was lost, except that the saved session 5 prompt was a shortened copy, so the orchestrator's full original was put back. Old side branch deleted. Work is on `main` again.
- **Nate's art is in:** all 79 files of Tier 1 and Tier 2 imported, nothing missing or rejected. The menus now use the real emblem (top bar and app icons), wax seal, gold frame corners, the icons (action bar, army panel, territory card), Leader portraits and the vistas.
- **Art fixes made by the importer** (no redraws needed):
  - Gemini's backgrounds are lighter pinks than pure magenta, which left ghost squares behind clouds and a hill, and pink edges around many pieces. Both are fixed.
  - The `tree-broadleaf-3` smudge is removed automatically.
  - Clouds are made cool white.
  - Grass, rock, snow and water are evened out more.
  - The open sea no longer shows a repeating grid.
- **Still worth redoing (Nate):** the two pine clusters (`tree-conifer-1`, `-2`) still read as round bushes; tuning can't change shapes. Lower priority: the rock, snow and hills textures still have big built-in shapes (mostly hidden under mountains and hills).
- **A real freeze, found and fixed:** on the third or fourth turn the replay could lock the page up. The map was redrawing all its borders about 30 times a second during the replay. It now redraws only when something changes. Whole games now play to the end on laptop and phone.
- **Polish:**
  - The desktop Leader card fits, and the army panel's hint isn't clipped.
  - The round buttons show Nate's icons, with the Recruit count as a badge.
  - "Lock in" sits on a ribbon under the seal's star.
  - The phone replay bar stays on one line, and "1 troop" is no longer "1 troops".
- **Replay camera:** when a battle, fogged battle or fallen Leader happens off screen, the camera glides there (never zooming), holds, and glides back at the end. Skip, or moving the map yourself, stops it. For fogged events it aims only at the pulse.
- **Speed** (phone emulation, CPU slowed 4x, real art, this laptop's Intel GPU): the map appears in about 2.1 s (Embervale) and 2.2 s (Greatmarch). This laptop's Chrome holds every page, even a blank one, at 30 fps. With that cap lifted, panning runs at 215–315 fps at every zoom, so there's lots of room. Memory: 52–85 MB.
- **Private preview: uploaded, but not reachable yet.** Wrangler is logged in and `pnpm deploy:preview` uploaded the game. Cloudflare confirms there's no workers.dev address and no preview addresses, and the custom domain is attached with a certificate. But the domain's nameservers still have no `conquerra` record after 25+ minutes, so the address doesn't open for anyone (safe: the game isn't exposed). The lock check therefore couldn't confirm the Google sign-in yet. Nate needs to look in the Cloudflare dashboard (steps in the session summary), then run `pnpm check:preview`.
- 210 automated tests pass (12 new). Screenshots retaken: `docs/art/screens/`.

### Oct 4: Orchestrator review of session 6 (the preview is live)
- Checked the work: GitHub's checks pass, all of Nate's art is in, and the game looks like the Gilded Atlas we aimed for.
- **The preview is online and locked.** The missing DNS record turned out to be a delay: an hour later the `conquerra` record was in Cloudflare's DNS list and the address answered. The orchestrator checked it from the browser on Nate's computer:
  - without a sign-in, every page and file redirects to the Cloudflare sign-in, so nothing of the game loads
  - signed in as Nate (Google), the game loads
  - `conquerra.nkurtz.workers.dev` shows "nothing here", so there's no back door
- Small things for the next session: the army panel's bottom row (Recruit −, 12, +) is still cut off on desktop.
- Art for Nate to redo when he has time: `tree-conifer-1` and `-2` (still round bushes), then the rock, snow and hills textures.
- **Next:** Nate plays on his phone (sign in, install the app, a game with a 1-minute timer). That closes M2. Then session 7 starts M3.
- Six Claude Code sessions are done, so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-03.md`.

### Oct 4: Nate's phone test, and the plan for M3
- **On Nate's phone:** the app installed fine and the timer locked his orders in when it ran out. But the installed app showed the **desktop layout** instead of the phone one.
- **Nate's new ideas, now decided:**
  - **Chained attacks:** win at B, and the same army can attack on from B in a later order that turn. No limit on hops, but each hop waits its turn in the order queue, so rivals can react in between.
  - **Amounts as shares:** send All, 3/4, 1/2 or 1/4 of the army (or "Just enough") rather than typing a troop number, because a chained army's size isn't known until its battle is over.
- **Plan:** session 7 fixes the phone layout, builds chaining and shares, and fixes the army panel's clipped row. Then M3 in this order: smarter bots and the map lab; generals and the Fallen; the Spoils and Fate card decks; diplomacy; spies and culture unlocks; a balance pass.
- Next prompt: `docs/prompts/claude-code-session-07.md` (run it locally).

### Oct 4: Claude Code session 7 (M2 wrap-up: phone layout, chained attacks, amounts as shares)
- **Phone layout:** the game used to pick the phone layout only from the page width. Chrome's "Desktop site" setting, or turning the phone sideways, reports a wider page, so a phone could get the desktop layout. Now a phone-sized touch screen always gets the phone layout, whatever width the page claims (tested for Desktop site, sideways and the installed app). **Settings → Layout** (Auto / Phone / Desktop) lets you force either, and it's remembered on the device.
- **Diagnostics view (hidden):** tap the version line in Settings or the lobby 5 times (or add `?debug=layout`). It shows what the phone reports and which layout it picked and why. **Copy all** copies it for pasting.
- **Updates reach the installed app:** it now checks for a new version when it opens, when you switch back to it, and every 30 minutes, then shows "Update ready".
- **Chained attacks:** an army that moved in or captured can push on from there in a later order the same turn. Each hop waits for its own turn in the round-robin, so rivals act in between. Every hop leaves 1 troop behind. If a hop fails, later hops from land you don't hold fizzle (or run their backup). Follow through is the automatic version and steps aside if you queue your own hop.
- **Amounts as shares:** moves and attacks send Just enough, All, 3/4, 1/2 or 1/4 of the army that's there when the order plays (an exact number is under More). A first attack starts on Just enough; a hop and a move start on All.
- **On the map:** after you queue an attack, its target shows a faint "≈18" (the army expected to arrive). Tap a neighbour of it to queue the next hop. Chain arrows show hop numbers ①②③, and a hop's odds say "estimate".
- **A typical turn is now 6 taps** (was 7). A turn with one chained hop is also 6.
- **Desktop army panel:** it grows up over the map instead of being cut off; the Recruit −/+ row shows in full.
- **Simulator (1,000 games each):** chaining shortens 4–6 player games by about a turn (4 players: 25.9 → 24.9 turns). Seats stay fair. Runaways (one player with half the map by turn 10) rise a little: 40% → 45% at 4 players, 24% → 27% at 6. 10-player games are still about 36 turns. Details and options: `docs/sim-results-m2-chaining.md`. No rules were changed for balance.
- 240 automated tests pass (30 new). Screenshots: `docs/art/screens/ui-chain-desktop.png`, `ui-chain-phone.png`, `ui-share-chips.png`, `ui-share-chips-phone.png`, `ui-diagnostics.png`, and `ui-desktop.png` (retaken).
- **Nate's phone check (after the deploy):** the installed app updated (version c20f39b). Its diagnostics showed the cause: Chrome's **"Desktop site"** mode was on, so the phone reported a desktop computer with a 980px-wide page on a 384px screen. The new check picked the phone layout anyway, but in Desktop site mode everything is drawn for a 980px page and shrunk to fit. Once Nate turned Desktop site off, the phone layout looked right. Queuing a chain on the phone worked, with hop numbers and the "≈" marker.

### Oct 4: Orchestrator review of session 7 (M2 is done)
- Checked the work: GitHub's checks pass, the scope held, and the screenshots show the chain (numbered hops, "≈" arrival markers), the share chips, and the desktop army panel no longer cut off. **M2 is done:** Nate has played full games against bots on his laptop and his phone.
- **Phone:** the tiny-looking menus and the main menu not filling the screen came from Chrome's "Desktop site" setting too. With it off, everything looks right. The game will show a one-line tip when it detects Desktop site.
- **Nate's calls:**
  - The survivors of a failed attack fall back and can't attack again that turn.
  - Runaways: no rule change for now. We'll look again after the smarter bots and in the balance pass.
  - 10-player games (about 36 turns): wait for the smarter bots and the balance pass. Conquest stays the lobby's suggestion for 8+.
  - **New idea: the fog lifts during the replay.** As your army takes a territory, you start seeing around it right then, so you can watch a chain push into the fog. Anything you see along the way goes into your "last seen" memory.
  - **The map builder is for players from the start** (not just Nate). That means saving, sharing and playing each other's maps, with automatic fairness checks. It still comes after online play.
- **M3 grows by one session:** 8 the fog lifts during the replay, plus smarter bots · 9 the map lab · 10 generals and the Fallen · 11 Spoils and Fate decks · 12 diplomacy · 13 spies and culture unlocks · 14 balance pass.
- Next prompt: `docs/prompts/claude-code-session-08.md` (run it locally).

### Oct 4: Claude Code session 8 (M3 start: the fog lifts during the replay, smarter bots)
- **The fog lifts during the replay.** What you can see is now worked out step by step through the turn. Take a territory and the fog fades off the land around it right then, so you can watch a chain push into land you couldn't see. Lose one and the land around it fogs over from that moment. Everything you saw along the way goes into your "last seen" memory ("Seen last turn" on the next turn).
  - **The replay rule, narrowed:** someone else's action shows in full only if you could see its land *at the moment it happened*. Land that only came into view later in the turn doesn't count any more (the old rule used "visible at the start or end of the turn"), so a few things that used to show now don't.
  - It's worked out from the turn's event log, the record the server will keep in M4. A test checks every replay event and every revealed territory against the real game at that moment.
  - On screen: the fog fades in about a third of a second, the replay ends exactly on the new turn's map, the camera follows a chain off screen (and your own battles beat a fogged pulse for its attention), and the turn report has "What came out of the fog".
  - Turn speed, measured back to back: 0.22 → 0.30 ms on average at 4 players, 0.53 → 0.67 ms at 10. Still well under a millisecond.
- **Captain bot, the new default** (Lobby → Bots: Recruit (easy) / Captain). It plays only from its own view and holds passes cheaply, gathers a real army before breaking through, lands where the far side is weak, finishes weakened rivals (one spearhead in the endgame), defends its capital, and chains on into the fog. The full list is in `docs/rules-reference.md` §13.
  - It wins **37%** of games against three Recruits (fair: 25%) and **77%** head to head.
  - All-Captain games: **4 players 24.0 turns, 6 players 25.0** (both on target now; were 24.9 and 26.0). 2 players: 22.3. 10 players got longer: 36 → 40.
  - **Runaways got more common** (one player on half the map by turn 10: 45% → 55% at 4 players, 27% → 46% at 6). No rules changed; options for Nate are in `docs/sim-results-m3-bots.md`.
  - Bots take about 3.5 ms a turn for nine Captains at 10 players (worst 27 ms, on a laptop running slow).
- **Desktop site tip:** if Chrome's Desktop site is on (a phone drawing a page much wider than its screen), a one-line tip in the lobby and the game says how to turn it off. You can dismiss it, and the phone remembers.
- 269 automated tests pass (29 new). Screenshots: `docs/art/screens/ui-replay-fog-1.png`, `-2.png`, `-3.png`, `ui-replay-fog-phone-2.png`, `ui-lobby-bots.png`, `ui-desktop-site-tip.png`.

### Oct 4: Orchestrator review of session 8
- Checked the work: GitHub's checks pass, the scope held, and the screenshots show the fog clearing around each capture during the replay, the lobby's new Bots row and the Desktop site tip.
- **Nate's calls:**
  - **Runaways:** Captain bots made early runaways more common (6 players: 27% → 46% of games with one player on half the map by turn 10). The fix is in the bots, not the rules: in session 10, Captains (and generals, which use the same brain) gang up on whoever is running away with the map, as people do. Rule brakes stay on file for the balance pass.
  - The smarter bot keeps the name **Captain**.
  - **The map lab lives on the private preview** (only Nate can sign in), so he can use it from his laptop. It's hidden at public launch.

### Oct 4: Nate's play test of session 8, and a new plan
Nate played a full game (against Recruit bots; Captains next). What he found, and what the orchestrator dug up:
- **An attack of 35 against 1 failed. That's a real bug.** The game worked out "about 1 loss" for the defender before rolling the luck, so a hopeless defender could survive by rounding. In 300 bot games, about 1 in 20 attacks with 8 times the troops or more failed. It's fixed first thing in session 9, with a test that a "guaranteed" attack always wins.
- **Recruits only landed in the capital or one other place.** That was the rule: recruit at your capital or a barracks. **Nate's call:** also anywhere in a province you hold completely. And you choose how many (All, 3/4, 1/2, 1/4 or an exact number).
- **Culture didn't seem to matter.** It didn't: a market earns about 4 times more per gold, and culture's other effects were invisible. **Nate's call: "loyal land".** Each level makes that territory defend about 5% better, on top of the protection and specialist unlocks, and the game shows and explains it.
- **You can't tell what's connected.** Some neighbours share only a sliver of border (Embervale has 8, Greatmarch 13, one almost a single point), and passes are drawn very narrow. Session 9 makes the map maker stop doing that, rebuilds both maps, and marks every neighbour when you select a territory.
- **Provinces aren't clear.** They get their own border style and a plaque: "Pinemark +3 · you hold 3 of 5".
- **Buildings look like ghosts.** They were drawn small, and see-through while being built. They'll be twice the size and stand on the ground like the capital.
- **Maps should be bigger and more imaginative** (islands, twin continents, a fantasy-shaped land), not one round blob. **Nate's call:** keep a 40-territory quick map; new maps of 60–120.
- **"The visuals need to be cleaned up and improved."** The orchestrator's review and the three-step plan are in `docs/08-visual-upgrade-plan.md`.

**New session order (Nate's call):**
- 9: play-test fixes and clarity
- 10: map lab, bigger maps and new shapes, art test bench
- 11: big visual upgrade (with a new art batch from Nate)
- 12: generals, the Fallen, and bots ganging up on a runaway leader
- 13: card decks
- 14: diplomacy
- 15: spies and culture unlocks
- 16: balance pass

Next prompt: `docs/prompts/claude-code-session-09.md` (run it locally). A fresh orchestrator prompt comes after session 9.

### Oct 5: Claude Code session 9, part 1 (stopped at the usage limit)
- **Done and pushed:**
  - **The combat bug is fixed.** Luck is now rolled on the full expected losses, so an overwhelming attack always wins: lopsided attacks that failed went from 5.3% to 0.
  - **Every order that didn't happen says which one and why**, in plain words. A failed attack says why the defence held ("They held: hills and a fort").
  - **Settings → Save this game** makes a small file that `pnpm sim --replay` plays back exactly.
  - **Recruiting:** at your capital, a barracks, or anywhere in a province you hold completely. You choose how many with the same chips as attacks, and every place you can recruit lights up. A typical turn is still 6 taps.
  - **Culture defends:** +5% per level. Half done: not yet tuned or shown on the map.
- **What the orchestrator found:** the jump in runaways comes mostly from the combat fix. Attacks finally work, so games are faster (4 players: 23.9 → about 19 turns) and more decisive (one player on half the map by turn 10: 54% → 80%).
- **Nate's calls:**
  - Runaways are a **bot strategy** problem, not an engine or chaining one. The bots should account for a player pulling ahead. The "gang up on the leader" behaviour moves up into session 9b, along with bots defending against a fast attacker.
  - **Game length in real time:** his game against Recruit bots took about 30 minutes, which is too short. His targets are **single player 45–90 minutes** and **a live online game 2 hours or more**. No rule change now: cards, generals, diplomacy, bigger maps and smarter opponents will all lengthen games. The sim write-ups will start estimating real time.
- **The rest of session 9 is one session, 9b**, for Nate's next usage window (his call): finish culture, bots that handle a runaway, the sim write-up, map clarity, buildings, then one deploy. It commits after every part, so nothing is lost if it's cut off.
- Next prompt: `docs/prompts/claude-code-session-09b.md` (run it locally).

### Oct 5: Claude Code session 9 complete (9 and 9b: play-test fixes, bots that handle a runaway, map clarity, buildings)
Session 9 stopped at the usage limit after the combat fix, plain-words "called off" lines, Save this game and province recruiting (see the entry above). Session 9b finished the rest in one go, committing after each part.
- **Culture ("loyal land"), tuned and shown:**
  - Each level makes that territory defend **6% better** (+30% at level 5), and raising it costs **3, 4, 6, 8, 10** gold (was 4, 6, 8, 10, 12).
  - The size of the bonus barely mattered in the sim; **where the Captain bought it was the problem.** It now buys only at its capital or a choke point it holds, with a rival army next door and enough troops there for the bonus to be worth the gold. Captains that buy culture now win **50%** against Captains that don't (was 37.7%): a fair buy, not a must-buy.
  - On screen: small gold laurels on the troop pill (one per level, Mid and Near). The card says "Culture 2: defends +12%, shrugs off 30% of unrest, +1 gold, unlocks Siege and Engineers in Old March", or "No culture yet: raising it costs 3 gold". The panel and the Culture button say what the next level adds.
- **Bots that handle a player pulling ahead** (they judge everything from their own view; the same rule for every seat):
  - **Gang up on a runaway leader:** a rival that looks to hold about 40% of the land (or far more than anyone else) becomes the main target; those fronts keep honest garrisons; no attacks on weaker rivals who are holding the leader off.
  - **Turn on a fast attacker:** bots now see what their seat watched in last turn's replay. A rival that took 2+ of their territories becomes the target (its chain is thinly held), and they recruit and march troops to that front instead of grabbing neutral land nearby.
  - A first version that just dug in cut runaways too, but Recruit bots then beat the Captain far more often, so it was dropped. The Captain is now stronger against Recruits than at the start of the session (33.5% at a table of 1 Captain + 3 Recruits; 92% head to head).
- **Simulator** (1,000 games each; `docs/sim-results-m3-fixes.md`):
  - Average turns, session 8 → now: 2 players 22.3 → 19.3, 4 players 24.0 → 20.8, 6 players 25.0 → 27.7, 10 players 39.8 → 35.1.
  - **Real time, roughly** (1.5 minutes a turn plus half a minute of replay): single player about 39 / 42 / 55 / 70 minutes; online with the 5-minute timer up to 1.8 / 1.9 / 2.5 / 3.2 hours. 4-player games are still a little under Nate's targets.
  - **Runaways** (4 players): one player on half the map by turn 10: 82% at the start of the session → 38% now. Part 2's bots account for about a third of that (49% → 38% on the same maps); the rebuilt Embervale for the rest (its 4-player capitals start a border closer). The leader at halfway still wins 83% of the time, and 20% of games are comebacks.
  - Seats are fair; lopsided attacks that failed: 0 of about 330,000.
  - Recruits: about a quarter of all troops are now recruited in fully held provinces.
- **Map clarity:**
  - **No hairline borders:** the map maker now gives the corner to a third neighbour when two territories barely touch (they stop being neighbours), or widens the contact if it can't. Embervale's shortest border went from 4.4 to 24 map units, Greatmarch's from 0.6 to 22.9 (a typical one is about 90). `checkMap` now rejects any map with one.
  - **Passes are wide:** 36–45 units on Embervale (were 12 and 23) and 29–50 on Greatmarch (were 9–31), each with a road and a gate symbol you can see at Mid zoom. Also a `checkMap` check.
  - **Both maps rebuilt** (map maker v2) from the same seeds: same coasts, lakes, islands and ranges, a few more passes, and **new place names** (names now come from their own random sequence, so they won't change again when shapes do). They play about the same length.
  - **Select a territory and every neighbour is marked:** a gilded chevron across the shared border (red core: you'd attack, blue: you'd move), blue ripples for a river, a stone arch for a pass, and its sea lanes light up.
  - **Every territory edge** is a crisp ink line with a light halo, at every zoom. **Province borders** are a gilded double line, and each province has a plaque: "Old March +4 · you hold 4 of 6" (just "+4" if you hold none of it), at Far and Mid. Plaques and province names never cover an army.
  - **Tactical view** really is flat House colours. The old screenshot looked painted because the capture script clicked "fit the whole map" instead; it's fixed and retaken.
- **Buildings stand on the map:** about twice the size, on a ground shadow like the capital's, and they step aside so the army marker never covers them. Being built: a wooden scaffold and a slightly washed-out building (no see-through ghost), and the pill's icon stays solid with a small hourglass.
- **Plainer panel and card:** the army panel's grey line is now chips ("Plains, defends ×1", "+2 gold a turn", "Old March +4 if you hold all 6 · you hold 3"), and the card is one plain sentence per row with its icon ("Held by Lady Morwen", "12 troops", "Fort, being built (ready next turn)"). Checked on a 384 px phone.
- **Deployed** to the private preview (version `7af998a7`); the lock check passed.
- 302 automated tests pass. Screenshots (`docs/art/screens/`): `ui-recruit-sites.png` (+ `-phone`), `ui-culture-card.png`, `ui-culture-pips.png`, `ui-report-called-off.png`, `ui-links-pass.png`, `ui-links-sea.png`, `ui-provinces-mid.png`, `ui-provinces-far.png`, `ui-buildings-mid.png`, `ui-buildings-near.png`, `ui-buildings-board-staged-mid.png` / `-near.png` (all four built and being built, staged by editing the page's view, since only forts are ever "being built" between turns), `ui-army-panel.png` (+ `-phone`), `ui-territory-card.png` (+ `-phone`), `ui-tactical.png`, `embervale-tactical.png`, and the map previews `docs/maps/embervale.png`, `greatmarch.png`. `pnpm ui-check clarity` retakes them.
- **Nate's play test:** asked to play after the deploy (results below once he has).

### Oct 5: Orchestrator review of session 9
- Checked the work: GitHub's checks pass, all five parts landed, and the screenshots look right:
  - province plaques with "you hold 4 of 6"
  - chevrons on every neighbour, with pass gates
  - buildings standing on the map
  - a truly flat Tactical view
- **Nate's calls:**
  - The rebuilt Embervale's closer start (4-player capitals 3 borders apart, was 4) is fine: it's the quick map, and the bigger maps give more room.
  - **Game length is measured in turns, not minutes** (minutes are hard to judge with bots), and **games may run up to 30–40 turns**. This replaces the 15–25 target.
- Still to come: Nate's play test of session 9.
- Nine Claude Code sessions are done, so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-04.md`.
- Next prompt: `docs/prompts/claude-code-session-10.md` (run it locally): bigger maps in new shapes, the map lab, the art test bench, candidate maps.

### Oct 5: Claude Code session 10 (M3: bigger maps in new shapes, the map lab, the art test bench)
No new art had arrived and Nate's session 9 play test isn't in yet, so there was nothing to fix first. All four parts are done, each committed and pushed.
- **New land shapes** (map maker): one continent (as before, and still the default), an **archipelago** (every island joined by a sea lane), **twin continents** (with sea lanes and sometimes a narrow land bridge), land ringing an **inland sea**, a **crescent**, and a **silhouette**: the land grows inside a drawn outline. Three come built in: a dragon, a shield and a crown. Nate can add his own by drawing a black-and-white picture (`pnpm --filter @conquerra/mapgen mask picture.png wolf "The Wolf"`).
  - **Sizes 40 to 120 territories**, with provinces scaled to match (about 4.5 territories each) and fair capitals for every player count a map claims.
  - **Embervale and Greatmarch are exactly the same** (a test checks, byte for byte).
  - Two fixes along the way: a stuck "hairline border" now joins the mountain range or becomes a cove, instead of throwing the map away (big maps hit this a lot); and the capital search does the same work in half the time.
  - **Making a map:** 60 territories 0.5–3 s, 100 territories 1.5–5 s, 120 territories 1.5–20 s (crescents and big archipelagos need the most tries). The browser is about as fast as the command line.
- **The map lab** at `conquerra.overconfidenceonline.com/?lab=maps` (behind the same sign-in, never linked from the lobby):
  - pick a shape, size and seed, or start from Embervale or Greatmarch; every setting has a plain label
  - it makes the map in the background, saying how long it took and why each earlier try failed
  - it shows the map with the game's own painting, at Far, Mid and Near, with Tactical view and toggles for names, choke points and capitals (for any player count)
  - the checks in plain words, a fair-capitals table, a territory-size chart
  - **Sim this map**: a few hundred Captain games with a progress bar, showing length, seat wins, runaways and where the battles happen
  - a **seed gallery** (12 at a time), and Copy recipe, Paste recipe and Save image
  - A link to the lab always carries the full recipe, so it opens exactly the same map.
  - **The game itself didn't get heavier:** what loads before the lobby went from 442.4 to 442.7 KB. The lab loads only when opened. For the public launch, build with `VITE_LABS=off` and the lab isn't in the game at all.
  - The lab's pieces each take a finished map, ready for the player map builder after M4.
- **Big maps on a phone** (emulated mid-range phone, CPU slowed 4x): a 120-territory map paints in 6.1–7.1 s (Greatmarch: 6.0 s measured the same way) and pans at 46–81 frames a second. It already paints at lower detail on big maps, so nothing needed changing.
- **The art test bench** at `?lab=bench` (it replaces `?lab=houses`), drawn by the game's own renderer at true size:
  - every House on every ground
  - every pair of grounds meeting, plus coasts and a river through hills
  - every tree, peak, hill, village, town, building (built and being built) and figure on every ground
  - the map symbols (neighbour chevrons, pass gate, plaques, culture laurels)
  - a "redo list" sheet: the rock, snow and hills textures with their big repeating shapes, and the pines that look like bushes
  - `pnpm map-check bench` saved 20 "before" pictures for session 11 in `docs/art/screens/bench/`.
- **Six candidate maps** for Nate (`docs/maps/candidates.md`, one Far picture each, 200 Captain games at each end of the suggested player range):
  - The Shattered Isles (archipelago, 60, 4–6 players): 28 / 37 turns
  - The Twin Realms (twin continents, 80, 4–8): 24 / 30
  - The Moon Coast (crescent, 80, 4–8): 27 / 31
  - The Ringsea (inland sea, 100, 6–10): 36 / 39
  - The Crownlands (crown, 100, 6–10): 35 / 38
  - Wyrmland (dragon, 120, 6–8): 32 / 37. Wyrmland needed 2 mountain ranges instead of 4; with 4 it ran 44–45 turns.
  - All pass every check, and none is in the lobby until Nate picks.
- **What shape does to length:**
  - Mountain passes are the biggest lever: fewer passes, shorter games.
  - Two halves or a long thin land end sooner (Twin Realms 9 turns shorter than a plain continent at 4 players).
  - Islands make 6-player games much longer (+12 turns).
  - At 10 players, 100-territory maps land inside 30–40 turns; 120-territory maps run 41–45.
- The simulator's core is now shared by `pnpm sim`, the lab and the candidate script (`packages/simcore`). `pnpm sim` reports the new target (within 40 turns, and inside 30–40).
- 337 automated tests pass (35 new). Deployed to the private preview (version `fcee6083`); the lock check passed, including `/?lab=maps` and `/?lab=bench`.
- **Screenshots** (`docs/art/screens/`):
  - the lab: `lab-overview.png`, `lab-checks.png`, `lab-gallery.png`, `lab-sim-running.png`, `lab-sim.png`
  - one Far view per shape: `shape-continent.png`, `shape-archipelago.png`, `shape-twinContinents.png`, `shape-crescent.png`, `shape-inlandSea.png`, `shape-crown.png`, `shape-dragon.png`, `shape-shield.png`
  - the bench set in `bench/`, and big-map phone numbers in `perf-big.json`
- **Nate's check of the lab:** asked after the deploy (his notes and picks go below once he's tried it).

### Oct 5: Orchestrator review of session 10
- **Checked the work:**
  - GitHub's checks pass on every commit, all four parts landed, and the engine and the existing maps didn't change.
  - Re-ran the most surprising number: on the Twin Realms, 4-player games take 24.4 turns, against 34.3 on a plain continent of the same size. It matches.
  - Looked at the Far view of every shape, the lab and the bench pictures. The isles, the twin continents, the crescent and the ring look like real places, and the crown reads well enough. **The dragon doesn't read as a dragon** (it looks like a lumpy continent).
  - One small bug: the bench's redo sheet cuts off its "Trees at 4x" row. It's fixed in session 11.
- **Nate's calls:**
  - **All six candidates become official maps:** the Shattered Isles, the Twin Realms, the Moon Coast, the Ringsea, the Crownlands and Wyrmland.
  - **The dragon:** Gemini draws a chunky black dragon outline in the next art batch, and session 11 rebuilds Wyrmland from it.
  - **10-player games may use 120-territory maps** even though they run about 41–45 turns. Wyrmland is suggested for 6–10.
  - **Mountain-range defaults stay as they are.** Range counts are tuned map by map (Wyrmland keeps 2).
- **Still to come:** Nate's play test of session 9, and his look at the map lab.
- **Next:**
  1. **Art batch 3** (about 20 images): Nate runs `docs/prompts/gemini-art-session-03.md` in a Claude chat that drives Gemini. It covers the redone pines and the hills, rock and snow textures, the dragon outline, mountain ridges, sea cliffs, a pass gate, scaffolding, a wooden bridge, four landmarks and a plaque frame. The list is at the end of `docs/art/asset-list-and-prompts.md`.
  2. **Session 11** (`docs/prompts/claude-code-session-11.md`, run it locally): the new art on the map, the six new maps in the lobby, the renderer pass (House colours, forests, a softer Far view), a roomier desktop layout, and before/after pictures on the bench.

### Oct 5: Claude Code session 11 (M3: the big visual upgrade, and six new official maps)
**Art batch 3 hadn't been made yet** (nothing new in `art/incoming/` or Downloads), so every new piece was built and placed by its rule, and keeps today's drawing until `pnpm art:import` brings the art in. There were no play-test notes to fix first. All five parts are done, each committed and pushed.
- **Six new official maps.** The Shattered Isles, the Twin Realms, the Moon Coast, the Ringsea, the Crownlands and Wyrmland are in the lobby (eight maps), with recipes exactly as in `docs/maps/candidates.md`.
  - **Wyrmland keeps today's hand-drawn dragon** (seed `mask-120-2`), suggested for 6–10 players. It gets rebuilt from Gemini's outline when batch 3 arrives (the steps are in `docs/07-map-tooling.md`).
  - Wyrmland, 200 Captain games each: **6 players 32.9 turns** (84% within 40), **8 players 36.9** (75%), **10 players 39.7** (61%; 6% reached the 60-turn cap).
  - The Crownlands came out with no rivers (the crown's land never gives one a long enough downhill run). It passes every check, it's just drier.
  - **Each map loads only when a game on it starts**, so the game's start-up didn't grow: 442.6 KB before, 445.7 KB after the whole session (+3.1 KB). Embervale and Greatmarch are cached for offline play as before; the newer maps are cached the first time they're played.
  - Tests check every official map is exactly what its recipe makes and passes the checks, that Embervale and Greatmarch are unchanged, and that the lobby lists eight maps.
- **Two small fixes:** the bench's redo sheet now shows its "Trees at 4x" row, and a province plaque at the map's edge slides in to stay on screen (it was cutting off the dragon picture's left side).
- **New painting, placed by rules from the map data** (`scenery.ts`; seeded from the map, no map file changes, tested on all eight maps):
  - **Mountain ranges read as ranges:** chains along each range's middle line, wide ridges where it runs across the screen, stacked peaks where it runs up and down, and every pass left open with its road. Today's peaks stand in for the ridge art.
  - **A gatehouse on every pass road** (the gate symbol then shows at Far).
  - **Sea cliffs** on straight, high, open stretches of coast, never by a sea lane's landing, and **a soft painted surf line** on every coast (that part is already visible).
  - **Bridges at river crossings:** stone ones now (there were none before), wooden ones on streams and farmland once that art is in.
  - **A few landmarks per map** (about one per 15 territories): lighthouses, windmills, standing stones and ruins, never on a capital, a building site, a pass, or under a pill or plaque.
  - The scaffold art over buildings being built, and the plaque frame under province plaques.
- **The painting pass:**
  - **House colours never muddy the ground:** the tint is now painted by the map's shader, which greys the ground's own colour and then lays the House colour on at its own brightness. Gold stays gold on grass, and red stays red on forest. Every House is checked on every ground on the bench.
  - **Forests:** pines higher up and in the north, broadleaf lower and in the south, with a few open glades.
  - **A softer, more painterly Far view** (one painted atlas), with borders, pills and plaques still crisp.
  - **Tactical view** checked: truly flat House colours.
- **Desktop menus:** one compact panel for the selected territory (bottom left, only as tall as its contents), the right column for the players and your Leader, and a dock (minimap and orders) that folds to a slim bar. The seal and the timer always show. There's now one type scale, and the round buttons' labels are bigger. **The phone is unchanged: a basic turn is still 6 taps on a 384 px screen.**
- **Phone performance** (emulated mid-range phone, CPU slowed 4x, measured back to back with the old version): Greatmarch paints in **3.88 s (was 3.64)**, and the 120-territory maps in **3.49–3.74 s (were 3.42–3.69)**. Panning runs at **54–56 frames a second, unchanged**. To keep it there, the scenery is worked out while the art downloads.
- **Pictures:**
  - before/after side by side: `docs/art/screens/compare/` (every bench shot, plus `greatmarch-far/-mid` and `ringsea-far/-mid`)
  - the "after" bench set: `docs/art/screens/bench-after/`
  - the game: `ui-desktop.png`, `ui-desktop-selected.png`, `ui-selected-panel.png`, `ui-desktop-folded.png`, `ui-phone.png`, `ui-phone-small.png`
  - the dragon: `shape-dragon.png` (still today's dragon)
- 432 automated tests pass. Deployed to the private preview (version `2fda17a7`); the lock check passed.
- **Asked Nate to play on the preview** (Ringsea on his phone, Twin Realms on his laptop, the lobby's eight maps, one game on Wyrmland). His notes go below once he's played.

### Oct 5: Orchestrator review of session 11
- **Checked the work:**
  - All five parts landed, the engine and bots didn't change, and Embervale and Greatmarch are unchanged.
  - Re-ran 10-player games on Wyrmland: 40.9 turns (session 11 said 39.7), and about 6% reach the 60-turn cap. It matches.
  - Looked at the before/after pictures: gold no longer turns mustard on grass, the map has more room on desktop, and the Far view is a little softer. Without batch 3 the change is modest.
  - **A failing test on `main`:** session 11's "Ideas for batch 4" list at the end of the art file was counted by a test that checks the art list against the game, so GitHub's checks failed. The list moved under "Tier 3: later" in the same file, and all 432 tests pass again. (Two other red marks were GitHub failing to start, not real failures.)
- **For Nate to look at when he plays:** at Mid zoom a House's colour now shows mostly along the edges of its land (the whole land is filled at Far), and the new desktop panel's last row sits right at the bottom of the window.
- **Nate's calls:**
  - **Session 12:** art batch 3 first, then **generals, captured generals and the Fallen**, as planned. If it runs short, the Fallen moves to session 13.
  - **Generals:** Nate likes both ideas. Session 12 builds **a general that leads one army** with a standing instruction (Hold here, Defend this border, Push toward, Raid a rival). **"Govern this province"** (keep a share of its income to build it up) is on file as a later instruction, planned for session 15.
  - **Captured generals command only:** no +20% fighting bonus, and you keep at most 2.
  - **The Crownlands gets another try for rivers:** new seeds of the same crown, shown to Nate before it changes.
  - The desktop dock keeps today's behaviour (starts open, remembers your choice).
- **Still to come:** Nate's play tests of sessions 9 and 11, his look at the map lab, and art batch 3.
- **Next:**
  1. Art batch 3 in Gemini (`docs/prompts/gemini-art-session-03.md`). **Do this before session 12.**
  2. Session 12 (`docs/prompts/claude-code-session-12.md`, run it locally).

### Oct 6: Art batch 3 made in Gemini
- A Claude chat drove Gemini and made all 20 pieces; they're in `art/incoming/`, ready for session 12 to import:
  - redone pines and hills, rock and snow textures (the old ones are in `_old/`)
  - the dragon outline for Wyrmland (one solid shape with an S-neck and a curled tail; it reads as a dragon at 160 pixels)
  - three ridges, three sea cliffs, a pass gate, scaffolding, a wooden bridge, four landmarks and the plaque frame
- **Compromises:**
  - The pines are steep-angle fir clusters rather than straight overhead; they read as pines at game size.
  - The new hills texture is slightly finer at the top, and the rock texture has faint dusty streaks.
  - A paler chalk cliff is there as an alternative (`_review/_alt/cliff-3-chalk.png`).
- Lessons for prompting Gemini are recorded in `docs/art/asset-list-and-prompts.md`. The big one: Gemini fakes "seamless" textures by repeating a small patch, so we ask for a vast scene and crop.
- Next: session 12 (`docs/prompts/claude-code-session-12.md`).

### Oct 6: Claude Code session 12 (M3: art batch 3 in, generals, captured generals and the Fallen)
All five parts are done, each committed and pushed. There were no play-test notes to fix first.
- **Art batch 3 is in, all 19 pieces.** Nothing kept today's drawing: pines, hills/rock/snow textures, ridges, sea cliffs, the pass gatehouse, scaffolding, the wooden bridge, four landmarks and the plaque frame.
  - **Tuned on the bench:**
    - the scaffold is sized to the building (it stood over a capital);
    - landmarks stay inside one territory (a windmill sat where three borders meet).
  - **Worth another go in batch 4** (in the art file, under Tier 3):
    - the hills texture looks like brown dirt at Near;
    - the new pines are bluer than the broadleaf trees;
    - a lower scaffold would show the building through it;
    - the wooden bridge is small and dark.
  - **Pictures:** before/after in `docs/art/screens/compare/`; the new bench set in `bench-after/`.
- **Desktop panel fix:** at 1440×900 the selected-territory panel faded out its own last row, because the frame's corner pieces hang 5 px below it. Fixed.
- **Wyrmland and the Crownlands re-seeded (Nate's OK):**
  - **Wyrmland** grows into Gemini's dragon, seed `mask-120-6`, now suggested for 6–8 players. Games run longer: 6 players 37.3 turns (was 33.0), 8 players 38.5 (36.7), 10 players 41.9 (39.2).
  - **The Crownlands** (`mask-100-9`) now has 5 rivers. 6 players 32.9 turns (was 35.4), 10 players 39.3 (38.0).
  - The other six maps are unchanged. Pictures: `docs/maps/session12/` and `docs/art/screens/s12-wyrmland-far.png`, `s12-crownlands-far.png`.
- **Generals:** your Leader can take a standing instruction (Hold here, Defend this border, Push toward a place, Raid a rival).
  - **How it works:**
    - It writes its army's orders each turn with the Captain's brain, from your view only.
    - It never spends gold.
    - Its orders sit at the top of your queue with its portrait.
    - Giving its army an order of your own takes control back for the turn.
  - **On screen:** select its land, then **Command**: 3 taps at most. **The basic turn is still 6 taps** on a 384 px phone.
  - **Sim** (one general seat against Captains, from turn 6): Hold, Push and Raid win about as often as a plain Captain; Defend wins less (it parks the army on a border).
  - **Dumb things found and fixed:** it emptied the capital, walked into stronger armies, and sent a lone Leader to march.
  - The Captain plays exactly as before (checked over 12,187 orders).
- **Captured generals:** knock a player out and their Leader joins you at your capital. It commands only: no +20% and no timing tricks. You keep two, it's gone for good if its land falls, and its portrait shows on its army.
- **The Fallen:** knocked-out players earn Influence and spend it on Plague, Storm, Uprising, Mercenaries and Famine.
  - **Caps:** no capitals, nobody knocked out, one event per player per turn, cooldowns, and culture protects.
  - **What they see:** who holds what, with no troop numbers.
  - **Tuning:** the first numbers made 6-player games 10 turns longer, so I tuned them down. All numbers are in `rules.fallen`.
  - **500 games each, without → with the Fallen:**
    - 4 players: 20.8 → 21.0 turns, comebacks 19 → 20%
    - 6 players: 27.7 → 29.8 turns, comebacks 37 → 41%
    - 10 players: 35.2 → 38.3 turns, comebacks 52 → 55%
  - **Risk:** at 10 players, games within 40 turns drop from 79% to 65%.
  - Details: `docs/sim-results-m3-generals.md`.
- **Rules:** `docs/rules-reference.md` §14–16.
- **Screenshots** (desktop and 384 px phone) are in `docs/art/screens/s12-*.png`:
  - the Command panel
  - the queue with a general's orders
  - a captured general
  - "You are one of the Fallen" and the Fallen panel
  - a plague in the replay and the report
- **Tests and deploy:** 488 automated tests pass. The start-up bundle is 469.6 KB (was 445.7). Deployed to the private preview (version `b9d9ac0d`); the lock check passed.
- **Asked Nate to play on the preview:**
  - Twin Realms on the laptop with a Push general
  - Ringsea on the phone with a captured general
  - some Fallen events
  - the new art and the two maps
  - how many turns each game took

  His notes go below once he's played.

### Oct 6: Orchestrator review of session 12
- **Checked the work:**
  - GitHub's checks pass on the last commit (two in-between failures were fixed within the session).
  - Re-ran the Fallen at 6 players: 27.9 → 29.7 turns, matching session 12's 27.7 → 29.8.
  - The pictures look right: real pines, Wyrmland clearly a dragon (especially on the minimap), the Crownlands with 5 rivers, and clean Command, queue and Fallen screens.
  - A small polish item: the Fallen screen still shows gold in the top bar.
- **Nate's new ideas (captured in `docs/04-design-additions.md` §2 and §10, and slotted into the plan):**
  - **Single-player pause and saved games:** the first part of session 13.
  - **Multiplayer pause by vote** (one asks, the rest agree or decline): M4.
  - **Tutorials** (short games already in progress that teach one thing: chaining, recruiting, culture, buildings, cards, treaties) and **scenarios:** before the public launch (M5), built on saved games.
  - **Bots with strong logic for accepting or declining treaties:** a requirement for session 14.
- **Nate's calls:**
  - The Fallen stay as tuned (about +3 turns at 10 players, for more comebacks); revisit in the balance pass.
  - The Fallen keep their own event menu; Fate events reuse the same engine.
  - Wyrmland is suggested for 6–8 players.
- **Twelve Claude Code sessions are done,** so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-05.md`.
- **Still to come:** Nate's play tests of sessions 11 and 12 (generals, captured generals, the Fallen, the new art).
- **Next:** session 13 (`docs/prompts/claude-code-session-13.md`, run it locally).

### Oct 6: Claude Code session 13 (M3: pause and saved games, the Spoils and Fate decks)
All four parts are done, each committed and pushed. There were no play-test notes from sessions 11 or 12 to fix first. Small polish: the Fallen's top bar now shows Influence instead of gold.
- **Pause (single player):** with a timer on, a round button next to it stops the clock and the timer reads "Paused". You can keep planning while paused (the map dims a little); nothing locks in until you resume. Without a timer there's no button. Pause is a host action, so M4's pause by vote can wrap it.
- **Saved games:**
  - The game saves itself at the start of every turn's planning. The lobby shows **Continue** (map, players, turn, when).
  - Settings → **Save game** (3 slots, each with map, players, turn and date, or **Save to a file**) and **Load game** (the autosave, a slot, or **Load a file**).
  - **The format, in plain words:** a save is now a snapshot of the game as it stands, with a version number, instead of a list of every turn's orders, so it keeps loading after the rules change. When the game's own shape changes, a small built-in update brings old saves up to date; anything else says plainly why it can't load. A save made at the start of this session is loaded by the tests, so future sessions keep it working.
  - Save files still play back move by move with `pnpm sim --replay` (old "Save this game" files too).
  - Saves stay on the device. A private window or a full disk gets a plain message, and the game goes on.
  - Queued orders you hadn't locked in aren't saved: Continue starts that turn fresh.
- **The Spoils deck:** a card at the end of any turn you took land (one a turn), marked Sword, Tower or Laurel.
  - Three alike or one of each turn in for a windfall: Swords 6 troops at your capital, Towers a fort + 1 troop, Laurels +1 culture on up to 3 territories in a province, one of each 3 troops + 5 gold. **Tuned down** from the first numbers (8 troops, fort + 3, 4 troops + 6 gold), which made games about 3 turns longer.
  - A small card stack on your Leader card (by the map buttons on a phone): tap it, then a set, **2 taps**. At 5 cards it glows red and the sensible set is already first in your queue.
  - Others see only how many cards you hold.
- **The Fate deck:** everyone draws one card a turn as the turn ends, so it's in the report when you plan (no tap).
  - About 7 in 10 are events landing anywhere on the map (14 cards: harvest, wandering band, pilgrims, master masons, hidden hoard, veterans, flooded ford, rockslide, squalls, fire, fever, blight, plague, uprising).
  - About 3 in 10 are missions for you (10 cards), shown on your Leader card with their deadline. Tap one to light up its target.
  - Caps: never a capital, never knocks anyone out, one Fate event per territory a turn, and culture protects. Because Fate lands between turns, it can never make a "guaranteed" attack fail.
  - Under fog you see "something stirs in Northreach".
  - Lobby switch: **Fate deck On/Off** (on by default). The Fallen keep their own menu.
- **Bots:** the Captain turns sets in where they help (a fort on its hottest front, culture where it holds), and gives missions a modest pull, never chasing one it can't win.
- **Sims (500 games each, no decks → both decks):**
  - **Length:** 4 players 21.0 → 22.9 turns, 6 players 29.8 → 31.0, 10 players 38.3 → 39.6.
  - **Runaways:** unchanged. Comebacks: 20 → 23%, 41 → 42%, 55 → 51%.
  - **Decided by the decks? No:**
    - the winner takes the lead on a Spoils turn as often as chance says;
    - it gets fewer good Fate events than its land would draw;
    - its net Fate luck is under 1 event a game.
  - Details: `docs/sim-results-m3-cards.md`.
- **Taps:** a basic turn is still 6 taps on a 384 px phone; Command is still 3.
- **Start-up bundle:** 469.6 KB → 489.9 KB (gzip 144.8 → 150.8).
  - The decks' rules and wording, saved games and the new lobby added about 35 KB.
  - Loading the Save/Load dialog, the cards sheet, the knocked-out screens, "keep two generals" and the Command menu only when first needed took 14.5 KB back out.
- **Rules:** `docs/rules-reference.md` §3 (pause), §17 (saved games), §18 (Spoils), §19 (Fate).
- **Screenshots** (desktop and 384 px phone) are in `docs/art/screens/s13-*.png`:
  - Continue in the lobby, and the save and load slots
  - the paused timer
  - the Spoils hand with a set ready
  - a mission on the Leader card with its target lit
  - a Fate event in the replay and the report
- **Tests and deploy:** 556 automated tests pass. Deployed to the private preview (version `78afdff9`); the lock check passed.
- **Asked Nate to play on the preview** (laptop: pause, close, Continue, slots; phone: Spoils and a mission; do Fate events feel fair; how many turns). His notes go below once he's played.

### Oct 6: Orchestrator review of session 13
- **Checked the work:**
  - GitHub's checks pass on all five session 13 commits, including the last one (`1f69398`).
  - Re-ran 4 players with both decks (500 games): 22.9 turns, 97.6% within 40, "winner took the lead on a set turn" 28% vs 27% by chance, winner's good Fate events 58% vs 60% of the land. All match session 13's numbers exactly.
  - The screenshots look right: Continue in the lobby, the save and load slots, the paused timer, the Spoils hand, a mission on the Leader card, Fate in the replay and the report.
  - One small layout fault: on a phone, the "Save to a file" button squeezes its label into a narrow column next to its explanation. Fixed in session 14's Step 0.
- **Nate's calls:**
  - **Spoils go back to the bigger rewards:** three Swords 8 troops, three Towers a fort + 3 troops, one of each 4 troops + 6 gold (Laurels unchanged). Games run about 1–2 turns longer; the balance pass looks at length.
  - **Continue keeps the orders you'd queued** but hadn't locked in, so a phone closing the tab doesn't cost a planned turn.
  - **The first Fate draw comes later:** at the end of turn 3 (a number in `packages/content`), so the opening turns stay quiet.
- **Nate's calls on diplomacy (session 14):**
  - **All four kinds of deal in the first version:** truces (named borders, a province, or everywhere between you; for some turns or until a player is knocked out), trades (gold, land, or gold paid over several turns), joint wars ("you hit X, I hit Y") and right of passage.
  - **Deals are public:** everyone sees who has a deal with whom; the terms of trades stay private.
  - **Both kinds of promise:** handshake deals (free, breakable, with an Oathbreaker penalty) and binding pacts (cost gold up front; the game blocks the attack).
- **Still to come:** Nate's play tests of sessions 11, 12 and 13.
- **Next:** session 14 (`docs/prompts/claude-code-session-14.md`, run it locally). Right of passage is its last part; if the session runs short, it moves to session 15.

### Oct 6: Claude Code session 14 (M3: Nate's calls on the decks, then diplomacy)
Parts 1–4 are done, each committed and pushed. **Right of passage's moves (Part 5) move to session 15**: the card shows "soon", and passage deals are already stored, so saves won't change again. There were no play-test notes from sessions 11–13 to fix first.
- **Nate's three calls (Step 0):**
  - **Spoils are back to the bigger rewards:** three Swords 8 troops, three Towers a fort + 3, one of each 4 troops + 6 gold.
  - **The first Fate draw comes at the end of turn 3,** so nothing from Fate happens before turn 4's planning.
  - **Continue keeps the orders you'd queued.** They're saved in the background a moment after you stop changing them, and at once when the tab closes or the phone puts it away. Tested in the browser: queue, reload, Continue, same orders.
  - **Phone fix:** "Save to a file" and "Load a file" now put their explanation under the label.
  - **Deck sims:** games run about 1 turn longer than with session 13's smaller numbers (4 players 23.6, 6 players 31.8, 10 players 40.8 turns). The decks still don't decide games. Details are at the top of `docs/sim-results-m3-cards.md`.
- **Diplomacy, as built:**
  - **Making a deal:**
    - Tap a rival in the Players panel, then **Propose a deal**. A plain truce is ready to send: **4 taps** on a phone.
    - The bot answers at once with one plain reason ("I need my army in the east."), or sends a counteroffer with the changes marked.
    - Offers to you come as a small toast as planning starts, with the bot's reason for asking. Accepting takes **1 tap**.
  - **The cards:**
    - **Truce:** everywhere, a province, or borders picked on the map. 2–8 turns, or until someone is knocked out.
    - **Trade:** gold now, gold each turn, or land picked on the map. The giver's troops step back and one of the receiver's moves in.
    - **Joint war:** against the same rival, with peace between the partners while it lasts.
  - **Handshake or binding:**
    - **Handshake:** free. Breaking it brings a public Oathbreaker mark, a fine and unrest, scaled by the deal's size. A truce everywhere for 3 turns is about 8 gold.
    - **Binding:** costs gold up front, and the game won't let either side attack across it.
  - **What shows where:**
    - The Players panel shows a mark for each deal (a seal on a binding one), its turns left, and the Oathbreaker mark.
    - Truce borders are drawn on the map as a white stitched band, with gold studs on a binding pact.
    - An attack across a handshake truce warns what breaking it costs.
    - The report and replay say when deals start, end and break.
  - **The re-confirm rule:** both sides must confirm in the same planning phase, and the deal starts before any move. Unconfirmed offers lapse, and an attack between the two voids them.
  - **Saves and replays:** offers and answers are orders, so a saved game and `pnpm sim --replay` reproduce exactly. A game saved before diplomacy carries on with no deals, and the session 13 save still loads.
- **The bots:**
  - Every answer comes with its strongest reason: fronts, who's ahead, what the deal costs, or trust ("You broke our truce at Old March.").
  - They never help a runaway (or the clear leader as far as they can tell), and they always join a war against one.
  - **Trust** comes from the record of how past deals ended, so it's part of every save.
  - The Captain proposes joint wars against a runaway, truces on fronts it can't afford, and land-for-gold trades. Bots also make deals with each other.
  - They keep their word, except that the Captain breaks a handshake deal for a capital it's sure to take, and says so.
  - The Recruit takes a truce only when it's weaker and never offers trades.
  - With diplomacy off, the Captain plays exactly as before (a test checks it).
- **Acceptance rates** on offers sorted beforehand: good **94%**, neutral **26%** (and 70% countered), bad **2%**.
  - The bad ones it accepts are mostly truces from a runaway it can't see under fog.
- **Sims (500 games, diplomacy off → on):**
  - **Length:** 4 players 23.6 → 27.8 turns, 6 players 31.8 → 36.4, 10 players 40.8 → **47.4** (only 27% of 10-player games end within 40).
  - **Runaways:** comebacks 25 → 36%, 45 → 51%, 55 → 62%.
  - **Deals per game:** 10.5, 21.6 and 62.1 made; 0.8, 2.4 and 5.1 broken; joint wars on the land leader 1.8, 3.4 and 4.6.
  - Rules weren't changed for length, as asked: it's for the balance pass. Options are in `docs/sim-results-m3-diplomacy.md`.
- **Taps (384 px phone):** a basic turn is still **6**, proposing a truce **4**, accepting an offer **1**. Command is still 3.
- **Start-up bundle:** 489.9 KB → **493.9 KB** (gzip 150.8 → 152.2).
  - The deal card loads when first used.
  - The turn report's wording and the game-over screen now load when first needed. That paid for almost all of diplomacy.
- **Rules:** `docs/rules-reference.md` §20 (diplomacy), plus §17–19 for Continue, Spoils and Fate.
- **Screenshots** (desktop and 384 px phone), in `docs/art/screens/s14-*.png`:
  - the Propose card
  - a decline and an accept with their reasons
  - an offer to you (its toast, and opened)
  - the Players panel with a binding pact and an Oathbreaker mark
  - a truce border on the map
  - the warning on an attack across a truce
- **Tests and deploy:** 612 automated tests pass. Deployed to the private preview (version `6e48e323`); the lock check passed.
- **Asked Nate to play on the preview:**
  - **Laptop, 4 players on Embervale:** propose a truce, a joint war on the leader, and a binding pact; break a handshake truce; trade gold for land; close the tab mid-turn and press Continue.
  - **Phone, 6 players on the Twin Realms:** answer a bot's offer, count the taps for a truce, and check that Fate stays quiet for three turns.
  - Do the bots' reasons sound like strong logic? Are they too easy or too stubborn? How many turns did each game take?

  His notes go below once he's played.

### Oct 6: Orchestrator review of session 14
- **Checked the work:**
  - GitHub's checks pass on all seven session 14 commits, including the last one (`e5e7d52`).
  - Re-ran 4 players with diplomacy on (500 games): 27.8 turns, 90.6% within 40, 36% comebacks, 10.5 deals a game. All match session 14's numbers exactly.
  - The screenshots look right: the Propose card, answers with reasons, the offer toast, the Players panel marks, white stitched truce borders on the map, and the warning on an attack across a handshake truce. Three small things go into session 15's Step 0:
    - the offer card's "breaking it costs (Oathbreaker)" reads oddly
    - in the warning screenshot, the Players panel still showed a binding pact that the screenshot script had removed: check that the panel updates when a deal ends
    - the Oathbreaker badge pushes a player's name onto two lines in the panel
- **Nate's calls:**
  - **Game length with diplomacy:** the balance pass (session 16) has bots offer fewer truces at big tables, and session 15 adds a lobby switch, "Diplomacy: On/Off".
  - **A harsher Oathbreaker:** about double the fine and the unrest.
  - **Spies use the orchestrator's defaults:** 8 gold + 1 upkeep, up to 5, travel 2 territories a turn, recall brings one home next turn, the defender is told of blocked and killed spies but never of a fooled one.
  - **A richer culture ladder:** culture still unlocks only specialists. New at culture 4 in a province, **Rangers** (forest, hills and swamp defend like plains against them); at 6, the **Standard-bearer** (attacks 10% stronger). These are the orchestrator's defaults; Nate can change them after playing.
- **Session 15's order:** Step 0 (the Oathbreaker, the switch, the small fixes), right of passage's moves, spies, the culture ladder, then sims, screenshots and the deploy. "Govern this province" is last and moves to session 16 if the session runs short.
- **Still to come:** Nate's play tests of sessions 11–14.
- **Next:** session 15 (`docs/prompts/claude-code-session-15.md`, run it locally). After it, a fresh orchestrator prompt is due.


### Oct 6: Claude Code session 15 (M3: Nate's diplomacy calls, right of passage, spies, the culture ladder)
All five parts are done, each committed and pushed, including Part 5 ("Govern this province"). There were no play-test notes from sessions 11–14 to fix first, and no new art in `art/incoming/`.
- **Nate's calls (Step 0):**
  - **A harsher Oathbreaker:** fine 4 + 1.4 per size, unrest 0.8 per size (about double). A 3-turn truce everywhere now costs about 17 gold and 7 troops to break. The Captain uses the same numbers, so it now breaks mostly small deals.
  - **"Diplomacy: On/Off"** in the lobby, next to the Fate deck. Off: no Propose, no offers, no deals; the bots play exactly as with diplomacy off in the sim.
  - **Small fixes:** the offer card says what breaking costs ("Breaking it brings the Oathbreaker mark, about 17 gold and unrest"); the Oathbreaker badge moved to the House line, so names stay on one line. The Players panel bug in the s14 screenshot wasn't real (the panel showed the truce the script had just added); a test now checks a deal's mark goes when it ends.
- **Right of passage, as built:** select your army, tap land beyond the partner's land: one order marches through up to 3 of their territories to your own land or a fight beyond, never stopping or fighting there. Land on the way that changed hands stops it at your last territory before it. Passage land shows on the map as a white stitched ring; the arrow and the replay follow the way. Bots ask for passage toward a rival they want a front with but don't border, march through it, and refuse it to a runaway or anyone attacking their partner ("You're running away with the map. I won't let you through.").
- **Spies, as built:** hire one at your capital or a barracks (8 gold, 1 a turn, up to 5). Send it to a province (3 taps) or Recall it. Spies act between turns: they travel 2 territories, lift the fog 2 around them where nobody holds the province whole, and try to get into a province someone holds whole. The spy-against-spy table is exactly Nate's (in, blocked, killed, fooled). A fooled spy brings back a false picture close to the truth that looks exactly like the real thing; what you see yourself always wins. The defender hears of blocked and killed spies, never fooled ones. Only you see your spies (a small eye, shield or hood badge on the map).
- **The culture ladder:** Rangers at culture 4 in a province (forest, hills and swamp defend like plains against them), the Standard-bearer at 6 (attacks 10% stronger, no stacking). In the odds preview, the Hire menu (locked ones greyed with the culture they need) and the card's culture line ("Culture 4 in Pinemark: Rangers. Next: Standard-bearer at 6"). Placeholder icons until the art comes (Tier 3 in the art list).
- **Sims (500 games, spies off → on):** length 28.0 → 27.1 turns (4 players), 36.2 → 36.1 (6), 46.4 → 44.9 (10); runaways and seat fairness about the same. Spy attempts per game 6.6 / 10.3 / 31.6, nearly all infiltrations, some blocked; bots never kill or fool each other (one spy each). Tuned the Captain to one spy: Captains with spies now win 47% / 51% against Captains without (was 40%). Rangers in 26% / 50% / 67% of games, Standard-bearers in 16% / 39% / 60%. Details: `docs/sim-results-m3-spies.md`.
- **Taps (384 px phone):** a basic turn is still **6**; hire a spy 3, send a spy **3**; Command 3, propose a truce 4, accept 1.
- **Start-up bundle:** 493.9 KB → **441.1 KB** (gzip 152.2 → 135.1), with everything this session added: the game screen now loads when the game starts (fetched quietly once the lobby shows).
- **"Govern this province" (Part 5), as built:** a fifth instruction for a general in a province where you hold most of the land. Its army holds the province; it keeps a quarter of the province's own income and spends it there the same turn (a fort where it's threatened, else culture, else troops). No second pot: what it's saving shows only as progress ("A fort at Pinemark: 5 of 8 gold"), and goes home if the general leaves or is lost. The report says "Your Leader governs Old March: kept 3 gold, raised culture in Pinemark." The Captain uses it for a captured general in a province it holds safely.
- **Saves:** game state version 7 (spies, then governing), with migrations; the session 13 save and a new session 14 save both load.
- **Screenshots** (desktop and 384 px phone), in `docs/art/screens/s15-*.png`: the Diplomacy switch, passage land and a march through it, a spy on the move, an infiltrated province with its eye, the spy report lines, the Hire menu with Rangers and the Standard-bearer, the culture line on the card.
- **Tests and deploy:** 685 automated tests pass. Deployed twice to the private preview: after Part 4 (version `7f30f6f5`) and after Part 5 (version `ac2e0173`); the lock check passed both times. Nate: please check the repo's Actions page for the last commit.
- **Asked Nate to play on the preview:**
  - **Laptop, 4 players on Embervale, Captain bots:** break a handshake truce (the harsher Oathbreaker); get right of passage from a neighbour and march through to a rival; hire a spy and send it into a province a rival holds whole; raise culture to 4 in a province and hire Rangers for a forest attack.
  - **Laptop, a second game with Diplomacy Off:** does it feel faster?
  - **Phone, 6 players on the Twin Realms:** send and recall a spy, and count the taps.
  - Do spies feel worth their gold? Did you ever suspect you'd been fooled? How many turns did each game take?

  His notes go below once he's played.

### Oct 6: Orchestrator review of session 15
- **Checked the work:**
  - GitHub's checks pass on all seven session 15 commits.
  - Re-ran 4 players with everything on (500 games): 27.2 turns (session 15 reported 27.1 before "Govern this province" went in), 92% within 40, spies infiltrating 6.0 times a game and blocked 0.7, 10.5 deals and 0.6 passage deals a game. All in line.
  - The screenshots look right: the Diplomacy switch in the lobby, passage land in white stitches with the march drawn through it, the spy's hood badge and the eye over an infiltrated province, the spy report lines, the Hire menu with Rangers and a locked Standard-bearer, and the culture line naming the next unlock.
  - The start-up bundle fell from 493.9 to 441.1 KB (the game screen now loads when a game starts).
- **Nate's calls:**
  - **Spy upkeep only while away:** free in your own land (at home or guarding a province), 1 gold a turn while travelling or inside someone else's land. Session 16.
  - **He plays sessions 11–15 before the balance pass,** so his notes go into session 16.
  - **Art batch 4 now,** and **a polish pass:** Nate wants the game to look like a large team with a good budget made it, with special effects in the replay. The orchestrator wrote the plan, `docs/09-polish-and-effects-plan.md`:
    - a cinematic replay (letterbox, golden-hour grade, a camera that pushes in on big moments, title cards like "Galeholt falls to House Gules")
    - armies that march as soldiers with dust, ships that bob, battles in smoke with arrow volleys and siege stones, banners raised over captured land, burning capitals
    - an effect for every Fate event, the Fallen's events, deals (a scroll and wax seal; a torn scroll and a red crack for a broken deal) and spies
    - a living map (moving water, drifting clouds and their shadows, chimney smoke, turning windmills, birds)
    - menus with weight (the seal stamps, numbers roll, the timer glows), and real title and game-over art
    - an "Effects: Full / Light / Off" setting; effects never carry game state, fit inside the replay's timing and respect fog
  - The art is **batch 4**, about 50 pieces (Tier 3 of the art list; `docs/prompts/gemini-art-session-04.md` drives Gemini). Soft effects are painted on pure black and the importer will turn brightness into transparency.
  - **The code is session 17,** after the balance pass. Sound is listed in the plan for Nate to decide.
  - **What comes after M3 is decided after he plays.**
- **Fifteen Claude Code sessions are done,** so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-06.md`.
- **Next:** Nate plays on the preview and runs the Gemini session; then session 16 (`docs/prompts/claude-code-session-16.md`, run it locally), with his notes added by the orchestrator first.

### Oct 6: Nate's play test of sessions 11–15
Nate played a full game on Wyrmland against 5 Captain bots. His notes, in his words where it matters:
1. **Leaders and attacks:** the Leader should go with the attacking army by default ("right now I have to click More"), easy to switch off. After the first move the Leader drops off, so it can't carry on through a chain with the troops; it should.
2. **"Seize the Initiative" and "Lie in Wait"** sit in oddly shaped bubbles. Make them buttons that just say "Initiative" and "Wait", with more on hover.
3. **More open space at the map's edges:** fully zoomed out, menus cover playable land.
4. **Provinces are still hard to see, and their names clutter the map.** Instead: tap any territory (yours or not) to light up the border of its whole province and show its name and bonus then.
5. **Player 1 should be red by default,** and players choose colours when setting up a multiplayer game.
6. **Zooming in still looks bad:** "we have high-resolution pictures that are shrunk down, so they should still look good, but everything is blurry when zooming in."
7. **Bots should have different personalities and play styles** (aggressive and focused on one front; all-out expansion with no defence; super-defensive, building culture and defence; deals it can break and lots of spies…), mixed at random so a table of 5 feels different. Maybe a separate, hardest bot level; see if it wins more.
8. **Orders along a path:** click where you're coming from and where you're going; take the shortest path or the "complete path" that snakes back and forth to take every territory in between; a box says how many orders that adds, and you confirm.
9. **The leaders don't seem to do much with the orders I give them.** Instead of the tax idea: give each a share or an exact amount of gold each turn, and they use it to carry out their orders. See the orders they set, mixed in with yours or (a toggle) after yours. They should make several orders where it fits: building, or attacking or moving in a chain.
10. **Spoils don't make sense:** one of each should give the most. Small troop rewards in scattered places are fine; culture or buildings would be nice too; always some gold.
11. **A power line graph at the end,** with awards (best culture, best military and so on).
12. **The game was too short:** Wyrmland, 5 bots, 12 turns, the last 3 a mop-up. The bots weren't hard enough, or culture and diplomacy didn't matter enough.
13. **Fate events need more fanfare** and a way to see what happened; it's very easy to miss them. The same for the Fallen. "I ran away with the game; I'd assume the others would team up against me and the Fallen would target me, but I noticed no extra resistance."
14. **Buildings in captured land should stay** (a fort someone built), **but culture should be wiped** when land changes hands.
15. **"I played the whole game without building a building or doing any culture."** Idea: two leaders from the start, one for culture and one for the military. Name your own Leader at the start, and command it the same as a captured one, so taking over two players gives three military leaders and up to three culture leaders, and gold is drawn away from your own recruiting to delegate. They should be very good at it. A military command: **"expand our empire in this direction"** toward a target territory: rapidly taking easy, undefended land by chaining, or slowly pushing the border where it's contested, not in a straight line, securing provinces on the way.
16. **Map size:** Wyrmland felt right for 6 players but on the small side; go much bigger for larger battles and longer games.

**Nate's calls on the plan (Oct 6):**
- **Mechanics first:** 16 his fixes (controls, sharp zoom, provinces on demand, red by default and choosing colours, orders along a path, culture wiped on capture, the Spoils rework, the Chronicle, the end-of-game graph); **17** the Marshal and bot personalities; **18** leaders you delegate to; **19** bigger maps (about 160 and 200 territories) and the balance pass; **20** the polish pass (effects). (Nate agreed leaders, then bots; the orchestrator put the Marshal first because Nate wants leaders to plan at the Marshal's level.)
- **Leaders keep a visible purse** and can save up. A larger command list, with menus inside menus if needed. You can tell a leader to do anything, up to running your whole military, not just the land it stands on. Your own and captured leaders plan at the Marshal's level.
- **The Marshal is a new hard level** with personalities, built separately from the Captain. Analyse the sims to find which behaviours win, and build those into it.
- **Bigger maps:** about 160 and 200 territories.
- Details: `docs/04-design-additions.md` §4 (leaders), §5 (culture wiped on capture), §6 (the Spoils rework), §11 (the Marshal), §12 (controls and map clarity).

**On graphics engines (Nate asked):** the game already uses **PixiJS v8**, the leading free, open-source (MIT) 2D engine for the web. Switching (Phaser, or a 3D engine like Three.js) would mean a rewrite and be heavier on phones. Instead:
- **pixi-filters** (MIT; v6 for PixiJS v8) comes in with the polish pass: shockwaves, glow, bloom, light rays, colour grading.
- **@pixi/sound** (MIT; v6 for PixiJS v8) if Nate wants sound.
- **Particles and effects are built in-house** on PixiJS's own fast particle container. Off-the-shelf emitters simulate frame by frame with random numbers, so a replay's effects couldn't be scrubbed, skipped or played again identically. Ours are worked out from the replay's clock and the game's seed.
- **The blurry zoom is ours to fix, not an engine's:** the whole map is painted once at about 1.75 pixels per map unit on desktop (1.3 on a phone) for Wyrmland, and fully zoomed in that's stretched about three times. The art is also stored small (trees 192 px, castles 384 px) though the originals are 2048 px. Session 16 paints sharper tiles where you're looking and keeps the art bigger.

### Oct 6: Claude Code session 16 (M3: Nate's play-test fixes)
All six parts are done (Part 6, the end of the game, too), each committed and pushed. No art batch 4 was imported (that's session 20).
- **Controls and rules (Part 1):**
  - **Your Leader goes with the attack** by default: "Leader goes (+20%) / Stays home" sits right under the troop chips. It **carries on through a chain** (each hop you add from where it lands takes it on, and so does Follow through). The report says "with 10 troops and your Leader".
  - **Initiative and Wait** are now plain buttons (under More…). Hover on a laptop, or press and hold on a phone, for the full explanation. (The odd bubbles were the buttons accidentally picking up the Leader card's layout.)
  - **Room at the map's edges:** the game measures its menus, and fully zoomed out the whole map sits clear of them, on a laptop and a phone. You can pan any edge into the clear part at every zoom.
  - **You are red (Gules) by default**, and the lobby lets you pick any of the ten House colours (remembered on your device and kept in saves). The bots take the rest.
  - **Culture is lost when land changes hands** (a capture, a trade, or rebels); buildings stay. The card says "Lost if you take it" on a rival's land. Games are as long as before (4 players 27.9 → 27.7 turns, 6 players 37.1 → 37.4; 300 games each).
  - **Spy upkeep only while away:** free at home or guarding a province, 1 gold a turn while travelling or in land you don't hold.
- **Sharp at every zoom (Part 2):**
  - When you zoom in, the land where you're looking is painted again at up to 3 times the detail (in about a quarter of a second). The art is also kept twice as big: those bigger copies load after the map is on screen, so the first paint isn't slower.
  - Side-by-side before/after pictures: `docs/art/screens/compare/s16-near-{capital,forest,mountain,coast}-{desktop,phone}.png`. The phone pictures went from blocky to clean.
  - **Speed** (phone emulation, processor slowed 4×): panning 95–101 → 97–102 frames a second; laptop 130–184 → 121–154. Texture memory 51 → 88–95 MB. The phone's replay ran at 35 frames a second before and 39–43 after (the marker layout got cheaper), still under the 50 goal; the rest is in how the replay redraws its lines, which the polish pass rebuilds anyway.
  - **Art download:** 2.7 MB at first (unchanged), plus 3.0 MB of bigger copies afterwards.
  - **Provinces on demand:** province names on the land only at Far zoom. Tap any territory (yours, a rival's, fogged) and its whole province lights up with a bright band and its plaque. The card says "The Oak Downs +3: you hold 2 of 5".
- **Orders along a path (Part 3):** select your land, **Path…**, tap where to go. The box offers the **shortest way** or the **full sweep** (it takes everything in between), draws the chain on the map and says "9 orders: take 8 territories, end at Wildstead". Confirm adds ordinary hops you can change. It never attacks anyone you have a deal with. Taps on a phone: 4 (shortest), 5 (sweep).
- **Spoils, the Chronicle, and ganging up (Part 4):**
  - **Spoils rework:** every set gives gold, and **one of each is the best** (6 troops over your front, a building of your choice, 10 gold). The Spoils sheet always shows the table, with the sets you can make lit. Games are no longer (27.7 → 27.5, 37.4 → 36.7).
  - **The Chronicle:** every turn so far, newest first, with what touched you on top. It holds only what you saw; fog fighting is grouped ("Battles in Mistreach ×3"). Tap a line to see the place. Button in the top bar (laptop) or the scroll button by the map buttons (phone). It's kept with saved games.
  - **Louder Fate and Fallen:** an event on your land gets a big banner, the replay camera goes there, and it's the first line of the report: "The Fallen have turned on you: a plague in Old March."
  - **Why nobody ganged up on Nate:** not a bug. People and bots are judged the same way, and the Fallen do target a runaway once there are Fallen. The problem is fog: each Captain counts only the land it sees or remembers, so on Wyrmland it recognised a runaway in only 21% of its turns (100% with fog off), about 8–9 turns late, and joint wars against the runaway fell from 4.3 to 0.6 a game. The ideas for the Marshal (session 17) are in `docs/sim-results-s16.md`. Nate's game wasn't saved to a file, so a "fast expander" bot stood in for him.
- **The end of the game (Part 6):** the game-over screen has a **power graph** (each House's share of the map by turn, House colours with their banner patterns, winner strongest) and **awards** with portraits: Best Military, Best Culture, Master Builder, Spymaster, Diplomat, Survivor, plus Iron Wall, Kingslayer, Fortune's Favourite, Quartermaster and Oathbreaker. Nobody sees any land counts until the game ends.
- **Taps (384 px phone):** a basic turn is still **6**. Path order 4 (shortest) or 5 (sweep). Command 3, propose a truce 4, accept 1, hire a spy 3, send a spy 3.
- **Start-up bundle:** 441.1 → 451.4 KB (gzip 135.1 → 138.1).
- **Saves:** game state version 9 (House colours, then the game's record), with migrations. The session 13 and 14 saves still load.
- **Screenshots** (desktop and 384 px phone), in `docs/art/screens/s16-*.png`: the lobby colour choice, fully zoomed out, an attack with the Leader, Initiative/Wait (phone, with its explanation), a lit province, both path boxes, the Spoils sheet, the Chronicle, the game-over graph and the awards. Scripts: `s16-shots.mjs`, `s16-over.mjs`, `s16-zoom.mjs`.
- **Tests and deploy:** 722 automated tests pass. Deployed twice to the private preview: after Part 5 (version `558bb993`) and after Part 6 (version `a7a4ebf6`). The lock check passed both times. Nate: please check the repo's Actions page for the last commit.
- **Asked Nate to play on the preview:**
  - **Laptop, 6 players on Wyrmland, Captain bots, you in red:** zoom all the way in (sharp now?) and all the way out (can you see everything?); tap a few territories you don't own (do provinces read clearly?); make a path order both ways; attack with your Leader and chain on; turn in one of each in Spoils; open the Chronicle after a few turns (did anything happen to you that you'd have missed?); look at the graph and awards at the end.
  - **Phone:** the same zoom checks, and how smooth it feels.
  - How many turns did the game take?

  His notes go below once he's played.

### Oct 6: Orchestrator review of session 16
- **Checked the work:**
  - GitHub's checks pass on Parts 1–6, but **the last commit (`7dff410`, only `PROGRESS.md`) failed:** two tests that use random inputs failed on that run.
    - **The fog-leak check** (`replay-fog.test.ts`) found a case (seed `"{T"`, 5 players, turn 4): a spy's end-of-turn report and an uprising on the same player's land land on the same step, and the test can't tell a mixed event from ordinary sight. The orchestrator reproduced it: the revealed land matches the spy's real report exactly, so **it's not a leak**, but the test (or how the two are grouped) needs fixing.
    - **A spy test's pass bar** ("at least 10 fooled spies seen") depends on luck: 6 on that run.
    - Neither is a game bug, but `main` shows red until they're fixed. Session 17's Step 0.
  - **Zoom is sharp now:** the before/after pictures at Near show a crisp castle, walls and trees where they were soft.
  - The screenshots look right: the colour picker, the attack with "Leader goes (+20%)" and "Stays home", Initiative/Wait, a lit province, both path boxes with the numbered chain, the Spoils table, the Chronicle, the power graph and awards.
  - **One new problem, from the zoomed-out picture:** on Wyrmland at Far zoom, the province plaques pile on top of each other across the whole map (the clutter Nate disliked). Session 17's Step 0: fewer, smaller, non-overlapping names at Far.
  - **Why nobody ganged up on Nate:** not a bug. Under fog each Captain counts only the land it sees or remembers, so on a big map it spotted a runaway in only 21% of its turns, 8.6 turns late (100% at once with fog off); joint wars against the runaway fell from 4.3 to 0.6 a game. The Fallen do target a runaway, but only once someone is knocked out. This is the Marshal's first job (`docs/sim-results-s16.md`).
- **Session 16's questions, answered with defaults** (Nate can change them when he plays):
  - the Chronicle as a scroll button by the phone's map buttons: keep it
  - the phone replay's frame rate (39–43, goal 50): acceptable until the polish pass rebuilds the replay
  - the 11 awards (Oathbreaker tongue-in-cheek): keep them
- **Nate's call:** his next play test comes **after session 18.** The things to try collect in the list below.

### Oct 6–7: Claude Code session 17 (M3: the Marshal, a hard bot level with personalities)
All five parts are done, each committed and pushed. Nate added two notes during the session (below).
- **Step 0, the red tests and the Far names:**
  - **The fog-leak check** failed because the spies' end-of-turn report was fogging over land again that the turn's own sightings had already fogged (an uprising had just taken that land from the player). Nothing leaked. The report now leaves that land alone. The failing case (seed `"{T"`, 5 players) is a fixed regression case.
  - **The spy test's "at least 10 fooled" bar** now has four fixed cases that are always fooled (20 fooled views on their own), so it can't fail by luck.
  - The rule from now on: property tests keep random inputs, and every failing case they find becomes a fixed test.
  - **Province names at Far:** small, with a dark rim and no plaque, only where they fit (bigger provinces first, never over an army, another name or the screen's edge); tap a territory for its full plaque as before. The old painted names are gone. Checked on Wyrmland and Embervale, desktop and phone.
- **The Marshal (Part 1):** a new bot built beside the Captain (the Captain is unchanged: its fingerprint test passes, and a new one pins it with everything on). Six personalities as data in `packages/content/data/personalities.json`, dealt from each game's seed:
  - **the Conqueror:** one front at a time
  - **the Blitzer:** all-out expansion
  - **the Turtle:** forts, culture and markets, a late strike
  - **the Schemer:** deals it may break, and spies
  - **the Opportunist:** hits whoever just fought
  - **the Merchant:** markets from turn 1, then a rich push

  Each answers deals in its own voice ("Peace suits me; my walls aren't finished."). It never cheats: tests show that hidden changes, or a view stripped to what a person could know, give the same orders, and that bots never pool what they see. Its planner takes a scope (the realm, one army, one front, or building) and a purse, for session 18's leaders.
- **What wins (Part 2):** a parallel tournament (`pnpm tournament`, about 30,000 games in all) recorded each seat's behaviours. Winners grow fastest early, lose the least land early, attack more than one rival, and spend on troops before buildings. Tests that change one thing at a time showed what really causes wins:
  - **attacking hard** (chaining whenever the next hop is likely to win, every spare troop in): 25% → 31% on Embervale, 14% → 30% on Wyrmland
  - **not holding troops back:** holding them back cost 6 points
  - **a hard first 14 turns** on big maps
  - **choosing targets on what you know**, not on guesses about the fog

  All of that is built in under every personality. One Marshal against Captains went from 22% to 33–35% on Embervale (fair 25%) and from 19% to 25–28% on Wyrmland 6 (fair 17%).
- **Nate's notes during the session:**
  1. **Make culture and buildings worth doing.** The sims agree they don't pay yet (culture on safe land loses games; markets make no difference). That's a rule change, so it's for the balance pass (session 19), with the numbers.
  2. **Marshals should go for whole provinces, end on defensible ground, and read the border.** The first two are built in (no cost on average). Reading the border and fortifying ahead of threats was tried and is off for now: it holds troops back and cost 2–3 points. Worth another try once forts and culture are worth more.
- **Stopping a runaway (Part 3):** the Marshal estimates land it can't see (from what it remembers and who knocked out whom), watches pace, uses a lower bar at 6+ players, and proposes joint wars at once that stick. The strong stand-in for a person (the Conqueror playing with fog off) on Wyrmland at 6 players:
  - it wins **35% against Captains, 24% against Marshals** (fair 17%)
  - Marshals name it **half a turn** after it truly runs away (Captains: 8.5 turns late)
  - their first joint war against it comes on **turn 10** (Captains: turn 29)

  The Fallen are unchanged; they do turn on the runaway once they exist.
- **The lobby (Part 4):** Recruit (easy), Captain (medium), **Marshal (hard, now the default)**, and **Mixed** ("2 Marshals and 3 Captains", with − and +). Personalities are hidden while you play and revealed at the end ("Baron Krell wins", with "Marshal, the Schemer" underneath, and in the Houses panel). "Show personalities" in the lobby (off by default) shows them all along. Saves keep each bot's level, personality and memory.
- **Headline numbers (Part 5):**
  - One Marshal against Captains: **35% at 4 players** (fair 25%), **25% at 6** (17%), **11% at 10** (10%).
  - Tables of Marshals play about as long as Captains at 6 and 10 players. At 4 players on Embervale they snowball: half the map by turn 10 in 70% of games, about 21 turns a game (Captains: 28). A balance-pass question.
  - Planning speed: **0.4 ms a turn on average, worst 5 ms** (10 players, Wyrmland; the limit is 50 ms).
  - Write-up: `docs/sim-results-m3-marshal.md`.
- **Screenshots** (desktop and 384 px phone), in `docs/art/screens/`:
  - `s17-lobby-bots*.png`: the lobby's bot choice
  - `s17-game-over-winner*.png` and `s17-game-over-personalities*.png`: the game-over screen revealing personalities
  - `s17-far-wyrmland*.png` and `s17-far-embervale*.png`: zoomed out, with the uncluttered names
- **Tests and deploy:** 741 automated tests pass (the full run twice, as property tests use random inputs). Deployed to the private preview (version `49f5dfd1`); the lock check passed. Nate: please check the repo's Actions page for the last commit.

### Oct 7: Orchestrator review of session 17
- **Checked the work:**
  - GitHub's checks pass on all seven session 17 commits, so `main` is green again (the two red tests are fixed: the spies' report no longer fogs land a second time, with the failing case kept as a fixed test, and the spy test can't fail by luck).
  - Re-ran one Marshal (the Blitzer) against 3 Captains on Embervale, 300 games: it won **39.0%** (session 17 reported 41.3%; within the ±2.5-point wobble of 300 games).
  - The screenshots look right: province names at Far are small, plaque-free and no longer pile up on Wyrmland; the lobby's bot choice with Mixed ("2 Marshals and 3 Captains") and "Show personalities"; the game-over screen revealing each bot ("Marshal, the Turtle").
- **What session 17 found wins** (built into every personality): attack hard and chain whenever the next hop is likely to win; don't hold troops back on quiet fronts; expand hardest in the first 14 turns on big maps; choose targets on what you know. **Culture and buildings don't pay back yet.**
- **The Marshal is now the default bot level.** One Marshal beats Captains about 1.4 times its fair share; it spots a runaway half a turn after it happens (Captains: 8.5 turns late) and the first joint war against it comes on turn 10 (Captains: turn 29). Planning takes 0.4 ms a turn (worst 5 ms).
- **Art batch 4 is made:** 42 of about 50 pieces (all effects, key art, the specialists and spies, the redo pieces; of the scenery additions only one narrow peak, when Gemini's daily limit ran out). The report is `docs/art/batch-4-report.md`; its lessons are in the art list. The built-in browser downloads half-size images (1024 px), so `terrain-hills` is 768 px.
- **Nate's calls (Oct 7):**
  - **Culture and buildings must pay:** the balance pass (session 19) tests more income per culture level, bigger markets and cheaper forts, and Nate picks.
  - **The 4-player snowball** (Marshals: half of Embervale by turn 10 in 70% of games, about 21 turns): **bots first** (Marshals gang up sooner at small tables); rule changes only with numbers for Nate.
  - **The Fallen act from their first turn out:** "the goal is to keep people knocked out still engaged in the game so everyone is still having fun; that could also help the balance." Session 19.

### Oct 7: Claude Code session 18 (M3: leaders you delegate to)
All four parts are done, each committed and pushed. Art batch 4 wasn't imported (that's session 20).
- **Two leaders from the start (Part 1):** your **Leader** (military, on the map, +20%) and your **Steward** (culture, buildings, forts, the economy; never on the map, can't be lost).
  - **Names:** you name your Leader in the lobby (a name is filled in); the Steward's name is optional. Bots' leaders get names from the game's seed.
  - **Purses:** each leader has a purse: its budget (a share of your income, or an exact amount) goes in as income comes in, it saves up, it pays for its leader's orders, you can take it back in one tap, and purses pay your upkeep before anyone deserts.
  - **Defaults:** your Steward starts on **Run the realm with 20%**; your Leader has no command and no budget until you give it one.
  - **Captured leaders:** knocking a player out gives you their Leader and Steward, up to 4 of each kind (your own included).
  - **Govern is gone;** old saves come up to date (a governing general's saved gold goes into its purse). A real session 17 save is a new test fixture.
- **They plan with the Marshal (Part 2):** every command goes through the Marshal's planner with its scope and the leader's purse, from your view only, and writes several orders where it fits.
  - **Expand our empire in this direction** (Nate's): pick a target. It chains fast through empty land, is careful where rival armies stand (only where what arrives would hold), takes whole provinces on the way, and holds at the target.
  - Also: Command this front, Run the military, Hold, Defend, Push, Raid; and the Steward's Run the realm, Build up, Fortify, Raise culture, Grow the economy.
  - **Your orders come first:** an order of yours takes that army (or a place you build on) back from the leader for the turn.
  - The Captain plays exactly as before (checked against session 17's code).
- **The sims** (`docs/sim-results-m3-leaders.md`, 300 games a line):
  - **A player who hands everything to their leaders** (80% to the Leader, 20% to the Steward) wins **1.48 times its fair share against Marshals on Embervale, 1.46 on Wyrmland**: the leaders are at least as good as a Marshal. Half and half does badly (0.35–0.5×): buildings don't pay yet.
  - **The default Steward** builds now: about 2.5 times the forts by turn 10, and markets the Captain never builds. On Wyrmland it pays for itself (a Captain with it wins 18.3%, without 17.3%); on Embervale it costs wins (16% against 23%), because small games end before buildings pay back. The first version of Run the realm also bought culture for its income and did much worse (11%), so it now buys urgent forts, markets, a barracks where needed, and culture only where it protects.
  - **Orders:** a Leader running the military writes about 7–8 orders a turn, the Steward 1–2 every few turns (it saves up).
  - **Speed:** 0.7 ms a turn on average (worst 6.3 ms) at 10 players on Wyrmland; with all 8 leaders commanded, 3.2 ms (worst 8.1 ms). The limit is 50 ms.
- **The screens (Part 3):**
  - **The lobby:** name fields for your Leader and Steward.
  - **The Leaders panel** (laptop: the right column; phone: the Leaders sheet, from your Leader's portrait by the map buttons): every leader with its portrait (Stewards show the House shield with a quill), name, what it's doing, purse, budget and orders this turn.
  - **Controls:** Command, Budget (0/10/20/30/50% chips or an exact amount) and Take back. While a leader is open, its target glows and the provinces it works in get a gold band.
  - **The queue:** leaders' orders show with their portraits, with **"Leaders' orders: Mixed in / After mine"** in Settings and at the top of the queue. The top bar shows the purses' total next to your gold.
- **Taps** on a 384 px phone, from your Leader's portrait:
  - the basic turn is still **6**
  - Expand toward **4**, Command this front **5** (one province), Run the military **3**, Hold **3**, Raid **4**
  - Run the realm **4**, Grow the economy **4**, Build up / Fortify / Raise culture **5**
  - a budget **3** (your Leader) or **4** (your Steward)
  - (On a laptop, one fewer each.)
- **Start-up bundle:** 462.1 → 474.1 KB (gzip 141.6 → 145.1).
- **Saves:** game state version 10, with a migration; the session 13, 14 and 17 saves load.
- **Screenshots** (desktop and 384 px phone), `docs/art/screens/s18-*.png`: `lobby-names`, `leaders-panel`, `command-menu` (Steward), `command-military`, `expand` (the target glowing, the way outlined), `budget`, `queue-mixed`. Script: `apps/web/scripts/s18-shots.mjs`.
- **Tests and deploy:** 772 automated tests pass (the full run twice, as property tests use random inputs). Deployed to the private preview (version `2b6282f3`); the lock check passed. Nate: please check the repo's Actions page for the last commit.

### Oct 7: Orchestrator review of session 18
- **Checked the work:**
  - GitHub's checks pass on all four session 18 commits.
  - The screenshots look right: the lobby's name fields, the Leaders panel (Aldric expanding toward Northdale with a 12-gold purse and 7 orders this turn; Odo the Steward running the realm), the command menus, the Expand target outlined on the map, the budget chips (0–50% or an exact amount), and the leaders' orders in your queue with their portraits under "Mixed in / After mine".
  - **One surprising number, re-run and confirmed:** a player who hands everything to their leaders (Leader on "Run the military" with 80%, Steward on "Run the realm" with 20%) **beats a table of Marshals 37.0% of the time on Embervale (fair 25%)**, exactly as session 18 reported. The leaders plan with the Marshal's own brain on less gold, so either the leaders' way of planning is better than the Marshal's, or a delegating player gets an edge a Marshal doesn't. **Session 19 finds out**, and the Marshal must play at least as well as your leaders.
- **Session 18's questions, orchestrator's defaults until Nate plays after session 19:**
  - the default Steward share stays at 20% for now; the balance pass makes buildings and culture pay and then sets the default where it helps
  - "Expand our empire in this direction" stays careful where rival armies stand (Nate judges it in his play test)
  - leaders' orders stay "Mixed in" by default
- **Nate's call (Oct 7):** his next play test comes **after session 19**, once the balance pass is in. The list below is now "Things to test after session 19".
- **Eighteen Claude Code sessions are done,** so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-07.md`.
- **Next:** session 19 (`docs/prompts/claude-code-session-19.md`, run it locally), then Nate's play test.

### Oct 7: Claude Code session 19 (M3: the balance pass, and bigger maps)
All five parts are done, each committed and pushed. Art batch 4 wasn't imported (session 20). Full write-up: `docs/sim-results-m3-balance.md`.
- **Step 0:** the "keep or let go" dialog lists captured Stewards too (they used to go by default without a choice).
- **Why a delegating player beat the Marshals (Part 1):** not diplomacy and not the Leader's +20%. The Marshal queued its purchases before its attacks (each order takes a round, so rivals moved first), bought cavalry on a whim, and in its all-out opening left one troop at home: on Embervale, where capitals are 3 steps apart, **14% of Marshals were knocked out on turn 1** (a delegating player's starting gold stayed home as troops, by accident). Now the Marshal queues troops and attacks first, skips the whim cavalry, and keeps a **guard at its capital** (half of any rival army within 3 steps, and half its stack for the first 3 turns). A player who hands everything to their leaders now wins 20% against Marshals on Embervale (fair 25%; was 30–37%) and 1.09× fair on Wyrmland (was 1.46×). One Marshal beats Captains more often on every table (Embervale 32% → 40%, Greatmarch 11% → 21%).
- **Culture and buildings that pay (Part 2), pending Nate's pick:** three levers tested alone and in pairs. All but quick forts make building pay on big maps; on a 4-player Embervale nothing makes 20% on buildings pay before the game is decided; bigger or cheaper markets made the Merchant too strong. **Picked: culture +1 gold a turn a level** (was +½). Your Steward's default is now **20% with room, 10% on a crowded table** (12 or fewer territories a player), and "Run the realm" buys culture where it pays.
- **The Fallen, the snowball, runaways (Part 3):** a knocked-out player starts with **8 Influence** (9+ on the first turn out: a storm, a famine or mercenaries), the dialog and panel say what you can do this very turn, and Fallen bots strike the biggest realm on their first turn. **The 4-player snowball is gone, from the bots alone:** half the map by turn 10 in 71% → 30% of games, 21 → 29 turns, comebacks 22% → 45%. The capital's opening guard now holds on every table (knocked out by turn 6: 15–24% → 1–2%); the halfway leader wins 47–79% (was 59–87%). Stronger gang-ups and an earlier runaway reading made no difference; catch-up rules are listed as options only.
- **Bigger maps (Part 4), Nate's OK:** **Ashwing** (a phoenix, 160, 6–8 players), **The Sundered Crowns** (twin continents, 160, 6–8), **Krakenmere** (a kraken, 200, 8–10) and **Rootholm** (a tree of life, 200, 8–10; redrawn after Nate said the first looked like a uvula). The lobby says who each map suits. On a phone they paint in 3.5–4.4 s and pan at 74–105 fps; the replay at 10 players is 43–44 fps (goal 50, the polish pass) and memory 225–263 MB (a fix is suggested).
- **A finding that touches every map:** among equal bots, **the capital spot decides a lot** (Embervale 4: one spot won 53%, another 1%). Earlier sessions measured seats by number, which are shuffled, so it stayed hidden. Embervale's 4-player capitals were re-chosen with the simulator (now 13–38%); the other maps are listed for a later session.
- **Nate's notes during the session:** both 160 maps official, Krakenmere official, the tree redrawn ("more of a tree of life look") and then OK'd; **long bot games are fine** ("all of my runs on the maps, even big ones, go for significantly less turns than your tests").
- **Screenshots** (desktop and 384 px phone), `docs/art/screens/s19-*.png`: each new map at Far and Mid, the Fallen's choice and their first turn out. Galleries and Far pictures: `docs/maps/s19/`.
- **Start-up bundle:** 474.1 → 476.6 KB (gzip 145.1 → 146.0); each new map loads only when picked (413–552 KB compressed).
- **Tests and deploy:** 844 automated tests pass (the full run twice). Deployed to the private preview (version `36e80125`); the lock check passed. Nate: please check the repo's Actions page for the last commit.
- **Questions for Nate:** keep culture +1 a level, or another lever (table in the write-up)? Should Conquest's 20-turn default grow on the 160–200 maps? Make the Recruit weaker still (a new player wins 46% against three)? Fairer capital spots for the other maps next (a later session)?

### Oct 7: Orchestrator review of session 19
- **Checked the work:**
  - GitHub's checks pass on all ten session 19 commits (Step 0 through the last `PROGRESS` note), so `main` is green.
  - The screenshots look right: the phoenix, the twin continents, the kraken and the tree all read at Far (unexplored land in grey), Mid is clean, and the Fallen's first-turn screen says plainly what you can do now ("Ready now: Storm, Famine, Mercenaries. Pick one, then tap Queen Isolde's land"). One note for the polish pass, not a bug: on a phone the wide maps sit small at Far (Ashwing fills about a quarter of the screen).
  - **Re-run and confirmed:** a table of four Marshals on Embervale: half the map by turn 10 in 34% of games (the write-up: 30–36%), 31 turns (29.9), the halfway leader wins 70% (68%). The snowball fix is real.
  - **Re-run and not confirmed: the delegating player.** Session 19 reported that a player who hands everything to their leaders now wins 20.1% against Marshals on Embervale and 1.09× fair on Wyrmland. That was measured right after Part 1. On the finished code (500 and 300 games) it wins **29.8% on Embervale (1.19× fair) and 25.0% on Wyrmland at 6 (1.50× fair)**; a player who gives the Leader everything wins 38.6%. What changed in between: Part 2 made culture pay (+1 gold a level) and taught the Steward to buy it where it pays, and your leaders took that up (the delegating player's culture spend went from about 10 gold a game to 156), while the Marshals' personalities mostly didn't. **So "the Marshal is at least as good as your leaders" doesn't hold today.** The fix is in the bots (every Marshal should spend on culture and buildings the way the Steward does, in its own style), not the rules; it goes into the next coding session. Nate can still play: it only means a heavily delegating player has an edge over the bots for now.
- **Two findings worth a plan of their own:**
  - **The capital spot decides a lot on every map** (among equal bots, 0–76% between spots; a person starting in Embervale's Embercrest or Krakenmere's Rookstone is at a real disadvantage). Session 19 fixed Embervale at 4 players and built the tools; the other maps and table sizes need a smarter search, an exposure-aware fairness check in the map maker, and a start bonus as the fallback. It matters most once friends play online (M4).
  - **Bot games on the big maps run to the 60-turn cap,** and 8+ players default to Conquest (20 turns). Nate said long bot games are fine because his own run much shorter; whether 20 turns is right on a 200-territory map is on his play-test list (item 6).
- **Session 19's questions:** the culture lever and sound are Nate's (asked with his play test); the Recruit stays as it is until the capital spots are fairer (orchestrator default: 46% against three Recruits is easy enough for now); Conquest's default on big maps waits for his play test.
- **Nate's calls (Oct 7, after the review):** culture +1 gold a level stays the default; sound gets its own session after the language pass; **session 20 = his play-test fixes + the Marshal builds like the Steward + fair seats**, so the polish pass becomes **21** and the language pass **22**; the polish pass stays one session, parts in priority order.
- **Next:** Nate plays from "Things to test after session 19"; then session 20.

### Oct 7: Nate's play test after session 19 (Rootholm, 9 Marshals)
One game: **Rootholm (200 territories) with 9 Marshals, Classic, on the laptop; 30–40 turns**, "only because I dragged it out testing the generals". Details in `docs/04-design-additions.md` §15–16.
- **Good:** the length; a fair starting spot and a good size; the Marshals teamed up on him and he noticed it (joint wars, offers that said so); the path order ("a great addition"); his Steward slowly building up on its own ("I just set it to run the realm and forgot about it, and liked that").
- **The leaders (and the Marshal) aren't organised, and the leaders seem worse.** His example: he held **95% of the map** with three rivals left (2, 3 and 6 territories) and his Leader on "Run the military". With that income it could have ended the game in one or two turns (recruit all round the remnants and close in, or mass on one territory with the Leader and sweep every territory). Instead it **hoarded income, moved troops far from the fighting and wrote few orders** (Nate writes 50+ a turn; all his leaders together about 20), and the 2-territory player won back a large part of the map over 4 turns. His asks: leaders never hoard without a good reason, spend their whole budget on troops, push forward or move through our land to anticipate and counter what the enemy might do, or fortify; a **"Clean up"** that has every leader work together to finish the remnants (and Run the military does it on its own); a **"Push back <player>"** command that sets a leader on one rival; leaders and Marshals should look at the players they can see, guess what they'll do and counter it. The bots should learn the way he plays: grab along the path of least resistance finishing provinces, take and fortify a choke point and attack again two turns later, then take the best region of the map, clear it, fortify it and move carefully through the rest.
- **New command: "Report to <leader>":** a new general works under the one running the military (the senior directs it and uses its budget); the same for Stewards under Run the realm.
- **Budgets could add up to more than 100%:** the options should only offer what's left.
- **Culture:** "troops still felt like they were worth way more." **Walls** (his idea): max out a territory's culture and buildings (a fort among them) and it gets a wall; walls join up and share their spare defenders (three walled territories with 4 troops each: an attacker faces 10). Session 20 builds it (design with defaults in §16).
- **Controls:** **Enter** (a hotkey) to confirm an attack as shown, instead of mousing to the corner; the **full sweep** should leave no unclaimed land between the two points: a band about 3 wide, branching to finish provinces.
- **Fate and the Fallen are still easy to notice too late**; he never got knocked out and never noticed the Fallen doing anything to him. Nate: the events are fine; make them visible (the polish pass).
- **Not tried this time:** the phone, the 160 maps, Embervale with 4, getting knocked out, Conquest's 20-turn default.
- **Nate's calls (Oct 7 evening):** culture +1 stays; sound is its own session later; **session 20 = his fixes above + the Marshal builds like the Steward + Walls + fair seats, split into 20 and 20b** (two usage windows), each ending with a deploy; the polish pass is **21**, the language pass **22**.

### Oct 7: Claude Code session 20 (M3: leaders that finish the job, the Marshal plays like a person, controls)
All four parts are done, each committed and pushed. Art batch 4 wasn't imported (session 21). Nothing slipped to 20b. Full write-up: `docs/sim-results-m3-leaders.md` (session 20).
- **Why your Leader didn't finish the game** (from replaying real positions turn by turn):
  - **Your capital's army was frozen.** Leaders you capture arrive at your capital with no command, and "a leader with no command keeps its army for you" meant Run the military never touched the biggest army you had. Now only your own Leader with no command keeps its army.
  - Recruits all went to one place; if a rival took it first, the whole purse sat unspent that turn. Reinforcements crept one step a turn. The last rival's army broke out through land held by 1 troop.
  - A small engine bug turned up too: a turn changed the game it started from (the replay's copy shared the leaders' purses). Fixed, with a test; it made the purses look fuller than they were.
- **Leaders that finish the job (Part 1):**
  - **Finishing:** when a rival is down to a handful of territories (6, or a tenth of yours), your leaders (and every Marshal) recruit next to them, march troops through your land to every territory touching theirs (one order a hop, the way you write them), strike their armies first, sweep the rest, and keep the ring strong enough that nothing escapes. On 20 real "85% of the map" positions: **7 turns to finish → 3** (Marshals 6 → 3), 80% within 4 turns. **Not met:** "2 turns or fewer in most" (about 40%): the slow ones are real fights where the rivals' armies match yours.
  - **Never hoards:** recruits are shared out with a fallback site; unspent gold a turn 3.5–8.4 → 1.5–2.0. The only reason it saves is one it names ("Saving 32 gold: nowhere to recruit until the barracks at Galeholt is up").
  - **More orders, at the fight:** a Leader on Run the military writes 7–16 orders a turn (was 6–10), dozens when finishing someone; it matches or beats a Marshal in the same seat on 9 turns in 10.
  - **New commands:** **Clean up** (offered from 75% of the map; every leader on it shares the rivals out; Run the military does it unasked), **Push back <rival>** (that rival's weak land only, never anyone else's), **Report to <leader>** (its army and budget go to the senior; Take back ends it).
  - **Anticipate and counter:** leaders (and Marshals) guess where a rival army they can see will strike next, and strike it first or reinforce there and ask the Steward for a fort.
  - **Budgets cap at 100%:** the chips offer only what's left; the panel says "Budgets: 80% of income"; older saves are trimmed as they load.
  - **The Leaders panel** says what each leader is up to ("Finishing them off: Baron Krell (2 territories left), Queen Isolde (7 territories left)"; "Reports to Aldric"), and the report says "Your Leader, Aldric, finished House Azure".
- **The Marshal plays like a person (Part 2):**
  - **Builds like your Steward on roomy maps** (the Turtle and Merchant more, the Blitzer least); on a crowded map (Embervale with 4) building costs it wins, so it doesn't there.
  - **Holds what matters** on roomy maps (it guards whole provinces and builds forts there; in session 17 this cost wins, now it doesn't).
  - **Tried and not kept:** picking the best region (no gain), lean play on crowded maps, longer marches, its Leader riding along.
  - **A player who hands everything to leaders (80/20) is now at fair** against Marshals: Embervale 32% → 27% (fair 25%), Wyrmland 29% → 17% (fair 17%). **Still open:** all-in (100/0) on Embervale wins 35% (1.38× fair; target 1.2×). It isn't the personalities, the Leader's +20% or the talking; it shows only on the crowded 4-player map.
  - **Bot games end now:** games at the 60-turn cap on Rootholm 8 85% → 31%, Wyrmland 8 57% → 29%, Wyrmland 6 29% → 16%. The opening isn't faster; who leads at halftime wins less or about the same.
  - **The headline holds:** one Marshal against Captains averages 39.2% on Embervale (was 39.0%) and 31.9% on Wyrmland (was 29.6%); the sharp stand-in against Marshals 23.6% (was 22.4%, within the noise).
- **Controls (Part 3):**
  - **Enter confirms** an attack, move or path box exactly as shown; **Esc cancels**; arrow keys and Enter pick a command in a leader's menu. Never while you're typing. A small ↵ on the confirm button on a laptop.
  - **The full sweep** clears a band about 3 territories wide between the two points, and finishes provinces it nearly covers. A sweep across all of Wyrmland is about 50 orders and leaves nothing unclaimed in its band. Still 4 taps for the shortest way, 5 for the sweep.
- **Taps on a 384 px phone** (from your Leader's portrait): Clean up 3, Push back 4, Report to 4 (a Steward's 5); a basic turn is still 6.
- **Screenshots** (desktop and 384 px phone), `docs/art/screens/s20-*.png`: `command-menu` (Clean up and Push back), `finishing`, `report-to`, `budget` (chips stop at what's left), `enter-hint` (desktop), `sweep-band` (Wyrmland). Script: `apps/web/scripts/s20-shots.mjs`; its save: `make-s20-save.ts`.
- **Speed** (10 players): one Marshal plans in 1.3 ms a turn (worst 16.5 ms), all ten bots together 10.9 ms (worst 34 ms); limit 50 ms.
- **Start-up bundle:** 476.6 → 479.3 KB (gzip 146.0 → 146.9).
- **Tests and deploy:** 872 automated tests pass (the full run twice, as property tests use random inputs); typecheck and the web build pass. Deployed to the private preview (version `219fc605`); the lock check passed. Nate: please check the repo's Actions page for the last commit.
- **Questions for Nate:** (1) all-in delegating (100% to your Leader) still beats Marshals on Embervale at 1.38× fair: worth more work, or fine since it's a crowded small map? (2) Clean up is offered from 75% of the map: right threshold? (3) Should a finishing Leader turn down truces from a rival it's finishing (today your diplomacy is yours)?

### Oct 7: Orchestrator review of session 20
- **Checked the work:**
  - GitHub's checks pass on all seven session 20 commits, so `main` is green.
  - The screenshots look right: Clean up and Push back in the command menu; "Finishing them off: Baron Krell (2 territories left), Queen Isolde (7 territories left) · 21 orders this turn"; "Reports to Aldric"; the budget chips stopping at what's left; "Add attack ↵"; a 49-order sweep band across Wyrmland. The phone sheets match.
  - **Re-run and confirmed:** the 20 mop-up positions with a Leader on Run the military: median 3 turns, 80% within 4, none unfinished (exactly as reported); a delegating player (80/20) against Marshals **16.7% on Wyrmland 6 (fair 16.7%)** and 27–29% on Embervale 4 (fair 25%; the session said 27.2%). **So the gap found after session 19 is closed:** your leaders and the Marshal are level again.
  - **One number depends on the seeds:** all-in delegating (100% to the Leader, nothing to the Steward) on Embervale 4 wins **34.6% with the session's seeds and 42.6% with the orchestrator's** (fair 25%); it is 0.6× fair on Wyrmland. The two harnesses set the seat up differently, which is worth a look, but either way an all-military player beats Marshals on the crowded small map. Session 19's one-change tests showed the same for an all-military Marshal (36% in a table of styled Marshals), so it's the small map rewarding pure troops, not a leaders bug. **Nate decides** (below).
- **What session 20 found that nobody expected:** the real reason the Leader didn't finish Nate's game was that **captured leaders arrive with no command, and "a leader with no command keeps its army for you" froze the biggest army he had** (864 troops at his capital in one trace). That rule now applies to your own Leader only. Plus an engine bug (a turn changed the game it started from through shared purses), fixed with a test.
- **Session 20's questions:**
  - **All-in delegating on Embervale (1.4–1.7× fair):** Nate (Oct 7): accept it for now and look once more after fair seats (20b).
  - **Clean up at 75% of the map:** orchestrator default: keep 75% until Nate has played with it (on his list).
  - **Should a finishing Leader turn down truces from the rival it's finishing?** Orchestrator default: **no, diplomacy stays yours**; instead the offer card says "A truce with Baron Krell would stop Aldric finishing them" so you know what you're signing. Session 20b, Step 0 (a small screen change).
- **Next:** session 20b (`docs/prompts/claude-code-session-20b.md`: Walls, fair seats), then Nate plays from the list below.

### Oct 8: Nate's second note, after reading session 20's results
- **The late game is about how many more troops we field each turn**, so a remnant's army should never be "as big as ours" at the point of contact; what session 20 called slipping a strike is the remnant **getting away**. Nate's finish: **mass everything in one place with a Leader, then sweep everywhere they are and everywhere they could get to**, with a **security blanket** of transfers through our own land so anything they take is taken straight back. That's a great many orders, and that's the point: late in a big game he expects **well over 50–75 orders a turn** from a leader (don't force the number; the sweeps should produce it).
- **Defensible pauses** as they sweep, and **a sweep of our own land before attacking** when a rival could get behind the lines. The game allows unlimited transfers and attacks a turn; the bots should use that to keep troops near the action. (Session 20's "longer marches" and "Leader rides along" tests measured win rate, which isn't the point.)
- **The bots' Leaders are to be used** with the main effort, and **captured leaders work together** toward the same goal.
- **Leaders with personalities:** name your Leader and Steward and give each a personality (war-minded ones for the Leader, building-minded for the Steward) that changes how it plays and stays with it for life, including after capture.
- **Planning may be slower:** fine ("it will always be faster than people putting in orders").
- **Nate's calls:** all of this is **session 20c, run before 20b** (Walls and fair seats); personalities change play style, not just voice. Design: `docs/04-design-additions.md` §15, "Nate's second note". Prompt: `docs/prompts/claude-code-session-20c.md`.

### Oct 8: Session 20c done: mass and sweep, the security blanket, and leaders with personalities
*All four parts done. Numbers: `docs/sim-results-m3-leaders.md` (session 20c). Commits: Part 1 `d369852`, Part 2 `f406bfd`, Part 3 `a22ab34`, Part 4 (this write-up).*
- **Finishing is now Nate's mass and sweep.** Once you hold 75% of the map, a leader on Run the military or Clean up (and every Marshal): holds the ring around the remnant's armies before they can move, turns the whole purse into troops where they can't be lost that turn, marches every spare troop to one staging point with your Leader, sweeps one chain through everywhere the remnant is and everywhere its armies could reach, then lays the **security blanket**: transfers through your land into every territory they could reach, queued last, so anything they take is taken straight back. About 100 orders a turn while finishing on Wyrmland, up to about 300 on Rootholm.
- **Mop-up fixtures (Leader):** median **3 → 2 turns**, within 3 turns **60% → 100%** (wide set of 180 runs: **69% → 92%**), none past 5 on the fixtures (one run at 6 on the wide set). **"Got away"** (a rival keeping land it took to the end of a turn): **65% → 25%** of positions (52% → 17% on the wide set). **That misses the 10% target**: what's left is real armies of 11–228 troops breaking out 6–7 hops through land that couldn't be held in the first rounds, and one fixture where the rivals' armies outnumber ours. Spare troops left far from the fight 22% → 14% (wide 26% → 8%).
- **Defensible pauses** (a chain stops a hop short rather than end where an army would throw it out; not the Blitzer), **a sweep of your own land after the attacks** when a rival army could get behind your front, **marches as far as they need**: retaken within a turn up on Wyrmland (29% → 31%), troops closer to the action (2.06 → 1.87 steps), win rates unchanged.
- **The bots' Leaders are used** from turn 15 (from turn 1 they made the strongest opener snowball on Embervale): the Marshal's Leader is on its main chain on 46% of its attacking turns after the opening on Embervale, 30% on Wyrmland (was 0%). **Captured leaders work together:** Clean up is one team under one senior; the Marshal carries its captured leaders with its armies.
- **Leaders with personalities:** pick one in the lobby next to each name (Leader: Neutral, Conqueror, Blitzer, Opportunist, Schemer; Steward: Neutral, Turtle, Merchant), remembered on your device; it changes how the leader plays, the bots' leaders carry their Marshal's, and they keep it for life, including after capture (old saves load as Neutral). "Aldric, the Conqueror" in the Leaders panel and a line in its own voice in the report and Chronicle when it takes land.
- **Personality effects** (delegating seat vs Marshals, 300 games, Embervale 4 / Wyrmland 6; Neutral 28.3% / 16.7%): Conqueror 26.7 / 18.0, Blitzer 27.7 / 16.7, Opportunist 27.7 / 18.3, Schemer 28.7 / 18.7, Turtle 25.0 / 15.3, **Merchant 34.3 / 20.0 (too strong on Embervale)**. The Steward personalities buy visibly differently; the Leader personalities differ less than the Marshal's (the Blitzer never pulls back).
- **Nothing else got weaker:** headline 39.2% → 38.9% (Embervale), 31.9% → 32.6% (Wyrmland); delegating player 27.0% / 18.2% (fair 25 / 16.7); the opening the same (Embervale half-map by turn 10 35% → 37%, within noise); bot games end sooner (Rootholm 10 at the cap 45% → 30%); the Captain unchanged.
- **Also fixed or changed:** session 17's personality-signature test now plays 24 games (8 sat at the edge); two web tests use three bots (two Marshals now often end a game the turn you're knocked out).
- **Screenshots** (desktop and 384 px phone), `docs/art/screens/s20c-*.png`: `lobby` (the personality choice), `leaders` ("Aldric, the Conqueror", "Odo, the Turtle", 83 orders), `finishing-queue` (108 orders), `finishing-map`, `home-sweep`. Saves: `s20c-save.json`, `s20c-home.json` (from `make-s20c-save.ts`; their Steward's big purse is the save maker's doing: a stand-in played your turns). Script: `apps/web/scripts/s20c-shots.mjs`.
- **Speed** (10 players): all ten bots plan a turn in **12.5 ms on average** (was 11.7; 95% of turns under 24 ms); the worst single turn 67 ms (over the 50 ms line once in 981 turns). Start-up bundle 479.3 → 482.5 KB (gzip 146.9 → 148.0).
- **Tests and deploy:** 899 automated tests pass (the full run twice); typecheck and the web build pass. Deployed to the private preview (version `ae60a59b`); the lock check passed. Nate: please check the repo's Actions page for the last commit.
- **Questions for Nate:** (1) the Merchant Steward wins about 6 points more than Neutral on Embervale because Neutral's Steward stops and saves for an urgent fort while the Merchant keeps buying markets: should Neutral's Steward buy markets before saving (that would also make delegating stronger), or should the Merchant be held back? (2) "Got away" is 17–25%: is a rival army breaking out and keeping one territory for a turn acceptable, or should the leader hold more land back as a ring (fewer troops in the mass)? (3) The Leader personalities are subtle: want them pushed further (a Blitzer Leader chaining longer, a Conqueror ignoring second fronts)?

### Oct 8: Orchestrator review of session 20c
- **Checked the work:**
  - GitHub's checks pass on all four session 20c commits, so `main` is green.
  - The screenshots look right: the lobby's personality chips (Neutral / Conqueror / Blitzer / Opportunist / Schemer; Neutral / Turtle / Merchant), "Aldric, the Conqueror … 83 orders this turn", captured leaders keeping their personalities ("Gerrit, the Merchant, Queen Isolde's old Leader"), and a 108-order finishing turn with the marches converging on the map.
  - **Re-run and confirmed exactly:** the 20 mop-up positions with a Leader on Run the military: median 2 turns, 90% within 2, all within 3, "got away" 25%, about 134 orders a turn while finishing. This is what Nate asked for: mass, sweep, blanket.
  - **One thing the summary understates:** a finishing turn's planning takes about 290 ms on the orchestrator's machine (worst 600 ms) because of the hundreds of orders. Fine in single player (the limit that matters is the 50 ms for all bots together in ordinary turns, which holds at 12.5 ms average); worth watching in M4 when the server plans the bots.
- **Nate's calls on session 20c's questions (Oct 8):**
  - **"Got away" at 17–25%** (a real army breaks out and keeps a territory for one turn before the blanket retakes it): **acceptable**; no bigger ring.
  - **Leader personalities are subtle: leave them**; the language pass (22) gives them their voice.
  - **The Merchant Steward 6 points over Neutral on Embervale: leave both, re-measure after Walls (20b)**, which changes what a Steward's gold is worth.
  - **Captured leaders arrive on "Report to" your Leader / Steward by default** (one tap to change), instead of idle with no command. Session 20b, Step 0.
- **Next:** session 20b (Walls, fair seats), then Nate's play test from the list below.

### Oct 8–9: Claude Code session 20b (M3: Walls, and fair seats on every map)
*All four parts done. Write-ups: `docs/sim-results-m3-walls.md`, `docs/sim-results-m3-balance.md` ("Fair seats (session 20b)").*
- **Step 0:** captured leaders arrive on **"Report to" your Leader / Steward** (one tap changes it; the keep-or-let-go dialog and the report say so). The deal card warns **"A truce with Baron Krell would stop Aldric finishing them"** (a joint war too); diplomacy stays yours. **The two harnesses agree:** given the same seed, `s20-marshal.ts` and `s19-lines.ts` give the same number; 34.6% vs 42.6% was the seed alone (which capital spot the seat drew, which personalities were dealt). True number for all-in delegating on Embervale 4: **38.6% (1.54x fair) over 2,000 games**.
- **Walls (Parts 1–2):** culture 5 and a fort make a territory walled at the end of the turn its last piece finishes; touching walls join; every other territory of the wall lends its spare troops to every attack on it, at any distance (**Nate's calls during the session**: unlimited reach; lend to every attack, because one battle a turn let a 1-troop decoy use up the wall's help); losses on the attacked land first, then the lenders, carried over within the turn; Siege cuts only the fort's bonus; the wall falls with the land. Anyone who sees part of a wall sees its garrison, the odds preview counts it, and "guaranteed" still always wins (property-tested). Saves: state version 12.
  - **On screen:** a grey stone wall with battlements, towers and pennants in the House colour and the House's glow (Nate's picture), greyed when remembered; "Walled: 11 defend (with Yewstead and Wildstead)" on the card and the attack panel; "Completes a wall" before the last piece.
  - **The bots:** the Steward (Run the realm, Build up) finishes walls on land worth holding, after its markets, and keeps the fort's plot free (a market on the capital used to block its wall for good); the Marshal by personality (the Turtle from scratch, the Blitzer never); every bot counts a wall's garrison.
  - **The sims:** walls go up in 69% of 6-player Wyrmland games and 88% of Rootholm (from about turn 17), mostly the Turtle's and your Steward's; they're rarely attacked (bots count the garrison first). **A seat that walls its core wins more where there's room** (delegating seat on Embervale 29.6% vs 26.0%, Wyrmland 19.0% vs 15.4%; a Marshal on Rootholm 16.2% vs 9.2%), about even elsewhere. **Length and runaways are the same with walls on and off**, and no runaway hides behind walls (the halfway leader has under 1% of its land walled). **None of the limits changes anything measurable** in bot play (bot walls are small and hold 1 troop).
  - **Steward personalities with walls on** (delegating seat vs Marshals, 300 games, Embervale 4 / Wyrmland 6): Neutral 26.3 / 19.0, Turtle 22.3 / 18.0, **Merchant 36.7 / 26.0** (still over by 10 / 7 points). One market a turn levels Wyrmland, not Embervale; Neutral not saving up for forts levels Embervale but makes delegating 1.39x fair. Nate's call.
- **Fair seats (Part 3):** a search for every official map at its suggested table sizes (300 games a layout; about 13 hours of simulation overnight). **13 layouts pinned** where at least 5 points fairer on fresh games, e.g. The Moon Coast 4 from 1–82% to 1–50% a spot, The Sundered Crowns 6 2–72% → 0–32%, Wyrmland 6 1–50% → 3–29%, Greatmarch 10 2–31% → 5–17%, The Twin Realms 4 11–40% → 20–36%. The other 11 kept. **Most maps still have a spot under half its fair share** among equal bots (only The Twin Realms 4 and Greatmarch 10 are clear): the start bonus is listed with numbers, not built. **The exposure check** (in the map maker) agrees with the sims moderately: rank correlation 0.53, the weakest spot among the more exposed half in 84% of layouts; a tool, not yet a requirement.
- **Nate's notes during the session:** keep the wall's qualification as built (culture 5 and a fort, appears on its own); unlimited reach and every attack; the walls should look like his picture (done); **make the buildings more 3D so they pop like the wall** (for the polish pass, 21, and art batch 5).
- **Screenshots** (desktop and 384 px phone), `docs/art/screens/s20b-*.png`: `wall-single`, `wall-joined` (round five), `wall-card` ("Walled: 11 defend"), `wall-odds` (the attack panel counting the garrison), `wall-remembered` (greyed in the fog). Save: `s20b-save.json` from `make-s20b-save.ts` (a real Wyrmland game with walls added by hand); script `s20b-shots.mjs`.
- **Start-up bundle:** 482.5 → 485.9 KB (gzip 148.0 → 149.2).
- **Tests and deploy:** 943 automated tests pass (the full run twice); typecheck and the web build pass. Deployed to the private preview (version `995e5162`); the lock check passed. Nate: please check the repo's Actions page for the last commit.
- **Questions for Nate:** (1) a **start bonus** for the weaker capital spots (most maps have one under half of fair among equal bots; e.g. +4 troops or +10 gold, set per map and table size)? (2) **The Merchant Steward** is 7–10 points over Neutral: cap its markets, change Neutral's fort-saving, or leave it? (3) Should the map maker **require** the exposure check (it would reject some layouts the sims call fair)?

### Oct 9: Orchestrator review of session 20b
- **Checked the work:**
  - GitHub's checks pass on all eleven session 20b commits, so `main` is green.
  - The screenshots look right: grey stone walls with towers and pennants in the House colour, one territory and a joined ring of five; "Walled: 11 defend (with Yewstead and Wildstead)" on the card; the attack box counting the garrison in its odds; a remembered wall greyed in the fog.
  - **Re-run and confirmed:** Wyrmland at 6 players, win rate by capital spot (300 games): Longrest 27% down to Whitemarch 1.7%, a 26-point spread (the write-up: 49 → 27). Two spots (Whitemarch 1.7%, Wildfield 6.7%) are still under half of fair (8.3%): the start-bonus case.
  - The two harnesses now agree; all-in delegating on Embervale 4 is **38.6% (1.54× fair)** over 2,000 games (Nate: accepted until looked at again).
- **Nate's calls on session 20b's questions (Oct 9):**
  - **A start bonus for the weak capital spots: yes, as a part of session 22** (the sims size each bonus per map and table size and re-check the spread). Before friends play online.
  - **The Merchant Steward (7–10 points over Neutral on both maps): leave it.** Nate: personalities are meant to play differently, and that naturally gives different benefits in different scenarios (map size, player count, who you're up against). **But a leader that beats the Marshals consistently across map types shows a behaviour the Marshals should adopt.** The Merchant's edge shows on both Embervale and Wyrmland, so: **the Marshal (and the Neutral Steward) adopt it** (markets that pay back come before saving up for a fort that isn't urgent; save only for the capital's fort), and the delegating player is re-checked at fair. **Session 22.**
  - **The exposure check stays a map-builder feature**, for players building their own maps and, later, randomly generated maps: both will produce some games that aren't perfectly balanced, and that's accepted. **Player-made maps live in a community section, apart from the official, thoroughly tested maps.** (Design note for the map builder, after M4.)
- **Next:** Nate's play test from the list below (walls, the finish, personalities, captured leaders, a 160 map); then session 21 (the polish pass, with his fixes and the 3D buildings), 22 (the language pass, the start bonus, the Marshal adopts the Merchant's lesson).

### Oct 9: The orchestrator's own checks of the test list (played in the browser pane, build `e1aae2c`)
Nate asked whether the orchestrator had tried the list itself. The mechanical items, checked by playing the preview (an Embervale game against 3 Marshals from the lobby, then session 20b's saved Wyrmland position loaded from its file):
- **Verified:** Enter confirms an attack exactly as shown (amount, Leader, "only if still stronger") and Esc cancels; the ↵ hint on the button. Budgets cap at 100% ("Budgets: 100% of income"; typing 99 gold into the exact box became "Purse · 5 gold a turn"). The command menu (Hold, Defend, Push, Raid, Expand, Command this front, Run the military, Push back), with Clean up correctly absent at 1 territory. The lobby's personality chips, and "Aldric, the Conqueror" / "Odo, the Turtle" in the panel; the Steward's 10% default on crowded Embervale. Province lights up on a tap. Path: shortest way 3 / full sweep 12 (8 territories) with Enter confirming (15 orders queued). A deal card with one plain reason ("Queen Isolde is running away with the map; let's stop them together"), Accept in one tap. The Fallen's first turn (9 Influence, Famine on Isolde's land in one tap). The game-over graph and awards. The wall card ("Walled: 16 defend (with Kestrelkeep, Wildfield, Mistmarch and 1 more)"). Settings (Leaders' orders Mixed in / After mine, Tactical view, Layout, Save/Load). The Chronicle (Everything you saw / What touched you). A save file from the 20b code loads.
- **Found, for session 21's Step 0:**
  1. **A stale build served by the service worker.** The browser pane opened the preview on a build from before session 15 (two maps, "Recruit bots", no leader names), and a plain reload didn't update it; only unregistering the worker and clearing its precache brought up `e1aae2c`. Anyone who has visited the preview before may be stuck on an old version (a phone especially). The fix: check the worker's update path behind Cloudflare Access (the update fetch may be failing on the Access redirect), make the app check for a new version on every load, and show "A new version is ready: reload" (`vite-plugin-pwa`'s `registerType: "prompt"` or `autoUpdate` with `skipWaiting`), and show the version in the lobby so it's visible when it's stale.
  2. **The exact-amount budget box keeps showing the number you typed (99) after it's been capped (to 5).** Show the capped value.
  3. **Autosave shows "Nothing yet" in the lobby right after a finished game.** Probably the autosave is cleared when the game ends; if so, say "Last game finished" rather than "Nothing yet", or keep the last autosave until a new game starts.
  4. The path box's "Shortest way / Full sweep" buttons weren't found by name in the accessibility tree (a screen reader would see them unlabelled). Give them names.
- **Not checked (needs a late-game position or a phone):** Report to on a captured leader, Clean up at 75%, the attack box's odds on a rival's wall, a remembered wall greyed, the phone.
- **Two things seen in play, for the record:**
  - **Embervale, 4 players, 14 turns.** The orchestrator played badly on purpose for the budget test (a 5-gold Leader, 40 gold unspent) and was knocked out on turn 6 by Queen Isolde (a Marshal, the Merchant), who then held 25% by turn 6, half the map by turn 9 and 98% at 14, winning Best Military, Best Culture, Master Builder and Kingslayer (6 Leaders felled). The other two Marshals never stopped her; on turn 5 Morwen and Isolde had signed a joint war against Krell, the wrong target. One game, but it's the shape the sims call "half the map by turn 10" (a third of Embervale games): once a seat collapses, the map is small enough that nobody can catch the one who ate it.
  - **The walls weren't attacked:** over four turns of the 20b position the Marshals took every unwalled 1-troop territory around the walled core and left the wall alone (they count the garrison first).
- **Strategies that beat the Marshal:** none found at the knob level. One changed Marshal against a table of standard ones on Embervale (300 games): Leader with the main effort from turn 1 24.7%, a sweep of its own land first 20.7%, more pre-emptive strikes 23.7%, no opening capital guard 25.3% (fair 25%). The only known edge stays the one already logged: pure military with the leaders' planning path wins 1.5× fair on Embervale (and loses on Wyrmland), which session 20 couldn't trace to a cause. A strategy that needs new behaviour (not a knob) would need code, so it's a job for a session, not the orchestrator.

### Oct 9: Nate's play test of session 20b's build (first notes)
- **The Leader still hoards** on Run the military (gold kept turn over turn, fewer recruits than it could afford); the clean-up dragged, and once the remnant was coming back before he stepped in. Session 20's "never hoard" didn't hold in play.
- **The sweep isn't complete:** territories in the fog weren't touched. The sweep should hit every territory the remnant is in, might be in, or could move to.
- **Captured leaders report to his by default:** yes.
- **The Steward was mostly good,** but should put markets and buildings in the centre, forts wherever a wall may be wanted (now or later) and at choke points, push to wall up fast when its purse allows (several culture levels in one territory in one turn, so a wall can go up in a turn from 0), and when defences are the best thing to do, put everything into them. Run the realm and Run the military should work together on walls and the armies on them.
- He walled areas himself, too late to see them attacked. **The Marshals feel harder** but can still be improved, or a better bot built above them.
- **Nate's calls (Oct 9):** a short **session 20d** for these, before the polish pass (21 and 22 shift by one); **a top-tier bot above the Marshal later**, built from how he wins; he can share his games as save files (Settings → Save game → Save to a file), which the simulator replays. Design: `docs/04-design-additions.md` §15, "Nate's third note". Prompt: `docs/prompts/claude-code-session-20d.md`.

### Oct 9: Claude Code session 20d (M3: no hoarding for real, a sweep that covers the fog, the Steward's walls)
*All four parts done. Write-up: `docs/sim-results-m3-leaders.md` ("Session 20d"). Raw outputs: `docs/sims/s20d-*.txt`.*
- **Why the Leader looked like it hoarded:** its plan was already spending the purse (on 94–97% of turns in the sims, traced turn by turn the way Nate plays). **The Leaders panel showed the purse as the turn started**, before the Leader's own orders spent it, and the purse is refilled every turn, so it always looked full. **Now the panel, its header and the top bar show what's left once this turn's orders are paid for:** "Purse 0g · 50% of income · 9 orders this turn (18g)". Three smaller leaks fixed: a recruit whose site is lost now tries up to four other sites; with nowhere at all to recruit, it builds a barracks as soon as it can pay (it used to wait for 14 gold); a "saving" reason only when it really keeps gold.
  - **The numbers:** the purse ends a turn with less than a troop's cost (0 or 1 gold) on **95–98% of turns** (Wyrmland 6 and Rootholm 9, budgets 20/50/80%; was 93–96%). "Under 10% unspent" is 94–95% at 80%, 88–92% at 50%, 70–73% at 20%, where the 1 gold it can't spend (a troop costs 2) is more than 10% of a small purse.
  - **In the browser:** 12 turns of Wyrmland 6 against Marshals, Aldric on Run the military at 50%: "Purse 0g" or "Purse 1g" after its orders every turn.
- **The sweep covers the fog:** it goes everywhere the remnant is, **might be** (land never seen, and fog within 2 steps of theirs that was empty when last seen) and could move to; fogged land is no longer visited last; **more chains** sweep whatever the first ones didn't reach; the blanket covers your land next to the fog. Fixed on the way: while cleaning up, a rival next to whoever the planner read as running away was being skipped. **Rival land no order went for:** 20 fixtures 10.3% → **5.1%** (in the fog 22% → **13%**); the wide set 12.4% → **8.7%** (fog 23.5% → **12.5%**), now about the same as with the fog lifted. Not near zero: on the first finishing turn of a big map the troops can't reach everything yet, and armies too big to strike wait. **Finishing is no slower** (median 2 turns, all fixtures within 3).
- **The Steward builds with a plan:** markets and barracks deep inside your realm; forts on choke points and where walls will go (your capital's province, provinces you hold whole facing a rival, the province your Leader stands in); **several culture levels in one turn** (the culture rule didn't need changing: it was always allowed), so 40 gold walls your capital in one turn's orders; when you're threatened (a rival army near your capital's province, or a runaway whose land touches yours) **everything goes into the wall**. Your Leader keeps **4 troops in walled land facing a rival**. Walls now go up in about three games in four, from about turn 13 (was one in five, from turn 24–27), several territories a game.
  - **What the sims say:** those walls are attacked about once a game on the big maps and nearly always fall to that attack (a Marshal only attacks a wall it's sure of). The delegating seat (Leader 80%, Steward 20%) against Marshals: Embervale 26.0% → **31–33%** (fair 25), Wyrmland ~21% → **19–22%** (fair 16.7), Rootholm 8 13–14% → **10–12%** (fair 12.5). A question for Nate below.
- **Nothing else changed:** the Marshal plays exactly as before until it cleans up: one Marshal against Captains wins exactly as before (38.4% on Embervale 4, 36.8% on Wyrmland 6, the same games), the opening is the same (half the map by turn 10), and a few big games end a turn sooner. The Captain and the Recruit are unchanged (their tests).
- **Planning time:** this machine was about 2.3 times slower today than in session 20c (20c's own code planned in 29 ms today against the 12.5 ms it measured then). Side by side today, all ten bots at 10 players: 30.3 ms at the session start, **31.5 ms** now (about 13 ms on 20c's yardstick: under the 50 ms limit). Finishing turns: about 25–35 ms on average (worst about 70 ms), no slower than before.
- **Screenshots** (desktop and 384 px phone), `docs/art/screens/s20d-*.png`: `leaders` ("Purse 0g · 50% of income · 11 orders this turn (26g)"), `finishing-fog` and `finishing-fog-queue` (a finishing turn going into the fog: "Attack Kestrelhurst … Hop 11"), `wall-rush` (the Steward raising Moonwood's culture three levels in one turn, its fort building), `wall-garrison` ("Walled: 8 defend (with Moonwood)", Rookhome 5 troops, Moonwood 4). Saves from `make-s20d-save.ts` (a real delegating Wyrmland game); script `s20d-shots.mjs`.
- **Seen in passing (for session 21):** the Spoils card's text runs into its "1 mission" line in the Leaders panel (visible in `s20d-leaders.png`); and early in a fogged game the Leader's line can say "Finishing them off: …" about rivals it has barely seen (session 20's rule judges remnants on the land it can see), which reads oddly on turn 6.
- **Start-up bundle:** 485.9 → 486.3 KB (gzip 149.2 → 149.3).
- **Tests and deploy:** 952 automated tests pass (the full run twice); typecheck and the web build pass. Deployed to the private preview (version `dc0791c1`); the lock check passed. Nate: please check the repo's Actions page for the last commit.
- **Questions for Nate:** (1) your Steward's walls cost the delegating seat about 2–3 points on Rootholm 8 (10–12% against 13–14%, fair 12.5) and gain it 5–7 on Embervale 4: keep the plan everywhere, or wall less on the big 8-player tables? (2) Should the Marshal build with the same plan (session 22, with the Merchant's lesson)? (3) "Never ordered" isn't near zero (5% of rival land on the fixtures, 9% on the wide set): it's the first finishing turn on big maps and armies too big to strike. Acceptable, or push harder (fewer troops in the security blanket)?

### Oct 10: Orchestrator review of session 20d
- **Checked the work:**
  - GitHub's checks pass on the last three commits (Part 3, Part 4, PROGRESS), so `main` is green. **Parts 1 and 2 were pushed red:** session 20c's pinned "finishing fingerprint" test changed as soon as the sweep covered the fog, and the pin was only updated in Part 3. Not a real bug, but the full suite should run before every push, not only the package's tests (session 21's prompt says so).
  - The screenshots look right: "Purse 0g · 50% of income · 11 orders this turn (26g)"; a finishing turn's arrows going into greyed fog ("Attack Kestrelhurst … Hop 11"); Moonwood's culture raised three levels in one turn with its fort "ready next turn"; "Walled: 8 defend (with Moonwood)" with 5 and 4 troops inside. The phone sheets match.
  - **Re-run with the orchestrator's own seeds (300 games each):** the delegating seat with the planned Steward wins **29.0% on Embervale 4** (the session: 31–33%; fair 25) and **10.0% on Rootholm 8** (the session: 10–12%; fair 12.5). So the "stronger on small maps, weaker on Rootholm" picture holds.
  - **The headline finding:** the Leader wasn't hoarding; **the Leaders panel showed the purse before the Leader's own orders spent it**, and the purse refills every turn, so it always looked full. Now it shows what's left after this turn's orders. Three small leaks were real and are fixed.
- **Seen in the screenshots, for later:** the Steward sitting on **998 gold at turn 54** of a won game with nothing worth buying (Nate's call below); "Finishing them off: … Duke Varric (17 territories left)" on turn 6 of a fogged game (the session flagged it: the rule judges remnants on the land it can see); the Spoils card's text overlapping "1 mission" (session 21).
- **Nate's calls (Oct 10):**
  - **The Steward's wall plan stays everywhere**, and **the Marshal adopts it** in the bots-and-balance session (it beats the Marshals on two map types: his rule), with the delegating seat re-checked at fair on every table.
  - **The sweep's remaining misses (5–9%) are acceptable;** he plays and tells.
  - **A Steward with nothing worth building hands gold back:** whatever its purse holds over two turns of its budget, with a reason ("Odo returned 40 gold: nothing worth building").
  - **Session order: 21 the polish pass, 22 the language pass, 23 bots and balance** (the start bonus, the Merchant's lesson, the Steward's plan for the Marshal, idle gold handed back, a remnant judged honestly under fog), **then sound.**
- **Next:** session 21 (`docs/prompts/claude-code-session-21.md`) and the orchestrator-08 prompt. Nate's play test (below) can run alongside it.

### Things to test after session 20d (Nate's next play test)
*Laptop first; the phone where it applies.*
- **From session 20d, most important first:**
  1. **Run the military with 50–80% for ten turns** (Wyrmland or Rootholm): look at your Leader's line in the Leaders panel each turn. Does it say "Purse 0g" (or 1g) with its orders' cost beside the count ("9 orders this turn (18g)")? Do the troops it recruits march toward the fighting the same turn? If it ever keeps gold, does it say why ("Saving 4 gold: nowhere to recruit until the barracks at … is up")?
  2. **Clean up against a rival with land in the fog** (hold 75% of a big map, Leader on Run the military): does the sweep go into the fog after them (its orders reach territories you can't see, each "only if still stronger")? Do they still get away, or come back?
  3. **Give your Steward 50% when a Marshal masses near your capital:** does a wall go up in a turn or two (the queue shows several "Raise culture" orders on one territory and a fort)? Does your Leader keep troops inside it (4 or more in walled land facing the rival)?
  4. **Did anyone ever attack your wall?** And did it hold? (In the sims walls get attacked about once a game on the big maps and usually fall when they do; the question is whether they put attacks off.)
  5. **Where does your Steward build now?** Markets deep inside your land, forts on passes, fords and the narrow necks, and walls on your capital's province first.
  6. **Does a delegating game feel too easy on Embervale now?** (The sims say a delegating seat wins about 31–33% there against Marshals, fair 25.)
- **Still open from session 20b (not tried yet), most important first:**
  1. Wall your capital's province on Wyrmland and let a Marshal hit it: does "Walled: N defend" match what happened in the battle?
  2. Can you still break a walled runaway (the Turtle walls most)? Is the odds preview honest, and does "guaranteed" always win?
  3. Your starting spot on a 160 map (Ashwing or The Sundered Crowns): did it feel fair?
  4. Capture a Leader: does it arrive "Reports to Aldric", and does one tap give it another command?
  5. Offer a truce to a rival your Leader is finishing off: does the card warn you?
  6. A wall you saw and can't see now: is it greyed on the map?
  7. On the phone: do the wall ring and its battlements read at every zoom, and never hide the troop pill?
- **Not tried yet (carried over):** the phone; a 160-territory map (Ashwing or The Sundered Crowns); Embervale with 4; getting knocked out once (is the Fallen loud enough?); Conquest's 20-turn default on a 200-territory map.

### Things to test after session 20b (Nate's next play test)
*The orchestrator adds to this list after each session. Laptop first; the phone where it applies.*
- **From session 20b (Walls, fair seats), most important first:**
  1. **Wall your capital's province on Wyrmland and let a Marshal hit it.** Raise culture to 5 and put a fort on your capital and two or three neighbours (or leave it to your Steward on Run the realm). Does the red crenellated ring go round the whole group? When a Marshal attacks one of them, does the card's "Walled: N defend" match what happened in the battle (the report counts everyone who defended, and your other walled land loses its share)?
  2. **Does a wall feel worth 39 gold a territory?** Keep a real army inside it (the sims' bots keep 1 troop in walled land, so their walls lend nothing): does it make that land safe enough to send everything else to the front?
  3. **Can you still break a walled runaway?** Let a Marshal wall up (the Turtle walls most) and attack it: is the odds preview honest (it counts the garrison), and does "guaranteed" always win?
  4. **Your starting spot on a 160 map** (Ashwing or The Sundered Crowns): did it feel fair? Several maps' capital spots were re-chosen by the simulator (see the table in `docs/sim-results-m3-balance.md`).
  5. **Capture a Leader** (knock a Marshal out): does it arrive "Reports to Aldric" (and its Steward to Odo), and does one tap give it another command?
  6. **Offer a truce to a rival your Leader is finishing off:** does the card warn "A truce with … would stop Aldric finishing them"?
  7. **A wall you saw and can't see now:** is it greyed on the map ("Walled when last seen" on the card)?
  8. **On the phone:** do the wall ring and its battlements read at every zoom, and never hide the troop pill?
- **From session 20c (mass and sweep, the security blanket, leaders with personalities; not tried yet), most important first:**
  1. **Hold 75% of Wyrmland and watch the finish:** your Leader on **Run the military** (or **Clean up**) with most of your income. Does it mass in one place with your Leader, sweep everywhere the rivals are and could go, and take back anything they take the same turn? How many orders did it write (the queue counts them)? How many turns to finish?
  2. **Give your Leader the Conqueror and your Steward the Turtle** in the lobby: can you tell in play? (The Turtle should put up forts and culture first; then try the Merchant: markets first.) Does "Aldric, the Conqueror" show in the Leaders panel, and does it speak in its own voice in the report when it takes land?
  3. **Capture a Leader that had a personality** (knock out a Marshal): does it keep it ("Wynn, the Turtle")? Put it on Clean up with your Leader: do they work as one (its army moving under your Leader's orders)?
  4. **A rival army next to your land mid-game:** does your Leader on Run the military move a few troops into the land behind your front that army could reach (after its attacks), and does it take back what the rival grabs?
  5. **Watch the Marshals' Leaders after turn 15:** do they march with the biggest attack and use the Initiative there?
  6. **Your chains:** does your Leader stop a chain a step short rather than leave the army where a rival would throw it straight out?
  7. **An older save** (from before today): does it load, with your leaders Neutral?
- **From session 20 (leaders that finish the job, the Marshal plays like a person, controls), most important first:**
  1. **Hold 75% of a map and finish it with your leaders:** put your Leader on **Run the military** (or **Clean up**, which now appears in its command list) with most of your income. Does it end the last rivals in a turn or two? Does the Leaders panel say "Finishing them off: …", and does the report say "Your Leader, Aldric, finished …"? How many orders does it write?
  2. **Watch your Leader's purse on Run the military:** it should be spent every turn (or say what it's saving for). Do your troops head toward the fighting, including the army at your capital?
  3. **"Push back"** a rival that annoys you: does it take only their weak land, keep clear of their big army, and leave everyone else alone? Does the one-line reason make sense?
  4. **"Report to":** set a captured Leader to report to yours: does "Reports to Aldric" show, does its budget go to Aldric, and do Aldric's orders move its army (its portrait on those orders)?
  5. **Budgets:** with your Leader on 80%, open your Steward's Budget: do the chips stop at 20%? Does the top say "Budgets: 90% of income"?
  6. **Enter to confirm** for a whole turn: attack, Enter, attack, Enter. How many fewer mouse trips? Esc to cancel. (The ↵ on the Add button.)
  7. **A full sweep across Wyrmland:** does it leave any pocket of unclaimed land between the two points?
  8. **A delegated game against Marshals** (Leader on Run the military with 80%, Steward on Run the realm): does delegating still beat them? (The sims say it's now about fair.)
  9. **Do the Marshals finish their own games faster now?** (Bot games on the big maps used to run to the 60-turn cap.) Do they build more on a big map?
- **Not tried yet (carried over):** the phone; a 160-territory map (Ashwing or The Sundered Crowns); Embervale with 4; getting knocked out once (the Fallen's first turn); Conquest's 20-turn default on a 200-territory map.
- **Older lists (still useful):**

- **From session 19 (the balance pass and bigger maps), most important first:**
  1. **Embervale against 3 Marshals:** does the game last longer (the sims say about 29 turns, was 21), and does someone run away less? Does anyone get knocked out in the first few turns (they shouldn't now)?
  2. **A 6–8 player game on a new ~160 map** (Ashwing or The Sundered Crowns): how many turns, does the size feel right for big battles, and do the neck (Ashwing) and the strait (Sundered Crowns) matter?
  3. **Does culture or building now feel worth it?** Culture gives +1 gold a turn a level now. Raise culture on safe land early and see if it pays; watch what your Steward builds on its own. (The three levers are in the write-up if you'd pick another.)
  4. **Get knocked out on purpose once** and try the Fallen's first turn: is it obvious what you can do straight away? Did your event land, and did it feel worth staying for?
  5. **Try to run away against Marshals** on Wyrmland: do they team up on you, and when?
  6. **An 8–10 player game on Krakenmere or Rootholm** (the lobby defaults to Conquest, 20 turns, at 8+ players): is 20 turns enough on a 200 map? On the phone: is it smooth enough?
  7. **Your starting spot:** did it feel fair? (Sims found some capital spots much stronger; Embervale's 4-player spots were re-chosen.)
  8. **Never touch your Steward** on Embervale with 4 (it starts at 10% there) and on Wyrmland (20%): does it feel like the right amount? What did it build? Then give it a **bigger budget** (30–50%) and see what it builds.
- **From session 16:**
  - zoom all the way in (sharp?) and all the way out (everything visible clear of the menus? the province names readable, not piled up?)
  - tap territories you don't own: does the province light up clearly, with its name and bonus?
  - a path order, both Shortest way and Full sweep
  - attack with your Leader and chain on (it should go along by default and stay with the army)
  - the Initiative and Wait buttons (hover, or press and hold on the phone)
  - pick a House colour in the lobby
  - capture land that had culture (it should drop to 0; buildings stay)
  - Spoils: is it clear now, and does one of each feel like the best?
  - the Chronicle after a few turns: did anything happen to you that you'd have missed? Do Fate and the Fallen feel loud enough?
  - the power graph and the awards at the end
  - spies cost gold only while away
  - on the phone: how smooth do panning and the replay feel?
- **From session 17 (the Marshal):**
  - a 6-player Wyrmland game against Marshals (the lobby's default now): **try to run away.** Do they team up on you, and when? (A Marshal offers the others a joint war against you as soon as it reads you as running away; the sims say about turn 10.) Do the offers you get say so?
  - **do the personalities feel different?** Guess each bot's personality while you play, then check at the end (the game-over screen reveals them: "Marshal, the Turtle"). Or turn on "Show personalities" in the lobby.
  - a **Mixed** table ("2 Marshals and 3 Captains"): can you tell which are which?
  - are Marshals **too hard**, or just right? (One Marshal beats Captains about 1.4 times as often as its fair share.)
  - fully zoomed out on Wyrmland: are the province names readable and no longer piled up?
- **How many turns did each game take?** (Note the map and the player count.)
- **From session 18 (leaders you delegate to):**
  - **name your Leader** in the lobby (and your Steward if you like); do the names show in the Leaders panel and the report?
  - give your Leader **"Expand our empire in this direction"** toward somewhere 4–6 steps away, with a budget (say 30%), and watch it for a few turns: does it race through empty land, slow down where rivals stand, take whole provinces on the way, and stop when it gets there?
  - **"Run the military"** for a few turns while you only do the diplomacy: is it as good as you'd hope?
  - **capture a player** and command their Leader and Steward (try "Command this front" on a captured Leader)
  - the **"Leaders' orders: Mixed in / After mine"** switch: which reads better?
  - **Take back** a purse and spend it yourself the same turn
  - change or delete one of a leader's orders in the queue (it's yours to edit)
  - on the phone: open the Leaders sheet from your Leader's portrait; is everything reachable in a few taps?

### Oct 10: Claude Code session 21 (M3: the polish pass: art batch 4, effects, a cinematic replay, a living map, menus with weight)
*All six parts done, plus Step 0. Plan and BUILT lines: `docs/09-polish-and-effects-plan.md`. Screenshots `docs/art/screens/s21-*.png`, the GIF `s21-replay.gif`.*
- **Step 0, the stale build:** behind Cloudflare Access, once the login expires every request gets the sign-in redirect, the service worker's update check included, so it failed without a word and the offline copy kept serving whatever it had (the orchestrator's pane: a pre-session-15 build). Worse, the offline copy answered every page load itself, so the sign-in could never get through. Now the game checks `version.json` (never cached) on every load: **"Sign in again to get the latest version"** when the login has expired (its link reaches the sign-in, past the offline copy), **"A new version is ready: reload"** when a newer build is live and no update is on its way, and the usual "Update ready" otherwise. The version shows at the top of the lobby. Tested against two real builds in three cases (`s21-stale-build.mjs`: login fine, login expired, update never arriving): all three end on the new build. **Not tested on the real preview** (the browser pane I have went straight to Access's sign-in, which is Nate's to do; it had no old offline copy). **A browser stuck on a build from before today** can't be rescued by new code: signing in normally lets its own update through; if it's still stuck, clear the site's data once.
- **Step 0's nits:** the budget box shows the capped amount (99 → 5); Autosave says "Last game finished (Wyrmland, turn 14)"; the path buttons have names; **the Spoils card overlap** was a class clash (its rule text was squashed to 1 px by the gold divider's style).
- **Art batch 4 (Part 1):** all 42 pieces were there (and the scenery group's other 12 were finished on Oct 7; not drawn yet, so not registered). The importer turns black backgrounds into soft transparency with the colour kept (tested), cuts magenta as before, flags each effect normal / add / screen, and writes contact sheets (`import-fx.png`, `import-batch4.png`): nothing came out wrong; as the report said, `fx-crack` is diagonal (turned in code) and `fx-dust-2` is a spiral. **The pines:** batch 3's firs kept (they read as pines at game size; batch 4's look like round oak clumps), warmed to the oaks' green by a colour rule. New hills, scaffold, wooden bridge; rangers' and standard-bearer's figures by the army; the spy icon in the menus; the windmill with turning sails; the title art behind the lobby (69 KB), victory and defeat behind the results.
- **The replay got faster before it got prettier (Part 2a):** measured with three turns and the fog lifted, the replay ran at **4.9 fps on Wyrmland 6 and 1.3 on Krakenmere 10** on the phone profile at the start: every event redrew every border on the map, rebuilt all 200 markers and every House's band, and re-traced every realm. Now only what changed is redrawn; separate render groups; the map catches up at most 5 times a second.
- **Effects (Part 2):** a particle system built in house on PixiJS's ParticleContainer, every particle a formula of the replay's clock and a seed (the game's public id, the turn and the event), so "Watch again", Skip and pause look the same; recipes as data with a schema. Armies march as soldiers with their banner behind an inked campaign line, meet at the border, fight in dust and smoke with sparks and arrow volleys (from the walls behind a fort), a Siege stone lands in debris; captures topple the old banner and raise the new; a capital falls in smoke and flame with a push-in and a title card; a knocked-out House's banner burns away. **Settings → Effects: Full / Light / Off**; a slow replay moves itself to Light and says so once; Reduce motion starts on Light. The info (troop numbers, results, losses, pops, the fog's pulse) is its own code and identical on every setting (tested), and fogged events are the same pale pulse whatever they were (tested; the old coloured dot that hinted at a battle is gone).
- **Buildings stand up like the walls (Part 3):** a cast shadow from the building's own outline, a stone plinth, lit and shaded rims, on forts, markets, barracks, watchtowers, scaffolds and the capitals.
- **The cinematic replay and the rest (Parts 4–6):** letterbox, vignette and a warm grade; title cards (capital falls, House knocked out, deal broken; at most two a turn); recruits marching out, scaffolds rising and dropping away, laurels, Spoils cards bursting, coins to the gold counter as it rolls; a signature for every Fate card and Fallen event; deals sealed (scroll, seal, the truce border stitching itself) and broken (a red crack, the Oathbreaker stamp); spies (the hooded figure, the eye, "Caught"); the living map (clouds and their shadows, chimney smoke, sails, flags, the lighthouse beam, boats, birds, coastal foam); the seal's press and gold flecks, the timer's ember, "Turn N" sweeping across, panels easing in, the report's lines one by one, clouds over the title art, embers or petals on game over.
- **Frame rate** (phone profile: 384 px, CPU 4×; fog lifted, three turns each; `perf-s21.json`):
  | | Start of session | Full | Light | Off (Part 2 build) |
  |---|---|---|---|---|
  | Wyrmland 6, phone | 4.9 (worst 3) | **93** (worst turn 87) | 108 (84) | 114 |
  | Krakenmere 10, phone | 1.3 (worst 1) | **79** (worst turn 48) | 81 (58) | 77 (52) |
  | Wyrmland 6, laptop | | 302 | 289 | 246 |
  | Krakenmere 10, laptop | | 203 | 194 | 194 |

  (Frames a second through the replay, uncapped. Session 19's 39–43 fps was a different measure: one turn, one attack. Krakenmere's busiest turn sits just under 50 even with Effects Off, so it's the 10-player map's own work, not the effects; on a real phone that turn would move itself to Light, which doesn't help much there. Runs vary by ±15% on this machine.)
- **Particle budget** 600 phone / 2,000 laptop; busy moments use 60–90 (Full), 35–40 (Light). **The living map** costs about 0.4–1 ms a frame on the throttled phone at Mid. **The replay's length** is unchanged (timeline untouched; the 10–20 s median test passes). **Start-up bundle** 486.3 → 491.2 KB (gzip 149.3 → 150.8), inside the 5 KB allowance: batch 4's names, Step 0's notices, the title art's styles (the effects and their art load with the game screen).
- **Tests and deploy:** typecheck and the web build pass; 978 tests pass (the full run twice before the last push). Deployed to the private preview twice (`07750885` after Part 6, **`5c6d1602`** final); the lock check passed both times. Nate: please check the repo's Actions page for the last commit.

### Oct 10: Orchestrator review of session 21
*A new orchestrator (session 8) took over from here.*
- **The code:** all seven commits green on GitHub (the last, `87febf7`, included). Nothing slipped, so there is no 21b.
- **The stale-build fix, checked on the real preview from the browser pane:** the pane was on an old build (no version in the lobby, a new service worker waiting). With a valid sign-in it showed "Update ready"; "Update now" brought up today's build (`c033ff7` in the lobby). The lock held: every path fetched without the sign-in cookie (bypassing the offline copy) was sent to Cloudflare's sign-in, and the identity was Nate's.
- **The phone screenshots read well:** the replay has the whole screen, title cards and banners sit clear of the map, buildings stand up.
- **Found in the screenshots, not the session's subject (session 22's Step 0):**
  1. **On the laptop the replay is half hidden:** the territory panel and the order dock stay open over the map while it plays (about 40% covered), and the letterbox sits under them. The phone closes its sheet. Nate: fix it at the start of 22.
  2. **The same news twice:** a capture with a title card shows the banner ("You capture Whitemarch") and the card ("Whitemarch falls to you") together.
  3. **Floating words** ("Fire", "culture") are plain white system text.
  4. **Gold piling up:** 811 gold in purses at turn 54 in the knock-out shot, the Steward with nothing to buy. Session 23's hand-back rule covers it.
- **Frame rate:** the numbers are from a phone profile on the laptop (CPU 4×), not a real phone. Nate's Android is the real check (test list item 2).
- **The session's three questions** (the amount of effects, whether the buildings pop, the 12 scenery pieces waiting) are play-test items; the scenery pieces wait for art batch 5 (orchestrator default).
- **Nate's voice:** his writing-style skill ("nate-voice") is the source for the language pass. The orchestrator turned it into `docs/voice-guide.md` (the hard rules, where humor is allowed, a voice for each bot personality, sample rewrites for Nate to strike or change). The session writes `docs/voice/lines-for-nate.md` at the end for Nate to mark up.
- **Session 22's prompt is written** (`docs/prompts/claude-code-session-22.md`).

### Things to test after session 21 (Nate's next play test)
*Laptop first; the phone where it applies.*
- **From session 21, most important first:**
  1. **The update notice:** open the preview on your phone (the one that may be on an old version). Does the lobby show today's version at the top? If not, does it say "A new version is ready" or "Sign in again"? (If it's stuck on an old version with no notice at all, clear the site's data once: Chrome, the lock icon, Site settings, Clear.)
  2. **Watch a whole replay on the phone on Full:** smooth? Did it ever move to Light by itself and say so? (Krakenmere and Rootholm at 8–10 players are the hardest.)
  3. **Is the replay as readable as before?** Can you still tell who attacked whom, who won, and the losses, without reading the report? Then **Settings → Effects → Off**: is anything missing that you needed?
  4. **"Watch again":** does it look exactly the same?
  5. **Do the buildings pop like the walls?** (Forts, markets, the capitals, at Near, Mid and Far.)
  6. **The title screen and game over:** is the key art right behind the lobby on the laptop and the phone? Victory and defeat?
  7. **A capital falling** (yours or a rival's): the push-in, the smoke and flames, the title card. Too much, or right?
  8. **The living map while you plan:** clouds, smoke, sails, boats, birds. Quiet enough? Ever distracting?
  9. **The menus:** the seal's stamp, the timer's ember in its last 10 seconds, "Turn 9" sweeping across. Does anything slow a basic turn?
- **Still open from session 20d (not tried yet), most important first:**
  1. Run the military with 50–80% for ten turns: "Purse 0g" with its orders' cost beside the count?
  2. Clean up against a rival with land in the fog: does the sweep go into the fog after them?
  3. Your Steward at 50% when a Marshal masses near your capital: does a wall go up in a turn or two, with your Leader keeping troops inside?
  4. Did anyone attack your wall, and did it hold?
  5. Where does your Steward build now (markets inside, forts on passes and necks, walls on the capital's province first)?
  6. Does a delegating game feel too easy on Embervale?
- **Not tried yet (carried over):** the phone; a 160-territory map (Ashwing or The Sundered Crowns); Embervale with 4; getting knocked out once (is the Fallen loud enough?); Conquest's 20-turn default on a 200-territory map; capturing a Leader ("Reports to Aldric"); a remembered wall greyed in the fog.

### Oct 10: Claude Code session 22 (M3: the language pass, every word in Nate's voice)
*All four parts and Step 0 done, nothing slipped (no 22b). Built on `docs/voice-guide.md` and Nate's "nate-voice" skill. Nate's sheet: `docs/voice/lines-for-nate.md`. Screenshots `docs/art/screens/s22-*.png`.*
- **Step 0, the replay fixes:** on the desktop the territory panel and the order dock slide out of the way while the replay plays (0.3 s, none with Reduce motion) and come back as they were, so the letterbox and vignette show full width (`s22-plan-1440.png` before, `s22-replay-1440.png` and `s22-replay-1024.png` during). One headline per event: a title card's event no longer gets a banner too (`s22-title.png`). The floating words are in the display font on an ink plate with the House's colour (`s22-pop-1440.png`). Baseline sims recorded.
- **Part 1, the voice in code:** the voice test reads about 6,200 player-facing strings with the TypeScript parser (the web app, the bots, the engine's text, the line library, the rules reference) and fails on the guide's hard rules; 192 failures at the start, **none at the end** (the expected-failures list is empty). It can't reach names built from map data, the browser's own formats or Workbox's text. The line library (`packages/content/data/lines.json`, its schema checks every placeholder) holds what the bots and leaders say, 3 to 5 versions each, picked by the game's public id, the turn and the speaker.
- **Part 2, the six personalities:** each answers, offers and breaks deals in its own voice, and has its own versions of the reasons it gives most; the Captain and the Recruit stay plain (`s22-deal-<personality>-truce/passage.png`, `s22-deal-offer.png`). **Not captured:** a bot's broken-deal line in the report (bots break deals with a line only when a capital or the win is certain; none did in 20 headless games or 54 played turns).
- **Part 3, the leaders' voices:** your Leader, your Steward and captured leaders speak about each turn in the report ("Your leaders"), the Chronicle and the Leaders panel, worked out by the host from your own view only. Nate's running bits: captured leaders' suspicious loyalty, your Leader judging your own bad moves with the turn's real numbers (`s22-leader-judge.png`: "You hit Moonwood's 41 with 1. I admire the confidence. I'd have brought more."), the Steward's handout written for session 23; grudges with receipts. At most one line per leader a turn and three a report (`s22-report-voices.png`, `s22-leaders-panel.png`, `s22-chronicle.png`, `s22-captured-first.png`).
- **Part 4, every other word:** title cards (plain for your own loss, a sarcastic subline on a rival's misfortune or a broken deal), game over and the awards as a royal audit (`s22-victory-awards.png`), notices, empty states, waiting text, Spoils flavour lines, the map and personality blurbs, the rules reference (no dashes, semicolons or arrows, and a section on what leaders say).
- **Lines written:** about 1,000: 241 personality deal lines, 147 personality reasons, 83 plain reasons, 445 leader lines (six personalities and Neutral), 27 captured-leader lines, 59 screen lines.
- **Words only:** the same seeded sims before and after every part match exactly (6 Marshals on Wyrmland with diplomacy: same win rates by seat and personality, games avg 43.5 turns, 40.7 deals and 5.10 broken a game; a Blitzer and three Captains on Embervale: avg 26.8 turns, 9.8 deals, 0.90 broken). The determinism test passes; tests that pinned old wording now pin the new.
- **Start-up bundle** 491.2 → 487.8 KB (the old voice block left the lobby's bundle; the line library loads with the game screen and the bots' worker). **Deployed** four times: `16fc915d` (Part 2), `5178dde7` (Part 3), `aff89578` (Part 4) and **`910e40e4`** (final, after the docs); the lock check passed each time. 999 tests pass. Nate: please check the repo's Actions page for the last commit.

### Oct 10: Orchestrator review of session 22
- **The code:** every part done, no 22b. Two commits went red mid-session; the last two are green.
  - `507ba26` (Part 3): a test still pinned the old trade wording. It was re-pinned in the next commit, but it should have been in the same one.
  - `202374c`: a random-input fog test failed when a rival watched a wall go up. **Not a fog leak:** the engine shows a wall to anyone who can see any part of it, but the test never learned about walls (session 20b) and found no place to check. Reproduced with the failing case, fixed the test, kept the case as a fixed example (orchestrator commit).
- **Only the words changed, checked with the orchestrator's own seed:** 30 games of six Marshals on Wyrmland with diplomacy, at the commit before the session and after it. Every game came out the same (only the timings differ).
- **The screenshots read well:** the laptop replay now has the whole map (the panels slide away), one headline per event, the floating words on a plate, your leaders speaking in the report ("Baron Krell has 57 troops two steps from Whitemarch. I'm pulling the army home to meet them."), the Leader judging a bad attack, the awards as a royal audit.
- **One nit left:** the Fallen's uprising line still says "its 1 rebels" (the Fate card's line was fixed). Session 23's Step 0.
- **Nate's calls:** extra troops at the capital for the start bonus; a comeback title card (your own House only: a rival's land size is hidden, so a card about it would leak what the fog hides); keep the dots on busy buttons; he picked his key lines with the orchestrator (`docs/voice/nate-picks-oct10.md`) and added one of his own for the Merchant: "The math isn't mathing here."
- **Session 23's prompt is written** (`docs/prompts/claude-code-session-23.md`).

### Things to test after session 22 (Nate's next play test)
*Laptop first; the phone where it applies.*
- **From session 22, most important first:**
  1. **Read a whole turn's report.** Does it sound like you? Is anything a joke where it should be plain?
  2. **Do the six personalities sound different** in their deal answers? Offer a truce and a right of passage to each bot (Show personalities in the lobby helps).
  3. **Your leaders:** did one ever say too much, or something that didn't happen? Did your Leader judge a bad move of yours fairly, with the right numbers? Too often, or not often enough?
  4. **Capture a leader** (knock a House out): does its first report and its loyalty make you laugh, or wince?
  5. **Any line you'd never say?** Mark it in `docs/voice/lines-for-nate.md`.
  6. **The replay on the laptop:** the territory panel and the order dock slide away and come back; the whole map is clear while it plays.
  7. **Title cards:** a rival's capital falling or a House knocked out has a dry line under it; your own loss is plain. One headline per event (no banner under the card).
  8. **Game over:** the line under the result, and the awards' remarks.
- **Still open from session 21 (not tried yet):** the update notice on your phone; a whole replay on the phone on Full; is the replay as readable as before (and with Effects Off); "Watch again" looks the same; do the buildings pop; the title screen and game over art; a capital falling (too much, or right); the living map while you plan; the menus' seal, ember and turn sweep.
- **Still open from 20d and before:** Run the military at 50 to 80% for ten turns; the sweep into the fog; the Steward's walls when a Marshal masses; a 160-territory map; Embervale with 4; getting knocked out once; Conquest's 20 turns on a 200-territory map; a remembered wall in the fog.

### Oct 10 and 11: Claude Code session 23 (M3: bots and balance: your leaders' last fixes, the Marshal learns, a head start for the weak spots)
*All three parts and Step 0 done. Write-ups: `docs/sim-results-m3-leaders.md` ("Session 23"), `docs/sim-results-m3-balance.md` ("The start bonus (session 23)"). Raw runs `docs/sims/s23-*.txt`. Screenshots `docs/art/screens/s23-*.png`.*
- **Step 0:** Nate's picks in the line library (picked situations skip the three-version minimum; his Merchant line; "Since turn {turn}."; the new tagline; the Blitzer's blurb "Eats lunch on the march."); Nate's sheet now generated from the library. Plurals fixed ("its 1 rebels" and four more). **The comeback card** for your own House (down to a quarter of its most land, back above half, once a game): "House Gules is back / Everyone who wrote us off, please form an orderly line." (`s23-comeback.png`).
- **Part 1, the handout:** a Steward with nothing more worth building keeps two turns of its budget (or what it would spend over the next two turns, if more) and hands back the rest as the turn ends. **The turn-54 save:** Odo had 1,157 gold; he bought 37 levels of culture, kept 110 and **handed back 916**, then about 45 to 50 a turn. In the browser the panel said "about 908 gold goes back" and 908 came back (`s23-leaders-handout.png`, `s23-report-handout.png`).
- **Part 1, the remnant:** the "Duke Varric (17 territories left)" line was **turn 54, cleaning up**, not turn 6 (before turn 15 the opening blocks finishing). The honest-under-fog rule is built for your leaders; for the Marshal it made Rootholm games 3 turns longer, so the Marshal keeps its old judgement.
- **Part 2:** the **Merchant's lesson** is on (Marshal and your Neutral Steward): markets that pay back before the likely end of the game before forts that aren't urgent. **The Steward's plan for the Marshal was tried six ways and left off:** it made the Marshals weaker, games longer, and every personality a waller (a question below).
- **The delegating seat against Marshals, before and after (times fair, seed s23p2b):** Embervale 4 1.32 to **1.25**, Wyrmland 6 1.30 to **1.36**, Rootholm 8 0.80 to **0.93**, Moon Coast 6 1.02 to **1.10**, Crownlands 8 1.33 to **1.15**, Ashwing 7 0.79 to **0.93**. Four of six inside 0.85 to 1.2; Embervale 4 and Wyrmland 6 still above (on another seed 1.17 and 1.02: about ±0.15 with the seed).
- **All-Marshal tables, before and after:** Embervale 4 22.9 / 22.9 turns, Wyrmland 6 41.1 / 41.0, Rootholm 8 44.1 / 43.7 (halfway leader won 56.0 / 55.3%, 43.0 / 41.1%, 45.7 / 43.0%). Each personality plays and wins as before (`docs/sim-results-m3-leaders.md`). **The Captain's fingerprint is unchanged** (`232617a30b1f8b47`); the Recruit 0.35 times fair before and after.
- **Planning time (side by side):** the Marshals as before (all ten bots 10.9 and 11.5 ms, now 11.4 ms); your own leaders 1.5 to 2.1 ms a turn for the handout's look-ahead.
- **Part 3, the head start:** extra troops at a weak spot's capital (+2, +4 or +6), in the map recipes beside the pinned layouts, shown as turn 1 starts ("Wildfield starts with 6 extra troops (a harder spot).", `s23-bonus-notice.png`), on the card and panel on turn 1, and in the first report. Saves carry it (state version 13); old saves' histories replay as they were played. **The finding:** start troops barely move a weak spot. Across 24 tables 59 spots win under half of fair; on average they win 3.3% before and 3.6% with the bonus (the 49 with +6: 2.8% to 3.0%), and 5 reach half of fair. Bonuses on all 12 maps (none needed on Greatmarch 10 and The Twin Realms 4), nothing above fair. Table: `docs/sim-results-m3-balance.md`. Screenshots `s23-bonus-notice`, `-card`, `-report`.
- **Start-up bundle:** 487.8 to 489.8 KB (gzip 150.3). Deployed: `7fcff7f6` (Part 1), `c8011f15` (Part 2), `4e5e6b1f` (Part 3's first six tables), **`efdc5ad4`** (final; the lock check passed each time). 1,030 tests pass; typecheck and the web build pass (the full run twice before the last push). Nate: please check the repo's Actions page for the last commit.
- **Questions for Nate:** (1) The Steward's plan made the Marshals weaker, not stronger: leave it to your leaders, or should the Marshal get a lighter wall habit of its own (a separate design)? (2) Start troops barely help the weakest spots (+6 often leaves them at 1 to 5% on 6 to 10 player tables): keep the bonus as sized, try another lever (gold, a Spoils card, a fort at the capital), or move those spots (the map maker)? (3) Your Leader with the Opportunist's or the Schemer's personality often plays like a Neutral one mid-game under fog: give them a stronger trait of their own?

### Oct 11: Orchestrator review of session 23
- **The code:** all five commits green; nothing slipped (no 23b).
- **The start bonus doesn't move weak spots, confirmed with the orchestrator's own seed:** Embervale 6's three weak spots win 3.3%, 4.0% and 5.0% without it and about 2 to 6% with +2 to +6 troops (fair 16.7%); the session's own 24 tables say the same (2.8% to 3.0% for the spots that got +6). The position is the problem, not the army. **Nate: keep it and judge by play**, and **weak spots are used last and go to bots first** (session 25).
- **The screenshots read well:** "Wildfield starts with 6 extra troops (a harder spot)" on the notice, the card and the first report; the comeback card ("House Gules is back. Everyone who wrote us off, please form an orderly line."); the Steward's handout in the panel and the report.
- **Seen in the screenshots:** the turn-55 report has one line per culture level the Steward raised (four lines for Larkgarth alone); "Squalls at sea strikes Hollydale"; "handed 908 gold back from its purse". All three in session 24's Step 0. The handout's voiced line ("Wanted the peasants to have something.") didn't show in the shots because the wall line outranked it that turn (one line per leader a turn); it shows on quieter turns.
- **Nate's calls:** (1) keep the start bonus, plus the seat rule; (2) **walls need payback:** a stacking defense bonus per connected wall territory, which session 25 tests capped against stop rules (the orchestrator's read: today's walls fall because they're thinly held, and an uncapped stack could make a big stocked wall untakeable); (3) sharper Opportunist and Schemer leaders later, with the top-tier bot; (4) **sound from free packs with commercial-use licenses first**.
- **Written:** session 24's prompt (sound), orchestrator-09.

### Things to test after session 23 (Nate's next play test)
*Laptop first; the phone where it applies.*
- **From session 23, most important first:**
  1. **Your Steward's handout:** give your Steward 20 to 50% on Run the realm and play a long game. When it hands gold back ("Nothing more worth building, so about 40 gold goes back to you as the turn ends"), did you agree there was nothing worth building? Did it ever hand back gold you wanted spent on a wall or a market?
  2. **Start at a weak spot** (new games on Wyrmland 6 until the first notice says "… starts with 6 extra troops (a harder spot)"): does the head start feel fair, too much, or (as the sims suggest) too little to matter?
  3. **Did the Marshals feel tougher, or the same?** (The sims say about the same: the Merchant's lesson changes little.) Do they still play like six different people?
  4. **A delegating game on Embervale 4 or Wyrmland 6:** still too easy? (The sims say your leaders beat the Marshals there, 1.25 to 1.36 times their fair share.)
  5. **Did you ever get the comeback card?** ("House Gules is back", with a dry line.) Lose most of your land, then win it back: did it play, once?
  6. **Your Leader's "Finishing them off" in the fog,** after turn 15: does it name only rivals that really are down to a handful?
  7. **The words:** "The math isn't mathing here." from a Merchant turning down a trade; a captured leader's "Since turn 31."; the new lobby line and the Blitzer's blurb.
- **Still open from session 22 (not tried yet):** read a whole turn's report (does it sound like you?); the six personalities' deal answers; your leaders saying too much or something untrue; capturing a leader; lines you'd never say (`docs/voice/lines-for-nate.md`, now with your picks marked); the replay on the laptop (panels slide away); title cards; game over.
- **Still open from session 21 and before:** the update notice on your phone; a whole replay on the phone on Full; the replay with Effects Off; "Watch again"; do the buildings pop; the title screen and game over art; a capital falling; the living map; the menus' seal, ember and turn sweep; Run the military at 50 to 80% for ten turns; the sweep into the fog; the Steward's walls when a Marshal masses; a 160-territory map; Embervale with 4; getting knocked out once; Conquest's 20 turns on a 200-territory map; a remembered wall in the fog.

### Oct 11: Claude Code session 24 (M3: sound)
*All four parts and Step 0 done, nothing slipped (no 24b). Sound list `docs/sound/sound-list.md`, credits `docs/sound/credits.md`, the BUILT block in `docs/09-polish-and-effects-plan.md` §9. Screenshots `docs/art/screens/s24-*.png`. Measurements `docs/sound/perf-s24*.json`.*
- **Step 0:** several culture levels or recruits at one place in one turn read as one line ("Your Steward, Odo, running the realm, raised culture at Larkgarth from 1 to 5 (28 gold).", recruits added up), in the report and the Chronicle; "Squalls at sea strike Hollydale"; "Odo handed 908 gold back from the purse" (and "the gold in the purse came home").
- **Part 1, the sources and the importer:** 41 cues, 56 files, all from **25 CC0 sources** (Kenney's audio packs, OpenGameArt CC0 packs, RandomMind's "Medieval" music for all five tracks), every one downloadable without an account, so **Nate didn't need to download anything**. `pnpm sound:import` (needs ffmpeg, which this computer has) mixes, trims, normalises (effects −16 LUFS at their loudest moment, music −18, ambience −24, peaks under −1 dBTP) and encodes MP3, named by cue; swapping a sound is one file plus its credit. Tests refuse any file without an allowed license. Settings → Credits lists every pack.
- **Part 2, the replay's sound:** every replay event has its cue (marches by army size, steel, shouts for big fights, arrows from walls, a Siege stone, a short fanfare for your capture and a low horn for a rival's, a shield for an attack beaten back, a heavy hit and a bell for a capital, a fading drum for a knock-out, a horn for a Leader, recruits, walls, buildings, culture, Fate, the Fallen, deals, spies). Fogged events: one distant rumble per beat, the same whatever they were (tested). Driven by the replay's clock and seeded (Watch again sounds the same; Skip stops it). Caps (6 phone, 12 laptop), no stacking, cooldowns. **Settings → Sound:** Master, Music, Sound effects, Mute, remembered on the device; separate from Effects. **The sound bench** (`?lab=sound`): every cue and file with play buttons, size, loudness, license, "Play a turn" (a recorded busy turn, 61 sounds), and "I'd change this" boxes with "Copy my notes".
- **Part 3, menus and music:** the seal's press, coins for an order that costs gold, soft ticks in the timer's last 10 seconds, the turn sweep, notices, a Spoils card, a very soft page when a panel opens (all with cooldowns). Music: title in the lobby after the first tap, the planning loop and the replay loop crossfading (about 1 s) and each carrying on where it was (checked: planning went 9.7 s → 12.3 s across a replay, never from the start), the victory or defeat sting at game over, dipping under the big moments.
- **Part 4, the ambience:** wind under the map while you plan, the sea when the camera shows coast, birds for 25 s of every 70; closer in is a little louder; under Music's volume; fades out for the replay.
- **Sizes:** effects 602 KB, music 2.36 MB, ambience 603 KB; a first game uses **3.1 MB** of distinct files (in the measurement the browser fetched 3.9 to 4.0 MB, because an audio element streaming a long file asks for parts of it more than once; the browser's cache keeps them after). The lobby loads nothing until the first tap. **Start-up bundle** 489.8 → **491.2 KB** (gzip 150.9).
- **Frame rate** (phone profile, the same pinned game muted and with sound, fog lifted, three turns): Wyrmland 6 muted 63.8, 81.8 and 72.9 fps, with sound 73.7, 83.4 and 88.0; Krakenmere 10 muted 74.9, 66.2 and 61.5, with sound 57.4, 64.5 and 57.7 (three passes; the last with the music and ambience in). Two muted runs of the same game differ by up to 28% on this laptop, so sound's cost is inside the noise; Krakenmere averages about 10% lower with sound, so watch it on your phone. A profile of a replay with sound on shows nothing from the sound library. Never more than 6 sounds at once on the phone profile.
- **Tests and deploys:** 1,068 tests pass; typecheck and the web build pass. Deployed `e28f2a2d` (Part 2), `39843e94` (Part 3), `13ef2662` (Part 4) and **`33787070`** (final); the lock check passed each time. The full suite ran twice before the last push. Nate: please check the repo's Actions page for the last commit.

### Oct 11: Orchestrator review of session 24
- **The code:** six commits, all green (the write-up and the final PROGRESS commit were pushed together, so CI ran once, on the tip). Nothing slipped: no 24b.
- **Every license checked at its source:** all 25 pages say CC0 (Kenney's four, the 21 on OpenGameArt). None owes credit; several say credit is "appreciated", and Settings → Credits does that. One nit for 25's Step 0: the wind recording's page asks to be credited as "Bashar from Skirmish.io", not "Bashar3A". The test refuses any file without an allowed license (CC0, public domain, CC BY); the license texts are in `docs/sound/licenses/`.
- **Nothing in the game changed:** the same seeded sim (60 games, Embervale 4, a Blitzer against Captains) at the commit before the session and at the tip is identical, as it must be for a session that changed only words and sound.
- **Sizes re-counted:** effects 602 KB, music 2.3 MB, ambience 603 KB (3.6 MB on disk, 3.1 MB for a first game). The bundle's +1.4 KB is inside the allowance.
- **The screenshots:** Settings → Sound and Credits read well on the laptop and the phone; the bench lists the busy turn's 61 sounds in order. **Seen in them:** Settings on the phone is now a long scroll (Leaders' orders, six buttons, Layout, Effects, Sound and three sliders, Credits, Leave): worth folding the sliders under the Sound row later. In the busy turn the capture fanfare plays three times in six seconds (10.0, 12.9, 15.5 s): a bar of music that often may grate; Nate's ear on the bench decides.
- **Not checked here:** the sounds themselves (no ears in this review either) and the phone's frame rate with sound; both are Nate's.
- **Nate's call:** write session 25 now (`docs/prompts/claude-code-session-25.md`, with orchestrator defaults for the wall bonus and the seat rule) and play the whole test list alongside it. His notes outrank the defaults: the session reads "Nate's play test after session 24" in this file if it's there.

### Things to test after session 24 (Nate's next play test, the last of M3)
*Laptop first; the phone where it applies. Sound on (it's on by default).*
- **From session 24, most important first:**
  1. **Open the sound bench on the laptop** (`?lab=sound` on the preview) and press "Play a turn", then play each cue. Tick "I'd change this" on any you'd change, with a word on why, and press "Copy my notes" to paste them to the orchestrator. (The weak ones I already know: the spy has no whisper, the capture "fanfare" is a bar of music, not a brass call, the march is drums only, the Fallen's choir is makeshift.)
  2. **Play a whole game on the phone with sound.** Too loud, too busy, ever annoying? Does sound start after your first tap in the lobby? Does it stop when you switch apps?
  3. **Does a capital falling sound big enough?** (The big hit, the bell, the music dipping under it.)
  4. **Does the music get repetitive?** (Planning is an 81 s loop, the replay 79 s, the title 42 s.) Does it carry on through the turns rather than start over?
  5. **The replay on the phone:** still smooth with sound on? (On this laptop's phone profile, sound's cost was inside the noise; your phone is the real check.)
  6. **Settings → Sound:** the three sliders and Mute; Effects Off keeps the sound, Mute keeps the effects. Settings → Credits.
  7. **The ambience:** zoom in near a coast. Can you hear the sea? Is the wind too much? Do the birds ever get annoying?
  8. **The small sounds:** the seal when you lock in, coins when you recruit or build, the ticks in the last 10 seconds (try a 1-minute timer), the turn sweep. Any you'd rather not hear?
  9. **The report:** a Steward raising culture several levels at one place now reads as one line ("from 1 to 5 (28 gold)").
- **Still open from session 23 (not tried yet, and the ones session 25 waits on):** your Steward's handout; starting at a weak spot; the Marshals tougher or the same; a delegating game on Embervale 4 or Wyrmland 6; the comeback card; your Leader's "Finishing them off" in the fog; the new words.
- **Still open from session 22 and before:** read a whole turn's report; the six personalities' deal answers; your leaders saying too much; capturing a leader; lines you'd never say (`docs/voice/lines-for-nate.md`); the update notice on your phone; a whole replay on the phone on Full; Effects Off; "Watch again"; the buildings; the title and game over art; a capital falling; the living map; the menus' seal, ember and sweep; Run the military at 50 to 80%; the sweep into the fog; the Steward's walls; a 160-territory map; Embervale with 4; getting knocked out once; Conquest's 20 turns on a 200-territory map; a remembered wall in the fog.

### Oct 11: Claude Code session 25 (M3: bots and balance, part two: walls that pay back, and the seat rule)
*Step 0 and all four parts done, nothing slipped (no 25b). Nate's play test after session 24 wasn't in this file at the start or at any pull, so the orchestrator's defaults were used. Write-ups: `docs/sim-results-m3-walls.md` ("Walls that pay back (session 25)"), `docs/sim-results-m3-balance.md` ("The seat rule (session 25)"), `docs/sim-results-m3-leaders.md` ("Session 25"). Raw runs `docs/sims/s25-*.txt`. Screenshots `docs/art/screens/s25-*.png`.*
- **Step 0:** the wind is credited as "Bashar from Skirmish.io" (Settings → Credits, `docs/sound/credits.md`). On the phone, Settings' three volume sliders fold under the Sound row (tap "Sound ▸ volumes" to open them; Mute stays on the row, still two taps from the map), so Settings fits on one screen again. The desktop shows them all, as before.
- **Part 1, the wall's bonus as a rule:** a walled territory defends at × (1 + min(cap, rate × (wall size − 1))), the wall size being every walled territory joined to it. On top of the fort and culture 5, against every attack. Siege cuts the fort's bonus only. Missing numbers (an older game's rules) mean no bonus. The engine, the odds preview and every bot count it the same way ("guaranteed" still always wins). The card, the side panel and the attack panel say it: "Walled: 11 defend (with Yewstead and Wildstead), +20% for 3 walled". With it off the sims played identical games to before.
- **Part 2, the sweep and the pick (seed s25, 300 games a table):** all four settings (A +5% to +20%, **B +10% to +40%**, C +10% uncapped, D +15% to +60%) pass every stop rule on Embervale 4, Wyrmland 6 and Rootholm 8: games no longer, no personality near 2×, the Turtle up at most 0.10, the halfway leader and the delegating seat within the noise. **Shipped B** (the orchestrator's pick). **But no setting shows a payback in bot play:** pooled over three seeds (900 games a table), a seat whose Steward walls wins no more than one that never walls, and walls hold about as often (Wyrmland 3.9% → 3.3%, Rootholm 1.5% → 1.8%) and are attacked slightly less. The reason: every bot counts the bonus and brings more, and bot walls are thinly held. The bonus pays on a wall with troops behind it: a wall of 5 with 10 troops in each takes about **81** attackers to break instead of 58 (exact, `s25-stocked.txt`). **C (uncapped) passed too:** the cap only matters for big stocked walls (12 walled with 10 in each: 191 attackers with B, 286 uncapped). A reserve inside the Marshal's own walls was tried and left off (nothing gained). Deployed `8a3a352f`.
- **The fingerprints:** with B on, the Captain's fingerprint is unchanged (`232617a30b1f8b47`), and so are the saved-game tests and the mop-up fixtures. Nothing was re-pinned in any commit.
- **Part 3, the seat rule:** a person dealt a harder spot (one with a start bonus) swaps with the first bot on an ordinary one. A table of bots only is dealt exactly as before. The lobby has a new row, **Harder spots: Bots first (default) / Anyone**, and a save remembers the choice. **What it does (the delegating seat against Marshals, times fair, random spots → bots first, seeds s23p2b / s25):** Embervale 4 1.23 → 1.33 / 1.20 → 1.25, **Wyrmland 6 1.52 → 2.08 / 1.28 → 1.74**, Rootholm 8 0.85 → 0.99 / 1.04 → 1.09. Moon Coast 6, Crownlands 8 and Ashwing 7 have no harder spots at those sizes, so nothing changes there. Deployed **`4c335f76`** (final; the lock check passed both times).
- **Part 4:** the Steward's plan for the Marshal (session 23's closest variant, walls round the capital) re-tested with the bonus: still makes the Marshals much weaker (the delegating seat 1.28 → 1.68 on Wyrmland 6, 1.04 → 1.49 on Rootholm 8), games longer, every personality a waller. Left off.
- **Planning time, side by side on this laptop** (Krakenmere 10; the laptop ran about 3× slower today than in session 23, so only the side-by-side counts): all bots 33.8 ms before the session, 32.3 ms after (once the bots look up each target's wall once a plan); one Marshal 3.9 → 3.7 ms. **Start-up bundle** 491.2 → **492.6 KB** (gzip 150.9 → 151.3).
- **Tests:** 1,087 pass (seven new for the wall's bonus, seven for the seat rule, five on the page and in the host); typecheck and the web build pass; the full suite ran twice before the last push. Nate: please check the repo's Actions page for the last commit.
- **Questions for Nate:** (1) The cap: B (+10% a walled territory, at most +40%) is shipped. The uncapped version passed every test too, because bots never build walls big enough for the cap to matter. Keep the cap, or let a big wall keep stacking? (2) Walls still don't pay *for bots* (they bring enough or don't attack). Is that fine, as a wall's payback is for a person who stocks it, or do you want a second lever (for example the bots keeping more troops inside their walls, or attackers needing more than "likely" before hitting a wall)? (3) With harder spots going to bots, a delegating game on Wyrmland 6 is now clearly easy against Marshals (1.7 to 2.1 times fair). Fine as a single-player perk, or should the Marshals get a little tougher on tables with harder spots?

### Oct 12: Orchestrator review of session 25
- **The code:** eight commits, all green (the wall-reserve option commit was pushed with Part 2, so CI ran on the tip). Nothing slipped: no 25b. Nate's play-test notes weren't in yet, so the orchestrator's defaults stand everywhere.
- **The sweep read from the raw runs** (`docs/sims/s25-sweep-*.txt`): the bonus changes almost nothing in bot play because the bots count it and don't attack a wall that would hold: at the all-Marshal tables walls are attacked 0.1 times a game and hold 0 of 32 to 45 attacks, with or without the bonus; game length 23.0 / 41.1 / 45.4 turns, within 0.1 of before; the Turtle 1.72 → 1.80 on Wyrmland. So "every setting passed" means the sims can't tell the settings apart, not that the bonus is small: a stocked wall of 5 takes 40% more attackers to break (the session's own arithmetic: 81 instead of 58). The cap is a person's question, not a sim's.
- **The payback measure is noisier than it looks:** the walling seat's edge over the non-walling one swings from −5 to +8 points between seeds **with the bonus off** (`s25-payback-before-*.txt`), so "no payback in bot play" is the honest reading of 900 games, and a payback of a few points would be invisible to it anyway. The one thing the bonus does measurably in bot play is deter: walls are attacked 3 to 6% less.
- **The seat rule re-run with the orchestrator's own seed, Wyrmland 6, the delegating seat against Marshals:** random spots **1.70× fair**, bots first **2.22×** (the session: 1.28 → 1.74 and 1.52 → 2.08 on its two seeds). The +0.5 is real and consistent; the random-spot figure itself ranges 1.28 to 1.70 across seeds, so that one seat on that map carries about ±0.2 of seed noise, more than the ±0.15 assumed so far. **Part of the rise is arithmetic:** Wyrmland 6 has two harder spots that win about 3% each, so a seat that never sits on one has a "position-fair" share of about 23% (1.4× the nominal 16.7%); measured against that, the delegating seat is about 1.25 to 1.6× fair, where it was before the rule. The rest is that your leaders match the best Marshal (the Turtle, 1.80) and beat the weak personalities (the Blitzer 0.34, the Opportunist 0.54), which is the old finding from session 23.
- **The screenshots:** "Walled: 11 defend (with Yewstead and Wildstead), +20% for 3 walled" on the card; the attack panel's one-line explanation and "21, Just enough: Odds: LIKELY" against it (the odds math checked: the defence kill rate of 0.6 is why 21 beat 11 behind a wall; that's the 70/30 design, and whether it feels like enough is Nate's); the lobby's "Harder spots: Bots first / Anyone" with its one-line note. Phone versions read as well.
- **Not checked here:** how a wall feels to hold, and whether a delegating game on Wyrmland 6 is now too easy; both are the play test.
- **Nate's calls (Oct 12):** the cap comes off (26's Step 0); bot walls stay; Wyrmland judged by play; the M4 plan written first (`docs/10-online-plan.md`), then session 26.

### Oct 13: Nate's play test after sessions 24 and 25 (his notes, recorded by the orchestrator)
- **Harder spots:** no lobby row; just deal them to bots before people, always.
- **The lobby needs a redesign:** declutter, put things under dropdowns where possible (multiplayer will add more), and the text is larger than it needs to be.
- **Sound is too much:** the background music should be about **20% of what it is now**; turning the Music slider down made it **fade in and out instead** of getting quieter; the replay's sounds **overlap and cut into the enjoyment**: they need to be **much simpler and shorter**; the sound for **losing a territory sounds like an error** and is terrible.
- **A glitch:** choose Recruit in a territory, click other territories, come back to the first and press Done: it can take several presses of Done before it goes through.
- **Your Leader:** clicking on your Leader should show where they are on the map.
- **Not in these notes (still untested):** holding a wall, a game from a weak spot, the Marshals' feel, the comeback card, the sound bench's cue-by-cue review.

### Things to test after session 25 (Nate's next play test, the last of M3)
*Laptop first; the phone where it applies. The preview is `4c335f76`.*
- **From session 25, most important first:**
  1. **Build a wall of 3 and hold it against a Marshal** (Wyrmland 6, your Steward on Run the realm, or build it yourself: culture 5 and a fort on three touching territories, about 120 gold). Keep some troops inside. Did it feel worth the gold? Did the Marshals leave it alone, or come with a big army?
  2. **Read the "Walled … +20% for 3 walled" line** on a walled territory's card (yours and a rival's), and **the odds at a walled target** (draft an attack on a rival's wall). Is it clear what the wall adds? Do the odds feel right when the attack goes in?
  3. **"Completes a wall … (+10% for each walled territory it joins)"** on the culture and fort buttons: does it make you want to finish the wall?
  4. **Start new games on Wyrmland 6** (five or six of them): you shouldn't get the "… starts with 6 extra troops (a harder spot)" notice now. Then set **Harder spots: Anyone** in the lobby and start a few more: you should get it sometimes.
  5. **A delegating game on Wyrmland 6** (Run the military 80%, Run the realm 20%) with harder spots going to bots: too easy now? (The sims say you win about twice your fair share.)
  6. **Settings on the phone:** "Sound ▸ volumes" opens the sliders, Mute is one tap. Does Settings fit on your screen without scrolling?
- **Still open from session 24 (not tried yet):** the sound bench (`?lab=sound`: "Play a turn", then "I'd change this" and "Copy my notes"); a whole game on the phone with sound; a capital falling; the music over several turns; the replay on the phone with sound on; Settings → Sound and Credits; the ambience near a coast; the small menu sounds; the report's one-line culture raises.
- **Still open from session 23:** your Steward's handout; the Marshals tougher or the same; the comeback card; your Leader's "Finishing them off" in the fog; the new words.
- **Still open from session 22 and before:** read a whole turn's report; the six personalities' deal answers; your leaders saying too much; capturing a leader; lines you'd never say (`docs/voice/lines-for-nate.md`); the update notice on your phone; a whole replay on the phone on Full; Effects Off; "Watch again"; the buildings; the title and game over art; the living map; the menus' seal, ember and sweep; Run the military at 50 to 80%; the sweep into the fog; the Steward's walls; a 160-territory map; Embervale with 4; getting knocked out once; Conquest's 20 turns on a 200-territory map; a remembered wall in the fog.

### Oct 13: Claude Code session 25b (Nate's play-test fixes: sound, the lobby, two controls)
*Step 0 and both parts done, nothing slipped to 26. Screenshots `docs/art/screens/s25b-lobby-*.png`. Sound write-up: the BUILT block in `docs/09-polish-and-effects-plan.md` §9 and `docs/sound/sound-list.md`.*
- **Step 0:** "Harder spots" is gone from the lobby: new games always deal harder spots to bots first (the setup still records it, so saves replay as played). **The Recruit glitch:** with the Recruit panel open, tapping any other territory used to do something: a glowing site silently moved your recruit there, your own land started a move, and the panel closed or came back, so pressing Done after looking around didn't do what you meant. Now a glowing site still moves the recruit, an enemy next to it still starts the attack (Recruit then attack is still one tap), and **anything else only looks**: the panel stays, nothing moves. Done (bigger now), Enter or Esc close it. A test runs your sequence; it failed before the fix. (I couldn't make Done itself need several presses in the browser; this is the confusion around it.) **Tap your Leader** (in the Leaders panel, its portrait on the territory card, or the phone's portrait): the map glides there and a gold ring pulses once; your Steward and captured leaders the same.
- **Part 1, sound:** the music is at **about a fifth** (22% of before at the default: files 8 dB quieter, Music slider 25% instead of 45%; the ambience followed it down). Your saved Music level restarts at 25% once. **Sliders set the level at once** and cancel any dip under a big moment (what you heard as fading was most likely the music dipping under the replay's big moments and the switch between planning and replay music). **The replay:** never more than 2 sounds at once, one of each kind per moment, marches only for 20 or more, one short clash (under 0.6 s), your capture a short drum tap, **a rival taking your land one low drum hit (no horn)**; the crowd shouts and the small marches are gone. The bench's busy turn: **61 → 27 sounds, at most 9 → 2 at once, 22.9 → 16.3 s of sound** (the long ones you kept, a Leader falling, a capital, the fog, are most of what's left). The bench shows these numbers and lets you try other rules ("At most at once", "Marches from"). Deployed `7c341802`.
- **Part 2, the lobby:** in view: the title and version, Continue and Load, **the Map** (a small picture of its land and sea and its name; tap it to pick another), **Opponents** (two dropdowns: how many, how hard), and **Start**. **Your House** and **Rules** start folded, each with its choices in one line ("normal luck, fog on, Fate on, diplomacy on, classic, 5 min"), and remember whether you opened them. Text one size smaller. Start sits under them and stays at the bottom of the screen when they're open. On the phone the folded lobby fits on one screen, opened about two. A default game is **one tap** (Start); a custom one a few (map 2, bots 2, a rule 3). The Online block's place is marked for 26. **Start-up bundle 492.6 KB** (unchanged: the map pictures and the folded blocks' insides load after the lobby). Deployed **`328f8cdf`** (final; the lock check passed every time).
- **Tests:** 1,103 pass (new: the Recruit sequence, Esc closes Recruit, the Leader pan request, the slider, the default level, the simpler replay, the short cues, the lobby's summaries, the map pictures); typecheck and the web build pass; the full suite ran before every push. Nate: please check the repo's Actions page for the last commit.

### Things to test after session 25b (Nate's next play test)
*Laptop first; the phone where it applies. The preview is `328f8cdf`. Sound on.*
- **From session 25b, most important first:**
  1. **Play a replay with sound:** simpler now? Can you follow it? Anything still overlapping or too long?
  2. **The music at the default** (Music 25%): about right, or still too much / now too quiet?
  3. **Move the Music slider** during planning and during a replay: does it just get quieter and louder now?
  4. **A rival takes your land:** the new low drum hit. And your own capture: the short bright tap.
  5. **The lobby on the phone:** folded and opened. Does it read well? Anything you miss from the old one, or want in view?
  6. **Recruit, then tap other territories, then Done:** one press, and the recruit where you left it?
  7. **Tap your Leader** (the Leaders panel, the portrait on its territory's card, the phone's portrait): does the map show you where it is?
  8. **The sound bench** (`?lab=sound`): "Play a turn", and try "At most at once" or "Marches from" if you'd like it busier or quieter ("Copy my notes" includes them).
- **Still open from session 25:** build and hold a wall of 3 against a Marshal; a game from a weak spot (now only by luck: harder spots go to bots); the Marshals' feel; a delegating game on Wyrmland 6; Settings on the phone.
- **Still open from 24 and before:** the comeback card; the sound bench cue by cue; a capital falling with sound; a whole game on the phone with sound; your Steward's handout; your Leader's "Finishing them off"; the update notice on your phone; Effects Off; "Watch again"; Conquest's 20 turns on a 200-territory map.

### Oct 13 and 14: Claude Code session 26 (M4: online with friends, part one: the server)
*All four parts done (Part 4, the long-turn clock, too), nothing slipped to 26b. Screenshots `docs/art/screens/s26-*.png`. Write-up: the BUILT block in `docs/10-online-plan.md` §9, `docs/infra-cloudflare.md` (M4), `docs/rules-reference.md` §25.*
- **Step 0:** the wall bonus has no cap now (Nate, Oct 12): +10% for each other walled territory, so a wall of 8 defends +70%. The card and hints already worked it out from the rules; the docs say it; a 10-game Marshal sim played the same games capped and uncapped (no Marshal wall of 5 or more was attacked). Nothing from 25b slipped here.
- **The server (Part 1):** the Worker `conquerra` now runs code for `/api` (static files are served as before). Each online game is a **game room** (a Durable Object) running the **same engine and bots** as single player, saved every turn, with its turn clock on an alarm, so turns resolve on time with nobody connected. Sign-in is Access: every API call and WebSocket is checked against Access's signed token (our app, our team, not expired). A small database (`conquerra_db`) keeps accounts, games and seats. The page's **online host** speaks the same messages as the single-player one over a WebSocket, reconnects by itself, and asks "where are we" (back in planning with your queue, or in the replay you missed).
- **The lobby and the first online game (Part 2):** a third fold, **Online**, under Start: "New online game" (the map, bots, House and rules above, with an online timer: 3, 5, 10 min or 1, 8, 24 h, and "If I miss a turn with no orders, my leaders run my House", on) and "Your online games" (map, turn, who it's waiting on, time left, Continue). Its line says how many games wait on you. Online there's no pause and no save menus; "Leave this game" says the game goes on. **The fog on the wire:** a test plays two people and two Marshals for a dozen turns and checks every message to each seat is exactly that seat's view and replay and nothing of anyone else's (a deliberate leak fails it). That test found one thing: a rival's **order ids** rode along on the replay events you can see (a bot's named what the order was for), so the engine now blanks them.
- **Nate's step and the first real game (Oct 14):** Claude Code read the Access app's AUD tag from the dashboard in Nate's Chrome (nothing changed there) and switched online on. Nate played two turns in Chrome and left; the room played turns 3 to 13 with his leaders running his House, and **Queen Isolde won on turn 14**: the result and the revealed seed are in the database. **CPU per turn in the real room: 31 to 89 ms** (Free plan: 30 s). No limit errors.
- **Polish (Part 3):** the players panel marks who is a person; "Reconnected" shows quietly and goes; Settings shows the seed's fingerprint online and the game-over screen the seed (provably fair); a finished online game opens on its result. **Workers Builds:** Nate's copy-paste steps are in `docs/infra-cloudflare.md` (the GitHub authorization is his). `pnpm deploy:preview` stays the fallback, and it applies database changes (Workers Builds' token can't).
- **Long turns (Part 4):** a test with a fake clock leaves a 24-hour game two days with nobody connected: each day's turn resolves on time and you come back to the replay you missed. On the server, Nate's game ran 11 turns with nobody connected.
- **Numbers:** the start-up bundle 494.5 KB (+1.9 KB, inside the 2 KB allowance: the online code loads with the Online block). A turn's message to a page about 1.5 to 13 KB. Deploys: `e2fbea37` (online off), `a70d41d3` (online on), **`0347decf`** (final, by `pnpm deploy:preview`); the lock check passed every time, now including the API and a real WebSocket.
- **Tests:** 1,133 pass (new: the room, the Access token check, the API on a real SQLite database with the migration, the page's online host against a real room, the fog on the wire, long turns, rivals' order ids); typecheck (the server too) and the web build pass. Nate: please check the repo's Actions page for the last commit.

### Oct 14: Orchestrator review of sessions 25b and 26 (and the orchestrator's own online test)
- **The code:** 25b's five commits and 26's ten, all green (26's Step 0 cap commit was red on the voice test's semicolon, fixed in the next commit; nothing else). Nothing slipped from either: no 25c, no 26b.
- **25b, read from the commits and the screenshots:** the lobby reads well folded and open on both devices (Map, Opponents, Start in view; Your House with the colour row, Rules with its one-line summary); the Recruit glitch was three things (a glowing site silently moving the recruit, your own land starting a move, the panel closing or returning), now one rule. **Nate's second listen the same evening** (commit `f47ce6e`, made in a separate chat): one steady music loop from the lobby to game over (Medieval: Battle), no dip under big moments and no planning/replay switch, the Music slider on an even curve with 50% the default, a deep drum for your capture, the jolly tracks gone. Recorded as his calls.
- **26's fog-on-the-wire test, checked here:** it compares every message to a seat against `viewFor` and `replayFor` exactly, whitelists every field, and searches the raw text for rivals' order ids and the seed. **I planted a leak** (the seed and the last turn's orders in the start message) and it failed at once on the seed. It also found a real leak the engine's own fog tests hadn't: rivals' order ids on visible replay events (a bot's ids name the order's purpose); `replayFor` blanks them now.
- **The game itself unchanged across 25b and 26:** the same seeded all-Marshal Wyrmland 6 sim (60 games) before 25b's write-up and at 26's tip is identical; the cap's removal only shows where a wall of five or more is attacked, which never happened in those games. The Captain's fingerprint and the mop-up fixtures pass unchanged (CI).
- **The orchestrator played the first online game** (Oct 14, 11:20, Nate's Chrome, laptop): a game against three Marshals from the Online block; recruits and an attack; lock in; the turn resolved at once; **closed the tab mid-replay and the lobby said "1 game, 1 waiting on you"; Continue landed in turn 2's planning with the captured land in place; locked turn 2 and closed within two seconds; reopening the link landed in the turn-2 replay I'd missed, then the report and turn 3 with the clock running.** The room then played turns 3 to 13 with my leaders (the server logs: 31 to 89 ms a turn) and Queen Isolde won on turn 14. **Seen on the way:** the lobby's version label lags one commit (the build is made before the deploy's commit exists; `b38f06c` on the `a70d41d3` build); the header clock sits at a frozen "5:00" during a replay until the next window opens; the turn report says "you now have 23 gold" while the header shows 22, because the purse's gold comes off after the line is written (the same 30 against 29 in the session's own screenshot), and "upkeep –0" could go when it's zero. All three are small; session 27's Step 0.
- **The session's test games sit in Nate's "Your online games"** (three or four Embervale games on his account, since the session played as him). They end on their own (the leaders play them out), but 27 needs a way to leave a game and a list that hides finished ones.
- **The Free plan held:** no 1102 or 1027 in the logs; the room's 31 to 89 ms a turn against a 30 s limit.
- **Not checked here:** the phone on the real server (Nate), Workers Builds (Nate's step), the long-turn game overnight (a fake-clock test covers it; Nate's real one is on the list).
- **Nate's two questions, the orchestrator's answers (his to overrule):** (1) after a missed turn, **the budgets go back to the player's own** when they return (the 80/20 was the leaders' standing in for a turn, not a choice the player made); session 27. (2) The name from the email is fine until 27's Settings field.

### Things to test after session 26 (Nate's next play test)
*The preview is `0347decf`. Laptop and phone. If the preview says "Update ready", tap it first.*
- **From session 26, most important first:**
  1. **An online game on your phone:** lobby → **Online** → Start an online game (or Continue the one from the laptop). Play a few turns. Does it feel like single player? Is the clock right?
  2. **Close the tab in the middle of a replay**, then open the preview again and Continue: are you back in the replay, or in planning with your orders as you left them?
  3. **Laptop and phone on the same game:** open it on the laptop, then on the phone. The laptop should say the game is open somewhere else.
  4. **The lobby's Online block** on the phone and laptop: does it read well? Is "Your online games" what you need to see (who it's waiting on, time left)?
  5. **The missed-turn choice:** leave a game for a turn or two. When you come back, does the report say "Your leaders ran your House this turn"? Did they do something sensible? (Their Run the military 80% / Run the realm 20% stays set until you change it: is that what you'd want?) Try one game with the box unticked: your House should hold still.
  6. **A 1-hour game left overnight:** start one with the 1 h timer, leave it, and open it the next day. You should land in the last turn's replay, with the game moved on one turn an hour.
  7. **The fair-play line:** Settings shows the seed's fingerprint during an online game; the game-over screen shows the seed.
  8. **Workers Builds** (your steps in `docs/infra-cloudflare.md`, "Nate's steps", step 2), then the version line at the top of the lobby should show the last commit after the next push.
- **Still open from session 25b:** a replay with sound (simpler now?); the music at the default; the Music slider in planning and replay; a rival taking your land (the low drum hit); the lobby on the phone; Recruit, tap around, Done; tap your Leader; the sound bench.
- **Still open from session 25 and before:** build and hold a wall of 3 against a Marshal (now uncapped: a bigger wall is stronger still); a game from a weak spot; the Marshals' feel; a delegating game on Wyrmland 6; the comeback card; a capital falling with sound; your Steward's handout; Effects Off; "Watch again"; Conquest's 20 turns on a 200-territory map.

### Oct 14: Claude Code session 27 (M4: friends at the table)
*All four parts done, nothing slipped to 27b. Screenshots `docs/art/screens/s27-*.jpg`/`.png`. Write-up: the BUILT block for 27 in `docs/10-online-plan.md` §9, `docs/rules-reference.md` §25, `docs/infra-cloudflare.md` (Nate's step 3: a friend on the guest list).*
- **Step 0:** the lobby's version label is now always the live build (`pnpm deploy:preview` refuses uncommitted changes; checked live: the label read each deploy's own commit). **No frozen "5:00" during a replay**: the header says "Replay", then "in 0:08" until the window opens, online and single player (checked live). **The gold line matches the header**: "Income +12, upkeep −3: you now have 22 gold, after 1 to your Steward's purse." (no upkeep part when it's zero). **After a missed turn your own budgets come back**: the 80/20 stands in for the missed turns only; your own commands and budgets wait in your queue as changes of yours and apply when you play a turn (a test). No phone notes from Nate after 26 to fix.
- **Part 1, a game link:** "Make a game link" makes a **table** with a link (`?join=` and a 10-character code). The **table screen**: the link (Copy, Share on phones), the seats, your colour, Start, Cancel. A friend opens the link, types a name, picks a free colour and sits; everyone at the table sees it at once; a friend can get up again, the host can take a seat away (before the start only). **Start** (once a friend sits, or "Start now with bots" alone): empty seats become bots, harder spots go to bots, and everyone seated goes straight into turn 1. Late friends are told the game has started. **Your name** in the Online block, in Settings online and on the table screen. The lobby lists tables waiting ("Waiting for players, 2 of 4 seated"), games in play, and **Finished** (folded, kept a week). Tried locally with two accounts (desktop and phone) and live on the preview. Deployed `c8271a99` (with the database change).
- **Part 2, several people:** a turn waits for everyone **still playing**; a page that comes back counts down to the room's own deadline. **Three missed turns in a row**, or **Resign** (Settings, or "Leave this game" in the list), and a Marshal (your leaders' Neutral style) takes the seat for good: the table is told ("Kit's seat is a Marshal's now."), the players panel shows "(bot)" in the seat's colour, the purses come home, and the person can still open the game and watch (checked live: I resigned a test game in your Chrome and watched it play out). With nobody left playing, the bots finish the game by themselves. **"Where are we" trimmed**: the page keeps its Chronicle and asks only for the turns it lacks (Rootholm, two people, turn 32: 74 KB to 24 KB). Deployed `15459b7c`.
- **Part 3:** who has locked in shows in the players panel ("✓ locked in": who, never what); "Reconnected" never covers a real problem notice or stacks. **Workers Builds isn't connected** (no push made a deployment), so your step 2 stands. Deployed `e8f0e494`.
- **Part 4:** a finished online game's result screen has **Watch a turn again** (any turn, from your seat, exactly as you saw it; tried live). `scripts/table-harness.mjs` plays a table of two people and bots against `wrangler dev` headlessly (the sign-in stand-in exists only there). Deployed `a0799d3b`.
- **Found on the preview and fixed:** a room didn't save its game when it ended, so after a deploy a finished game woke on its last turn with no clock. Now the end is saved and a waking room sets its alarm again; the stuck test game finished itself when opened (the same winner). Deployed **`da144f80`** (final, commit `2c80f4d`).
- **Numbers:** CPU on Cloudflare: starting a table's game 39 ms, a turn 35 ms, a resignation 11 ms, the Worker's handlers 1 to 4 ms (Free plan: 30 s in the room, 10 ms in the Worker); no limit errors. In-process with two people: Rootholm avg 23 ms a turn (worst 31). The start-up bundle **495.8 KB** (+1.3 KB, inside the new 2 KB allowance: the table screen and online code load only when used). The lock check passed on every deploy, now with the game link too.
- **Tests:** 1,159 pass (new: the table's life, colours, the host's powers, the late join, cancel, a sleeping table, the API with the database copy on real SQLite, the invite code, the fog on the wire with three people, the clock waiting for a third person who never connects, takeover after three misses, the reset on return, resign, watching, nobody left playing, the trimmed hello, the page's Chronicle, the lock-in ticks, a finished game's turns, a room that wakes, the gold line, the window's clock, budgets after a missed turn); typecheck and the web build pass; the full suite ran before every push. Nate: please check the repo's Actions page for the last commit.

### Oct 14: Orchestrator review of session 27 (and the orchestrator's own table on the live server)
*Checked: all nine commits green on GitHub; the fog-on-the-wire test fails at once on a planted leak (the seed on the hello) and passes clean with three people; nothing under `packages/` or `apps/sim` changed, so the seeded sims are identical by construction; a table made, started with bots, played, resigned and watched in Nate's Chrome on the preview; the screenshots; the write-up.*
- **The live test (Oct 14, 8 pm, Nate's Chrome):** the lobby's label read `2c80f4d`, the live build (the last commit was docs only). Make a game link, the table screen (link, four seats, the colour row, Start waiting for a friend, Start now with bots), a colour change, the game at once in turn 1 with the clock at 4:53, a recruit and lock in, "Replay" in the header and then "Turn 2, in 0:10" counting down to the window, Settings with Your name, the fair-play line, Leave and Resign, a resignation that resolved the turn at once, the watching view with its banner and the Marshal taking three territories on its first turn, the lobby's Finished fold, a finished game's result screen with the seed, and **Watch a turn again** playing turn 15 from my seat. All as the session described.
- **A real bug, found before any of that: the page came up blank** (the table screen and the map renderer "failed to fetch"). The cause is in the serving, not the session's code: `_headers` gives `/assets/*` a one-year immutable cache, and `not_found_handling: "single-page-application"` answers a missing asset with the lobby's HTML under that same path, with that same header. One miss during a deploy (two chunk files asked for before the new build had them, or from the old build after it was gone) was cached as HTML by Cloudflare's edge, by the browser for a year, and by the service worker's precache. No reload fixes it, and a fresh service worker re-fills its cache from the poisoned browser cache. I cleared Nate's Chrome by hand (the service worker, its cache, the two entries) and it loaded. **Session 28's Step 0:** the Worker answers 404 with `no-store` for any `/assets/` path it doesn't have (never the HTML fallback), a failed chunk load reloads the page once (`vite:preloadError`), and the test list tells Nate what to do if a page is ever blank. Until then, a blank page on the phone or laptop means: in Chrome, Settings, Privacy, Clear browsing data, cached images and files (the sign-in survives).
- **The gold line is only half fixed:** the turn report card still says "Income +10: you now have 10 gold" with "Into purses: 1 gold to your Steward" on its own line, while the header says 9. The fold-in (`narrate.ts`, `incomeLine` with the purses) runs on the replay log's path only; the report card still calls `incomeLine(e, null, n)`. One path for both, and a test on the report card with a Steward at 10%. Step 0.
- **Nits for Step 0:** the Settings popover's "Leave this game" button wraps to three lines and collides with its note ("it goes on on the server" also reads badly); the Finished row of a game that has since ended still says "You left this game on turn 17. It goes on without you" (the game-over screen shows Lady Morwen won: the row should say "Over: Lady Morwen won" and the turn you left); the row's turn is the current turn, not the turn you left on; the Houses panel truncates names ("Baron K…", "Queen I…") once the OUT badges and the Oathbreaker tag crowd it; the single-player Start button reads "Starting…" while a table is being made; the table screen's guest-list note shows a file path (`docs/infra-cloudflare.md`) to players.
- **Seen and fine:** the room's `info()` (the D1 mirror and the "make a game" reply) carries the seed only at game over, and the list query never selects it, so the fog test's wire-only scope is enough for now; session 26's three test games are no longer in the lists (the new seats table has no rows for them), which is fine.
- **Numbers held:** the bundle 495.8 KB against the 496.5 KB allowance (28's allowance: within 2 KB of 495.8); CPU per turn 35 ms on Cloudflare; no limit errors.
- **Nate's step before his friend game:** the friend's Google email in the Access policy "Conquerra players" (`docs/infra-cloudflare.md`, "Nate's steps", step 3), then Make a game link and send it.
- **The session's question (three missed turns before takeover):** stays the orchestrator default until Nate's friends' games say otherwise; on the test list.

### Things to test after session 27 (Nate's next play test)
*The preview is `2c80f4d` (deploy `da144f80`). If the preview says "Update ready", tap it first. Laptop and phone. **If the page is ever blank** (dark, nothing on it): a cached file went wrong after a deploy (fixed in session 28). On the laptop: Chrome, Settings, Privacy and security, Clear browsing data, "Cached images and files" only, then reload. On the phone: Chrome, the three dots, History, Clear browsing data, the same box. Your sign-in survives.*
- **From session 27, most important first:**
  1. **A table with a friend:** add their email to the guest list (`docs/infra-cloudflare.md`, "Nate's steps", step 3), then lobby → **Online** → **Make a game link**, send it (Share on the phone), and wait for them to sit. Does the table screen make sense to them on their phone? Press **Start** and play a few turns together. Is the clock right for both? Do you see each other's "✓ locked in"?
  2. **Two friends on phones**, if you can: three people at one table.
  3. **Colours:** your friend picks first, then you try their colour (it should say it's taken). Next table, does it offer you your last colour?
  4. **Leaving for three turns:** one of you closes the tab for three turns on purpose (a 3-minute timer helps). After the third, the other should see "...'s seat is a Marshal's now." and "(bot)" in the players panel. The one who left: open the game, you should be watching. Then try coming back after only two turns instead: nothing happens, you're still playing.
  5. **Resigning:** Settings → Resign in one game, and "Leave this game" in the lobby's list in another. Both go to Finished in your list.
  6. **The lists:** a table waiting ("2 of 4 seated"), games in play (who it's waiting on, time left), Finished. Anything you'd want to see there that isn't?
  7. **After a missed turn:** miss one with "my leaders run my House" on, come back: your leaders' own commands and budgets should be waiting in your queue (the Leaders panel shows them as your changes).
  8. **The replay's header:** "Replay" during it, then "in 0:08" until the countdown starts. And the turn report's gold line matches the gold at the top.
  9. **A finished online game:** open it from Finished, **Watch a turn again**.
  10. **Your name:** change it in the Online block; the next table shows it.
- **Still open from session 26:** the phone online test; laptop and phone on the same game ("open somewhere else"); a 1-hour game left overnight; the fair-play line; **Workers Builds** (your step 2, then the version line should show the commit of the next push).
- **Still open from session 25b and before:** a replay with sound; the music at the default; the Music slider; a rival taking your land (the low drum hit); the lobby on the phone; Recruit, tap around, Done; tap your Leader; the sound bench; build and hold a wall of 3 against a Marshal (uncapped now); a game from a weak spot; the Marshals' feel; a delegating game on Wyrmland 6; the comeback card; a capital falling with sound; your Steward's handout; Effects Off; "Watch again"; Conquest's 20 turns on a 200-territory map.

### Oct 15: Claude Code session 28 (M4: deals between people, chat, pause by vote)
*All four parts done, nothing slipped to 28b. Screenshots `docs/art/screens/s28-*.jpg`. Write-up: the BUILT block for 28 in `docs/10-online-plan.md` §9, `docs/rules-reference.md` §25, `docs/decisions.md`.*
- **Step 0, the blank page:** a missing `/assets/` file now answers **404 that nobody keeps**, never the lobby's HTML (the Worker checks every built file it serves). A part of the page that fails to load mends itself: it throws away its own copies of that file and reloads once (never in a loop); failing again, it says "Something didn't load. Reload the page." Checked live: `/assets/nothing.js` answers 404, the poisoned chunk the orchestrator found now answers JavaScript at the edge, and your Chrome's own bad copies (it still had some) were cleared by the first load. **The gold line** on the turn report card now says the gold after your Steward's purse (one path for the card, the log and the Chronicle). Settings online: **Leave** and **Resign**, each with a one-line note. The Finished list says the result of a game you left, and the turn you left on. The Houses panel never cuts a name short. Start reads "Starting…" only for its own game; the guest-list note is in plain words. No play-test notes from you after 27.
- **Part 1, deals between people:** Propose works on people as on bots (the Houses panel), with a note of your own. The other person gets it at once, answers Accept, Counter (once) or Decline, and you're told at once; you can withdraw until you lock in; unanswered, it lapses when they lock in. The server holds both sides' answers and starts the deal only from what it relayed. Public as designed: the report, the Chronicle and the Houses panel tell of a deal between people as of a bot's (trade terms private). Deployed `f1df1f3e`.
- **Part 2, chat for people:** the **💬** button in the top bar (with an unread count): the table chat (it starts on the table screen and carries into the game), one-to-one (the bubble beside a person in the Houses panel) and **groups** anyone makes (Group… under the Houses panel). A group is private: the others never see it or learn it exists. Desktop: a sidebar of chats and the chat on the right; phone: the list, then the chat, in the bottom sheet. A message while chat is closed shows for 6 s at the top (never during the replay). 2,000 messages a game, 300 characters, one every 2 s a person. Deployed `34b88bb7`.
- **Part 3, pause by vote:** Ask for a pause in Settings or tap the clock; everyone else still playing gets a card (Agree, No; bots agree at once); it starts only if all agree within 60 s; 15 minutes at most, three a player a game; the top says "Paused by Kit, 12:40 left"; Lock in becomes Ready, and everyone Ready ends it early; the turn's clock carries on from where it stopped. A paused game survives a deploy. Deployed `ef050961`.
- **Part 4:** `scripts/table-harness.mjs` now seats three people, makes an offer and a counter, writes in a group chat (checking the third seat never hears of it) and, with `PAUSE=1`, asks for a pause, so session 29 can test bots' chat against it. The polish two-account games showed is in (shorter Houses panel lines, a solid chat panel, the phone opening on the chat list, no duplicate pause notice).
- **Checked:** two accounts against `wrangler dev` (and a third headless seat): a truce countered and accepted, a trade declined, a withdrawal, the table chat, a group the third seat never heard of, the pop-up, the phone's two screens, a pause that started, one that failed on a No, one that ended early on Ready. On the preview with your account: an offer to a bot, the table chat, a pause the bots agreed to, two turns (then I resigned that test game: it's under Finished). **Found and fixed before any deploy:** the chat's scroll effect blanked the page as the table screen closed (this Chrome's `scrollIntoView` returns a Promise).
- **Numbers:** CPU on Cloudflare: a game made 40 ms, a turn 22 to 38 ms, a pause 4 to 8 ms, the Worker's handlers 1 to 9 ms; no limit errors. A chat message about 190 bytes on the wire; a hello with chat 9.4 KB. The start-up bundle **496.1 KB** (the diagnostics panel now loads only when opened). Deploys `6440c4aa`, `d08aab5b` (Step 0), `f1df1f3e`, `34b88bb7`, **`ef050961`** (final code; the docs commit after it doesn't need a deploy). The lock check passed every time.
- **Tests:** 1,188 pass (new: the missing asset, the failed load, the report card's gold, the Finished row, deals between people in the room and on the page, chat in the room and on the page, pause by vote with the fake clock, the fog on the wire with three people all online, an offer and its counter, a group chat and a pause vote); typecheck and the web build pass. Nate: please check the repo's Actions page for the last commit.

### Oct 15: Orchestrator review of session 28 (and the orchestrator's own checks on the live server)
*Checked: all six commits green (the first two were pushed together, one run); the fog test fails at once on a planted leak (a group's lines sent to every seat: "p3 was sent SECRET-GROUP") and passes clean with the offer, the counter, the group and the pause vote; nothing under `packages/` or `apps/sim` changed, so the sims are identical by construction; the live preview in Nate's Chrome; the screenshots; the write-up.*
- **The live check (Oct 15, 4:30 pm):** `/assets/nothing.js` answers 404 with `no-store` (the blank-page cause is gone; the lobby, a table and a game all loaded first time). The label reads `3bffade` (the last code commit). Make a game link, a line in the table chat on the table screen, Start now with bots, the chat button in the top bar with the table chat carried in (the sidebar: The table, New group…), a truce offered to Lady Morwen from the Houses panel and accepted at once ("Peace is good for business. Agreed."), a tap on the clock, the confirmation card, Ask for a pause, "Paused by you, 14:57 left" and the Ready card, Ready, "Everyone is ready. The clock is running again." at 3:49 (the time paused given back), Settings with Leave and Resign each on one line, a resignation that resolved the turn at once. The test game is under Finished in Nate's list.
- **Screenshots:** the desktop chat panel (a renamed group, Add people), the phone's chat as a tab in the bottom sheet with an unread count and a back arrow, the pop-up, a person's offer with its note on the phone, the table chat on the table screen. All read well.
- **Nits for 29's Step 0:** a resigned seat (watching) still sees "Propose a deal" on a rival's row; the report says an offer "was declined" when it was countered (the engine's `dealLine` has no countered wording: words only, the seeded sims must match); a quiet notice (a deal's answer) is dropped while a warning is up (queue it instead); the Worker's resign-from-the-lobby handler at 9 ms against the Free plan's 10: the Access token is verified with RS256 on every API call (`access.ts` caches the public keys, not the result), so cache the verified identity by the token's hash until its expiry, and the imported key; measure before and after.
- **The session's two questions:** three pauses a player stays the default until play says otherwise (on the test list); the "declined" wording for a counter is a fix, not a choice (Step 0).
- **Numbers held:** the bundle 496.1 KB (29's allowance: within 2 KB of 496.1); a turn 22 to 38 ms, a pause 4 to 8 ms; no limit errors.

### Things to test after session 28 (Nate's next play test)
*The preview is `ef050961`. If the preview says "Update ready", tap it first. **A blank page should never happen again after a deploy**: if one does, tell the orchestrator (and the old fix still works: Chrome, Settings, Privacy and security, Clear browsing data, "Cached images and files").*
- **Alone (you can try these now):**
  1. **A blank page never again:** open the preview on the phone and the laptop after this deploy (and after the next one). It should load, every time.
  2. **An offer to a bot and its counter:** in an online game with bots, tap a bot in the Houses panel, Propose a deal. Its answer comes at once (as before); if it counters, Accept or Decline it.
  3. **The table chat on the phone:** Make a game link, write something in the table chat on the table screen, Start now with bots. In the game, the 💬 button: the list, then the table chat with your message, with a back arrow.
  4. **A pause the bots agree to:** tap the clock at the top, Ask for a pause. It starts at once (bots agree), the top says "Paused by you, 14:59 left". Change an order, then press Lock in: it says you're Ready, and the clock runs again from where it stopped.
  5. **Settings online:** Leave and Resign read cleanly, each with its line. Resign a test game, then look at Finished in the lobby: once it ends, it says who won and the turn you left on.
  6. **The turn report's gold line** matches the gold at the top (with a Steward on 10%).
  7. **The Houses panel:** names in full, even with OUT and Oathbreaker badges.
- **With a friend:**
  1. **A truce and a trade between you:** one of you proposes (add a note), the other counters, then accepts. Then a trade one of you declines, and an offer one of you withdraws. Is each answer shown quickly and clearly?
  2. **A group chat two friends make against you** (three people): they make a group and scheme; you should never see it. Then they add you: you read what they said before.
  3. **A pause with three people:** one asks, one says No ("Not everyone agreed."), then everyone agrees, then everyone presses Ready.
  4. **The pop-up:** a friend writes while your chat is closed: who and the first words, for 6 s, never during the replay.
- **Still open from session 27:** a table with a friend (the link, the table screen on their phone, Start, the clock for both, "✓ locked in"); two friends on phones; colours; leaving for three turns; resigning from Settings and from the lobby's list; the lists; after a missed turn your own commands come back; the replay's header ("Replay", then "in 0:08"); Watch a turn again; your name.
- **Still open from session 26:** the phone online test; laptop and phone on the same game ("open somewhere else"); a 1-hour game left overnight; the fair-play line; **Workers Builds** (your step 2, then the version line should show the commit of the next push).
- **Still open from session 25b and before:** a replay with sound; the music at the default; the Music slider; a rival taking your land (the low drum hit); the lobby on the phone; Recruit, tap around, Done; tap your Leader; the sound bench; build and hold a wall of 3 against a Marshal (uncapped now); a game from a weak spot; the Marshals' feel; a delegating game on Wyrmland 6; the comeback card; a capital falling with sound; your Steward's handout; Effects Off; "Watch again"; Conquest's 20 turns on a 200-territory map.

### Oct 15: Claude Code session 29 (M4, part four: chat for bots and your leaders, notifications, the polish pass)
*All four parts done, nothing slipped to 29b. Screenshots `docs/art/screens/s29-*`. Write-up: the BUILT block for 29 and "M4 as built" in `docs/10-online-plan.md` §9, `docs/rules-reference.md` §25, `docs/infra-cloudflare.md` (push keys, the email binding, Nate's step 4), `docs/decisions.md`, `docs/voice-guide.md`.*
- **Step 0:** a seat a Marshal plays (you resigned or were taken over) no longer shows "Propose a deal". A counter reads as one: "Kit countered your truce: a truce everywhere for 2 turns." (a bot's counter with its own words). Words only: the same seeded sims before and after. Quiet news (a deal's answer) waits behind a warning instead of vanishing, one on screen at a time. The Worker remembers a sign-in it already checked until it expires: the lobby's resign took 4 to 7 ms of CPU before, 3 ms after (7 on a cold start). No play-test notes from you after 28.
- **Part 1, bots in the chat:** a bot speaks in the table chat when something calls for it (it took your land, you took its land, a deal between you started or broke, it took a capital you saw fall, it finished a rival, it took its own capital back), at most one line a bot to you a turn and two in all, three turns apart unless a deal, the Captain rarely and plainly, the Recruit never. Each line is written for you from your own replay: never a place in your fog, never a troop count. The 💬 bubble beside a bot: Say something (three lines of yours, the bot answers two a turn), its offers to you (the Deals card), Propose a deal. A bot in a group answers "Join us against…" and "Peace among us?" with the deal ready to send, and its words never bind it. Checked live: Queen Isolde in the table chat ("Finished Lady Morwen. I don't leave a job half done."), Baron Krell's and Lady Morwen's offers in their one-to-ones, the Merchant answering a line. Deployed `a953a6af`, `ffc6adf7`.
- **Part 2, your council:** a chat only you have: your leaders' lines as a conversation, and now and then a question you answer by picking (a grudge: push back, raid or hold. A new threat to your capital: defend it. A Steward with nothing to build: fortify, culture or your call. An empty purse: 10%, 20% or leave it). Your pick goes through the Leaders panel (it shows there as your change). One a turn at most, none in the first two, three turns apart. Unanswered, it lapses ("No answer. I took that as a no."). Checked live: "Purse is empty. A share of income?", answered 20%, and the Leaders panel showed "20% of income". Deployed `c08699ed`.
- **Part 3, notifications:** quiet news waits for the replay, and "Turn 12 is open for orders." as an online window opens. **Tell me when it's my turn** (Settings online): a push to this device when a new turn opens and the game isn't open here, once a turn, every timer. **Email me when it's my turn in a long game** (1 h and up). Both say only "Your turn in Conquerra: Embervale, turn 12". The push is signed and encrypted by our own code (no new library: it matches the standard's own example byte for byte). The keys: `VAPID_PUBLIC` in the config, `VAPID_PRIVATE` a Cloudflare secret only. **Checked:** a test email from a 1-hour game reached your Gmail inbox, a push through Google's real push service reached a throwaway Chrome and decrypted, and **a push reached your laptop's Chrome** (you allowed notifications, Oct 15 at 23:00 UTC): a 3-minute game, turn 1 locked in, the page closed, and as turn 2 opened Chrome showed "Your turn in Conquerra", "Embervale, turn 2", linking to the game (the room's log: "1 pushed", 10 ms of CPU). Found and fixed on the preview: a room the clock woke told nobody (and the bots stayed quiet after such turns). Deployed `040b97a7`, `a40f36cf`. Your Gmail was already verified in Email Routing, so your step 4 is done.
- **Part 4:** single player has your council and the bots' lines in the table chat too (the 💬 button now shows there). Old saves load as before. A chat pop-up plays the game's own quiet notice sound. `scripts/table-harness.mjs` talks to a bot, asks a bot in a group, and answers council questions. Deployed **`b2842747`** (final code).
- **Numbers:** the start-up bundle 497.1 KB (allowance 498.1). On Cloudflare: a turn 12 to 159 ms of the room's CPU (30 s allowed), the "your turn" alarm 12 ms, the Worker's handlers 0 to 4 ms warm and up to 16 ms on a cold start's first call. No limit errors. The seeded sims (`pnpm sim --bots marshal --players 4 --games 60 --seed s29`, and `--bots captain --players 6`): identical before Step 0 and at the end (Marshal: 23.8 turns, seats 20/20/35/25%. Captain: 37.9 turns).
- **Tests:** 1,227 pass (new: the Access cache, countered wording, the notice queue, the bots' limits and fairness per reader, talking to a bot, groups with bots, the council's questions and answers, single player's table lines, Web Push against RFC 8291, "your turn" in the room and sent, the push and email API); typecheck and the web build pass. The fog-on-the-wire test now checks every bot line and council question (a planted leak fails it). Nate: please check the repo's Actions page for the last commit.
- **Your test games:** this session made and resigned a dozen test games in your account (they're under Finished). Turn emails are **on** for your account (Settings online turns them off).

### Oct 15: Orchestrator review of session 29 (M4's last build session)
*Checked: all eleven commits green (three were pushed with the next, one run each); the fog test fails at once on a planted leak (a bot's line naming a fogged territory and a troop count: "p2 was told a number by Baron Krell") and passes clean; **the seeded sims re-run here at the commit before and at the tip** (`pnpm sim --bots marshal --players 4 --games 60 --seed s29`): identical games, seats, personalities and deal counts (only the timing lines differ); the live preview in Nate's Chrome; the screenshots; the write-up.*
- **The live check (Oct 15, 7:15 pm):** the label `7b31825`; a table started with bots, three turns locked in with no orders; the gold line now matches the header ("you now have 29 gold, after 1 to your Steward's purse"); the chat button with an unread count; the sidebar Your council, The table, Lady Morwen, Queen Isolde; Queen Isolde's joint-war offer in her chat with her note and Accept / Counter / Decline; Lady Morwen's note from a lapsed offer; **Say something** with three lines of mine ("Lady Morwen, your border looks very relaxed today.") and her answer in character ("Friend. We should talk more. I learn so much."); the council with Falk's first line. The session's own push test reached Nate's laptop (Chrome showed "Your turn in Conquerra, Embervale, turn 2"). The test game resigned; it's under Finished.
- **Screenshots:** the council's question answered ("Purse is empty. A share of income?" → "Give it 20% of income" → "Done."), a bot's one-to-one on the phone with the offer card and the three lines, Queen Isolde's "Finished Lady Morwen. I don't leave a job half done." in the table chat. All read well.
- **Nits for 30's Step 0:** a bot's offer note stays in its chat after the offer lapsed with nothing to say so ("(lapsed)" or the bot's own line); the Finished list holds about a dozen test games (a "Clear finished" link, or hide bot-only games older than a day); the Worker's cold start at 10 to 16 ms (the first request loads the whole script: move the maps' JSON and anything not needed by the API off the Worker's start-up path, measure again); "Baron Krell is running away with the map" in a bot's offer note is the existing joint-war wording (the bots target the player holding the most land, session 14), not a new leak, but worth Nate's eye: the players panel shows no counts, the note implies one.
- **M4 as built, in one line:** a game link, a table with friends and bots, the clock for several people with takeover and resign, deals between people, chat for people and bots with private groups, your council, pause by vote, "your turn" push and long-game email, all with only `viewFor` on the wire. Checked by the fog test with a planted leak on every session since 26.
- **What's next:** Nate's solo play test (the "Alone" lists); `docs/11-launch-plan.md` (M5, written tonight); session 30; orchestrator-11.

### Things to test after session 29 (Nate's solo play test: M4 closes on it)
*The preview is `b2842747`. If it says "Update ready", tap it first.*
- **Alone (you can try these now), most important first:**
  1. **A push, yourself:** "Tell me when it's my turn" is already on in Chrome on the laptop (checked Oct 15). Make a 3-minute game with bots, lock in turn 1 and close the tab: about half a minute later a "Your turn in Conquerra" notification appears. Tap it: it should open the game. Then try the installed app on your Android phone (Settings online, the same switch).
  2. **A bot in the table chat:** play an online game against Marshals until one takes your land. The 💬 button: the table chat has its line ("Took Ashfell. Nothing personal, it's just the math."), and it waits until you've watched the replay. Does it sound like that bot? Too much, too little?
  3. **Talk to a bot:** the 💬 bubble beside a bot in the Houses panel. **Say something**, pick a line, read its answer. Twice, then it has nothing more to say. If it has offered you a deal, answer it right there.
  4. **A group with a bot:** New group…, tick a bot, **Join us against…**, pick a rival: **Send this deal** under its answer opens the joint war ready to send.
  5. **Your council:** the first chat in the list. After a few turns one of your leaders asks something: answer it, then look at the Leaders panel (your choice shows as your change). Ignore the next one and lock in: next turn it says it took that as a no.
  6. **Single player:** the 💬 button is there now: your council, and the bots' lines in the table chat.
  7. **An email in a long game:** turn emails are on for you. Make a 1-hour game, lock in turn 1, close the tab: the email comes as turn 2 opens (about half a minute).
  8. **A watcher can't deal:** resign a test game and look at the Houses panel: no Propose a deal.
  9. **A counter in the report:** offer a bot a deal it counters. Next turn's report says it countered (not "declined").
- **With a friend (later):** a group with a friend and a bot; your friend's "your turn" push (their email on the guest list, then their own Settings); their turn email (verify their address first: `docs/infra-cloudflare.md`, "Nate's steps", step 4).
- **Still open from session 28:** a blank page never again after a deploy; an offer to a bot and its counter; the table chat on the phone; a pause the bots agree to; Settings' Leave and Resign; the report's gold line; the Houses panel's names. With a friend: deals between people, a group that schemes against you, a pause with three people, the pop-up.
- **Still open from session 27 and before:** a table with a friend; two friends on phones; colours; leaving for three turns; the lists; after a missed turn your own commands come back; the replay's header; Watch a turn again; your name; the phone online test; laptop and phone on the same game; a 1-hour game left overnight; the fair-play line; **Workers Builds** (your step 2); a replay with sound; the music; a wall of 3 against a Marshal; a game from a weak spot; the Marshals' feel; a delegating game on Wyrmland 6; the comeback card; Effects Off; Conquest's 20 turns on a 200-territory map.

### Oct 15: Claude Code session 30 (M4's close-out, then M5 part one: random maps and blackout fog)
*All four parts done, nothing slipped to 30b. Screenshots `docs/art/screens/s30-*`. Write-up: `docs/07-map-tooling.md` (BUILT, session 30), `docs/11-launch-plan.md` §5 and §6, `docs/rules-reference.md` (§11 Blackout, §12 Random maps), `docs/sim-results-m5-random-maps.md`, `docs/decisions.md`.*
- **Step 0:** a bot's offer you didn't answer now says **"(lapsed at lock-in)"** under its note in your chat (a person's offer with a note shows in your one-to-one now too, and says "(lapsed at lock-in)" or "(withdrawn)"). **Finished** hides day-old games you played alone with bots, and has **Clear finished** (hides the rest on this device; the games stay on the server for their week). **The Worker's cold start:** the API no longer loads the room's code, the maps or the content's checks when it starts (the room loads them when it first wakes): Wrangler's start-up time **37 ms before, 3 to 4 ms after**; a first request after a deploy 8 ms before (one sample), 6 to 9 ms after (the rest is the first sign-in check and the database, not start-up). Deployed `c44ebe11`.
- **Part 1:** no notes from your solo test had come in, so nothing to change; "M4 as built" in `docs/10-online-plan.md` says so. **M4 still closes on your solo test.**
- **Part 2, random maps in single player:** Change map → **Random map**: a size (40, 80, 120, 200), a shape (one island, archipelago, twin continents, crescent, inland sea), the seed as two words (**quiet-heron**), **Reroll**, a box to type one, and its picture on the card ("80 territories, a crescent, seed quiet-heron"). The same seed always makes the same map, on any device. Every random map passes the official maps' checks plus a fairness band; a seed gets six tries, then "That seed didn't make a fair map. Try another." (about one seed in six at 40 to 120, one in four at 200, crescents most). The map maker now runs in stages with their own random streams for random maps; **the twelve official maps are byte for byte the same** (pinned) and their games are identical (a 240-game digest and the seeded sims, before and after). Saves keep the map's id and version.
- **Part 3, online:** a table on a random map: the room makes the map once when the table is made and keeps its slim copy (a deploy never changes a running game: tested); each page builds its own in the background; only the id and the version travel (the fog test now runs on a random map too). The lists say "Random, 80 territories (quiet-heron)". **Live on the preview:** a table on a random 80 made (5.6 s), started, two turns resolved in the room (43 and 47 ms of CPU). Then your Chrome stopped drawing the tab (its window was behind others; I asked to bring it forward and you declined, fine) and its Access sign-in looks to have expired (every preview address said "can't be reached" in that Chrome while the server answered normally), so "three turns, close and reopen" is on your list. Deployed `4e73a503`.
- **Part 4, blackout fog:** Rules → Fog of war → **Blackout**: land you've never seen is under thick painted clouds (the sea around it too), no names, borders or gates, the minimap the same, and you can't tap it; once seen it's ordinary fog with "last seen". The game itself is identical either way, so the bots (unchanged) play exactly the same games: **300 games each on Embervale 4 and Wyrmland 6, game for game the same as standard fog** (23.1 and 39.9 turns). Deployed **`f33adb65`** (final code).
- **The random-map sim** (100 seeds a size, all Marshals): 40 territories at 4 players 19.7 turns, 80 at 4 26.3, 120 at 6 35.0, 200 at 8 44.0 (only 46% within 40). Win rate by the capital spot's exposure: inside ±5 at 40, 5.9 off at 120, **12 off at 80 and 11 at 200**; the spots marked harder win 0 to 12.5% against a fair 15 to 25%. So the sims want a start bonus (or a tighter band) for random maps: the orchestrator's call.
- **Numbers:** the start-up bundle **499.1 KB** (allowance 499.1; the map maker loads only with a random map or the game). A random 80 drew in 1.2 s in your Chrome. Tests: **1,253 pass** (new: the twelve pinned, stages independent, ids, rerolls, the seat rule on a random map, saves that rebuild, the room's kept copy across a deploy, the fog test on a random map and with blackout, blackout's view and replay, lapsed notes, Clear finished, the API's cold start). Typecheck and the web build pass. Nate: please check the repo's Actions page for the last commit.

### Oct 16: Orchestrator review of session 30 (random maps and blackout, checked live)
*Checked: all six commits green; **the twelve maps unchanged** (their committed files have no diff since before the session and the map maker's rebuild test passes at the tip); **the seeded sim re-run here at the commit before and at the tip** (Wyrmland, 40 all-Marshal games, seed o30): identical; the fog test fails at once on a planted blackout leak (terrain and name on `unknown` land) and passes clean on a random map and with blackout; a random 80 in Nate's Chrome; the screenshots; the write-up and the sim doc.*
- **The live check (Oct 16, 9:30 am):** the label `defcd52`; the lobby's Random map panel (size, shape, the seed "gilded-fjord" with Reroll and a box to type one, a thumbnail); a single-player game on it, painted with provinces, a lake and ranges, the capital's neighbourhood visible; then online: Make a game link on "Random, 80 territories (calm-stag)", Start now with bots, a turn locked in, the link closed and reopened into turn 2 with the clock running (the map rebuilt on the page in about 20 s with the reload). Resigned; under Finished. Chrome wouldn't paint that window for screenshots (the session saw the same), so the online part was read as text.
- **The sim doc** (`docs/sim-results-m5-random-maps.md`): by exposure rank, the marked harder spots win 0 to 12.5% against a fair 15 to 25% at every size; 200s average 44 turns (46% within 40). The orchestrator's default, for Nate to overrule: **a start bonus on a random map's harder spots (+4, the official maps' middle) and the exposure band tightened to 4.0** (nine in ten of the twelve's own layouts pass it), then the 100-maps-a-size sim again in 31's Step 0; if a size is still outside ±5 by exposure, the band goes to 3.0.
- **Blackout and the bots:** the games are identical with blackout on or off because the bots read the map's shape directly; under blackout a person can't. That brushes "bots never cheat" (Nate's standing call). Until the bots learn to explore (a later session with sims: pathing over known land only, a scout's drive), the Rules fold says so plainly: "Blackout (the bots still know the lay of the land)". Nate's call whether blackout stays offered before then (asked Oct 16).
- **Nits for 31's Step 0:** the start-up bundle sits exactly at its allowance (499.1 KB): find 15 KB (the Random map panel, the Rules fold's insides and the saves dialog after the first paint) before anything is added; the "Update ready" toast stayed up after Update now with the newest build already running; the lobby forgets "Random map" across a reload (it remembers the other settings); a 200 map takes up to 30 s to build on a phone (a "Making the map…" line with progress, and the build off the main thread as online already does); crescent seeds fail about half the time (tune the crescent's knobs); tactical view draws rivers through cloud under blackout; a bot's offer note now says "(lapsed at lock-in)" (good) but a person's withdrawn offer could say who withdrew.
- **Numbers held:** a room turn on a random 80 at 43 to 47 ms; the Worker's start-up 37 ms → 3 to 4 ms (the API no longer loads the room's code); a cold request 6 to 9 ms. Three older heavy tests got more headroom so the suite passes with the new map-building tests beside them.
- **Seen and fine:** the twelve keep the one shared random stream (splitting it would have changed every map), and only random recipes use the stage streams; `MAPGEN_VERSION` stays 2.

### Things to test after session 30 (Nate's next play test)
*The preview is `f33adb65`. If it says "Update ready", tap it first. If every preview page says "can't be reached", sign in to Access again (open the preview, pick your Google account).*
- **Alone (you can try these now), most important first:**
  1. **A random map at each size in single player:** Change map → Random map. Try 40, 80, 120 and 200 (big ones take a few seconds to draw). Start a game on one. Does it look like a real place? Anything odd (a name on the sea, a capital stranded on an island)?
  2. **A seed typed on the phone:** on the laptop pick a random map you like and note its two words; on the phone type them into "Type a seed" (same size and shape): the picture should be the same map.
  3. **A random map online:** Online → Make a game link with a random map, Start now with bots, play three turns, close the tab and open the game again from the lobby. It should come back where you were. (I got as far as two turns on a random 80.)
  4. **Blackout at turn 1:** Rules → Fog of war → Blackout. Start on Embervale: only your capital and its neighbours show; the rest is cloud. Play a few turns: the cloud lifts as you take land. Is it fun, or just hard?
  5. **A lapsed offer:** in an online game, let a bot's offer sit unanswered and lock in: its note in your chat with that bot says "(lapsed at lock-in)".
  6. **Clear finished:** the Finished list should be shorter (your day-old solo test games are hidden); Clear finished hides the rest.
- **Still open from session 29 (M4 closes on these):** a push yourself; a bot in the table chat; talk to a bot; a group with a bot; your council; single player's chat; an email in a long game; a watcher can't deal; a counter in the report.
- **With a friend (later):** a group with a friend and a bot; your friend's "your turn" push and email; deals between people, a group that schemes against you, a pause with three people, the pop-up.
- **Still open from session 28 and before:** a blank page never again after a deploy; the table chat on the phone; a pause the bots agree to; Settings' Leave and Resign; the phone online test; laptop and phone on the same game; a 1-hour game left overnight; **Workers Builds** (your step 2); a replay with sound; the music; a wall of 3 against a Marshal; a game from a weak spot; the Marshals' feel; a delegating game on Wyrmland 6; the comeback card; Effects Off; Conquest's 20 turns on a 200-territory map.


### Oct 16: Claude Code session 31 (M5 part two: tutorials, the guided first game, the first scenario)
*All four parts done, nothing slipped to 31b. Screenshots `docs/art/screens/s31-*`. Write-up: `docs/11-launch-plan.md` §5 and §7, `docs/rules-reference.md` §26 (Learn) and §11 and §12, `docs/04-design-additions.md` §10, `docs/sim-results-m5-random-maps.md` (session 31), `docs/decisions.md`.*
- **Step 0:** **the start-up bundle 499.1 KB before, 468.1 after** (the art book and its painted placeholders, about 32 KB, now load after the lobby's first paint. The Random map panel, the Rules fold's insides and the saves dialog already did). The allowance is 470.1 and a deploy now stops above it. **Random maps' harder spots start with +4 troops and the exposure band is 4.0** (random map version 3; version 2 still builds, so games already running keep their maps). The sim again, 100 maps a size: the harder spots win more than before at 40, 80 and 120, but **every size is still outside ±5 by exposure** (40: 6.9, 80: 7.9, 120: 13.0, 200: 12.5 points off), because the safest spot wins up to twice its share. The band at 3.0 for 80, 120 and 200 didn't bring any size inside and most seeds failed (80: 17 maps from 100 seeds), so it stays at 4.0. One seed in six to three in ten now says "That seed didn't make a fair map. Try another." **Crescents** are fatter (smaller bay, one isle, longer sea lanes, fewer choke points asked): about 5 seeds in 6 pass instead of 1 in 3. The Rules fold says "Blackout: the map is hidden until you explore it (the bots still know the lay of the land)", Tactical view paints cloud over rivers, "Update ready" hides once the newest build runs, the lobby remembers a random map (size and shape, a fresh seed), a big map says "Making the map… 40%" (", try 2 of 6" after a reroll), and a withdrawn offer says who withdrew it. No play-test notes from you after session 30. Deployed `e6d00f8`.
- **Part 1, the machinery and the first three:** a tutorial is a JSON file in `packages/content/data/tutorials/`: the recipe that makes its saved game (a free map, the seed, the bot, where things stand, any scripted turns), the goal (from a small fixed set), one hint a turn, its words, and the solution. The game's worker builds the saved game from the recipe each time and never touches your autosave (Continue keeps your own game: checked in your Chrome). A test plays every solution against the engine, so a rule change that breaks a lesson fails the build, and the voice test reads the files. **Learn** sits under Start (open on your first visit). In a lesson: the goal card (beside the territory panel on a desktop, the sheet's first tab on a phone), the hint as the quiet notice and on the card, the report's first line ("Goal: Moonmoor, Larkfell, Westermore and Thornton are yours. Done."), then Done (Next lesson / Back to the lobby) or Missed (Try again / Back), no timer. Deployed `2022a38`.
- **Part 2, the other four:** Hold the wall, Fate and Spoils, Make a deal (Lady Morwen took the truce once your border was stronger than hers: "Your army at our border is bigger than mine. Peace suits me."), Your leaders (one scripted turn first, so your council asks "Purse is empty. A share of income?" on the lesson's second turn). **Found on your Chrome:** the old build's Update now never switched (the waiting copy stayed put until the page navigated); Update now now reloads if nothing happened in 4 s. Deployed `c34f9f3`.
- **Part 3, the guided first game:** your first game against the bots on a new device (no saved games, no lesson done) shows three cards on turn 1 ("This is your capital. Tap it.", "Recruit here: 2 gold a troop.", "Lock in when you're ready. Everyone's orders happen at once."), each waiting for its tap, with Skip the guide, then one line in turn 1's report, never again. Learn's last line starts it on purpose. Deployed `d8deb82`.
- **Part 4, scenarios and the newcomer's lobby:** **The Siege of Highmouth** (the same format, no hints, take Highmouth and all of Rush March from a Captain in 10 turns) under Learn's Scenarios. Load a file reads a scenario file as it reads a saved game. Someone who has never played sees Learn open and "Or jump in: a 4-player game on Embervale" under Start. Deployed **`a9c7ce7`** (final code).
- **Played on the preview in your Chrome:** all seven lessons, to Done (the first three by hand with screenshots; the last four through the page's own taps and buttons, because Chrome stopped drawing that window, as in session 30). My lesson ticks are cleared from your browser, and your Continue game (the random 80) is untouched. **Not played there:** the guided first game, because starting any new game in your Chrome would have replaced your Continue game; I played it on the phone layout locally (screenshots), and the tests cover it.
- **Numbers:** the start-up bundle 469.7 KB at the end (allowance 470.1). The twelve maps unchanged (their pinned fingerprints, and the 240-game digest `dc8962d4f8ba3bc6` as in session 30). **Tests: 1,292 pass** (new: random map version 3, the lessons' schema and solutions, the goal checks, Learn, the guide, scenarios and scenario files, Step 0's fixes); typecheck and the web build pass. Nate: please check the repo's Actions page for the last commit.

### Oct 16: Orchestrator review of session 31 (tutorials, checked live)
*Checked: all seven commits green (`b08f6aa` was pushed with Part 3, so it shares that run); the tutorial test plays every solution against the engine (14 tests, under a second); the twelve maps' committed files are exactly what the map maker makes; **the seeded sim re-run here at the commit before and at the tip** (Wyrmland, 40 all-Marshal games, seed o31): identical (the engine wasn't touched: the +4 lives in the map maker's layout, which the seat rule already reads); the start-up bundle built here: **469.7 KB** (allowance 470.1); the fog test fails at once on a planted seed-on-hello leak (all four cases) and passes clean; **the size-40 random-map sim re-run here with the session's seed matches its table to the decimal** (27.7 / 28.9 / 25.3 / 18.1, 83 maps, 21.7 turns); the screenshots; the write-up.*
- **The live check (Oct 16, 1 pm, Nate's Chrome):** the lobby came up on `c34f9f3` with "Update ready"; **Update now switched to `a9c7ce7` within 7 seconds, no toast left** (Step 0's fix and Part 2's fallback, on the laptop). Then **"Take the field" and "Raise an army" played by hand to Done** (the goal card, the chained hops with "about 9, All" and "Odds (estimate): can't see" into fog, the report's goal line, the Done card, Next lesson, "2 of 7 lessons done" in the lobby). My ticks are cleared from the browser and the Continue game (the random 80, turn 1) is untouched.
- **One trip a newcomer will take (lesson 2):** after **Recruit here** on Westermore the panel stays in "Recruit at…" mode ("tap a glowing territory to recruit there instead"), so my next taps (Mistbury, then Larkfell, to march) **moved the recruit to Larkfell** instead of selecting Mistbury. Done closes it, but the hint doesn't say so. 32's Step 0 default (Nate can overrule): **Recruit here from the territory panel adds the order and goes back to the territory panel**; the round Recruit button keeps the retargeting mode.
- **Seen in the screenshots:** on the phone the hint shows twice (the quiet notice at the top, and the card's "This turn" line), and the notice covers the top of the map (the session saw it cover the buttons); the guide's cards sit over panel text on the phone (the Recruit card over the Army tab's lines, the Lock in card over "+ Somewhere else"); **the clock runs during the guided first game** (4:52 in the shot) while a newcomer reads three cards. "By turn 3" with two turns to play is consistent everywhere (the goal is checked when turn 2 resolves), but it may read as three turns to a newcomer: Nate's eye.
- **The random-map sim's reading stands:** the harder spots do better with +4, the safest spot is what breaks ±5 (up to twice its share at 8 players), the band at 3.0 fails most seeds. **The orchestrator's call: leave random maps here for now** (a note on the Random map panel is enough: "fairness within a few points, the safest spot a touch ahead"), and put a graded head start by exposure rank (every spot but the safest) into a later balance session with sims, after 1.0 if the numbers hold. Nate can pull it forward.
- **Nits for 32's Step 0:** the recruit panel above; the guide pauses the clock while a card is up (single player already has pause); the hint notice skipped when the goal card is on screen (desktop) or the Goal tab is open (phone); the guide's cards anchored clear of the panel's text on the phone; the "Update now" fallback on the phone is on Nate's list.
- **Numbers held:** 469.7 KB (the allowance 470.1 stays; the next room is Zod out of the start-up code, a bounded Step 0 item for 32); 1,292 tests; the twelve maps' digest `dc8962d4f8ba3bc6`.

### Oct 16: Nate's calls after session 31 (recorded by the orchestrator)
- **Random maps: pull the graded head start forward.** Every spot but the safest gets a head start by how exposed it is, with the 100-maps-a-size sim, as **session 33** (random-map balance). Scale and safety moves to 34, polish 35, sign-in 36, the purchase 37, battle royale 38. The launch plan's order is updated.
- **A failed seed rerolls by itself:** Reroll keeps rolling until a seed makes a fair map and shows the words that worked; a typed seed still gets its tries and the line. 32's Step 0.
- **Recruit here from the territory panel adds the order and returns to the panel** (the round Recruit button keeps the retargeting mode). 32's Step 0.
- **The guided first game pauses the clock while a card is up.** 32's Step 0.

### Things to test after session 31 (Nate's next play test)
*The preview is `a9c7ce7`. If it says "Update ready", tap Update now (it now reloads by itself if it doesn't switch). If every preview page says "can't be reached", sign in to Access again.*
- **Alone (you can try these now), most important first:**
  1. **Each lesson on the phone:** lobby, Learn, then each of the seven in order. Does each make sense from its goal card and hints alone? Too easy, too hard, a word that doesn't sound like you? The names are yours to change.
  2. **The guided first game in a fresh browser profile:** on the laptop, Chrome's profile menu, Add, Continue without an account, open the preview (sign in to Access), tap Start. Three cards on turn 1, each waiting for its tap; then one line in the report; never again. (Or Learn, "The guided first game", in your usual profile: note it replaces your Continue game.)
  3. **The start bonus on a random map:** Change map, Random map, 120, start a game: if your capital or a bot's is a harder spot, the first turn says "starts with 4 extra troops (a harder spot)". Also note how often Reroll says "That seed didn't make a fair map" (more often than before: one seed in six to three in ten).
  4. **The Siege of Highmouth:** Learn, Scenarios. 10 turns, no hints.
  5. **A scenario file:** save `packages/content/data/tutorials/08-siege-of-highmouth.json` somewhere, then Load a saved game, Load a file, pick it: the scenario starts.
  6. **Step 0's small ones:** a 200 random map on the phone says "Making the map… 40%"; reload the lobby with a random map picked (it comes back with new words); Rules, Fog of war, Blackout says the bots still know the lay of the land.
- **Still open from session 30:** a random map at each size; a seed typed on the phone; a random map online (three turns, close and reopen); blackout at turn 1; a lapsed offer; Clear finished.
- **Still open from session 29 (M4 closes on these):** a push yourself; a bot in the table chat; talk to a bot; a group with a bot; your council; single player's chat; an email in a long game; a watcher can't deal; a counter in the report.
- **With a friend (later):** a group with a friend and a bot; your friend's "your turn" push and email; deals between people, a group that schemes against you, a pause with three people, the pop-up.
- **Still open from session 28 and before:** a blank page never again after a deploy; the table chat on the phone; a pause the bots agree to; Settings' Leave and Resign; the phone online test; laptop and phone on the same game; a 1-hour game left overnight; **Workers Builds** (your step 2); a replay with sound; the music; a wall of 3 against a Marshal; a game from a weak spot; the Marshals' feel; a delegating game on Wyrmland 6; the comeback card; Effects Off; Conquest's 20 turns on a 200-territory map.


### Oct 16: Claude Code session 32 (M5 part three: bots that explore under blackout)
*All four parts done, nothing slipped to 32b. Screenshots `docs/art/screens/s32-*`. Write-up: `docs/sim-results-m5-blackout.md`, `docs/11-launch-plan.md` §2 and §6, `docs/04-design-additions.md` §9, `docs/rules-reference.md` §11, `docs/decisions.md`.*
- **Step 0:** no play-test notes from you after session 31, only your four calls, all done. **Recruit here** on the territory panel adds the recruit and stays on the territory panel (so the next tap selects, the trip the orchestrator fell into in lesson 2); the round Recruit button keeps "Recruit at…" with Done. **The guided first game holds the clock** while a card is up and lets it run once you lock in or skip; on a phone its cards sit above the open sheet. **A lesson's hint isn't shown twice** (no notice while the goal card or the phone's Goal tab is open; fold the card and it comes back). **Reroll rolls on by itself** until a seed makes a fair map (12 seeds at most, then the line); a seed you type keeps its six tries and the line. **Zod is out of the start-up code**: the content files are kept exactly as their checks make them (a test says so), so the lobby uses them as they are. **The start-up bundle 469.8 KB → 396.2 KB** (allowance now 398.2). Deployed `df61a0d`.
- **Part 1, the known map:** every bot (Recruit, Captain, Marshal, your leaders and Steward, the delegating seat, the Fallen, spies, the deals judge) plans from the land its seat has seen, and the borders that lead from it into the cloud (their kinds only: a river, a pass, a sea lane, never what's across). It knows the map's size (the lobby shows it). **The honesty test:** at several turns of blackout games on two random maps and all twelve, everything about each seat's unseen land is made up afresh (ids, names, terrain, provinces, borders), and every bot gives the same orders, answers and lines; planting the bots back on the whole map fails it on all 14 maps. A province you can't see all of now reads **"you hold 2 of ?"** (the card and the map's plaque). **Found:** the sim script's blackout runs never passed blackout to its workers, so session 30's "game for game the same" was standard fog; fixed. Standard fog is byte for byte the same: digest `dc8962d4f8ba3bc6`, Captain fingerprint `232617a30b1f8b47`, the o32 seeded sim identical at the commit before the session and after every part. Deployed `41e7fdc`.
- **Part 2, the scout's drive** (`personalities.json`, `explore`): land opening into the cloud is worth more (fading as the cloud lifts), early Scouts, idle spies toward the cloud. 300 all-Marshal games a table: **Embervale 4** every seat within 1.7 of fair under blackout (standard 0.7), 22.1 turns (standard 23.0), half the map seen by turn 4.8 (standard 6.2); **Wyrmland 6** within 3.7 (standard 4.0), 42.2 turns (standard 39.7), comebacks 69% (66%). **Met:** ±5 by seat, and turns within 3. **Not met:** the **Turtle** wins 14.7% under blackout against 22.5% (it stays cautious until turn 14 and explores least) and the **Opportunist** 30.1% against 20.9%; three settings tried, and even with the drive off they're the same, so it's blackout itself. **The delegating seat** (your leaders against Marshals, Wyrmland 6): 1.28× fair against 1.54× (0.26 down, the bar 0.2). **Found:** a knocked-out person was sent last turn's leader notes; fixed. Deployed `33659aa`.
- **Part 3:** the write-up. **The Rules fold keeps "(the bots still know the lay of the land)"** by the brief's rule (two bars missed), though it's no longer true; the rules reference says what the bots know. The optional bot chat line about the cloud is skipped (the time went to the sims). No code changed, so no deploy.
- **Part 4, what a bot knew** (`?lab=known` on the preview, dev only): a blackout game with Marshals played to turn N (or a saved game), one seat's view painted as the game paints it, the cloud's edge outlined in gold, its Marshal's orders that turn as arrows. `docs/art/screens/s32-known-map.jpg`: Embervale turn 3, the Conqueror chaining four hops up to the cloud's edge. Deployed **`6397bb0`** (final code).
- **Played on the preview in your Chrome:** Update now to `6397bb0`, Rules → Fog of war → Blackout (`s32-rules-fold.jpg`), then an **online** table on Embervale with 3 Marshals (so your Continue game is untouched): three turns, the cloud lifting as I took Dawnrest, Rushridge and Fairfall, "Old March +4: you hold 2 of ?" (`s32-blackout-online.jpg`). That game is still under Your online games (5-minute timer, your leaders play missed turns): carry on with it or resign.
- **Numbers:** the start-up bundle 397.9 KB at the end (allowance 398.2). Tests: **1,317 pass** (new: the honesty test on 14 maps, orders never naming unseen land, the explore term, the Scouts purchase, the known map with standard fog, the Fallen, "of ?", Step 0's fixes, the rolled seeds, the content files equal to their checks). Typecheck and the web build pass. Nate: please check the repo's Actions page for the last commit.

### Oct 16: Orchestrator review of session 32 (bots never cheat under blackout, checked here and live)
*Checked: all seven commits green (`8b695b1`'s run was still going at review time; the six before it pass); **standard fog unchanged three ways, re-run here:** the `--digest 4 20 --seed s30d` run gives **`dc8962d4f8ba3bc6`**, the Captain fingerprint **`232617a30b1f8b47`** (15,639 orders), and the same seeded sim at the commit before the session and at the tip (Wyrmland, 40 all-Marshal games, seed o32x): identical; the engine's source untouched (`rules.json` only gained the defaults its schema already filled in). **The honesty test read and tried:** it makes up the unseen land afresh (ids, names, terrain, provinces, borders among unknown land, where each border into the cloud leads, the lists' order) and runs every bot kind, every Marshal personality, the generals, the delegating seat, the Steward, the Fallen's and the leaders' plans under each command, the offers and the answers; **planting the bots back on the whole map fails 17 of its 19 cases**, and a planted seed on the hello fails all four fog-wire cases; both restored. **The blackout headline re-run here with my own seed** (300 all-Marshal games, Embervale 4): blackout 24.0 / 27.3 / 21.7 / 27.0 (3.3 off), 21.9 turns, 97% within 40, half the map by turn 4.9, all by 18.8; standard fog with the same seed 19.7 / 25.7 / 27.3 / 27.3 (5.3 off), 23.6 turns, half by 6.2, all by 19.3. So the session's reading holds (blackout a turn or two shorter on Embervale, the cloud lifting faster with the drive), and seed-to-seed noise on by-seat is about ±3 points at 300 games, as the balance docs say. The bundle built here: **397.9 KB** (allowance 398.2). The screenshots; the write-up.*
- **The live check (Oct 16, 6:45 pm, Nate's Chrome):** the lobby on `6397bb0` (the session's online blackout game had finished and sits under Finished); Rules → Fog of war → Blackout, Make a game link, Start now with bots: turn 1 under blackout shows Wildford and its neighbours, "Old March +4: you hold 1 of ?", thick cloud everywhere else; turn 1's report: Lady Morwen took Dawnrest, on my border, so the bots find you on turn 1. Resigned; under Finished (7).
- **Two blackout leaks on the page, not the wire (33's Step 0):** **the province outline is drawn through the cloud.** With Wildford selected, Old March's gold outline traces the whole province, including its unknown members, so a person sees the shape of land they've never seen (the coast of the cloud, in effect). The outline (and the plaque's placement) should stop at the cloud's edge. **The replay and the report can name cloud land** (the session's own risk: "the river crossing between Whitehome and Dawnrest is closed" in a Fate line, an arrow's start point inside the cloud for an army marching out of it): the words should say "a river crossing at the cloud's edge" and an arrow should start at the edge, as the rules reference promises. The bots ignore both (the honesty test renames that land and they don't flinch); a person could read them.
- **The Rules fold's words are now false:** "(the bots still know the lay of the land)" stays by Nate's call until the Turtle is fixed, but the bots no longer know it. Asked Nate for truthful words (Oct 16, evening).
- **Seen and fine:** the cloud layer is a rectangle around the map's bounds, so far from unknown land the sea is clear and the cloud has a straight edge (the map's size is public anyway); the lab's known-map page draws the cloud's edge in gold and the seat's orders as arrows (`?lab=known`, dev only); `s30-sims.ts` now passes `--fog` to its workers (session 30's blackout claim was standard against standard; the conclusion held by luck, and the doc says so); a knocked-out person no longer gets the previous turn's leader notes.
- **What goes to session 33 (balance):** random maps' graded head start (Nate's call after 31); **the Turtle (14.7% against 22.5%) and the Opportunist (30.1% against 20.9%) under blackout**, and **the delegating seat on Wyrmland 6 under blackout (1.28× against 1.54× fair)**: personality and leader tuning with sims, so the label can come off; the two page leaks above in Step 0.
- **Numbers held:** 397.9 KB (allowance 398.2; 0.3 KB of room, so 33's Step 0 finds 10 KB or the allowance moves); 1,317 tests; the digest and the fingerprint unchanged.

### Things to test after session 32 (Nate's next play test)
*The preview is `6397bb0`. If it says "Update ready", tap Update now. If every preview page says "can't be reached", sign in to Access again.*
- **Alone (you can try these now), most important first:**
  1. **A blackout game against Marshals on Embervale:** Rules → Fog of war → Blackout, 3 Marshals. Do the bots look like they're exploring (pushing to the cloud's edge early, Scouts in the first turns)? Do they still find you? (The online one I started is in Your online games.)
  2. **A blackout game on a random 120:** Change map → Random map → 120, Blackout. Is the cloud fun on a big map, or just slow?
  3. **The Rules fold's words** (your call, Oct 16): it keeps "(the bots still know the lay of the land)" until the Turtle under blackout is fixed.
  4. **"You hold 2 of ?":** under blackout, a province you can't see all of says "?" on its card and plaque.
  5. **Step 0's fixes:** lesson 2 (Raise an army): Recruit here, then tap Mistbury: it should select Mistbury, not move the recruit. The guided first game (Learn → The guided first game; it replaces your Continue game): the clock stands still while a card is up. On the phone: a lesson's hint isn't shown twice, and the guide's cards don't cover the panel's lines. Reroll on a random map a few times: you should never see "That seed didn't make a fair map".
  6. **What a bot knew** (curiosity): the preview's address with `?lab=known` on the end, then Play to that turn.
  7. **From the orchestrator's review:** under blackout, select your capital: the province's gold outline runs through the cloud (it shouldn't; 33 fixes it). Watch a replay for an arrow that starts inside the cloud, or a report line naming a place you can't see.
- **Still open from session 31:** each lesson on the phone; the guided first game in a fresh browser profile; the start bonus on a random map; The Siege of Highmouth; a scenario file.
- **Still open from session 30:** a random map at each size; a seed typed on the phone; a random map online (three turns, close and reopen); a lapsed offer; Clear finished.
- **Still open from session 29 (M4 closes on these):** a push yourself; a bot in the table chat; talk to a bot; a group with a bot; your council; single player's chat; an email in a long game; a watcher can't deal; a counter in the report.
- **With a friend (later):** a group with a friend and a bot; your friend's "your turn" push and email; deals between people, a group that schemes against you, a pause with three people, the pop-up.
- **Still open from session 28 and before:** a blank page never again after a deploy; the table chat on the phone; a pause the bots agree to; Settings' Leave and Resign; the phone online test; laptop and phone on the same game; a 1-hour game left overnight; **Workers Builds** (your step 2); a replay with sound; the music; a wall of 3 against a Marshal; a game from a weak spot; the Marshals' feel; a delegating game on Wyrmland 6; the comeback card; Effects Off; Conquest's 20 turns on a 200-territory map.

### Oct 18: Claude Code session 33 (M5 part four: balance with sims: random maps' graded head start, then the Turtle and your leaders under blackout)
*All three parts done, nothing slipped to 33b. Write-ups: `docs/sim-results-m5-random-maps.md` and `docs/sim-results-m5-blackout.md` (session 33 sections), `docs/rules-reference.md` §11 and §12, `docs/04-design-additions.md` §4, §9 and §11 (the brief said §4 and §12; in this file the personalities are §11), `docs/decisions.md`. Raw sims: `docs/sims/s33-*`. Screenshots: `docs/art/screens/s33-*`.*
- **Step 0:** no play-test notes from you after session 32. **The Rules fold's Blackout line** is now "Blackout: the map is hidden until you explore it." and no more (your call); the rules reference keeps what the bots know. **The two page leaks:** under blackout the lit province, a leader's command and a wall's ring stop at the cloud's edge (no line along land you've never seen), a province's plaque moves onto its known land, and the plain map (no WebGL) no longer draws cloud land at all (it drew every territory grey). In words, land you've never seen is **"the cloud"** in the report, the replay's log and toasts and the panels ("the river crossing from Dawnrest into the cloud is closed", "moved 6 troops out of the cloud to Rushridge"), and an army marching out of the cloud starts its arrow (and dust) at the cloud's edge. A test reads every line of ten blackout turns against the land the reader never saw (it fails on the old words). **The first turn's report** now names everyone's head start too. The new words first pushed the start-up bundle to 398.6 KB; I moved them out of the lobby's code: **398.1 KB** (allowance 398.2, unchanged). Deployed `a172137`.
- **Part 1, random maps' graded head start (version 4):** every capital spot but the safest gets `round(8 × (e − e₀) / e₀)` extra troops by the map maker's exposure check, at least 1, at most 6. The band stays 4.0, so the same seeds pass and the land is version 3's; versions 2 and 3 still build their maps (pinned), so running games keep theirs. The lobby's card says "Exposed spots start with extra troops (up to 6)." **The sims** were run on the same 300 maps for every size and setting (one standard error is about 3 points, and the maps vary a lot, so 100 maps couldn't tell the settings apart). Average distance from fair by exposure rank at 40 / 80 / 120 / 200: version 3 7.5 / 7.8 / 5.7 / 4.8, k = 5 9.1 / 6.9 / 3.7 / 3.9, **k = 8 4.2 / 7.6 / 4.5 / 3.6 (shipped)**. The furthest rank with k = 8: 6.5 / 13.6 / 7.1 / 7.2. Grading from the middle spot at 200 did worse (8.1 at the furthest rank). **It isn't inside ±5 at every size:** at 80 territories and 4 players the safest spot wins 36 to 41% whatever the others get, because its edge is room (income every turn), not troops on turn 1. A lasting head start (income) or a layout rule on room is the next lever, for the orchestrator. Deployed `8736673`.
- **Part 2, the personalities and your leaders under blackout:** a personality's `blackout` block (content) replaces some of its values only under blackout. **The Turtle:** its attack values do nothing (every Marshal's chains and sends are floored by the shared judgement; three settings all gave 17.6%). Its building was the thing: under blackout it now builds **markets and culture from turn 6 and spends the usual Steward's share**: 18.5% against 22.8% with standard fog (it was 17.5%). **The Opportunist:** vulture 0.5 (was 2): 29.5% against 25.8% (it was 31.0%). **All six personalities are within 5 points** (900 games each). The Blitzer gains the most from blackout (32.0% against 27.5%), and it did the same before the change. **Your leaders** already had the scout's drive (the same board as the Marshal's, and your Leader hires Scouts early); they now get their own content values, set to the Marshal's (a Steward's watchtower near the cloud was tried and is off): **the delegating seat wins 1.34x fair with standard fog and 1.24x under blackout** (met). **The headline:** Embervale 4 within 5.0 of fair by seat (standard fog 5.0 with the same seed), 21.5 turns (standard 22.7), half the map seen by turn 4.9; Wyrmland 6 within 4.7, 44.1 turns (standard 41.6). **Noise, for the record:** at 300 games a personality's number moves about 2.5 points with the seed, and the delegating seat's about 0.3x (seed s32: 1.54x standard, s33: 1.22x), so the decisions use 900 and 600 games. Deployed `13be223`.
- **Part 3, a Marshal's line about the cloud:** under blackout, on the turn a bot's own map goes from mostly cloud to mostly seen (once a game), it may say so in the table chat, as the least of its lines and within the chat's limits: "Nothing but cloud past my border, until today." It names nothing. The fog-wire test fails with a planted territory name on the line ("p1 was told of Dawnrest (fogged) by Baron Krell") and passes without it. Deployed `ed415ad` (final code).
- **Standard fog unchanged,** checked at the commit before the session and after Parts 1 and 2: the digest **`dc8962d4f8ba3bc6`**, the Captain fingerprint **`232617a30b1f8b47`** (15,639 orders), and `pnpm sim --games 40 --players 6 --map wyrmland --bots marshal --seed o33` identical. The delegating seat's seed-s32 standard run gives session 32's 1.54x exactly. The honesty test passes (19).
- **Played on the preview in your Chrome (`ed415ad`):** a random 120 (one island, seed fierce-toad) against 4 Marshals. On turn 1 the capital's card says "13 troops, 12 can move (1 of them extra at the start: an exposed spot)", and turn 1's report says "Nettleshire starts with 1 extra troop (an exposed spot)." then "Head starts for the exposed spots: Baron Krell +5, Queen Isolde +1, Warlord Rusk +1." (`s33-random120-*`). The Rules fold with Blackout picked (`s33-rules-fold.jpg`). A blackout game on Embervale, turn 1, with your capital selected: Rush March's outline goes round only the two territories you can see and stops at the cloud, "you hold 1 of ?" (`s33-blackout-outline*`). That blackout game is now your Continue game (single player, turn 1): carry on, or start another.
- **Numbers:** the start-up bundle 398.1 KB (allowance 398.2). The full test run first tripped vitest's worker timeout (every test passing, the run exiting 1) once my pinned big random maps were in it; with quicker seeds (one map a test) it runs clean twice, as it did before the session. Tests: **1,345 pass** (new: the cloud's words and drawing, version 4's grade and pins, the seat rule with graded head starts, the blackout overrides only under blackout, the leaders' drive zero with standard fog, the Leader's Scouts, the cloud line). Typecheck and the web build pass. Nate: please check the repo's Actions page for the last commit.

### Things to test after session 33 (Nate's next play test)
*The preview is `ed415ad`. If it says "Update ready", tap Update now. If every preview page says "can't be reached", sign in to Access again.*
- **Alone (you can try these now), most important first:**
  1. **A random 120 or 200, and its first turn:** Change map → Random map → 120. Does the lobby's line ("Exposed spots start with extra troops (up to 6).") make sense? After turn 1, does the report's head-start news read well ("Head starts for the exposed spots: ...")? Does a game feel fairer than before?
  2. **A blackout game against Marshals with the personalities shown** (Rules → Fog of war → Blackout, tick "Show the Marshals' personalities"): does the Turtle still turtle (forts, walls, a late strike) while building less early? Does the Opportunist still pick on whoever just fought?
  3. **Step 0's fixes, under blackout:** select your capital: the province's outline stops at the cloud. Watch a replay for an army marching out of the cloud: its arrow starts at the cloud's edge, and the report says "out of the cloud", never a name you haven't seen. The Rules fold's Blackout line says nothing about bots.
  4. **The cloud line:** in a blackout game, a Marshal says once, around turn 4 to 8, something like "Nothing but cloud past my border, until today." in the table chat.
  5. **A blackout game on a random 120** (from 32): is the cloud fun on a big map, or just slow?
- **Still open from session 32:** the Marshals exploring under blackout on Embervale; "you hold 2 of ?"; Step 0's fixes from 32 (Recruit here, the guided first game's clock, a lesson's hint, Reroll); what a bot knew (`?lab=known`).
- **Still open from session 31:** each lesson on the phone; the guided first game in a fresh browser profile; The Siege of Highmouth; a scenario file.
- **Still open from session 30:** a random map at each size; a seed typed on the phone; a random map online (three turns, close and reopen); a lapsed offer; Clear finished.
- **Still open from session 29 (M4 closes on these):** a push yourself; a bot in the table chat; talk to a bot; a group with a bot; your council; single player's chat; an email in a long game; a watcher can't deal; a counter in the report.
- **With a friend (later):** a group with a friend and a bot; your friend's "your turn" push and email; deals between people, a group that schemes against you, a pause with three people, the pop-up.
- **Still open from session 28 and before:** a blank page never again after a deploy; the table chat on the phone; a pause the bots agree to; Settings' Leave and Resign; the phone online test; laptop and phone on the same game; a 1-hour game left overnight; **Workers Builds** (your step 2); a replay with sound; the music; a wall of 3 against a Marshal; a game from a weak spot; the Marshals' feel; a delegating game on Wyrmland 6; the comeback card; Effects Off; Conquest's 20 turns on a 200-territory map.

### Oct 18: Orchestrator review of session 33 (balance with sims, checked here and live)
- **Every commit green** on GitHub (`a172137`, `8736673`, `13be223`, `ed415ad`, `854f990`; `85c128e` and `0aa0d23` were pushed with the next one and share its run).
- **Standard fog unchanged, re-run here at the commit before the session and at the tip:** the digest `dc8962d4f8ba3bc6` (240 games, every map's line the same), the Captain fingerprint `232617a30b1f8b47` (15,639 orders), and the same seeded sim (`--seed o12r`, Wyrmland 6, 40 games) identical at both but for the timing line. So version 4, the blackout overrides and the leaders' drive change nothing with standard fog.
- **The bots stay honest:** `knownMap` made to return the full map, and 17 of 19 cases of the honesty test fail; restored. **The wire stays clean:** a fogged territory's name planted on a bot's table line, and 3 of 4 fog-wire cases fail; restored.
- **The numbers re-run with my own seed:** the random-map table at 40 (100 maps, 83 played): by exposure 22.9 / 30.1 / 21.7 / 25.3 (furthest 5.1; the session's 300-map table 29.4 / 29.0 / 23.0 / 18.5), head starts 0 / 2.7 / 4.5 / 5.6 a rank (the session: 0 / 2.5 / 4.3 / 5.4). The Turtle on Embervale 4, 300 games: 22.1% with standard fog, 16.4% under blackout (5.7 apart; the session's 900-game pair 22.8 and 18.5, 4.3 apart; one standard error at 300 games is about 2.5, so the bar is about one error wide, as the session said). In the same run the Blitzer read 36.2% under blackout against 29.6% (the session's 900 games: 32.0 against 27.5): the one personality to keep an eye on.
- **Played live on the preview (`ed415ad`), an online table so nothing of yours was touched:** a random 120 (one island) under blackout with 5 Marshals. The capital's card: "18 troops, 17 can move (6 of them extra at the start: an exposed spot)". Turn 1's report: "Stoneshire starts with 6 extra troops (an exposed spot)." and "Head starts for the exposed spots: Baron Krell +6, Lady Morwen +6, Queen Isolde +6, Warlord Rusk +5." (the safest spot, Duke Varric's, got none). The province outline (Wild March, then The Lowlands when I picked the attack) went round known land only; the attack panel's odds and the report's words named no cloud land ("2 neutral territories came into view"); a Fate mission named a province I could see. Then Resign: a Marshal took the seat, and the table left the Online list.
- **Found, a third page leak under blackout: the living map draws over the cloud.** The boats bobbing on the sea lanes, the windmills' turning sails, the lighthouse beams, the flags on every capital's castle and the chimney smoke of villages, towns and capitals are sprites over the painting, placed from the map's geometry, so they show through the cloud: three boats and a windmill sat on cloud in my game. A boat marks a sea lane you've never seen, a flag or smoke a settlement (a capital's castle among them). The wire and the bots are clean; the fix is the page's (hide a sprite whose territory, or whose lane's ends, you haven't seen), in 33b's Step 0.
- **Also seen:** after Make a game link the table page is blank for about three seconds while the random map builds (no spinner, no words); it loaded. A loading line is 35's polish. The chat badge on turn 1 was your council's line, as it should be; no Marshal said the cloud line by turn 4 on a 120 (it needs half the map seen).
- **Screenshots read** (`docs/art/screens/s33-*`): the outline at the cloud's edge with "you hold 1 of ?", the turn 1 report, the capital's card, the Rules fold's line. Nothing else in them.
- **The scope held:** nothing of 34's started; the bundle 398.1 KB (the deploy's own check; allowance 398.2); 1,345 tests. The session's three big-map tests were trimmed so the suite runs clean on your laptop; noted for 33b (big maps in tests stay cheap).
- **Nate's calls (Oct 18, evening):** random maps at 80 territories and 4 players get an **income head start** tried in **session 33b** (the most exposed capitals earn more, since their gap is room, not troops); **the Opportunist keeps vulture 0.5** under blackout; **random maps get sizes 300 and 400**, in 33b with the income head start (34 lifts the tables to 10 people and 20 seats on the big maps). Next: **session 33b** (`docs/prompts/claude-code-session-33b.md`), then 34 scale and safety, 35 polish; orchestrator-13 after 35.
