# art/incoming

This is where Nate drops AI-generated art.

- Use the exact file names from `docs/art/asset-list-and-prompts.md` (for example `terrain-grass.png`, `mountain-1.png`).
- Drop the raw images here, then run `pnpm art:import`. It trims, resizes, makes textures tile, compresses them into `apps/web/public/art/` and tells you what's still missing.
- The raw files are big, so git ignores this folder (only the processed files are committed). Keep a backup of your originals somewhere safe.
- Anything missing shows as a placeholder in the game, so there's no need to finish the list in one go.
