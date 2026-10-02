# CLAUDE.md

**Conquerra**: a fantasy, military-first, simultaneous-turn strategy game (a fresh design inspired by Risk/War.app). Players set queued orders in a 5-minute window (longer timers optional), then everyone watches a shared replay of their visible area. Owner: Nate.

## Read first
- `PROGRESS.md`: where the project stands (add a short, plain-language entry at the end of every session)
- `docs/04-design-additions.md`: latest design (v0.2); wins over 02 where they disagree
- `docs/02-game-design-outline.md`: base design (v0.1)
- `docs/03-build-plan.md`: architecture, milestones, conventions
- `docs/decisions.md`: decisions log
- `docs/prompts/`: session prompts (your current one is the highest-numbered `claude-code-session-NN.md`)

## Hard rules
- `packages/engine` is pure, deterministic TypeScript: no DOM, Node, Cloudflare, Date.now() or Math.random(). All randomness comes from the seeded PRNG passed in.
- Every engine change ships with tests; the determinism test must pass.
- Balance values live in `packages/content` (JSON + Zod schemas).
- Clients receive only `viewFor(state, playerId)`, never the full state.
- Work one milestone at a time; finish each session with: Done / Next / Questions for Nate / Risks (Nate pastes this to the orchestrator).
- Design guardrails: simple to play, deep to master; a basic turn in about 60 seconds, a deep turn within 5 minutes; military first, with light culture (not Civ).
- Nate is not a full-time developer: explain choices in plain language and keep setup steps copy-paste simple.
