/**
 * GLSL for the illustrated map (PixiJS adds the version line and maps it to WebGL 1 or 2).
 *   GROUND: paints the ground once per game into tiles: blends ground textures by biome, lights hills and mountain
 *           ranges from the height map (light from the upper left), and draws water, shallows and the shore.
 *   DISPLAY: shows the painted tiles every frame: fog (greyed, darkened land with drifting mist), a gentle water
 *            shimmer, and the Far-zoom dimming. Cheap: one tile read and a little noise per pixel.
 */

export const VERTEX = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
out vec2 vPos;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vPos = aPosition;
  vUV = aUV;
}
`;

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
`;

export const GROUND_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vPos;
out vec4 finalColor;
uniform sampler2D uAtlas;
uniform sampler2D uB0;
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform sampler2D uAux1;
uniform sampler2D uAux2;
uniform vec2 uMap;
uniform vec2 uGrid;
uniform float uCell;
uniform float uSea;
uniform float uRepeat;
uniform float uSlot;
uniform vec2 uAtlasPx;
${NOISE}

vec3 slotTex(float i, vec2 p) {
  vec2 slot = vec2(mod(i, 4.0), floor(i / 4.0));
  vec2 f = fract(p / uRepeat);
  vec2 px = slot * uSlot + 1.0 + f * (uSlot - 2.0);
  return texture(uAtlas, px / uAtlasPx).rgb;
}
// Two reads at different scales, mixed by slow noise (worked out once per pixel), so repeats don't show.
float gTileMix;
vec3 terr(float i, vec2 p) {
  return mix(slotTex(i, p), slotTex(i, p * 0.71 + vec2(91.3, 47.1)), gTileMix);
}
float heightAt(vec2 p) { return texture(uAux1, p / uMap).b; }

void main() {
  vec2 p = vPos;
  // ---- Ground: blend textures by biome, with wobbly edges so the grid never shows ----
  vec2 warp = (vec2(fbm(p * 0.035), fbm(p * 0.035 + 19.7)) - 0.5) * uCell * 1.8;
  vec2 bu = (p + warp) / uGrid;
  vec3 b0 = texture(uB0, bu).rgb, b1 = texture(uB1, bu).rgb, b2 = texture(uB2, bu).rgb;
  float w[8];
  w[0] = b0.r; w[1] = b0.g; w[2] = b0.b; w[3] = b1.r; w[4] = b1.g; w[5] = b1.b; w[6] = b2.r; w[7] = b2.g;
  gTileMix = smoothstep(0.3, 0.7, vnoise(p * 0.011));
  // Wobble each ground type's edge with one of two noises, so neighbouring types interlock instead of fading.
  float na = vnoise(p * 0.06) - 0.5, nb = vnoise(p * 0.06 + 31.7) - 0.5;
  float total = 0.0;
  for (int i = 0; i < 8; i++) {
    float n = mod(float(i), 2.0) < 0.5 ? na : nb;
    w[i] = smoothstep(0.18, 0.82, w[i] + n * (0.26 + 0.04 * float(i)));
    total += w[i];
  }
  vec3 land = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float wi = w[i] / max(total, 0.001);
    if (wi > 0.004) land += terr(float(i), p) * wi;
  }
  if (total < 0.001) land = terr(0.0, p);

  // ---- Relief lighting from the height map (light from the upper left) ----
  vec2 r2 = texture(uAux2, p / uMap).rg; // range mask, range blurred
  float rock = clamp(w[4] / max(total, 0.001) + w[5] / max(total, 0.001) + r2.x, 0.0, 1.0);
  float e = 2.0;
  float hx = heightAt(p + vec2(e, 0.0)) - heightAt(p - vec2(e, 0.0));
  float hy = heightAt(p + vec2(0.0, e)) - heightAt(p - vec2(0.0, e));
  // Small rocky detail on mountains: ridges.
  float ridge = 1.0 - abs(vnoise(p * 0.09) * 2.0 - 1.0);
  float rx = (vnoise(p * 0.09 + vec2(0.05, 0.0)) - vnoise(p * 0.09 - vec2(0.05, 0.0)));
  float ry = (vnoise(p * 0.09 + vec2(0.0, 0.05)) - vnoise(p * 0.09 - vec2(0.0, 0.05)));
  float k = 13.0 + 14.0 * r2.x;
  vec3 nrm = normalize(vec3(-hx * k - rx * 1.8 * rock, -hy * k - ry * 1.8 * rock, 1.0));
  vec3 L = normalize(vec3(-1.0, -1.15, 1.25));
  float lit = dot(nrm, L) - L.z;
  land *= clamp(1.0 + lit * (0.9 + 0.6 * rock), 0.45, 1.5);
  // Ranges: darker and shadowed, so they read as impassable; they also cast a soft shadow to the lower right.
  land = mix(land, land * vec3(0.72, 0.7, 0.74), r2.x * (0.55 + 0.25 * (1.0 - ridge)));
  float rangeShadow = texture(uAux2, (p - vec2(7.0, 8.0)) / uMap).g * (1.0 - r2.x);
  land *= 1.0 - rangeShadow * 0.35;
  // A slight warm glow on sunlit slopes.
  land += vec3(0.05, 0.035, 0.0) * max(lit, 0.0);

  // ---- Water: deep to shallow, a soft shore, a fine coastline ----
  vec3 a1 = texture(uAux1, p / uMap).rgb; // land, land blurred, height
  float h = heightAt(p);
  float depthH = clamp((uSea - h) / uSea * 1.8, 0.0, 1.0);
  float near = a1.g;
  float depth = clamp(max(depthH, (1.0 - near * 2.2) * 0.75), 0.0, 1.0);
  vec3 water = mix(terr(8.0, p), terr(9.0, p), smoothstep(0.08, 0.75, depth));
  // Shore foam and a lighter ring of shallows.
  float foam = smoothstep(0.3, 0.46, near) * (0.55 + 0.45 * vnoise(p * 0.25));
  water = mix(water, vec3(0.82, 0.92, 0.9), foam * 0.32);
  float coast = smoothstep(0.42, 0.58, a1.r);
  float edge = smoothstep(0.08, 0.45, a1.r) * (1.0 - smoothstep(0.45, 0.9, a1.r));
  vec3 col = mix(water, land, coast);
  col = mix(col, col * 0.62, edge * 0.55);
  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const DISPLAY_FRAGMENT = /* glsl */ `
precision mediump float;
in vec2 vPos;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTile;
uniform sampler2D uFog;
uniform sampler2D uAux1;
uniform vec2 uMap;
uniform float uTime;
uniform float uDim;
uniform float uMotion;
${NOISE}

void main() {
  vec3 c = texture(uTile, vUV).rgb;
  vec2 mu = vPos / uMap;
  float land = texture(uAux1, mu).r;
  float water = 1.0 - smoothstep(0.35, 0.6, land);
  float t = uTime * uMotion;
  if (water > 0.01) {
    float s = vnoise(vPos * 0.08 + vec2(t * 0.30, t * 0.17)) * vnoise(vPos * 0.045 - vec2(t * 0.12, -t * 0.21));
    c += water * (s - 0.22) * 0.09;
  }
  // Fog: R = standard fog. G is kept free for blackout fog (thick clouds hiding the land), not built yet.
  vec4 fg = texture(uFog, mu);
  if (fg.r > 0.01) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 g = mix(c, vec3(l), 0.8) * 0.58 + vec3(0.035, 0.04, 0.055);
    float mist = fbm(vPos * 0.011 + vec2(t * 0.010, t * 0.004));
    g = mix(g, vec3(0.74, 0.76, 0.8), smoothstep(0.42, 0.82, mist) * 0.42);
    c = mix(c, g, fg.r);
  }
  c *= 1.0 - uDim;
  finalColor = vec4(c, 1.0);
}
`;
