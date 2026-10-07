# Claude Code: Session 18 (M3: leaders you delegate to)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**Why this session:** in Nate's play test, "the captured leaders and my own leader don't seem to do much with the orders I give them", and "I played the whole game without building a building or doing any culture". His redesign (`docs/04-design-additions.md` §4, "REDESIGN"): **two leaders from the start**, your named **Leader** (military) and a **Steward** (culture, buildings, the economy); each gets a **budget** every turn into its **own visible purse** and can save up; a **much larger command list**, up to running your whole military or all your building; and they're **very good at it**, because they plan with **the Marshal's brain** (session 17's `planMarshal`, which already takes a scope and a purse). Captured players give you both of their leaders. This replaces "generals never spend gold" and "Govern this province"'s income share.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 4 ends with the deploy, so the session is complete there.**

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: Nate's play test of sessions 11–15 (notes 1, 9 and 15 especially), the reviews of sessions 16 and 17, and "Things to test after session 18"
3. **`docs/04-design-additions.md` §4 (generals, and the "REDESIGN" block: the decisions for this session)**, §11 (the Marshal), §0 (simple to play, deep to master)
4. `docs/decisions.md`, newest lines at the bottom
5. `docs/rules-reference.md` §14–15 (generals and captured generals as they are today, including Govern), §13 (bots), §8 (gold and unrest)
6. `docs/sim-results-m3-marshal.md` (what wins)
7. The code: `packages/bots/src/marshal/plan.ts` (`planMarshal`, scopes), `generals.ts`, `generalSeat.ts`, and how the host writes generals' orders as planning starts

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Don't import art batch 4** (it's in `art/incoming/`): session 20 does it.
3. **Commit and push** if anything changed.

## The design (orchestrator's defaults where Nate didn't say; numbers in `packages/content`)
- **Two leaders from the start:** your **Leader** (military; it stands on the map with an army, as today, and keeps its +20% in battle) and your **Steward** (culture, buildings, forts, the economy; it doesn't stand on the map).
  - **You name your Leader in the lobby** (a sensible name is filled in; Nate: "that would be a fun thing to do"). Naming the Steward is optional, in the same place.
  - Bots' leaders get names too (generated from the game's seed).
- **Captured leaders:** knocking a player out gives you **their Leader and their Steward**. Nate's example: take over two players and you command three military leaders and up to three Stewards. The cap rises to **4 of each kind** (`rules.leaders.maxOfKind`). With one too many, you choose who goes, as today. Captured Leaders still add no +20%; a captured military leader is lost if its army is wiped out or its land taken (as today); Stewards can't be lost.
- **Budgets and purses:**
  - Each leader has a **purse** you can see. Each turn, as income comes in, it receives its **budget**: a share of your income (for example 20%) or an exact amount (for example 8 gold), your choice per leader.
  - **It can save up:** unspent gold stays in the purse. You can take gold back into your treasury at any time (one tap), and the purses count as yours when you can't pay upkeep (they pay before anyone deserts), so they can't be used to dodge costs.
  - **Defaults:** your Steward starts on **"Run the realm" with 20% of your income**, so building and culture happen even for a player who never opens the menu (Nate never built anything). Your Leader starts with no command and no budget: you order its army, as today. Captured leaders arrive with no command and no budget.
  - The top bar's gold shows your treasury; the leaders' purses show in the Leaders panel (and their total next to the treasury, smaller).
- **Commands** (menus inside menus where needed; Nate: "the list of commands should be larger"):
  - **Military leaders:**
    - **Hold here**, **Defend this border**, **Push toward a place**, **Raid a rival** (as today, now planned by the Marshal and able to recruit from the purse)
    - **Expand our empire in this direction:** pick a target territory. The leader moves out that way, **chaining through easy, undefended land quickly**, or **pushing the border out slowly where it's contested**; **not in a straight line**: it takes and secures **whole provinces** on the way (Nate's words).
    - **Command this front:** you mark a stretch of the map (pick provinces); the leader commands every army of yours there and recruits for it.
    - **Run the military:** every army and all the recruiting.
  - **Stewards:**
    - **Build up this province** (forts, markets and barracks where they help; this replaces "Govern this province")
    - **Fortify this frontier** (forts and garrisons where you're most threatened)
    - **Raise culture here** (a province)
    - **Grow the economy** (markets and culture where they pay most)
    - **Run the realm** (all building and culture)
- **They're very good at it:** every command is planned by `planMarshal` with the right scope and the leader's purse, from your view only (no cheating), and a leader writes **several orders a turn** where it fits (chains of attacks or moves, building in several places).
- **Overlaps:** a narrower command wins over a wider one for the armies or places it covers (a "Command this front" leader keeps its front even if another leader runs the military). Only one "Run the military" and one "Run the realm" at a time.
- **Your orders come first:** an order of yours for an army or a place takes it back from the leader for that turn, as today.
- **Seeing their orders:** leaders write their orders into **your order queue**, each marked with the leader's portrait, and you can edit or delete any of them. A setting (Nate's toggle) chooses where they go: **mixed in with yours** (taking turns, one of yours then one of theirs) or **after yours**. Default: mixed in.
- **Saves:** existing generals become military leaders with their instruction; a governing general's progress goes back into its purse. Migrate, and keep the old fixtures loading.
- **Bots** don't need leaders (the Marshal already plans the whole realm), but they keep the leaders they capture so a knocked-out bot's leaders can be captured from them.

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **No cheating:** leaders plan only from your view. The fog tests cover them.
- **Gold is still the only resource.** A purse is your gold, set aside.
- **Simple to play:**
  - A basic turn is still about 6 taps on a 384 px phone (run `tap-count.mjs`).
  - **Give a leader a common command and a budget in about 5 taps or fewer** (for example: the leader, Command, Expand toward, a territory, Confirm). Report the taps for each command.
  - A player who never touches the leaders still has a Steward quietly building at 20%.
- **Your Leader's +20% stays with your own Leader only.**
- **Speed:** all the leaders' plans for one player stay well under 50 ms a turn at 10 players on Wyrmland.

## Part 1: leaders, Stewards, budgets and purses (the engine)
- The leader model: your Leader and Steward from the start, names, captured Leaders and Stewards (up to 4 of each), purses, budgets (a share or an exact amount), the purse paying for its leader's orders, taking gold back, purses counting toward upkeep.
- The command data for every command above (with its scope: a place, a target, a set of provinces, or everything).
- The save migration from generals and Govern.
- Report, replay and Chronicle lines in plain words ("Your Steward, running the realm, finished a market at Pinemark (6 gold)"; "Your Leader, Aldric, expanding toward Old March, took three territories").
- **Tests:** budgets in both forms, saving up, taking gold back, upkeep drawing on purses, capture of both leaders, the cap of 4 and the choice, the migration and the old fixtures, determinism.
- **Commit and push.**

## Part 2: leaders that plan with the Marshal
- Each command calls `planMarshal` with its scope and purse, and writes several orders where it fits.
- **Expand our empire in this direction:** build it carefully, since it's Nate's own idea. Fast through empty, weak land with chains; slow and safe where the border is contested; take and hold whole provinces on the way rather than a thin line; stop and hold when the target is reached.
- **Command this front** and **Run the military**, with recruiting from the purse.
- **The Steward's commands,** spending the purse on forts, markets, barracks and culture where they help most (the Marshal's judgement on what pays).
- Overlaps, and your orders coming first.
- **Sims** (add a "delegating player" seat to the sim that hands everything to its leaders):
  - a seat whose Leader runs the military and whose Steward runs the realm (budgets 100% split between them) against Marshals: it should win close to its fair share (the leaders are as good as a Marshal)
  - a seat that plays like the Captain but has the default Steward at 20%: does it build and raise culture now, and how does it fare?
  - report how many orders leaders write a turn
- **Tests** for each command (it does what it says on small made-up maps), the overlap rule, no cheating, determinism.
- **Commit and push.**

## Part 3: the screens
- **The lobby:** a name field for your Leader (and your Steward, optional), filled in with a sensible name.
- **A Leaders panel** (desktop: the right column, replacing the single Leader card; phone: a sheet, opened from your Leader's portrait): every leader with its portrait, name, kind, command, purse and budget. The Steward shows its House's shield with a quill until Steward portraits are made.
- **Command menus:** the leader, **Command**, a category (Military: Hold, Defend, Push, Raid, Expand, Front, Run the military; Steward: Build up, Fortify, Culture, Economy, Run the realm), then the place, target or provinces on the map, then **Confirm**. Menus inside menus are fine (Nate), but keep the common ones short.
- **The budget control:** a share (chips: 0, 10, 20, 30, 50%) or an exact amount (a number), plus **Take back** for the purse.
- **Their orders in your queue** with the leader's portrait, and the "Leaders' orders: mixed in / after mine" setting (in Settings, and as a small switch at the top of the queue).
- **On the map:** each military leader's portrait on its army (as today); while a leader is selected, its command's area or target is outlined.
- **Tests** for the page logic, and tap counts.
- **Commit and push.**

## Part 4: write-up, screenshots, deploy
- **Rules reference:** rewrite §14–15 as "Leaders and Stewards", and update §13 and "Not in yet".
- `docs/sim-results-m3-leaders.md`: the sims from Part 2.
- **Screenshots** (desktop and a 384 px phone), in `docs/art/screens/s18-*.png`: the lobby's name field, the Leaders panel, the command menus, an "Expand toward" command with its target outlined, the budget control, the queue with leaders' orders mixed in.
- `pnpm deploy:preview` passes its lock check.
- **Add to "Things to test after session 18"** in `PROGRESS.md` (under "From session 18"), for example: name your Leader; give it "Expand our empire in this direction" and watch it work; give your Steward a bigger budget and see what it builds; capture a player and command their leaders; try "Run the military" for a few turns; the mixed-in / after-mine setting.
- **Commit and push.**

## Out of scope
- **Session 19:** bigger maps (about 160 and 200 territories) and the balance pass: culture and buildings that pay (three levers; Nate picks), the small-map snowball (bots first), the Fallen acting from their first turn out, length, seat fairness, a speed check before M4.
- **Session 20:** the polish pass and art batch 4 (including Steward portraits only if a later art batch makes them).
- **M4:** online play.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` twice before your last push** (property tests use random inputs), and ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- `docs/sim-results-m3-leaders.md`, the screenshots, and `pnpm deploy:preview` with its lock check.
- **Nate's play test comes after this session.** Make sure "Things to test after session 18" is complete.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **18**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the commands as built (one line each), and any defaults you changed and why
- how "Expand our empire in this direction" behaves, in three lines
- the sims: the fully delegating seat against Marshals, and the default Steward's building and culture
- tap counts for each command, and the start-up bundle, before and after
- the screenshot paths
