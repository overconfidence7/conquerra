# CLAUDE.md

**Conquerra**: a fantasy, async, simultaneous-turn strategy game (a fresh design inspired by Risk/War.app). Owner: Nate.

## Read first
- `docs/02-game-design-outline.md`: what we're building
- `docs/03-build-plan.md`: architecture, milestones, conventions
- `docs/decisions.md`: decisions log

## Hard rules
- `packages/engine` is pure, deterministic TypeScript: no DOM, Node, Cloudflare, Date.now() or Math.random(). All randomness comes from the seeded PRNG passed in.
- Every engine change ships with tests; the determinism test must pass.
- Balance values live in `packages/content` (JSON + Zod schemas).
- Clients receive only `viewFor(state, playerId)`, never the full state.
- Work one milestone at a time; finish each session with: done / next / questions for Nate.
- Nate is not a full-time developer: explain choices in plain language and keep setup steps copy-paste simple.
