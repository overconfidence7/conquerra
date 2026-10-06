# Conquerra art session 4: batch 4 in Gemini (for the polish pass)

Paste this into a new Claude chat on Nate's computer, with the project folder and the Downloads folder connected. You (Claude) are making Conquerra's fourth art batch: effects for the replay, key art, the new specialists and spies, and fixes to the map's scenery. Use **Claude in Chrome** to drive Nate's Gemini (he pays for it; Chrome is open and signed in). Review every image yourself, and keep only the ones you're happy with.

**Why this batch matters:** Nate wants Conquerra to look like a large team with a good budget made it. This batch feeds the polish pass (`docs/09-polish-and-effects-plan.md`): armies that march and kick up dust, battles in smoke and flame, banners raised over captured land, storms and plague on the map, a cinematic replay and real title and game-over art. Hold every image to that bar: rich, painterly, consistent with the art already in the game, never cartoonish or generic.

## Before you start
The batch 4 list and this prompt were pushed to GitHub on Oct 6. Check that `docs/art/asset-list-and-prompts.md` in the project folder has a "Batch 4" section under Tier 3. If it doesn't, ask Nate to update the folder first: open a terminal in the project folder and run `git pull` (or ask Claude Code to do it). Don't edit the docs yourself.

## Where things are
- **Project folder** (on Nate's computer): `C:\Users\nkurt\Claude\Projects\Strategy Game`.
- **What to make:** "Batch 4" under **Tier 3** in `docs/art/asset-list-and-prompts.md`, about 50 files in six numbered groups. That section has the exact file names, backgrounds and prompts. The top of the file has the **style line**, the angles, the magenta rule and the Gemini lessons (from batch 3 too). Read the whole file first, then `docs/09-polish-and-effects-plan.md` to see what each piece is for.
- **Where approved art goes:** `art/incoming/<exact name>.png`, saved as **PNG**. Redo items **replace** the old file of the same name. Before you overwrite one, move the old file into `art/incoming/_old/`.
- **`art/incoming/_source-map.txt`** lists which Gemini download became which file. Append to it.
- **Downloads:** Gemini saves to `C:\Users\nkurt\Downloads` as `Gemini_Generated_Image_*.jpg` (JPG, usually 2048×2048). Ask Nate to connect Downloads if it isn't already.
- **References:**
  - `docs/art/reference-mockup.png` (the realistic target)
  - `docs/art/reference-illustrated.jpg` (the painted feel)
  - `docs/06-art-direction.md`
  - the art already in `art/incoming/` (for colour and style matching)
  - today's game: `docs/art/screens/s15-*.png` and `s14-*.png`

## Order (most important first)
1. **Redo:** `terrain-hills`, `tree-conifer-1` and `-2`, `scaffold`, `bridge-wood`.
   - For the pines, attach `tree-broadleaf-1.png` as the colour reference. Put each new pine beside a broadleaf in PIL: the greens must match (warm, not blue).
   - Tile the hills texture 3×3 in PIL before you approve it: no repeats, no big shapes, mostly green.
2. **The new specialists and spies:** `icon-rangers`, `icon-standard-bearer`, `icon-spy`, `figure-rangers`, `figure-standard-bearer`, `figure-spy`. Put each icon next to the existing icons (`icon-cavalry.png`, `icon-healers.png`) at 24 px and 64 px: same rim, weight and finish.
3. **Effects for battles:** `fx-smoke-1` … `-3`, `fx-dust-1` and `-2`, `fx-flame-1` … `-3`, `fx-impact` (all on **black**), then `fx-arrow` and `fx-stone` (magenta).
4. **Effects for events, deals and the map:** `fx-splash`, `fx-wisp-1` and `-2`, `fx-lightning-1` and `-2`, `fx-crack` (black); `fx-storm-cloud`, `fx-rock-1` and `-2`, `fx-coin`, `fx-leaf`, `fx-wheat`, `fx-scroll`, `fx-birds`, `landmark-windmill-body`, `landmark-windmill-sails` (magenta).
5. **Key art:** `art-title`, `art-victory`, `art-defeat` (Gemini's widest ratio).
6. **Scenery additions:** `peak-narrow-1` … `-3`, `ridge-diag-1` and `-2`, `cliff-side-1` and `-2`, `fringe-bush-1` … `-3`, `glade-1` and `-2`, `paper-grain`.

If you run low on usage, stop after a numbered step and report. Anything missing waits for a later batch; the game keeps today's drawing for it.

## The look (non-negotiable)
- Semi-realistic, richly detailed hand-painted fantasy campaign-map art, like the terrain in the realistic mockup.
- Natural earthy palette, fine painterly texture, soft daylight from the upper left, depth from shading.
- **Not cartoon:** no black outlines, no flat fills, no candy-bright colours, no blobby shapes, no text.
- **Magenta pieces:** one object, centred, generous margin, on a flat pure magenta (#FF00FF) background filling the image, no ground plane, no shadow on the background.
- **Black pieces (soft effects):** one effect, centred, on a **pure black (#000000)** background filling the image, with soft edges fading smoothly into the black and nothing touching the image's edges. Smoke, dust, mist, lightning and cracks are **white, grey or pale** (the game tints them); flames keep their natural colours. The game turns the brightness into transparency, so **anything that isn't the effect must be pure black**: no ground, no sky, no glow across the whole frame, no vignette.
- **Angles:**
  - textures (hills, paper): straight top-down
  - trees, bushes, glades: almost directly overhead
  - everything else on the map: three-quarter view, camera about 45° down
  - icons, the scroll, the windmill sails: front view
- **Wide pieces** (ridges, cliffs, the storm cloud, the scroll, key art): the widest aspect ratio, or 1:1 with the object clearly wider than tall. Tall pieces (narrow peaks, side cliffs, flames, lightning): 1:1 with the object clearly taller than wide.
- **Reject:**
  - repeating grids or stripes
  - detail bunched at edges or corners
  - close-up scale
  - side-on views where overhead is wanted
  - pieces of earlier images bleeding in
  - for black pieces, any background that isn't truly black (check the corners and the edges in PIL: every edge pixel below about 12 in each channel)

## How to run Gemini (lessons from batches 1–3)
1. **Load the tools:** load the Chrome tools in one ToolSearch call (include browser_batch, javascript_tool, find and file_upload). Run `tabs_context_mcp` first, and work in a new tab.
2. **Start a fresh Gemini chat for each numbered group,** and another one after about **6 images**: in long chats the magenta drifts darker and Gemini starts editing instead of drawing. Open the + menu, then choose **Create image** by element, not by position (one position click opened Deep Research). Set the aspect ratio for the piece.
3. **Attach style anchors** in the first message of each chat. The hidden file inputs only exist while the + menu is open: open it, `find` the file input, then use `file_upload`.
   - Use `reference-mockup.png` plus two approved pieces that **don't share a subject** with what you're making (see `_source-map.txt`; the forest texture and the foot-soldier sprite worked well).
   - For effects on black, attach **only** `reference-mockup.png` (other anchors pull ground and objects into the frame).
   - For the windmill pieces, attach `landmark-windmill.png`; for the pines, `tree-broadleaf-1.png`; for icons, two finished icons.
   - Stage them from the computer first.
   - Say they are **style references only, never to be edited, and nothing from them goes in the image**.
4. **Start every prompt with "A brand-new image, nothing from earlier images (no ___)",** naming the last subject. For variants, describe a clearly different silhouette.
5. **Typing:**
   - Focus the box with JS: `document.querySelector('[aria-label="Enter a prompt for Gemini"]').focus()`.
   - Type, check that its `innerText` starts with your text, then press Return.
   - Never click page coordinates near images: that opens Gemini's image editor, and the overlays stack up.
6. **Waiting:** generation takes about 45–75 s. Keep each `browser_batch` under about 40 s of waits, then scroll down and take a screenshot to review.
7. **Downloading:**
   - Click the last download button with JS: `[...document.querySelectorAll('button[aria-label="Download full-sized image"]')].at(-1).click()`.
   - On the computer, wait for a new `Gemini_Generated_Image_*.jpg` that isn't in `_source-map.txt`.
   - Convert it to PNG with PIL into `art/incoming/<name>.png`, and append a line to `_source-map.txt`.
   - **Magenta pieces:** check that the corners are magenta and that no other colour touches the edges.
   - **Black pieces:** check that every edge pixel is near-black. If the background is very dark grey rather than black, you may push values below about 16 to pure black in PIL; if there's a glow or a ground across the frame, regenerate instead.
   - **Key art:** check there's no text or watermark-like lettering anywhere.
   - Ignore "(1)" duplicate files.
   - PNG downloads carry a small sparkle watermark in the bottom-right corner: paint that corner back to the background colour (magenta or black).
8. **Stray pieces:** when a stray piece appears, send a follow-up: *"Edit the image you just made: remove the ___, leave flat magenta (or pure black) there."*
9. **Hard pieces, and what to try:**
   - **Smoke and dust** come out as a whole cloudy sky. Say "a single puff floating alone in empty black space, like a photo of smoke against a black studio backdrop".
   - **The windmill sails** come out with the building. Say "only the sails, as a cut-out part, nothing behind the hub".
   - **Glades** come out as square patches. Say "the meadow's edge is a soft irregular oval fading into the magenta".
   - **Key art** sometimes adds lettering or a frame. Say "no words, no letters, no title, no frame, no border" at the end too.

## Troubleshooting (in this order)
- **The download didn't land:**
  1. Wait up to 60 s and check Downloads again.
  2. Refresh the Gemini page (navigate to the same chat URL), wait 5 s, scroll to the image and retry.
  3. If it still fails, ask Nate to check Chrome for a blocked-download prompt.
- **Screenshots time out, or typing does nothing:** the Chrome window is minimised or hidden. Ask Nate to bring it up.
- **The extension disconnected:** wait 10 s, run `tabs_context_mcp`, then check the page before redoing anything.
- **Google's "unusual traffic" page:** stop and ask Nate to clear it.
- **"Classifier unavailable":** wait a few minutes and retry. If it lasts more than 5 minutes, stop and report.

## Finish
- **Make contact sheets** (PIL) in `art/incoming/_review/`:
  - `batch-4-map.png`: the redo items beside the old versions (from `_old/`), the specialists and spies beside the existing icons and figures, and the scenery additions
  - `batch-4-fx.png`: every effect, black pieces shown both on black and over a mid-green map colour (#5d7a3a) with their brightness used as transparency, so you can see how they'll look in the game
  - `batch-4-key-art.png`: the three key art pieces
  Show them to Nate.
- **Report** what was added, and anything rejected or compromised on, by file name.
- **Don't run `pnpm art:import` and don't commit:** `art/incoming/` stays out of git, and Claude Code session 16 imports the batch.
- **Don't edit any file under `docs/`.** Nate's folder is a git clone, and a local edit would clash with the next pull. Put any better prompts you learned in your report; Nate passes it to the orchestrator, who records them.
