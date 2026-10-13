# Sound credits

*Written by `pnpm sound:import` from `packages/sound/data/credits.json` (session 24); don't edit by hand. Every sound file in the game is made only from the sources below. The tests refuse a file whose source isn't listed here or whose license isn't allowed.*

**Allowed licenses:** CC0 or public domain (best), CC BY with credit. Never "non-commercial", "personal use only", "editorial", or a license we can't find. **In use:** 24 sources, 24 CC0. None needs credit, but Settings → Credits lists every pack anyway (it's polite, and it's how a sound gets traced).

**License texts:** `docs/sound/licenses/` (the CC0 legal code, and the license files the packs ship with). The packs' own pages are linked below; each showed its license on the day it was downloaded.

| Source | Author | License | Page | Downloaded | Used in |
|---|---|---|---|---|---|
| RPG Audio | Kenney | CC0 1.0 (public domain dedication) | <https://kenney.nl/assets/rpg-audio> | 2026-10-11 | `sfx-recruits`, `sfx-spy`, `sfx-seal`, `sfx-coins-spend` |
| Impact Sounds | Kenney | CC0 1.0 (public domain dedication) | <https://kenney.nl/assets/impact-sounds> | 2026-10-11 | `sfx-battle`, `sfx-arrows`, `sfx-held`, `sfx-built`, `sfx-deal-sealed`, `sfx-seal` |
| Casino Audio | Kenney | CC0 1.0 (public domain dedication) | <https://kenney.nl/assets/casino-audio> | 2026-10-11 | `sfx-fate`, `sfx-spoils`, `sfx-card` |
| Interface Sounds | Kenney | CC0 1.0 (public domain dedication) | <https://kenney.nl/assets/interface-sounds> | 2026-10-11 | `sfx-timer-tick` |
| 100 CC0 SFX | rubberduck | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/100-cc0-sfx> | 2026-10-11 | `sfx-capital-falls`, `sfx-wall`, `sfx-culture`, `sfx-deal-sealed`, `sfx-notice` |
| 80 CC0 RPG SFX | rubberduck | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/80-cc0-rpg-sfx> | 2026-10-11 | `sfx-battle`, `sfx-siege`, `sfx-wall`, `sfx-spy-caught`, `sfx-coins-spend`, `sfx-coins-income` |
| 100 CC0 metal and wood SFX | rubberduck | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/100-cc0-metal-and-wood-sfx> | 2026-10-11 | `sfx-built`, `sfx-deal-broken` |
| RPG Sound Pack | artisticdude | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/rpg-sound-pack> | 2026-10-11 | `sfx-recruits` |
| Swishes Sound Pack | artisticdude | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/swishes-sound-pack> | 2026-10-11 | `sfx-arrows`, `sfx-turn-sweep` |
| Fantasy Sound Effects (Tinysized SFX) | Vehicle (Jan Schupke) | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx> | 2026-10-11 | `sfx-deal-broken`, `sfx-spy-caught`, `sfx-panel` |
| Their Coming (generic horn sound) | StumpyStrust | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/their-coming-generic-horn-sound> | 2026-10-11 | `sfx-leader-falls` |
| Horde War Drums loop | William Hector | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/horde-war-drums-loop> | 2026-10-11 | `sfx-march-large`, `sfx-capture`, `sfx-capture-rival`, `sfx-knocked-out`, `sfx-turn-sweep` |
| Battle at sea | Thimras | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/battle-at-sea> | 2026-10-11 | `sfx-siege`, `sfx-capital-falls` |
| Muffled Distant Explosion | NenadSimic | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/muffled-distant-explosion> | 2026-10-11 | `sfx-capital-falls`, `sfx-fog` |
| Creepy Incoherent Chanting | OwlishMedia | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/creepy-incoherent-chanting> | 2026-10-11 | `sfx-fallen` |
| Mystery Sting | railkill | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/mystery-sting> | 2026-10-11 | `sfx-fallen` |
| Medieval: King's Feast | RandomMind | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/medieval-kings-feast> | 2026-10-11 | `music-planning` |
| Medieval: Battle | RandomMind | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/medieval-battle> | 2026-10-11 | `music-replay` |
| Medieval: Rejoicing | RandomMind | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/medieval-rejoicing> | 2026-10-11 | `music-title` |
| Medieval: Victory Theme | RandomMind | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/medieval-victory-theme> | 2026-10-11 | `music-victory` |
| Medieval: Defeat Theme | RandomMind | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/medieval-defeat-theme> | 2026-10-11 | `music-defeat` |
| Sea and river wave sounds | RandomMind | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/sea-and-river-wave-sounds> | 2026-10-11 | `amb-sea` |
| Mild Wind Background Noise | Bashar from Skirmish.io | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/mild-wind-background-noise> | 2026-10-11 | `amb-wind` |
| Ambient Bird Sounds | isaiah658 | CC0 1.0 (public domain dedication) | <https://opengameart.org/content/ambient-bird-sounds> | 2026-10-11 | `amb-birds` |

## How a sound gets replaced
1. Put the new file in `sound/incoming/replace/`, named like the file it replaces (`sfx-battle-1.wav`; wav, ogg, mp3 or flac).
2. Add its source to `packages/sound/data/credits.json` (title, author, page, license, date) and set `"replace": "<that id>"` on the variant in `packages/sound/data/recipe.json`.
3. Run `pnpm sound:import <cue>` (it trims, normalises and converts it like the rest) and `pnpm test`.
