# Strategy Game: Market & Player Research

*Prepared October 1, 2026. Background for the design interview and Claude Code build plan.*

## 1. The landscape

| Game | Format | What it does well | Where it falls down |
|---|---|---|---|
| **Classic RISK** (Hasbro, 1957) | Tabletop, 2–6 players | Rules you can teach in 5 minutes; dice odds people *feel*; attacker/defender asymmetry; table drama and "the one army held!" stories | Games run for hours with no natural ending; player elimination leaves people sitting out; card-set escalation decides games late; kingmaking and turtling |
| **RISK: Global Domination** (SMG/Hasbro app) | Mobile/PC/Steam, real-time and async | Official brand; Blitz dice cut out the tedium; lots of themed maps; ranked play | Players believe the dice are rigged; heavy monetization (energy/token limits, $ map packs); allied or multi-account teams; AI that seems to cheat; crashes and frozen timers |
| **War.app** (formerly Warzone/WarLight, Randy Ficker) | Web, iOS, Android, all cross-play | Huge rule customization (fog of war levels, luck %, cards, bonus overrides); **simultaneous turns**; user-made maps (thousands); multi-day *and* real-time; clans, ladders, tournaments, mods; mostly free | Steep learning curve and settings overload; dated UI; players booting (timing out) instead of surrendering; premium paywall on autopilot and mods; matchmaking for newcomers is uneven |
| **Conquer Club / Dominating12** | Web, async Risk clones | Long-running communities; ranked play, team games, many maps; fast setup | Old-school web UX; collusion and multi-accounting a constant worry; small, ageing player base |
| **Diplomacy** (and webDiplomacy, Backstabbr) | Async, 7 players, no dice | **Simultaneous secret orders**; pure negotiation; deep tactics; one move a day suits busy adults | Betrayal is the whole game, which feels bad to many; long commitment; dropouts wreck a 7-player game |
| **Supremacy 1914 / Call of War** (Bytro) | Browser/mobile, real-time over weeks, up to 100 players | Persistent maps and big alliances; play in short check-ins | Pay-to-win ("gold"); real-time means waking up to find you lost while you slept; inactive players hollow out maps; weak support |
| **Polytopia** | Mobile/PC, turn-based 4X | Tiny, readable maps; 30-minute games; async with friends; strong art direction | Faction balance complaints; weak matchmaking and lobbies |
| **Civilization / 4X genre** | PC, long turn-based | Depth, tech trees, "one more turn" | Multiplayer takes forever, desyncs; late-game snowball where the winner is obvious hours before the end |
| **Risk 2210 / Godstorm / Risk Legacy / Risk Express** | Tabletop variants | **Turn limits** (5 years / 5 epochs) give a dramatic arc; commanders and command cards add choices beyond dice; Legacy creates a persistent, evolving world; Express plays in 30 minutes | Box-bound; can't scale or be played online |
| **Root / Twilight Imperium / Axis & Allies** | Tabletop | Asymmetric factions (Root); politics and long-form epics (TI); unit types and economy (A&A) | Asymmetry is expensive to build and balance; very long playtimes |

## 2. What keeps people coming back

1. **Rules anyone can learn fast, with real depth underneath.** Risk's one-page rules are its biggest strength, and every successful clone kept them.
2. **The swing moment.** Dice give dramatic upsets and the stories people retell. Players want luck, but enough control that they don't feel *robbed*.
3. **Diplomacy and table talk.** Informal alliances, threats and betrayal are the emotional core, even in games without formal diplomacy rules.
4. **Playing on their own schedule.** Async play (one turn a day) is what made Diplomacy, War.app and Conquer Club last for decades with busy adults.
5. **Variety.** New maps, scenarios and rule settings. War.app's user-created maps are its moat.
6. **Community and competition.** Ladders, clans, tournaments, seasons and visible ratings.
7. **Readable, at-a-glance boards.** Polytopia proves a clean, attractive map sells the game.

## 3. Top complaints (the opportunity)

| # | Complaint | Seen in | Design implication |
|---|---|---|---|
| 1 | **Games never end / drag on** | Classic Risk, Civ, Supremacy | Hard turn or round limits, objective/score victory, comeback-resistant endgame trigger |
| 2 | **"The dice are rigged"** | RISK: GD (constant), every digital clone | Provably fair RNG (seeded, published after the game), optional reduced-luck modes, show roll history and odds before attacking |
| 3 | **Player elimination = sitting out for hours** | Classic Risk, Diplomacy | Short games, spectator/"ghost" roles, eliminated players keep a stake (bounty, influence), or no elimination at all |
| 4 | **Collusion, secret teaming, multi-accounts** | RISK: GD, Conquer Club | Account integrity (verified sign-in, device and behavior signals), formal in-game alliance mechanics so teaming is visible and has rules, team modes for people who want to team |
| 5 | **Quitters and timeouts ("booting")** | War.app, Diplomacy | AI takeover of abandoned seats, reliability score that affects matchmaking, vacation mode for async play |
| 6 | **Pay-to-win and aggressive monetization** | RISK: GD, Supremacy, Call of War | Cosmetic-only or subscription monetization; never sell power |
| 7 | **Cheating or brain-dead AI** | RISK: GD, 4X games | AI that follows the same rules with no hidden bonuses, labeled difficulty tiers |
| 8 | **Snowball: the winner is obvious long before the end** | Risk, Civ, 4X | Catch-up mechanics, rising cost of holding territory, shared threats, scoring that rewards more than sheer size |
| 9 | **Too complex, settings overload, bad onboarding** | War.app, TI, Civ | Strong defaults, curated modes, interactive tutorial, unlock complexity gradually |
| 10 | **Weak matchmaking and lobbies** | Polytopia, War.app, RISK: GD | Rating-based matchmaking, quick match, filters, private friend lobbies with invite links |
| 11 | **Real-time punishes people with jobs** | Supremacy 1914, Call of War | Async-first with turn deadlines; real-time as an optional mode |
| 12 | **Bugs, crashes, frozen timers** | RISK: GD, Supremacy | Server-authoritative design, reconnect handling, deterministic engine with tests |

## 4. Gaps no one fills well

- A **modern, polished, fair** Risk-like game. Everyone has either the brand (Hasbro/SMG) or the depth (War.app), but not clean UX, fairness and depth together.
- **Built-in, visible diplomacy** (proposals, treaties, timed non-aggression pacts) instead of side chats and Discord.
- **Short, dramatic games with a guaranteed ending** (Risk 2210's five-turn arc) played online.
- **Simultaneous turns for 6+ players** that keep everyone engaged instead of waiting.
- **Friend-group play** as the core, not an afterthought: a private game in two taps from a shared link, a persistent "season" among friends (light Legacy-style).

## Sources

- [War.app](https://war.app/) and its [Jan 2019 booting update](https://war.app/blog/index.php/2019/01/)
- [Warzone on TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Warzone)
- [RISK: Global Domination app reviews](https://justuseapp.com/en/app/1051334048/risk-global-domination/reviews)
- [RISK: GD Steam discussion on teaming and cheating](https://steamcommunity.com/app/1128810/discussions/0/1744521150310827505)
- [Cardboard Republic: Variant Risk](https://cardboardrepublic.com/?p=497)
- [There Will Be Games: Risk, the greatest Ameritrash game](https://therewillbe.games/articles-analysis/3407-risk-the-greatest-ameritrash-game-ever-made)
- [Meeple Mountain: Top 6 Risk games](https://www.meeplemountain.com/top-six/top-6-risk-games/)
- [Tildes: Diplomacy players discussion](https://tildes.net/~games.tabletop/16fg/any_diplomacy_players_here)
- [Supremacy 1914 Trustpilot](https://ca.trustpilot.com/review/supremacy1914.com)
- [Polytopia review summary](https://vaporlens.app/app/874390/the_battle_of_polytopia)
- [Cole Wehrle on asymmetric design](https://justingarydesign.substack.com/p/cole-wehrle-cute-creatures-brutal)
