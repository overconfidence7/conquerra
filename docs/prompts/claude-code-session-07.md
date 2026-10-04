# Claude Code: Session 7 (M2 wrap-up: phone layout, chained attacks, amounts as shares)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his phone test, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer: explain choices in plain language and keep setup steps copy-paste simple.

Nate played the private preview on his Android phone. The app installed and the timer auto-locked correctly, but **the installed app showed the desktop layout**. He also asked for two gameplay changes, now decided:
- **chained attacks**
- **amounts as shares** instead of troop numbers

This session does those three, plus one layout fix, then redeploys so Nate can test again.

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (the last three entries)
3. `docs/decisions.md` (newest lines at the bottom, especially the Oct 4 lines on chaining and shares)
4. `docs/rules-reference.md` §3–§6 (turn order, orders, backups and presets, armies)
5. `docs/04-design-additions.md` (presets and the "simple to play" guardrails)

## Step 0: sync
1. `git --no-optional-locks status`. Nate's folder is behind `main`: the orchestrator pushed docs and this prompt.
2. If anything local is uncommitted, stash it and check it against `main` as in session 6.
3. Run `git pull` and `pnpm install`.
4. Work on `main` and push to `main`.
5. If there are new files in `art/incoming/` (Nate may redo the pine trees), run `pnpm art:import` and commit the result.

## Part A: the phone layout in the installed app
Today `GameScreen.tsx` picks the phone layout with `matchMedia("(max-width: 760px)")`. On Nate's phone the installed app came up in the desktop layout.
1. **Find the real cause on the real phone.** Add a hidden diagnostics view (for example, opened by `?debug=layout`, or by tapping the version number in Settings five times). It shows:
   - `innerWidth`, `screen.width` and `devicePixelRatio`
   - `display-mode` (standalone or browser) and `pointer` (coarse or fine)
   - the user agent, and which layout was chosen

   Deploy it and ask Nate to open it on his phone, both in the installed app and in a Chrome tab, and tell you the numbers.
   - Likely suspects: Chrome's **"Desktop site"** setting (it fakes a wide screen), landscape orientation, or a stale service worker serving an old build.
   - Optional: if Nate is comfortable, USB remote debugging (`chrome://inspect` on the laptop, with "USB debugging" turned on in the phone's developer options) lets you look directly. Give him copy-paste-simple steps, and only if the diagnostics view isn't enough.
2. **Fix it robustly.** Choose the layout from a small tested function that considers:
   - the viewport width
   - a touch-first screen (`pointer: coarse` together with a small `screen.width` in CSS pixels)
   - the installed (standalone) mode

   That way a phone gets the phone layout even if the viewport is reported wide.
3. Add **Settings → Layout: Auto / Phone / Desktop**, remembered on the device, as a manual override.
4. Make sure an update reaches the installed app: the "Update ready" prompt appears, and after **Update now** the new layout logic runs.

## Part B: chained attacks (engine, with tests)
The new rule replaces "troops that moved or fought this turn can't move again":
- An army that **moved into or captured** a territory earlier in your order list can **go again from there** in a later order the same turn. **There's no limit** on hops.
- Each hop is its own order and **waits for its own round-robin slot**, so rivals' orders land in between. That's the built-in brake.
- Every hop still **leaves at least 1 troop behind**.
- A failed hop falls back to the territory **it launched from**.
- **If an earlier hop fails or fizzles,** later orders that launch from a territory you no longer hold fizzle, or run their backup.
- Cavalry keeps its edge: it moves 2 territories inside a **single** order.

Also:
- The **"Follow through" preset** stays as the automatic version (the army picks its own next target). Make sure it and manual chains don't double-count the same army.
- Update `docs/rules-reference.md` (§4–§5) in plain language.
- **Tests:**
  - a 3-hop chain resolves in round-robin order
  - a rival's order can land between hops
  - a failed middle hop makes the later ones fizzle (or run their backup)
  - the leave-1-behind rule holds at every hop
  - fog: a chain never reveals more than the player could see
  - the determinism test still passes
- **Bots:** let the Recruit bot chain when it's clearly stronger (keep it simple; smarter bots are session 8).
- **Simulator:** run 1,000+ games before and after, at 2, 4, 6 and 10 players. Report:
  - average and median game length (target 15–25 turns; it was about 26 at 4–6 players)
  - seat fairness
  - a "runaway" check: how often one player holds more than half the map by turn 10

  Don't change the rules on your own. If chaining causes a problem, describe it and give Nate options.

## Part C: amounts as shares
- Moves and attacks send a **share of the army that's there when the order plays**:
  - **All** (always leaving 1)
  - **3/4**, **1/2** or **1/4**
  - **Just enough** (today's smart amount)
- An **exact number** stays available under "More".
- **Engine:** troops become `number | "all" | { share: 0.25 | 0.5 | 0.75 }` (plus whatever "Just enough" needs). Round sensibly: always send at least 1, always leave 1, and test the small-army edge cases.
- **Order builder:**
  - one row of share chips, defaulting to **Just enough** for a first attack and **All** for a chained hop
  - the pill shows an estimate ("about 9, 3/4")
  - for a hop that depends on an earlier battle, the odds pips are marked as an **estimate**
- **Planning a chain on the map:** after you queue A→B, B shows a faint "arriving" marker with the expected army. Tapping B and then a neighbour queues B→C as the next hop. The queued arrows read as one chain (numbered hops).
- Keep a typical turn at **7 taps or fewer**, and count it again.

## Part D: small fix
- **Desktop army panel:** the bottom row (Recruit −, number, +) is cut off at 1440×900 (`docs/art/screens/ui-desktop.png`). It must fit, or the panel must scroll.

## Out of scope
- **Session 8:** smarter bots (holding passes, choke points, sea landings) and the map lab.
- **Sessions 9–13:** generals, the card decks, diplomacy, spies, culture unlocks, the balance pass.
- **M4:** online play.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- Sim results go in `docs/sim-results-m2-chaining.md` (before and after, in plain language).
- **Screenshots:** a 3-hop chain queued on the map (desktop and phone), the share chips, and the diagnostics view.
- `pnpm deploy:preview` passes its lock check.
- Then ask Nate to:
  1. tap **Update now** in the installed app
  2. confirm the phone layout
  3. queue a chain on his phone

  Report what he says.
- `PROGRESS.md`, `docs/decisions.md` and `docs/rules-reference.md` are updated in simple language, with "Claude Code sessions completed" bumped to 7.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the cause of the phone layout problem, and the diagnostics numbers from Nate's phone
- the sim results before and after chaining, and any balance concern
- the tap count for a typical turn
- the screenshot paths
