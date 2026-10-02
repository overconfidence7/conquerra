import type { Rng } from "@conquerra/engine";

/*
 * Fantasy place names built from old-English-flavoured pieces ("Raven" + "gate", "Ash" + "ford").
 * Every name on a map is different.
 */
const START = [
  "Ash", "Amber", "Black", "Bram", "Bright", "Briar", "Cold", "Crow", "Dawn", "Deep", "Dun", "Elder", "Ember",
  "Fair", "Fen", "Frost", "Gale", "Glen", "Gold", "Grey", "Hallow", "Harrow", "Hawk", "Heath", "High", "Holly",
  "Iron", "Kestrel", "Kings", "Lark", "Long", "Marsh", "Mist", "Moon", "Nettle", "North", "Oak", "Old", "Pine",
  "Raven", "Red", "Rook", "Rose", "Rush", "Salt", "Silver", "Sorrow", "Stag", "Stone", "Storm", "Sun", "Thorn",
  "Wester", "White", "Wild", "Willow", "Winter", "Wolf", "Wyrm", "Yew",
];
const END = [
  "ford", "gate", "hold", "mere", "moor", "wick", "wood", "watch", "vale", "fall", "field", "haven", "holt",
  "hollow", "keep", "march", "mouth", "reach", "ridge", "stead", "ton", "bury", "by", "crest", "dale", "den",
  "fell", "garth", "helm", "home", "hurst", "leigh", "mark", "more", "rest", "shire", "stone", "thorpe", "well",
];
const PROVINCE = [
  (a: string) => `The ${a}lands`, (a: string) => `${a}reach`, (a: string) => `${a} March`, (a: string) => `The ${a} Vale`,
  (a: string) => `${a}shire`, (a: string) => `The ${a} Downs`, (a: string) => `${a}mark`, (a: string) => `The ${a} Wilds`,
];
const SEA = [(a: string) => `The ${a} Sea`, (a: string) => `${a} Bay`, (a: string) => `The ${a} Gulf`, (a: string) => `${a} Sound`];
const LAKE = [(a: string) => `Lake ${a}`, (a: string) => `${a}mere`, (a: string) => `The ${a} Water`];
const RANGE = [(a: string) => `The ${a} Peaks`, (a: string) => `The ${a}spine`, (a: string) => `The ${a} Teeth`, (a: string) => `The ${a} Crags`];
const RIVER = [(a: string) => `The ${a}run`, (a: string) => `The ${a} River`, (a: string) => `The ${a}water`, (a: string) => `The ${a}brook`];

export class Namer {
  private used = new Set<string>();
  constructor(private rng: Rng) {}
  private pick<T>(list: readonly T[]): T {
    return list[this.rng.int(list.length)]!;
  }
  private unique(make: () => string): string {
    for (let i = 0; i < 200; i++) {
      const n = make();
      const key = n.toLowerCase().replace(/^the /, "");
      if (n && !this.used.has(key)) {
        this.used.add(key);
        return n;
      }
    }
    throw new Error("ran out of names");
  }
  private stem(): string {
    return this.pick(START);
  }
  territory(): string {
    return this.unique(() => {
      const a = this.stem(), b = this.pick(END);
      // Avoid doubled letters like "Ashhold" and awkward "Hollowhollow".
      if (a.toLowerCase().endsWith(b[0]!) || a.toLowerCase().includes(b)) return "";
      return a + b;
    });
  }
  province(): string {
    return this.unique(() => this.pick(PROVINCE)(this.stem()));
  }
  water(kind: "sea" | "lake"): string {
    return this.unique(() => this.pick(kind === "sea" ? SEA : LAKE)(this.stem()));
  }
  range(): string {
    return this.unique(() => this.pick(RANGE)(this.stem()));
  }
  river(): string {
    return this.unique(() => this.pick(RIVER)(this.stem()));
  }
}
