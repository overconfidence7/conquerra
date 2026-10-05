# Conquerra art session 3: batch 3 in Gemini (for Claude Code session 11)

Paste this into a new Claude chat on Nate's computer, with the project folder and the Downloads folder connected. You (Claude) are making Conquerra's third art batch: the redo items and new pieces for session 11's visual upgrade. Use **Claude in Chrome** to drive Nate's Gemini (he pays for it; Chrome is open and signed in). Review every image yourself, and keep only the ones you're happy with.

## Where things are
- **Project folder** (on Nate's computer): `C:\Users\nkurt\Claude\Projects\Strategy Game`.
- **What to make:** "Batch 3" at the end of `docs/art/asset-list-and-prompts.md`, about 20 files. That section has the exact file names and prompts; the top of the file has the **style line**, the angles, the magenta rule and the Gemini lessons. Read the whole file first.
- **Where approved art goes:** `art/incoming/<exact name>.png`, saved as **PNG**. Redo items **replace** the old file of the same name. Before you overwrite one, move the old file into `art/incoming/_old/`.
- **`art/incoming/_source-map.txt`** lists which Gemini download became which file. Append to it.
- **Downloads:** Gemini saves to `C:\Users\nkurt\Downloads` as `Gemini_Generated_Image_*.jpg` (JPG, usually 2048×2048). Ask Nate to connect Downloads if it isn't already.
- **The "before" pictures** these will be judged against: `docs/art/screens/bench/`. For example, `sprites-near-trees.png` shows today's pines (round bushes), and `redo-list.png` shows the textures with big repeating shapes.
- **References:**
  - `docs/art/reference-mockup.png` (the realistic target)
  - `docs/art/reference-illustrated.jpg` (the painted feel)
  - `docs/06-art-direction.md`

## Order (most important first)
1. `tree-conifer-1`, `tree-conifer-2`: the pines. Compare them with `tree-broadleaf-1` side by side. They must read as pines at a glance, small.
2. `mask-dragon`: black on white, no style line. Shrink your pick to about 160 pixels wide and check it still says "dragon". Chunky beats detailed: thin claws, spines and whip tails can't become land.
3. `ridge-1` … `-3`.
4. `terrain-hills`, `terrain-rock`, `terrain-snow`. Tile each 3×3 in PIL before you approve it: no visible repeat, no big shapes, even detail to the edges.
5. `pass-gate`, `scaffold`.
6. `cliff-1` … `-3`.
7. `landmark-ruins`, `-stones`, `-lighthouse`, `-windmill`.
8. `frame-plaque`, `bridge-wood`.

If you run low on usage, stop after a numbered step and report. Session 11 copes with anything missing.

## The look (non-negotiable)
- Semi-realistic, richly detailed hand-painted fantasy campaign-map art, like the terrain in the realistic mockup.
- Natural earthy palette, fine painterly texture, soft daylight from the upper left, depth from shading.
- **Not cartoon:** no black outlines, no flat fills, no candy-bright colours, no blobby shapes, no text.
- **Sprites:** one object, centred, generous margin, on a flat pure magenta (#FF00FF) background filling the image, no ground plane, no shadow on the background.
- **Angles:**
  - textures: straight top-down
  - trees: almost directly overhead
  - everything else: three-quarter view, camera about 45° down
  - the plaque: front view
- **Wide pieces** (ridges, cliffs, plaque): ask for the widest aspect ratio for these, or 1:1 with the object clearly wider than tall.
- **Reject:**
  - repeating grids or stripes
  - detail bunched at edges or corners
  - close-up scale
  - side-on views where overhead is wanted
  - pieces of earlier images bleeding in

## How to run Gemini (lessons from sessions 1–2)
1. **Load the tools:** load the Chrome tools in one ToolSearch call (include browser_batch, javascript_tool, find and file_upload). Run `tabs_context_mcp` first.
2. **Start a fresh Gemini chat,** and start another one about every 8–10 images. Open the + menu, then choose **Create image**. Set the aspect ratio: 1:1 by default, the widest for ridges, cliffs and the plaque.
3. **Attach style anchors** in the first message. The hidden file inputs only exist while the + menu is open: open it, `find` the file input, then use `file_upload`.
   - Use `reference-mockup.png` plus two approved downloads that **don't share a subject** with what you're making. See `_source-map.txt`; the forest texture and the foot-soldier sprite worked well.
   - Stage them from the computer first.
   - Say they are **style references only, never to be edited**.
   - For `mask-dragon`, use a fresh chat with **no anchors**.
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
   - For magenta sprites, check that the corners are magenta and that no other colour touches the edges.
   - Ignore "(1)" duplicate files.
   - PNG downloads carry a small sparkle watermark in the bottom-right corner: paint that corner back to magenta (white for the mask).
8. **Stray pieces:** when a stray piece appears, send a follow-up: *"Edit the image you just made: remove the ___, leave flat magenta there."*

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
- **Make one contact sheet** of everything new (PIL) at `art/incoming/_review/batch-3.png`, with the old pines and textures next to the new ones, and show it to Nate.
- **Report** what was added, and anything rejected or compromised on.
- **Don't run `pnpm art:import` and don't commit:** `art/incoming/` stays out of git, and Claude Code session 11 imports the batch.
- **Don't edit any file under `docs/`.** Nate's folder is a git clone, and a local edit would clash with the next pull. Put any better prompts you learned in your report; Nate passes it to the orchestrator, who records them.
