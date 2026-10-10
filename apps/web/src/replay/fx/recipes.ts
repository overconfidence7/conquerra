import type { EmitterInput, RecipeInput } from "./recipeSchema";

/**
 * The replay's effects, as data (session 21, docs/09-polish-and-effects-plan.md). Each recipe is one or more
 * emitters: which textures, how many particles (and how many more per troop), when they're born, how they move,
 * grow, turn and fade. A test checks every recipe against recipeSchema.ts. Sizes and distances are screen pixels at
 * Mid zoom; times are ms. Effects decorate what happened: none of them carries game state.
 *
 * Particle budget: about 600 at once on a phone and 2,000 on a laptop (fx/particles.ts scales everything down
 * together past that); Light halves every count and drops the flashes.
 */
export const RECIPES = {
  // ---------- Armies on the move (§2) ----------
  marchDust: {
    note: "Dust kicked up behind a marching army, the ground's colour (snow powder in the mountains, mud in swamps).",
    emitters: [
      { textures: ["fx-dust-1", "fx-smoke-1"], blend: "normal", count: 7, perTroop: 0.35, max: 18, at: [0, 0.92], life: [650, 1100], spread: 7, spreadY: 3, alongPath: true, speed: [5, 16], angle: [-170, -10], drag: 1.2, size: [18, 30], grow: 1.9, alpha: 0.55, fadeIn: 0.15, fadeOut: 0.65, tint: "ground" },
    ],
  },
  cavalryDust: {
    note: "Cavalry trots faster and raises more dust.",
    emitters: [
      { textures: ["fx-dust-1", "fx-dust-2", "fx-smoke-3"], blend: "normal", count: 12, perTroop: 0.5, max: 28, at: [0, 0.95], life: [600, 1000], spread: 9, spreadY: 4, alongPath: true, speed: [10, 26], angle: [-175, -5], drag: 1.4, size: [20, 34], grow: 2, alpha: 0.6, fadeIn: 0.12, fadeOut: 0.6, tint: "ground" },
    ],
  },
  mudFlecks: {
    note: "Swamp: a few dark flecks of mud thrown up behind the army.",
    emitters: [{ textures: ["dot"], blend: "normal", count: 8, max: 12, at: [0, 0.9], life: [350, 600], spread: 5, alongPath: true, speed: [30, 60], angle: [-150, -30], gravity: 160, size: [2.5, 4], alpha: 0.85, fadeIn: 0, fadeOut: 0.3, tint: "#4a3a22" }],
  },
  wake: {
    note: "A ship's wake: white foam left behind on the sea lane.",
    emitters: [{ textures: ["dot", "fx-splash"], blend: "screen", count: 14, max: 18, at: [0, 0.95], life: [700, 1100], spread: 4, spreadY: 2, alongPath: true, speed: [3, 9], angle: [0, 360], drag: 1, size: [5, 10], grow: 2.2, alpha: 0.65, fadeIn: 0.05, fadeOut: 0.7, tint: "#eaf6fb" }],
  },
  fordSplash: {
    note: "A splash where the army wades a river.",
    emitters: [
      { textures: ["fx-splash"], blend: "screen", count: 3, max: 4, at: [0.45, 0.6], life: [450, 700], spread: 6, spreadY: 3, speed: [0, 8], angle: [-120, -60], size: [18, 26], grow: 1.3, alpha: 0.85, fadeIn: 0.05, fadeOut: 0.6 },
      { textures: ["dot"], blend: "screen", count: 10, max: 12, at: [0.45, 0.6], life: [350, 550], spread: 5, speed: [40, 80], angle: [-150, -30], gravity: 220, size: [2, 3.5], alpha: 0.9, fadeIn: 0, fadeOut: 0.4, tint: "#eaf6fb" },
    ],
  },

  // ---------- Battles (§3) ----------
  clash: {
    note: "The fight at the border: a cloud of dust and smoke, steel glints and sparks. Bigger fights, bigger cloud.",
    emitters: [
      { textures: ["fx-smoke-1", "fx-smoke-3"], blend: "normal", count: 5, perTroop: 0.35, max: 20, at: [0, 0.8], life: [700, 1300], spread: 16, spreadY: 8, speed: [8, 24], angle: [-180, 0], drag: 1, size: [28, 48], grow: 1.7, spin: [-40, 40], alpha: 0.75, fadeIn: 0.2, fadeOut: 0.55, tint: "#efe9dc" },
      { textures: ["fx-dust-1", "fx-dust-2"], blend: "normal", count: 4, perTroop: 0.25, max: 14, at: [0, 0.7], life: [600, 1100], spread: 18, spreadY: 6, speed: [10, 26], angle: [0, 360], drag: 1.2, size: [24, 40], grow: 1.8, alpha: 0.6, fadeIn: 0.15, fadeOut: 0.6, tint: "ground" },
      { textures: ["spark"], blend: "add", count: 10, perTroop: 0.5, max: 34, at: [0.05, 0.85], life: [160, 320], spread: 10, spreadY: 6, speed: [60, 150], angle: [0, 360], gravity: 120, size: [7, 12], faceTravel: true, alpha: 1, fadeIn: 0, fadeOut: 0.5, tint: "#ffd27a" },
      { textures: ["glint"], blend: "add", count: 4, perTroop: 0.2, max: 12, at: [0.05, 0.85], life: [140, 260], spread: 12, spreadY: 7, speed: [0, 0], angle: [0, 0], size: [9, 15], grow: 0.4, spin: [-90, 90], alpha: 1, fadeIn: 0.1, fadeOut: 0.6, tint: "#ffffff" },
    ],
  },
  volley: {
    note: "Arrows from the defenders (from the walls behind a fort or a wall), flying at the attackers.",
    emitters: [{ textures: ["fx-arrow"], blend: "normal", count: 3, perTroop: 0.25, max: 12, at: [0.02, 0.55], life: [420, 620], spread: 9, flight: { height: [18, 34] }, speed: [0, 0], angle: [0, 0], size: [16, 20], faceTravel: true, alpha: 1, fadeIn: 0.05, fadeOut: 0.12 }],
  },
  siegeStone: {
    note: "A Siege engine lobs a stone that lands in a puff of debris.",
    emitters: [
      { textures: ["fx-stone"], blend: "normal", count: 1, max: 1, at: [0, 0], life: [620, 620], spread: 0, flight: { height: [46, 52] }, speed: [0, 0], angle: [0, 0], size: [11, 12], spin: [200, 300], alpha: 1, fadeIn: 0.05, fadeOut: 0.02 },
    ],
  },
  stoneImpact: {
    note: "Where the Siege stone lands: a burst of earth and stone chips (with a shockwave ring on Full).",
    emitters: [
      { textures: ["fx-impact"], blend: "normal", count: 2, max: 2, at: [0, 0.02], life: [500, 700], spread: 3, speed: [0, 6], angle: [-120, -60], size: [28, 36], grow: 1.4, alpha: 0.9, fadeIn: 0.05, fadeOut: 0.6 },
      { textures: ["fx-rock-1", "fx-rock-2"], blend: "normal", count: 5, max: 6, at: [0, 0.02], life: [380, 560], spread: 3, speed: [50, 95], angle: [-160, -20], gravity: 260, size: [4, 6], spin: [-300, 300], alpha: 1, fadeIn: 0, fadeOut: 0.3 },
      { textures: ["ring"], blend: "add", count: 1, max: 1, at: [0, 0], life: [420, 420], spread: 0, speed: [0, 0], angle: [0, 0], size: [16, 16], grow: 4, alpha: 0.7, fadeIn: 0, fadeOut: 0.9, tint: "#fff6dc", flash: true },
    ],
  },
  captured: {
    note: "Captured: a short gold shimmer over the land as the new banner goes up.",
    emitters: [{ textures: ["glint", "dot"], blend: "add", count: 12, max: 14, at: [0, 0.45], life: [380, 700], spread: 22, spreadY: 12, speed: [4, 14], angle: [-110, -70], size: [4, 9], grow: 0.5, spin: [-60, 60], alpha: 0.95, fadeIn: 0.2, fadeOut: 0.6, tint: "#ffe39a" }],
  },
  heldBack: {
    note: "Held: the attackers fall back in a drift of smoke.",
    emitters: [{ textures: ["fx-smoke-3", "fx-smoke-1"], blend: "normal", count: 5, perTroop: 0.2, max: 12, at: [0, 0.4], life: [700, 1100], spread: 10, spreadY: 5, speed: [12, 26], angle: [-25, 25], aim: "toward", drag: 0.8, size: [22, 34], grow: 1.6, alpha: 0.5, fadeIn: 0.15, fadeOut: 0.6, tint: "ground" }],
  },
  shieldFlash: {
    note: "Held: the defender's shield flashes.",
    emitters: [{ textures: ["ring"], blend: "add", count: 1, max: 1, at: [0, 0.02], life: [380, 400], spread: 0, speed: [0, 0], angle: [0, 0], size: [26, 26], grow: 2.2, alpha: 0.9, fadeIn: 0, fadeOut: 0.8, tint: "#fff1c1", flash: true }],
  },
  capitalFalls: {
    note: "A capital falls: columns of smoke and flames over the castle, embers rising.",
    emitters: [
      { textures: ["fx-smoke-2"], blend: "normal", count: 4, max: 5, at: [0, 0.5], life: [1400, 1900], spread: 14, spreadY: 5, speed: [16, 26], angle: [-100, -80], drag: 0.2, size: [34, 48], grow: 1.6, alpha: 0.65, fadeIn: 0.2, fadeOut: 0.5, tint: "#8c8478" },
      { textures: ["fx-flame-1", "fx-flame-2", "fx-flame-3"], blend: "add", count: 5, max: 6, at: [0, 0.55], life: [700, 1100], spread: 12, spreadY: 4, speed: [4, 10], angle: [-100, -80], size: [20, 30], grow: 1.15, alpha: 0.95, fadeIn: 0.15, fadeOut: 0.5 },
      { textures: ["ember"], blend: "add", count: 18, max: 22, at: [0, 0.75], life: [700, 1300], spread: 14, spreadY: 5, speed: [26, 52], angle: [-115, -65], drag: 0.6, size: [2.5, 4], grow: 0.6, alpha: 1, fadeIn: 0.05, fadeOut: 0.6, tint: "#ffb35c" },
    ],
  },
  bannerBurns: {
    note: "A House knocked out: flames over its last banner as it burns away.",
    emitters: [
      { textures: ["fx-flame-1", "fx-flame-2"], blend: "add", count: 5, max: 6, at: [0.05, 0.6], life: [600, 900], spread: 8, spreadY: 4, speed: [6, 14], angle: [-100, -80], size: [14, 20], grow: 1.2, alpha: 0.95, fadeIn: 0.1, fadeOut: 0.5 },
      { textures: ["ember"], blend: "add", count: 14, max: 16, at: [0.05, 0.8], life: [600, 1100], spread: 8, speed: [24, 44], angle: [-120, -60], drag: 0.5, size: [2, 3.5], alpha: 1, fadeIn: 0.05, fadeOut: 0.6, tint: "#ffb35c" },
      { textures: ["fx-smoke-2"], blend: "normal", count: 2, max: 2, at: [0.3, 0.6], life: [900, 1200], spread: 6, speed: [12, 18], angle: [-95, -85], size: [20, 26], grow: 1.5, alpha: 0.5, fadeIn: 0.2, fadeOut: 0.6, tint: "#6f6a62" },
    ],
  },

  // ---------- Building, recruiting, gold, Spoils (§4) ----------
  recruitPuff: {
    note: "Recruits march out of the gate in a puff of dust.",
    emitters: [{ textures: ["fx-dust-2", "fx-dust-1"], blend: "normal", count: 4, max: 5, at: [0, 0.25], life: [500, 800], spread: 6, spreadY: 3, speed: [10, 22], angle: [-180, 0], drag: 1.2, size: [16, 26], grow: 1.8, alpha: 0.55, fadeIn: 0.1, fadeOut: 0.6, tint: "ground" }],
  },
  scaffoldDust: {
    note: "Building starts: a little dust as the scaffold goes up.",
    emitters: [{ textures: ["fx-dust-1"], blend: "normal", count: 3, max: 3, at: [0, 0.3], life: [500, 800], spread: 10, spreadY: 3, speed: [6, 14], angle: [-170, -10], drag: 1, size: [16, 24], grow: 1.6, alpha: 0.5, fadeIn: 0.1, fadeOut: 0.6, tint: "ground" }],
  },
  sawdust: {
    note: "Building done (or Master masons): the scaffold drops away in sawdust, with a glint.",
    emitters: [
      { textures: ["fx-dust-1", "fx-dust-2"], blend: "normal", count: 4, max: 5, at: [0.1, 0.35], life: [500, 900], spread: 12, spreadY: 4, speed: [8, 20], angle: [-170, -10], drag: 1, size: [18, 28], grow: 1.6, alpha: 0.55, fadeIn: 0.1, fadeOut: 0.6, tint: "#d9c497" },
      { textures: ["dot"], blend: "normal", count: 10, max: 12, at: [0.1, 0.35], life: [350, 600], spread: 10, speed: [30, 60], angle: [-160, -20], gravity: 180, size: [2, 3], alpha: 0.9, fadeIn: 0, fadeOut: 0.3, tint: "#e0c58e" },
      { textures: ["glint"], blend: "add", count: 1, max: 1, at: [0.45, 0.5], life: [380, 420], spread: 6, speed: [0, 0], angle: [0, 0], size: [16, 18], grow: 0.3, spin: [60, 90], alpha: 1, fadeIn: 0.2, fadeOut: 0.6, tint: "#fff6d6", flash: true },
    ],
  },
  laurels: {
    note: "Culture raised: golden laurel leaves drift up from the land, with a soft glow ring.",
    emitters: [
      { textures: ["fx-leaf"], blend: "normal", count: 8, max: 9, at: [0, 0.5], life: [800, 1200], spread: 22, spreadY: 8, speed: [40, 62], angle: [-115, -65], drag: 0.7, size: [12, 16], spin: [-140, 140], alpha: 1, fadeIn: 0.1, fadeOut: 0.45 },
      { textures: ["ring"], blend: "add", count: 1, max: 1, at: [0, 0.05], life: [700, 750], spread: 0, speed: [0, 0], angle: [0, 0], size: [20, 20], grow: 2.6, alpha: 0.75, fadeIn: 0.05, fadeOut: 0.8, tint: "#ffe39a" },
    ],
  },
  spoilsBurst: {
    note: "Spoils turned in: the three cards burst into the windfall in gold.",
    emitters: [
      { textures: ["glint", "dot"], blend: "add", count: 14, max: 16, at: [0.25, 0.4], life: [450, 750], spread: 6, speed: [40, 90], angle: [0, 360], drag: 1.6, size: [5, 10], grow: 0.5, spin: [-90, 90], alpha: 1, fadeIn: 0.05, fadeOut: 0.6, tint: "#ffe39a" },
    ],
  },

  // ---------- Fate and the Fallen (§5): one short signature each ----------
  harvest: {
    note: "A bountiful harvest: golden wheat drifts up, in a warm glow.",
    emitters: [
      { textures: ["fx-wheat"], blend: "normal", count: 7, max: 8, at: [0, 0.5], life: [800, 1200], spread: 16, spreadY: 7, speed: [12, 24], angle: [-110, -70], drag: 0.5, size: [12, 16], spin: [-80, 80], alpha: 1, fadeIn: 0.15, fadeOut: 0.5 },
      { textures: ["dot"], blend: "add", count: 1, max: 1, at: [0, 0.05], life: [900, 1000], spread: 0, speed: [0, 0], angle: [0, 0], size: [60, 60], grow: 1.3, alpha: 0.35, fadeIn: 0.3, fadeOut: 0.6, tint: "#ffcf6a" },
    ],
  },
  hoard: {
    note: "A hidden hoard: a burst of coins and glints.",
    emitters: [
      { textures: ["fx-coin"], blend: "normal", count: 8, max: 10, at: [0, 0.2], life: [600, 900], spread: 4, speed: [50, 95], angle: [-150, -30], gravity: 200, size: [8, 11], spin: [-300, 300], alpha: 1, fadeIn: 0, fadeOut: 0.3 },
      { textures: ["glint"], blend: "add", count: 6, max: 6, at: [0.05, 0.5], life: [250, 400], spread: 14, speed: [0, 0], angle: [0, 0], size: [8, 12], grow: 0.4, spin: [-90, 90], alpha: 1, fadeIn: 0.2, fadeOut: 0.6, tint: "#fff1b0" },
    ],
  },
  arrival: {
    note: "A band arrives (wanderers, veterans, mercenaries) in a puff of dust.",
    emitters: [{ textures: ["fx-dust-2", "fx-dust-1"], blend: "normal", count: 5, max: 6, at: [0, 0.4], life: [600, 900], spread: 12, spreadY: 4, speed: [8, 18], angle: [-170, -10], drag: 1, size: [18, 28], grow: 1.7, alpha: 0.55, fadeIn: 0.15, fadeOut: 0.6, tint: "ground" }],
  },
  pilgrims: {
    note: "Pilgrims: soft lantern lights move in, and laurel leaves.",
    emitters: [
      { textures: ["ember"], blend: "add", count: 8, max: 9, at: [0, 0.4], life: [900, 1200], spread: 26, spreadY: 12, speed: [10, 18], angle: [0, 0], aim: "toward", drag: 0.4, size: [6, 9], alpha: 0.9, fadeIn: 0.3, fadeOut: 0.5, tint: "#ffd890" },
      { textures: ["fx-leaf"], blend: "normal", count: 3, max: 3, at: [0.3, 0.6], life: [700, 1000], spread: 10, speed: [14, 24], angle: [-110, -70], size: [8, 11], spin: [-120, 120], alpha: 1, fadeIn: 0.15, fadeOut: 0.5 },
    ],
  },
  flood: {
    note: "A flooded ford: water spreads along the crossing, ripples and spray.",
    emitters: [
      { textures: ["fx-splash"], blend: "screen", count: 3, max: 3, at: [0, 0.4], life: [500, 800], spread: 10, spreadY: 4, speed: [0, 6], angle: [-120, -60], size: [20, 28], grow: 1.3, alpha: 0.85, fadeIn: 0.1, fadeOut: 0.6 },
      { textures: ["ring"], blend: "screen", count: 4, max: 4, at: [0, 0.6], life: [700, 900], spread: 12, spreadY: 5, speed: [0, 0], angle: [0, 0], size: [10, 14], grow: 3, alpha: 0.7, fadeIn: 0.05, fadeOut: 0.8, tint: "#bfe8f5" },
    ],
  },
  rockslide: {
    note: "A rockslide: rocks tumble into the pass with dust.",
    emitters: [
      { textures: ["fx-rock-1", "fx-rock-2"], blend: "normal", count: 6, max: 7, at: [0, 0.4], life: [450, 650], spread: 12, speed: [20, 40], angle: [60, 120], gravity: 260, size: [7, 11], spin: [-240, 240], alpha: 1, fadeIn: 0, fadeOut: 0.2 },
      { textures: ["fx-dust-1", "fx-dust-2"], blend: "normal", count: 4, max: 4, at: [0.3, 0.7], life: [600, 900], spread: 12, spreadY: 4, speed: [6, 14], angle: [-170, -10], size: [22, 32], grow: 1.6, alpha: 0.55, fadeIn: 0.1, fadeOut: 0.6, tint: "#b8ad98" },
    ],
  },
  storm: {
    note: "Squalls, or the Fallen's storm: a dark cloud over the lane, rain streaks and a lightning flash.",
    emitters: [
      { textures: ["fx-storm-cloud"], blend: "normal", count: 1, max: 1, at: [0, 0], life: [1500, 1500], spread: 0, speed: [8, 8], angle: [0, 0], size: [70, 70], grow: 1.1, alpha: 0.9, fadeIn: 0.15, fadeOut: 0.25 },
      { textures: ["streak"], blend: "screen", count: 22, max: 24, at: [0.05, 0.8], life: [260, 380], spread: 26, spreadY: 4, speed: [150, 190], angle: [100, 105], size: [10, 14], faceTravel: true, alpha: 0.7, fadeIn: 0.1, fadeOut: 0.3, tint: "#cfe2f3" },
      { textures: ["fx-lightning-1", "fx-lightning-2"], blend: "add", count: 1, max: 1, at: [0.3, 0.35], life: [180, 220], spread: 6, speed: [0, 0], angle: [0, 0], size: [40, 46], alpha: 1, fadeIn: 0, fadeOut: 0.6, flash: true },
    ],
  },
  fire: {
    note: "Fire in the works: flames and smoke on the scaffold.",
    emitters: [
      { textures: ["fx-flame-1", "fx-flame-2", "fx-flame-3"], blend: "add", count: 4, max: 5, at: [0, 0.5], life: [600, 900], spread: 8, spreadY: 3, speed: [4, 10], angle: [-100, -80], size: [16, 22], grow: 1.1, alpha: 0.95, fadeIn: 0.15, fadeOut: 0.5 },
      { textures: ["fx-smoke-2"], blend: "normal", count: 2, max: 2, at: [0.2, 0.5], life: [900, 1200], spread: 6, speed: [12, 18], angle: [-95, -85], size: [24, 30], grow: 1.5, alpha: 0.55, fadeIn: 0.2, fadeOut: 0.6, tint: "#7a746a" },
    ],
  },
  sickness: {
    note: "Camp fever or plague: a sickly green-grey mist creeps over the land.",
    emitters: [{ textures: ["fx-wisp-1", "fx-wisp-2"], blend: "normal", count: 5, max: 6, at: [0, 0.5], life: [1000, 1400], spread: 22, spreadY: 10, speed: [6, 12], angle: [-30, 30], drag: 0.3, size: [36, 52], grow: 1.3, spin: [-10, 10], alpha: 0.55, fadeIn: 0.3, fadeOut: 0.5, tint: "#a6b38a" }],
  },
  blight: {
    note: "Blight or famine: the ground's colour drains to brown for a moment, and dead leaves drift down.",
    emitters: [
      { textures: ["dot"], blend: "normal", count: 1, max: 1, at: [0, 0], life: [1200, 1300], spread: 0, speed: [0, 0], angle: [0, 0], size: [90, 90], grow: 1.1, alpha: 0.4, fadeIn: 0.3, fadeOut: 0.5, tint: "#6b5232" },
      { textures: ["fx-leaf"], blend: "normal", count: 6, max: 7, at: [0, 0.6], life: [800, 1100], spread: 20, spreadY: 8, speed: [8, 16], angle: [70, 110], drag: 0.3, size: [8, 11], spin: [-160, 160], alpha: 0.95, fadeIn: 0.15, fadeOut: 0.5, tint: "#8a6a3a" },
    ],
  },
  uprising: {
    note: "An uprising: torch flames and a red flicker.",
    emitters: [
      { textures: ["fx-flame-1"], blend: "add", count: 5, max: 6, at: [0, 0.6], life: [400, 700], spread: 16, spreadY: 7, speed: [4, 8], angle: [-100, -80], size: [9, 13], alpha: 0.95, fadeIn: 0.1, fadeOut: 0.5 },
      { textures: ["dot"], blend: "add", count: 3, max: 3, at: [0, 0.6], life: [300, 500], spread: 10, speed: [0, 0], angle: [0, 0], size: [40, 56], alpha: 0.35, fadeIn: 0.2, fadeOut: 0.6, tint: "#d2452f", flash: true },
    ],
  },

  // ---------- Diplomacy and spies (§6) ----------
  dealSealed: {
    note: "A deal is sealed: gold flecks as the wax seal stamps down.",
    emitters: [{ textures: ["glint", "dot"], blend: "add", count: 10, max: 12, at: [0.45, 0.5], life: [350, 600], spread: 4, speed: [40, 80], angle: [0, 360], drag: 1.5, size: [4, 8], grow: 0.5, alpha: 1, fadeIn: 0, fadeOut: 0.6, tint: "#ffe39a" }],
  },
  dealBroken: {
    note: "A deal is broken: a puff of torn parchment (the red crack along the border is drawn by the replay layer).",
    emitters: [
      { textures: ["flake"], blend: "normal", count: 8, max: 9, at: [0.2, 0.3], life: [500, 800], spread: 8, speed: [30, 60], angle: [0, 360], gravity: 70, drag: 1, size: [4, 7], spin: [-200, 200], alpha: 0.95, fadeIn: 0, fadeOut: 0.4, tint: "#efe2c2" },
    ],
  },
  spyWisp: {
    note: "A spy fades in and out in a wisp of smoke.",
    emitters: [{ textures: ["fx-wisp-1", "fx-smoke-3"], blend: "normal", count: 3, max: 3, at: [0, 0.3], life: [700, 1000], spread: 6, speed: [4, 10], angle: [-120, -60], size: [18, 26], grow: 1.5, alpha: 0.5, fadeIn: 0.2, fadeOut: 0.6, tint: "#9aa0a8" }],
  },
} satisfies Record<string, RecipeInput>;

export type RecipeName = keyof typeof RECIPES;
export type { EmitterInput };
