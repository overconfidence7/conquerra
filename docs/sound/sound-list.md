# The sound list

*Session 24, simplified in 25b. Every sound the game plays, most important first. The cue name (first column) is how the game, the importer (`packages/sound/data/recipe.json`) and the files (`apps/web/public/sound/sfx-<cue>-<n>.mp3`, `music-<cue>.mp3`, `amb-<cue>.mp3`) refer to it. A test checks this list, the recipe and the registry name the same cues in the same order.*

*Where each sound comes from (author, page, license): `docs/sound/credits.md`. To hear them all: the sound bench, `?lab=sound`.*

**Loudness:** effects at −16 LUFS at their loudest moment (momentary, 400 ms), music −26 LUFS and ambience −32 LUFS over the whole file (−18 and −24 until session 25b), every peak under −1 dBTP. The game's own volumes set the mix on top of that: the Music slider runs on an even curve (24 dB top to bottom, silent only at 0), and its default, 50%, puts the music at about a fifth of session 24's. The music never dips under a big moment.

**The replay since 25b (Nate: "much simpler and shorter"):** at most two sounds at once (a more important one cuts the least one off), one of each kind per beat, marches only for armies of 20 or more, one short clash per battle, short taps for captures. The bench's busy turn: 27 sounds (61 before), at most 2 at once (up to 9 planned before), 16.3 s with any sound in a 20 s replay (22.9 s before: the long ones kept as they were, a Leader falling, a capital, the fog, carry most of it).

**Weak or makeshift** (to upgrade from a paid pack or an AI tool later; marked ⚠ below): no real whisper for a spy, the march is war drums (no boots-and-drums mix), the Fallen's choir is a chant layered on a sting. The game's music is one 79 s loop until a darker track is picked (Nate, Oct 13: too jolly for a war game).

## The replay

| Cue | When it plays | Files | Made from |
|---|---|---|---|
| `march-large` | an army of 20 or more marches (smaller armies march in silence since 25b) | 2 | two drum beats, under a second (William Hector) |
| `battle` | a fight: one short clash (under 0.6 s), at most one every 1.5 s | 3 | a sword clash (rubberduck, Kenney), cut short |
| `arrows` | defenders shoot from a fort or a wall | 2 | arrow swishes (artisticdude) and a thunk |
| `siege` | a Siege engine's stone lands | 2 | a stone on a wall (Thimras) |
| `capture` | you take land (at most every 2.5 s) | 1 | one full, deep drum hit, under 0.5 s (William Hector's war drums; the bright tap sounded like a ping) |
| `capture-rival` | a rival takes land you can see from someone (not neutral land; at most every 3.5 s) | 1 | one low drum hit, under 0.5 s (William Hector's war drums, pitched down and muffled); no horn since 25b |
| `held` | an attack is beaten back (at most every 2.5 s) | 2 | a blow on a shield (Kenney) |
| `capital-falls` | a capital falls | 1 | a heavy, distant blast, a stone hit, a bell and a gong |
| `knocked-out` | a House is knocked out | 1 | war drums, slowed, fading away |
| `leader-falls` | a Leader falls | 1 | a slow, low horn |
| `recruits` | recruits march out (at most every 3 s) | 2 | mail and quick boots |
| `wall` | a wall goes up | 1 | stones and a slam |
| `built` | a building is finished | 2 | hammer blows and a thump |
| `culture` | culture rises | 1 | a small bell |
| `fog` | anything in the fog: one rumble per beat, the same whatever it was | 2 | a muffled, distant rumble |

## Fate, the Fallen, deals, spies

| Cue | When it plays | Files | Made from |
|---|---|---|---|
| `fate` | a Fate card plays (seen) | 1 | a card slid and turned (Kenney Casino Audio) |
| `fallen` | the Fallen strike (seen) | 1 | ⚠ a chant (OwlishMedia) over a slowed sting (railkill) |
| `deal-sealed` | a deal is sealed | 1 | parchment and a wax stamp |
| `deal-broken` | a deal is broken | 1 | wood cracking and paper tearing |
| `spy` | your spy's news | 1 | ⚠ cloth (no whisper yet) |
| `spy-caught` | a spy is caught | 1 | shackles locking |

## Planning and menus

| Cue | When it plays | Files | Made from |
|---|---|---|---|
| `seal` | you lock in your orders | 1 | a soft heavy press and leather |
| `coins-spend` | gold is spent (an order that costs) | 2 | coins handled |
| `coins-income` | gold comes in after the replay | 1 | coins poured |
| `timer-tick` | each of the timer's last 10 seconds | 2 | a soft tick |
| `panel` | a panel opens (very soft) | 1 | a page turned |
| `spoils` | a Spoils set is turned in | 1 | cards fanned |
| `turn-sweep` | "Turn N" sweeps across | 1 | a slow swish and one drum beat |
| `notice` | a notice | 1 | a small bell, higher |
| `card` | a Spoils card is earned | 1 | a card laid down |

## Music

| Cue | When it plays | Files | Made from |
|---|---|---|---|
| `game` | from the lobby to game over, planning and replay alike (loops, 79 s); never switches or dips | 1 | RandomMind, Medieval: Battle (in for King's Feast, Battle and Rejoicing since 25b: too jolly, and switching made it fade) |
| `victory` | game over, you won (once, 20 s) | 1 | RandomMind, Medieval: Victory Theme |
| `defeat` | game over, you lost (once, 20 s) | 1 | RandomMind, Medieval: Defeat Theme |

## Ambience (Part 4)

| Cue | When it plays | Files | Made from |
|---|---|---|---|
| `wind` | under the map, steady (planning and replay alike since 25b) | 1 | Bashar from Skirmish.io, Mild Wind Background Noise |
| `sea` | when the camera shows coast | 1 | RandomMind, Sea and river wave sounds |
