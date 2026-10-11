# The sound list

*Session 24. Every sound the game plays, most important first. The cue name (first column) is how the game, the importer (`packages/sound/data/recipe.json`) and the files (`apps/web/public/sound/sfx-<cue>-<n>.mp3`, `music-<cue>.mp3`, `amb-<cue>.mp3`) refer to it. A test checks this list, the recipe and the registry name the same cues in the same order.*

*Where each sound comes from (author, page, license): `docs/sound/credits.md`. To hear them all: the sound bench, `?lab=sound`.*

**Loudness:** effects at −16 LUFS at their loudest moment (momentary, 400 ms), music −18 LUFS and ambience −24 LUFS over the whole file, every peak under −1 dBTP. The game's own volumes set the mix on top of that (music lower than effects by default).

**Weak or makeshift** (to upgrade from a paid pack or an AI tool later; marked ⚠ below): no real whisper for a spy, no proper brass fanfare (the capture is the Victory theme's first bar), the march is war drums (no boots-and-drums mix), the Fallen's choir is a chant layered on a sting, and the title music is short (42 s, it loops).

## The replay

| Cue | When it plays | Files | Made from |
|---|---|---|---|
| `march-small` | an army of 1 to 5 marches | 2 | boots (Kenney RPG Audio footsteps) |
| `march-medium` | an army of 6 to 19 marches | 2 | one bar of war drums (William Hector) |
| `march-large` | an army of 20 or more marches | 2 | two bars of war drums |
| `battle` | a fight (any size) | 3 | sword clashes (rubberduck, Kenney) |
| `battle-big` | a fight with 15 or more troops in it, on top of `battle` | 3 | shouts (StarNinjas' crowd) and steel |
| `arrows` | defenders shoot from a fort or a wall | 2 | arrow swishes (artisticdude) and a thunk |
| `siege` | a Siege engine's stone lands | 2 | a stone on a wall (Thimras) |
| `capture` | you take land (at most every 2.5 s) | 1 | ⚠ the first bar of RandomMind's Victory theme |
| `capture-rival` | a rival takes land you can see from someone (not neutral land; at most every 3.5 s) | 1 | a low horn (StumpyStrust) |
| `held` | an attack is beaten back | 2 | a blow on a shield (Kenney) |
| `capital-falls` | a capital falls | 1 | a heavy, distant blast, a stone hit, a bell and a gong |
| `knocked-out` | a House is knocked out | 1 | war drums, slowed, fading away |
| `leader-falls` | a Leader falls | 1 | a slow, low horn |
| `recruits` | recruits march out | 2 | mail and quick boots |
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
| `planning` | under planning (loops, 81 s) | 1 | RandomMind, Medieval: King's Feast (loop version) |
| `replay` | under the replay (loops, 79 s) | 1 | RandomMind, Medieval: Battle |
| `title` | the lobby, after the first tap (loops, 42 s) | 1 | RandomMind, Medieval: Rejoicing (loop version) |
| `victory` | game over, you won (once, 20 s) | 1 | RandomMind, Medieval: Victory Theme |
| `defeat` | game over, you lost (once, 20 s) | 1 | RandomMind, Medieval: Defeat Theme |

## Ambience (Part 4)

| Cue | When it plays | Files | Made from |
|---|---|---|---|
| `wind` | under the map while planning | 1 | Bashar from Skirmish.io, Mild Wind Background Noise |
| `sea` | when the camera shows coast | 1 | RandomMind, Sea and river wave sounds |
| `birds` | now and then | 1 | isaiah658, Ambient Bird Sounds |
