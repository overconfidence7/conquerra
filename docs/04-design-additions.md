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
- **DECIDED (Oct 2): Leaders don't stay dead.** A fallen Leader comes back for free at the start of its owner's next turn, at the capital (or the strongest territory if the capital is lost). Eliminating a player adds their Leader to your pool as a general.

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
- Spoils cards sometimes give one free

It matches "simple at first, deep later" and the 5-minute turn, and it plugs neatly into generals, cards ("Spoils: a free Siege specialist") and factions.
- **DECIDED (Oct 2):** specialists are **lost** when their army is destroyed. They are never captured.

## 8. Fog of war and spies (DECIDED, Oct 2)

### Fog (lobby setting; on by default)
- **You see full details** on your own territories and the territories bordering them: owner, troops, specialists, culture, buildings, leaders.
- **Everywhere else you see only the map:** territory and province outlines, terrain, and the holding bonuses each territory and province is worth. You do **not** see who owns it, troops, culture or anything else.
- The replay follows the same rule: full detail where you can see, surface details elsewhere ("a battle in the north").
- Scouts (the specialist) extend what an army can see. Spies, below, are the way to see deep behind the lines.

### Spies
- **What a spy is:** a specialist that can travel on its own (not attached to an army). Bought with gold. **Each player can have only a few** (start at 5, tunable).
- **Traveling:** while moving through land that no single player fully holds, a spy lifts the fog **2 territories** around itself.
- **Infiltrating a country (province):** a spy can enter a country to spy on it. While it stays there, the fog stays lifted for that whole country **every turn**, until the spy is killed or recalled, or the defense changes.
- **Defending:** only a player who holds an **entire country** can defend it, by stationing spies at its capital. Defenders hold the position and also block other spies.
- **Spy vs spy (max 3 spies per side per country):** compare defenders to attackers. Each attacking spy beyond the first cancels one defender. What's left decides the outcome:

| Defense left | What happens to the incoming spy |
|---|---|
| 0 (no defenders, or cancelled) | **Infiltrates:** the attacker sees the true state of the whole country |
| 1 | **Blocked:** the attempt fails and the spy returns |
| 2 | **Killed:** all attacking spies in that attempt die |
| 3 (only 3 defenders vs 1 spy) | **Fooled:** the attacker *thinks* they got in, but sees false information that's close to the truth. The owner is correct, but troop counts, culture, leaders and positions are wrong or moved. The attacker isn't told. |

  - Examples: 2 defenders vs 1 spy = killed. 2 defenders vs 3 spies = 0 left = infiltrates. 3 defenders vs 2 spies = 2 left = killed. 1 defender vs 2 spies = infiltrates.
- **Spies do not affect combat.** Forts are Siege's job; spies are purely about information.
- **Design note:** this gives holding whole countries a second payoff (spy defense), and makes the 3-defender deception a real mind game. Because the fake intel is generated from the true state with the seeded RNG, it stays deterministic and replayable.
- **Open for the M3 build (orchestrator/Claude Code proposes, Nate approves):** spy movement speed, cost and the exact cap; whether "recall" is instant; and whether the defender learns that a spy was blocked or killed (planner suggests: yes for blocked and killed, no for fooled).

## 9. Maps: real geography (from Nate, Oct 2)
- **Look and feel:** like War.app and the better Risk variants. Territories have organic, irregular borders, not hexes or straight-edged cells.
- **Obstacles shape the fighting:**
  - **Seas and lakes:** not territories. Crossing water uses a **sea lane** drawn on the map, and only where one exists.
  - **Mountain ranges:** impassable, except through a **pass**.
  - **Rivers:** drawn along borders; attacking across one is harder (already in the rules).
- **Choke points on purpose:** every map should have a few places (passes, narrow land bridges, sea lanes) where a small army can hold off a big one. That gives forts, siege and positioning real meaning.
- **Map maker:** maps come from a seeded map maker (same seed, same map), then get hand-tuned names and touches. Because it's seeded, **random maps on the spot** become a lobby option later.
- **Later, with the big game modes (M5):**
  - **Random maps** generated when the game starts.
  - **Blackout fog** (a lobby option, likely for massive games): anything not next to your land is completely hidden, including the map itself, until you explore it. Standard fog, which shows the geography but not who holds it, stays the default. (Look: standard fog is desaturated land with drifting mist; blackout fog is thick painted clouds. See `docs/06-art-direction.md`.)
