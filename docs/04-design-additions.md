# Design Additions v0.2 (from Nate, Oct 2)

*Nate's new ideas, organized, with the planner's take. Items marked **DECIDE** need Nate's call before they go into the build.*

## 0. The guiding rule: "simple to play, deep to master"
- A new player should be able to finish a turn in about a minute using defaults and one-tap presets.
- An experienced player uses the full **5-minute** order window for deeper plays.
- Depth comes from how a few simple systems combine, not from more menus.
- **Test for every feature:** does it add a decision without adding a screen? If it needs its own complicated screen, simplify it or cut it.

## 1. Turn rhythm (correction)
- **Order phase: 5 minutes.** Everyone sets orders at the same time. Lock in early to speed things up.
- **Replay phase:** everyone watches the turn play out together. You see full detail in your visible area; fogged areas show only surface details ("a battle happened somewhere in the north").
- Implications:
  - A 20-turn game is about 2 hours, plus replay time. The early prototype's 80–110-turn games would be 7–9 hours, so the balance target is now **about 15–25 turns**.
  - The hosting choice still fits: Cloudflare Durable Objects run the 5-minute timers with alarms and push live updates over WebSockets.
- **DECIDED (Oct 2):** 5 minutes is the default. The host can set longer turn timers for extended campaigns.

## 2. Diplomacy: menu of preset deals
- Deal types are pre-built cards you click through:
  - border truce (specific territories, or a whole province or region)
  - trade land for land
  - trade resources for land
  - coordinated attacks ("you hit X, I hit Y")
  - multi-turn team-up
  - non-aggression until a condition is met
- **Counteroffers:** one tap to tweak the terms and send back.
- **Offer length:** an offer expires after 1 turn, or is an ongoing negotiation either side can end any time.
- **Anti-exploit rule (Nate's):** if a turn resolves while a deal is still pending, both sides must re-confirm before it takes effect. You can't accept an offer *after* attacking someone so they can't hit back.
  - Planner's version: a deal only takes effect if both sides confirm during the same order phase. Any attack between the two players during the replay voids every pending offer between them.
- Binding vs. handshake deals and scaled break penalties carry over from v0.1.

## 3. Contingency presets
- Order backups come from a short list of one-tap templates instead of being built by hand. Examples:
  - **Only if still stronger:** attack only if my odds are still at least "likely."
  - **Hold if threatened:** cancel the attack if an enemy stack next to my launch point grew.
  - **Retreat if outnumbered:** pull back to the nearest safe territory.
  - **Follow through:** if the capture succeeds, push on to the next target.
  - **Reinforce if hit:** if this territory was attacked earlier this turn, send reserves.
- Players pick a preset and the game fills in the details. Building a custom condition stays available behind an "Advanced" toggle.

## 4. Generals: commanders you give instructions to
- Generals are AI commanders. You give them a standing instruction; each turn they write their own orders, which resolve in the same turn cycle as everyone else's.
- Example instructions:
  - "Hold this region; send me 10% of its income." The general keeps 90% to strengthen it.
  - "Expand east."
  - "Defend this border."
  - "Raid enemy land."
- Capturing other players (or their capitals) gives you their generals, so a growing empire can still be run inside the 5-minute window.
- **Planner's take:** this is the best idea in the batch.
  - It solves the late-game problem in every Risk-like game: too much board to manage in the time you have.
  - It reuses the same bot AI that plays opponents and takes over for quitters, so we build one brain and use it three ways.
  - Risk 1: if generals make bad calls, players will feel cheated. They need to be good, and their instructions must be clear.
  - Risk 2: power creep. More generals means more free actions, so cap them or give them upkeep.
- **DECIDED (Oct 2): your Leader is a general.**
  - You can order your Leader's army directly, or hand it a standing instruction and let it command itself.
  - Capturing other players (or their capitals) adds their leaders to your roster as generals.

## 5. Military vs. culture
- Income can go to **military** (troops, forts) or **culture**.
- Culture protects against events (uprisings, plague, storms) and against the Fallen's revenge events, and it boosts holding bonuses.
- Going all-military is faster but leaves you exposed.
- Culture you build up can be captured. Someone who invested in culture risks a military player taking over and reaping the benefit.
- **Planner's take:** this creates a real strategic choice ("tall vs. wide") and gives the Fallen system a counterweight. Keep it to **one culture number per territory**, not a separate tech tree, or it bloats.
- **DECIDED (Oct 2): military and conquest first, with a cultural flair.** Culture must stay light; this is not Civilization. No culture victory, no culture tech tree.

## 6. Cards: three systems, consolidation suggested
Nate's three ideas:
1. **Holding rewards:** a bonus for each territory, a bigger one for a whole province ("country"), and more if you've invested culture there. Conquerors inherit them.
2. **Spoils cards:** Risk-style cards earned by conquering, stacking up until you turn them in for a windfall. There's a small luck element, and the rewards vary: troops, a fort, culture.
3. **Fate deck:** one draw per turn. Either an instant event, with surface details only for players under fog, or a mission, with an expiry and offensive, defensive or culture rewards.

**Planner's suggestion:** keep these as **two decks plus passive bonuses**:
- **Holding bonuses** are shown on the map, not as cards, so there's nothing to manage.
- **Spoils** (earned).
- **Fate** (drawn): events and missions. The **Fallen** can influence Fate draws, which links the revenge system to the deck instead of a separate menu.
- **DECIDED (Oct 2): two decks plus map bonuses.**
  - Holding bonuses (territory, province, culture) show on the map.
  - **Spoils** cards are earned by conquest and turned in for a windfall.
  - **Fate** cards are drawn each turn.
- **Fate draw (DECIDED):** every player draws one card per turn.
  - **Events** land on a completely random spot on the board, not necessarily near the player who drew them. Most are mildly good or bad; a few are very good or very bad. Players under fog see only surface details.
  - **Missions** go to the player who drew them.

## 7. Troop types: the analysis Nate asked for (DECIDE)

**Option A: one troop type** (like Risk and War.app)
- ➕ Fastest orders ("move 10 to X"). Easiest map to read. Easiest to balance. Best fit for 5-minute turns and 50-player games.
- ➖ Less tactical flavor. Every fight is a numbers game, so positioning and economy carry all the depth.

**Option B: three types in a rock-paper-scissors** (infantry, cavalry, siege; what the prototype has)
- ➕ Real composition choices, counters and scouting value. Feels distinct from Risk.
- ➖ Every recruit and every move needs a "how many of each" choice, which slows turns.
- ➖ Each stack shows three numbers, so the map is harder to read.
- ➖ Balancing triples in difficulty, and it gets worse with factions.
- ➖ Bots and generals must reason about composition.
- ➖ The 5-minute budget suffers most here.

**Option C: troops + specialists (recommended)**
- Every army is one number of **troops**. That's what you recruit and move 95% of the time.
- Armies can also carry **specialists**: a few one-off attachments you buy and assign to a stack (max 1–2 per army). Each specialist is a visible badge on the stack:
  - **Cavalry:** the stack can move 2.
  - **Siege:** breaks forts.
  - **Scouts:** see further into fog.
  - **Engineers:** build a fort in 1 turn.
  - **Healers:** fewer losses.
- ➕ Orders stay fast; specialists travel with the stack automatically. The map stays readable (a number plus icons). Depth emerges naturally ("their stack has siege, my fort won't hold"). Bots and generals stay simple. It's easy to add faction-unique specialists later.
- ➖ Less granular than full unit types, and specialists need clear rules for capture and loss.

**Option D: one troop type, flavored by factions and terrain**
- ➕ Simplest of all.
- ➖ Too close to Risk, which works against the "less predictable" goal.

**DECIDED (Oct 2): Option C, troops + specialists.** Players get specialists three ways:
- buy them with gold at a barracks
- a little culture in a province unlocks the fancier types
- Spoils cards sometimes give one free It matches "simple at first, deep later" and the 5-minute turn, and it plugs neatly into generals, cards ("Spoils: a free Siege specialist") and factions.
