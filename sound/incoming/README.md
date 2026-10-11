# sound/incoming

The sound packs the importer reads (`pnpm sound:import`). Not in git (they're large); the game-ready MP3s in
`apps/web/public/sound/` are.

Each pack goes in the folder named in `packages/sound/data/credits.json` (`folder`), unzipped as it came. Where to get
each one (all free, no account needed): `docs/sound/credits.md`.

To replace one sound with a better one, put the new file in `replace/`, named like the file it replaces
(`sfx-battle-1.wav`), and follow "How a sound gets replaced" in `docs/sound/credits.md`.
