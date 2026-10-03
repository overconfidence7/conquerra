# art/incoming

This is where Nate drops AI-generated art.

- Use the exact file names from `docs/art/asset-list-and-prompts.md` (for example `terrain-grass.png`, `mountain-1.png`).
- Drop the raw images here, then run `pnpm art:import`. It trims, resizes, makes textures tile, compresses them into `apps/web/public/art/` and tells you what's still missing.
- The raw files are big, so git ignores this folder (only the processed files are committed). Keep a backup of your originals somewhere safe.
- Anything missing shows as a placeholder in the game, so there's no need to finish the list in one go.
- The import also **makes the art match**: it evens out big light and dark patches baked into ground textures, and nudges every texture and every sprite family (trees, mountains, hills, settlements) toward one colour and contrast. The targets are in `packages/art/src/palette.ts` (edit the numbers to taste, then re-run the import). `pnpm --filter @conquerra/art exec tsx scripts/match-preview.ts` makes a before/after picture.
