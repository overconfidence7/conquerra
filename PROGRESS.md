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
**Phase: M2 (playable browser game vs bots): session 2 done; session 3 (replay, timer, phone layout, private preview) next.**

Claude Code sessions completed: **2** (a new orchestrator prompt is due after sessions 3, 6, 9, ...)

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
