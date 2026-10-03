/**
 * Colour-vision checks for the House colours: simulate protanopia and deuteranopia (Machado et al. 2009, full
 * severity) and measure how different two colours look (CIE76 ΔE in Lab; above ~20 reads as clearly different).
 */
export type Vision = "normal" | "deuteranopia" | "protanopia";

const MATRIX: Record<Exclude<Vision, "normal">, number[][]> = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
};

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** How a colour looks with this kind of colour vision, as "#rrggbb". */
export function simulate(hex: string, vision: Vision): string {
  if (vision === "normal") return hex;
  const lin = rgb(hex).map(toLinear);
  const m = MATRIX[vision];
  const out = m.map((row) => toSrgb(row[0]! * lin[0]! + row[1]! * lin[1]! + row[2]! * lin[2]!));
  return `#${out.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(toLinear) as [number, number, number];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** How different two colours look (ΔE), with the given colour vision. */
export function colourDistance(a: string, b: string, vision: Vision = "normal"): number {
  const la = lab(simulate(a, vision)), lb = lab(simulate(b, vision));
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** Simulate colour vision on raw pixels (RGBA bytes, changed in place), for the swatch images. */
export function simulatePixels(data: Uint8ClampedArray, vision: Vision): void {
  if (vision === "normal") return;
  const m = MATRIX[vision];
  const lut = new Float32Array(256).map((_, i) => toLinear(i / 255));
  for (let i = 0; i < data.length; i += 4) {
    const r = lut[data[i]!]!, g = lut[data[i + 1]!]!, b = lut[data[i + 2]!]!;
    for (let k = 0; k < 3; k++) data[i + k] = Math.round(toSrgb(m[k]![0]! * r + m[k]![1]! * g + m[k]![2]! * b) * 255);
  }
}
