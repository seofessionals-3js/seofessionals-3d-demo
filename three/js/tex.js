// Procedural surface textures, generated on the GPU at load time: nothing is downloaded.
// Every recipe is GLSL that describes one tile of a surface (uv 0..1 = `tile` metres) through
//   vec3 albedo(vec2 uv)   linear base colour
//   float height(vec2 uv)  relief in metres (turned into a tangent-space normal map)
//   float rough(vec2 uv)   roughness
// All noise is periodic over the tile, so the maps repeat without seams.
import * as T from 'three';

const VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const LIB = `
precision highp float;
varying vec2 vUv;
uniform vec2 uTexel;
uniform float uTile;
uniform float uStrength;
#define PI 3.14159265
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 h32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
// periodic value noise, 0..1
float vn(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = h12(mod(i, per)), b = h12(mod(i + vec2(1.0, 0.0), per));
  float c = h12(mod(i + vec2(0.0, 1.0), per)), d = h12(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// periodic gradient noise, about -1..1
float gn(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 ga = h22(mod(i, per)) * 2.0 - 1.0, gb = h22(mod(i + vec2(1.0, 0.0), per)) * 2.0 - 1.0;
  vec2 gc = h22(mod(i + vec2(0.0, 1.0), per)) * 2.0 - 1.0, gd = h22(mod(i + vec2(1.0, 1.0), per)) * 2.0 - 1.0;
  float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0)), vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
  return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y) * 1.5;
}
float fbm(vec2 p, vec2 per, int oct) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 8; k++) { if (k >= oct) break; s += a * gn(p, per); p *= 2.0; per *= 2.0; a *= 0.5; }
  return s;
}
float ridged(vec2 p, vec2 per, int oct) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 8; k++) { if (k >= oct) break; s += a * (1.0 - abs(gn(p, per))); p *= 2.0; per *= 2.0; a *= 0.5; }
  return s;
}
// periodic Worley: x = F1, y = F2, z/w = cell hashes
vec4 wor(vec2 p, vec2 per, float jit) {
  vec2 i = floor(p), f = fract(p); float F1 = 9.0, F2 = 9.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)); vec2 c = mod(i + o, per);
    vec2 r = o + 0.5 + (h22(c) - 0.5) * jit - f; float d = dot(r, r);
    if (d < F1) { F2 = F1; F1 = d; id = c; } else if (d < F2) { F2 = d; }
  }
  return vec4(sqrt(F1), sqrt(F2), h12(id + 3.1), h12(id + 17.7));
}
float sat(float x) { return clamp(x, 0.0, 1.0); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

const MAIN_COLOR = `void main() { gl_FragColor = vec4(max(albedo(vUv), 0.0), 1.0); }`;
const MAIN_NORMAL = `void main() {
  vec2 e = uTexel;
  float hx = height(vUv + vec2(e.x, 0.0)) - height(vUv - vec2(e.x, 0.0));
  float hy = height(vUv + vec2(0.0, e.y)) - height(vUv - vec2(0.0, e.y));
  vec3 n = normalize(vec3(-hx / (2.0 * e.x * uTile) * uStrength, -hy / (2.0 * e.y * uTile) * uStrength, 1.0));
  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
}`;
const MAIN_ROUGH = `void main() { gl_FragColor = vec4(1.0, sat(rough(vUv)), 0.0, 1.0); }`;

// ------------------------------------------------------------------ recipes
export const RECIPES = {
  // laminated oak boards, 0.2 m wide, two per row in a 2.4 m tile, staggered rows
  planks: { tile: 2.4, code: `
    vec4 plank(vec2 uv) { float r = floor(uv.y * 12.0); float ly = fract(uv.y * 12.0);
      float x = uv.x * 2.0 + h12(vec2(r, 3.7)); float b = floor(x);
      return vec4(fract(x), ly, h12(vec2(r, mod(b, 2.0)) + 11.1), r); }
    float edgeM(vec4 p) { return min(min(p.y, 1.0 - p.y) * 0.2, min(p.x, 1.0 - p.x) * 1.2); }
    float grainLines(vec2 uv, vec4 p) {
      float w = fbm(vec2(uv.x * 3.0, uv.y * 24.0 + p.z * 40.0), vec2(3.0, 24.0), 4);
      float rings = 0.5 + 0.5 * sin((p.y * 2.2 + w * 1.4 + p.z * 9.0) * 6.2832 * 2.0);
      return pow(rings, 7.0); }
    vec3 albedo(vec2 uv) { vec4 p = plank(uv); float id = p.z;
      vec3 base = mix(vec3(0.42, 0.27, 0.15), vec3(0.62, 0.43, 0.26), id) * (0.92 + 0.16 * h12(vec2(p.w, 9.0)));
      float fine = fbm(vec2(uv.x * 6.0, uv.y * 600.0), vec2(6.0, 600.0), 3);
      float late = grainLines(uv, p);
      float fig = fbm(vec2(uv.x * 2.0, uv.y * 12.0) + id * 13.0, vec2(2.0, 12.0), 3);
      vec3 c = base * (0.9 + 0.1 * fine) * (1.0 - 0.22 * late) * (0.94 + 0.12 * fig);
      float knot = smoothstep(0.08, 0.0, wor(vec2(uv.x * 8.0, uv.y * 12.0), vec2(8.0, 12.0), 0.8).x) * step(0.86, wor(vec2(uv.x * 8.0, uv.y * 12.0), vec2(8.0, 12.0), 0.8).z);
      c *= 1.0 - 0.45 * knot;
      float e = edgeM(p); c *= mix(0.28, 1.0, smoothstep(0.0, 0.0016, e)); c *= mix(0.86, 1.0, smoothstep(0.0, 0.004, e));
      return c; }
    float height(vec2 uv) { vec4 p = plank(uv); float e = edgeM(p);
      return -0.0012 * (1.0 - smoothstep(0.0, 0.0025, e)) - 0.00012 * grainLines(uv, p) + 0.00008 * fbm(vec2(uv.x * 6.0, uv.y * 600.0), vec2(6.0, 600.0), 2); }
    float rough(vec2 uv) { vec4 p = plank(uv); return mix(0.85, 0.42 + 0.12 * grainLines(uv, p) + 0.06 * fbm(uv * 20.0, vec2(20.0), 3), smoothstep(0.0, 0.002, edgeM(p))); }
  ` },
  // herringbone parquet: 7 cm x 42 cm blocks, axis-aligned staircase (rotated 45 deg by the floor's uvs)
  herring: { tile: 0.84, code: `
    vec4 herr(vec2 uv) { float N = 6.0; vec2 p = uv * 12.0;
      float j = floor(p.y); float m = floor((p.x - j) / (2.0 * N)); float hx = (p.x - j) - 2.0 * m * N;
      vec2 loc; vec2 org; float vert;
      if (hx < N) { loc = vec2(hx / N, p.y - j); org = vec2(j + 2.0 * m * N, j); vert = 0.0; }
      else { float c = floor(p.x); float mm = ceil((c + 1.0 - 2.0 * N - p.y) / (2.0 * N)); float y0 = c - 2.0 * mm * N - 2.0 * N + 1.0;
             loc = vec2((p.y - y0) / N, p.x - c); org = vec2(c, y0); vert = 1.0; }
      return vec4(loc, h12(mod(org, 12.0) + vert * 7.7), vert); }
    float edgeM(vec4 q) { return min(min(q.y, 1.0 - q.y) * 0.07, min(q.x, 1.0 - q.x) * 0.42); }
    float grain(vec4 q) { float w = gn(vec2(q.x * 3.0 + q.z * 20.0, q.y * 2.0 + q.z * 31.0), vec2(500.0)) * 0.6 + gn(vec2(q.x * 9.0, q.y * 6.0 + q.z * 50.0), vec2(500.0)) * 0.25;
      return pow(0.5 + 0.5 * sin((q.y * 1.6 + w + q.z * 6.0) * 6.2832 * 2.0), 6.0); }
    vec3 albedo(vec2 uv) { vec4 q = herr(uv);
      vec3 base = mix(vec3(0.36, 0.22, 0.12), vec3(0.58, 0.39, 0.22), q.z);
      float fine = gn(vec2(q.x * 30.0 + q.z * 99.0, q.y * 220.0), vec2(9999.0));
      vec3 c = base * (0.9 + 0.08 * fine) * (1.0 - 0.25 * grain(q));
      float e = edgeM(q); c *= mix(0.3, 1.0, smoothstep(0.0, 0.0012, e)); c *= mix(0.85, 1.0, smoothstep(0.0, 0.003, e));
      return c; }
    float height(vec2 uv) { vec4 q = herr(uv); return -0.0009 * (1.0 - smoothstep(0.0, 0.002, edgeM(q))) - 0.0001 * grain(q); }
    float rough(vec2 uv) { vec4 q = herr(uv); return mix(0.8, 0.38 + 0.12 * grain(q), smoothstep(0.0, 0.0015, edgeM(q))); }
  ` },
  // hand-troweled knock-down stucco
  stucco: { tile: 1.4, code: `
    float plate(vec2 uv) { vec2 w = vec2(fbm(uv * 3.0, vec2(3.0), 3), fbm(uv * 3.0 + 5.2, vec2(3.0), 3));
      float n = fbm(uv * 6.0 + w * 0.9, vec2(6.0), 5); return smoothstep(-0.08, 0.22, n); }
    vec3 albedo(vec2 uv) { float p = plate(uv);
      return vec3(0.83, 0.815, 0.79) * (0.975 + 0.025 * fbm(uv * 5.0, vec2(5.0), 3)) * mix(0.965, 1.0, p); }
    float height(vec2 uv) { return 0.0011 * plate(uv) + 0.00012 * fbm(uv * 70.0, vec2(70.0), 3); }
    float rough(vec2 uv) { return 0.88 - 0.05 * plate(uv); }
  ` },
  // dry-laid fieldstone wall: rounded stones of mixed tones in a recessed mortar bed
  rock: { tile: 2.2, code: `
    vec4 st(vec2 uv) { vec2 per = vec2(5.0, 9.0);
      vec2 w = vec2(fbm(uv * 4.0, vec2(4.0), 3), fbm(uv * 4.0 + 3.1, vec2(4.0), 3)) * 0.22;
      return wor(uv * per + w * per, per, 0.9); }
    vec3 albedo(vec2 uv) { vec4 c = st(uv); float e = c.y - c.x;
      vec3 pal0 = vec3(0.30, 0.22, 0.15), pal1 = vec3(0.42, 0.36, 0.28), pal2 = vec3(0.22, 0.19, 0.17), pal3 = vec3(0.50, 0.40, 0.27);
      vec3 s = c.z < 0.3 ? pal0 : c.z < 0.55 ? pal1 : c.z < 0.8 ? pal2 : pal3;
      s *= 0.75 + 0.5 * c.w;
      float m = fbm(uv * 26.0, vec2(26.0), 4); s *= 0.82 + 0.3 * m;
      s = mix(s, s * vec3(0.8, 0.85, 0.75), smoothstep(0.2, 0.6, fbm(uv * 9.0 + 2.0, vec2(9.0), 3)) * 0.5);
      vec3 mortar = vec3(0.16, 0.145, 0.13) * (0.8 + 0.3 * fbm(uv * 60.0, vec2(60.0), 2));
      return mix(mortar, s, smoothstep(0.03, 0.09, e)); }
    float height(vec2 uv) { vec4 c = st(uv); float e = c.y - c.x;
      return 0.028 * smoothstep(0.02, 0.32, e) + 0.004 * fbm(uv * 30.0, vec2(30.0), 4) * smoothstep(0.04, 0.12, e) - 0.006 * (1.0 - smoothstep(0.03, 0.08, e)); }
    float rough(vec2 uv) { vec4 c = st(uv); return mix(0.95, 0.72 + 0.12 * fbm(uv * 30.0, vec2(30.0), 2), smoothstep(0.03, 0.09, c.y - c.x)); }
  ` },
  // banded travertine with dark pores
  travertine: { tile: 1.2, code: `
    float pit(vec2 uv) { vec4 w = wor(uv * vec2(28.0, 90.0), vec2(28.0, 90.0), 1.0); return smoothstep(0.22, 0.06, w.x) * step(0.72, w.z); }
    vec3 albedo(vec2 uv) {
      float warp = fbm(uv * 3.0, vec2(3.0), 3);
      float b = fbm(vec2(uv.x * 2.0, uv.y * 22.0 + warp * 3.0), vec2(2.0, 22.0), 5);
      vec3 c = mix(vec3(0.46, 0.37, 0.27), vec3(0.74, 0.66, 0.53), smoothstep(-0.45, 0.45, b));
      c = mix(c, vec3(0.86, 0.80, 0.70), smoothstep(0.3, 0.7, fbm(vec2(uv.x * 3.0, uv.y * 40.0 + warp * 4.0), vec2(3.0, 40.0), 4)) * 0.6);
      c *= 0.94 + 0.08 * fbm(uv * 40.0, vec2(40.0), 3);
      return c * (1.0 - 0.45 * pit(uv)); }
    float height(vec2 uv) { return -0.0012 * pit(uv) + 0.00008 * fbm(uv * 50.0, vec2(50.0), 3); }
    float rough(vec2 uv) { return 0.42 + 0.35 * pit(uv); }
  ` },
  // white Calacatta with bold grey veins
  marble: { tile: 1.9, code: `
    float veins(vec2 uv, float f, float sharp, float seed) {
      vec2 w = vec2(fbm(uv * 2.0 + seed, vec2(2.0), 5), fbm(uv * 2.0 + seed + 5.3, vec2(2.0), 5));
      float flow = uv.x * f + uv.y * f * 0.35 + 1.25 * fbm(uv * 3.0 + w * 0.9 + seed, vec2(3.0), 6) * f * 0.33;
      float d = abs(sin(flow * PI));
      float thin = 0.6 + 0.4 * fbm(uv * 6.0 + seed * 2.0, vec2(6.0), 3);
      return exp(-d * sharp / thin); }
    vec3 albedo(vec2 uv) {
      float v1 = veins(uv, 2.0, 22.0, 0.0);
      float v2 = veins(vec2(uv.y, uv.x), 3.0, 46.0, 9.0) * 0.55;
      float v3 = veins(uv + 0.31, 7.0, 90.0, 21.0) * 0.35;
      float cloud = fbm(uv * 4.0, vec2(4.0), 5);
      vec3 c = vec3(0.86, 0.855, 0.84) * (0.955 + 0.045 * cloud);
      c = mix(c, vec3(0.80, 0.78, 0.75), smoothstep(0.1, 0.6, fbm(uv * 2.0 + 3.0, vec2(2.0), 4)) * 0.4);
      c = mix(c, vec3(0.40, 0.395, 0.39), clamp(v1 * 0.9 + v2 + v3, 0.0, 1.0));
      c = mix(c, vec3(0.6, 0.53, 0.44), v1 * 0.18);
      return c; }
    float height(vec2 uv) { return 0.00002 * fbm(uv * 80.0, vec2(80.0), 2); }
    float rough(vec2 uv) { return 0.12 + 0.05 * fbm(uv * 10.0, vec2(10.0), 3); }
  ` },
  // cast concrete with pores and cloudy tone
  concrete: { tile: 3.0, code: `
    float pore(vec2 uv) { vec4 w = wor(uv * 160.0, vec2(160.0), 1.0); return smoothstep(0.16, 0.05, w.x) * step(0.65, w.z); }
    vec3 albedo(vec2 uv) { float g = 0.55 + 0.07 * fbm(uv * 3.0, vec2(3.0), 5) + 0.04 * fbm(uv * 24.0, vec2(24.0), 3);
      return vec3(g) * vec3(1.0, 0.985, 0.96) * (1.0 - 0.4 * pore(uv)); }
    float height(vec2 uv) { return -0.0008 * pore(uv) + 0.00025 * fbm(uv * 40.0, vec2(40.0), 4); }
    float rough(vec2 uv) { return 0.78 + 0.1 * fbm(uv * 8.0, vec2(8.0), 3); }
  ` },
  // plain-weave linen: slubby threads over and under
  linen: { tile: 0.35, code: `
    float th(vec2 uv) { vec2 t = uv * 128.0; vec2 c = floor(t), f = fract(t);
      float over = mod(c.x + c.y, 2.0);
      float slx = 0.75 + 0.5 * vn(vec2(uv.y * 64.0, c.x * 7.1), vec2(64.0, 9999.0));
      float sly = 0.75 + 0.5 * vn(vec2(uv.x * 64.0, c.y * 5.3), vec2(64.0, 9999.0));
      float warp = sin(f.x * PI) * slx, weft = sin(f.y * PI) * sly;
      return max(warp * (0.65 + 0.35 * over), weft * (1.0 - 0.35 * over)); }
    vec3 albedo(vec2 uv) { vec2 t = floor(uv * 128.0);
      float v = 0.9 + 0.1 * h12(vec2(t.x, 1.0)) * h12(vec2(2.0, t.y)) + 0.06 * fbm(uv * 8.0, vec2(8.0), 3);
      return vec3(v) * (0.86 + 0.14 * th(uv)); }
    float height(vec2 uv) { return 0.00045 * th(uv); }
    float rough(vec2 uv) { return 0.92; }
  ` },
  // nubby knit / boucle loops
  knit: { tile: 0.2, code: `
    float lp(vec2 uv) { vec2 p = uv * vec2(40.0, 56.0); p.x += 0.5 * mod(floor(p.y), 2.0);
      vec2 f = fract(p) - 0.5; float v = 1.0 - smoothstep(0.15, 0.5, length(f * vec2(1.0, 1.3)));
      vec4 w = wor(uv * 70.0, vec2(70.0), 1.0); return v * 0.7 + 0.3 * (1.0 - smoothstep(0.0, 0.5, w.x)); }
    vec3 albedo(vec2 uv) { return vec3(0.82 + 0.18 * lp(uv)); }
    float height(vec2 uv) { return 0.0012 * lp(uv); }
    float rough(vec2 uv) { return 0.95; }
  ` },
  // soft pebbled leather
  leather: { tile: 0.5, code: `
    float gr(vec2 uv) { vec4 w = wor(uv * 90.0, vec2(90.0), 1.0); return smoothstep(0.0, 0.22, w.y - w.x); }
    vec3 albedo(vec2 uv) { return vec3(0.9 + 0.1 * gr(uv)) * (0.92 + 0.08 * fbm(uv * 6.0, vec2(6.0), 3)); }
    float height(vec2 uv) { return 0.00035 * gr(uv) + 0.0002 * fbm(uv * 12.0, vec2(12.0), 3); }
    float rough(vec2 uv) { return 0.42 + 0.12 * (1.0 - gr(uv)); }
  ` },
  // lawn ground under the grass blades
  grass: { tile: 1.4, code: `
    float blades(vec2 uv) { float s = 0.0;
      for (int k = 0; k < 3; k++) { float a = float(k) * 2.1; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
        vec4 w = wor(uv * (70.0 + float(k) * 23.0), vec2(70.0 + float(k) * 23.0), 1.0); s += smoothstep(0.32, 0.0, w.x) * (0.5 + 0.5 * w.z); }
      return s / 3.0; }
    vec3 albedo(vec2 uv) { float n = fbm(uv * 5.0, vec2(5.0), 4); float b = blades(uv);
      vec3 dark = vec3(0.030, 0.062, 0.012), lite = vec3(0.115, 0.19, 0.035), dry = vec3(0.21, 0.20, 0.07);
      vec3 c = mix(dark, lite, sat(0.45 + 0.6 * n + 0.5 * b));
      c = mix(c, dry, smoothstep(0.35, 0.75, fbm(uv * 3.0 + 4.0, vec2(3.0), 3)) * 0.35);
      return c * (0.85 + 0.3 * b); }
    float height(vec2 uv) { return 0.004 * blades(uv) + 0.002 * fbm(uv * 12.0, vec2(12.0), 3); }
    float rough(vec2 uv) { return 0.88; }
  ` },
  // clipped box / yew: dense small leaves with dark gaps
  hedge: { tile: 0.9, code: `
    vec4 lv(vec2 uv, float s) { return wor(uv * s, vec2(s), 1.0); }
    float leaf(vec2 uv) { vec4 a = lv(uv, 38.0); vec4 b = lv(uv + 0.37, 53.0);
      float la = smoothstep(0.62, 0.15, a.x) * (0.55 + 0.45 * a.z), lb = smoothstep(0.6, 0.12, b.x) * (0.55 + 0.45 * b.z);
      return max(la, lb * 0.92); }
    vec3 albedo(vec2 uv) { float l = leaf(uv); float n = fbm(uv * 4.0, vec2(4.0), 3);
      vec3 c = mix(vec3(0.010, 0.022, 0.006), mix(vec3(0.05, 0.10, 0.018), vec3(0.11, 0.18, 0.03), sat(0.5 + n)), smoothstep(0.05, 0.6, l));
      return c * (0.8 + 0.4 * lv(uv, 38.0).w); }
    float height(vec2 uv) { return 0.012 * leaf(uv) + 0.006 * fbm(uv * 6.0, vec2(6.0), 3); }
    float rough(vec2 uv) { return 0.62 + 0.25 * (1.0 - leaf(uv)); }
  ` },
  // dark rectangular drive pavers in running bond
  pavers: { tile: 2.6, code: `
    vec4 pv(vec2 uv) { float r = floor(uv.y * 8.0); float ly = fract(uv.y * 8.0); float x = uv.x * 4.0 + 0.5 * mod(r, 2.0); float b = floor(x);
      return vec4(fract(x), ly, h12(vec2(mod(b, 4.0), r) + 2.3), r); }
    float edgeM(vec4 p) { return min(min(p.x, 1.0 - p.x) * 0.65, min(p.y, 1.0 - p.y) * 0.325); }
    vec3 albedo(vec2 uv) { vec4 p = pv(uv); float e = edgeM(p);
      vec3 s = mix(vec3(0.12, 0.115, 0.11), vec3(0.22, 0.21, 0.195), p.z) * (0.85 + 0.25 * fbm(uv * 30.0, vec2(30.0), 4));
      s *= 0.92 + 0.12 * vn(uv * 300.0, vec2(300.0));
      return mix(vec3(0.07, 0.068, 0.065), s, smoothstep(0.003, 0.009, e)); }
    float height(vec2 uv) { vec4 p = pv(uv); float e = edgeM(p); return 0.006 * smoothstep(0.002, 0.012, e) + 0.0006 * fbm(uv * 40.0, vec2(40.0), 3); }
    float rough(vec2 uv) { return 0.82; }
  ` },
  // fine-grained pale sandstone slabs
  sandstone: { tile: 1.6, code: `
    vec3 albedo(vec2 uv) { float n = fbm(uv * 4.0, vec2(4.0), 5); float f = vn(uv * 400.0, vec2(400.0));
      vec3 c = mix(vec3(0.50, 0.47, 0.42), vec3(0.62, 0.59, 0.53), sat(0.5 + n));
      c = mix(c, vec3(0.55, 0.47, 0.36), smoothstep(0.2, 0.7, fbm(vec2(uv.x * 2.0, uv.y * 14.0), vec2(2.0, 14.0), 4)) * 0.25);
      return c * (0.9 + 0.2 * f); }
    float height(vec2 uv) { return 0.0006 * fbm(uv * 30.0, vec2(30.0), 4) + 0.0002 * vn(uv * 400.0, vec2(400.0)); }
    float rough(vec2 uv) { return 0.8; }
  ` },
  // painted board-and-batten (battens every 30 cm), colour from the material
  siding: { tile: 1.2, code: `
    float bat(vec2 uv) { float b = fract(uv.x * 4.0) * 0.3; return smoothstep(0.0, 0.004, b) * smoothstep(0.035, 0.031, b); }
    vec3 albedo(vec2 uv) { return vec3(1.0) * (0.96 + 0.06 * fbm(vec2(uv.x * 40.0, uv.y * 2.0), vec2(40.0, 2.0), 3)); }
    float height(vec2 uv) { return 0.018 * bat(uv) + 0.00015 * fbm(vec2(uv.x * 60.0, uv.y * 3.0), vec2(60.0, 3.0), 3); }
    float rough(vec2 uv) { return 0.6 + 0.06 * fbm(uv * 20.0, vec2(20.0), 2); }
  ` },
  // standing-seam metal: a seam every 48 cm up the slope (u across the slope)
  seam: { tile: 0.96, code: `
    float sm(vec2 uv) { float b = abs(fract(uv.x * 2.0) - 0.5) * 0.48; return smoothstep(0.016, 0.006, b); }
    vec3 albedo(vec2 uv) { return vec3(1.0) * (0.97 + 0.04 * fbm(uv * 6.0, vec2(6.0), 3)); }
    float height(vec2 uv) { return 0.022 * sm(uv) + 0.0012 * fbm(vec2(uv.x * 4.0, uv.y * 1.0), vec2(4.0, 1.0), 3) * (1.0 - sm(uv)); }
    float rough(vec2 uv) { return 0.36 + 0.06 * fbm(uv * 8.0, vec2(8.0), 3); }
  ` },
  // horizontal cedar boards with shiplap shadow lines
  cedar: { tile: 1.8, code: `
    vec4 bd(vec2 uv) { float r = floor(uv.y * 12.0); float ly = fract(uv.y * 12.0); float x = uv.x * 1.0 + h12(vec2(r, 1.3)); float b = floor(x);
      return vec4(fract(x), ly, h12(vec2(r, mod(b, 1.0)) + 4.4), r); }
    vec3 albedo(vec2 uv) { vec4 p = bd(uv);
      vec3 base = mix(vec3(0.34, 0.17, 0.08), vec3(0.55, 0.32, 0.16), p.z);
      float g = fbm(vec2(uv.x * 4.0, uv.y * 140.0 + p.z * 50.0), vec2(4.0, 140.0), 4);
      float rings = pow(0.5 + 0.5 * sin((p.y * 3.0 + g * 1.2 + p.z * 7.0) * 6.2832), 5.0);
      vec3 c = base * (0.88 + 0.15 * g) * (1.0 - 0.2 * rings);
      float e = min(p.y, 1.0 - p.y) * 0.15; return c * mix(0.25, 1.0, smoothstep(0.0, 0.004, e)); }
    float height(vec2 uv) { vec4 p = bd(uv); float e = min(p.y, 1.0 - p.y) * 0.15; return -0.004 * (1.0 - smoothstep(0.0, 0.006, e)) + 0.0002 * fbm(vec2(uv.x * 4.0, uv.y * 140.0), vec2(4.0, 140.0), 3); }
    float rough(vec2 uv) { return 0.68; }
  ` },
  // straight-grained veneer for joinery and furniture (tinted per wood by the material colour)
  veneer: { tile: 1.2, code: `
    float g(vec2 uv) { float w = fbm(vec2(uv.x * 1.0, uv.y * 4.0), vec2(1.0, 4.0), 5);
      float w2 = fbm(vec2(uv.x * 3.0, uv.y * 12.0), vec2(3.0, 12.0), 3);
      float lines = 0.5 + 0.5 * sin((uv.y * 30.0 + w * 2.6 + w2 * 0.5) * 6.2832);
      float cath = smoothstep(0.45, 0.95, fbm(vec2(uv.x * 2.0, uv.y * 3.0), vec2(2.0, 3.0), 3));
      return pow(lines, 4.0) * (0.35 + 0.65 * cath); }
    vec3 albedo(vec2 uv) { float fine = fbm(vec2(uv.x * 8.0, uv.y * 420.0), vec2(8.0, 420.0), 3);
      float fig = fbm(vec2(uv.x * 3.0, uv.y * 6.0), vec2(3.0, 6.0), 3);
      return vec3(0.98, 0.93, 0.86) * (0.9 + 0.1 * fine) * (1.0 - 0.26 * g(uv)) * (0.94 + 0.1 * fig); }
    float height(vec2 uv) { return -0.00008 * g(uv) + 0.00004 * fbm(vec2(uv.x * 8.0, uv.y * 420.0), vec2(8.0, 420.0), 2); }
    float rough(vec2 uv) { return 0.42 + 0.12 * g(uv); }
  ` },
  // large-format porcelain tiles (60 cm) with fine grout
  porcelain: { tile: 1.2, code: `
    float joint(vec2 uv) { vec2 f = fract(uv * 2.0) * 0.6; float e = min(min(f.x, 0.6 - f.x), min(f.y, 0.6 - f.y)); return smoothstep(0.0012, 0.003, e); }
    vec3 albedo(vec2 uv) { vec2 cell = floor(uv * 2.0); float t = 0.97 + 0.05 * h12(mod(cell, 2.0) + 3.0);
      float n = 0.6 + 0.05 * fbm(uv * 6.0, vec2(6.0), 4) + 0.025 * vn(uv * 200.0, vec2(200.0));
      return mix(vec3(0.26, 0.255, 0.25), vec3(n) * vec3(1.0, 0.99, 0.975) * t, joint(uv)); }
    float height(vec2 uv) { return -0.0015 * (1.0 - joint(uv)); }
    float rough(vec2 uv) { return mix(0.85, 0.32 + 0.06 * fbm(uv * 12.0, vec2(12.0), 2), joint(uv)); }
  ` },
  asphalt: { tile: 4.0, code: `
    vec3 albedo(vec2 uv) { float n = fbm(uv * 6.0, vec2(6.0), 4); vec4 w = wor(uv * 500.0, vec2(500.0), 1.0);
      float stone = smoothstep(0.35, 0.1, w.x) * w.z; return vec3(0.06 + 0.02 * n + 0.07 * stone); }
    float height(vec2 uv) { vec4 w = wor(uv * 500.0, vec2(500.0), 1.0); return 0.0015 * smoothstep(0.45, 0.0, w.x); }
    float rough(vec2 uv) { return 0.9; }
  ` },
  gravel: { tile: 1.2, code: `
    vec4 pb(vec2 uv) { return wor(uv * 46.0, vec2(46.0), 1.0); }
    vec3 albedo(vec2 uv) { vec4 w = pb(uv); vec3 c = mix(vec3(0.36, 0.34, 0.31), vec3(0.62, 0.58, 0.52), w.z); c = mix(c, vec3(0.45, 0.38, 0.30), step(0.8, w.w) * 0.6);
      return c * mix(0.25, 1.0, smoothstep(0.02, 0.12, w.y - w.x)) * (0.85 + 0.2 * fbm(uv * 90.0, vec2(90.0), 2)); }
    float height(vec2 uv) { vec4 w = pb(uv); return 0.008 * smoothstep(0.0, 0.4, w.y - w.x); }
    float rough(vec2 uv) { return 0.75; }
  ` },
  bark: { tile: 1.0, code: `
    float rd(vec2 uv) { vec2 w = vec2(fbm(uv * vec2(3.0, 1.0), vec2(3.0, 1.0), 3), 0.0) * 0.08;
      return ridged(vec2(uv.x * 10.0, uv.y * 2.0) + w * vec2(10.0, 2.0), vec2(10.0, 2.0), 5); }
    vec3 albedo(vec2 uv) { float r = rd(uv); vec3 c = mix(vec3(0.05, 0.045, 0.04), vec3(0.24, 0.22, 0.2), smoothstep(0.35, 0.8, r));
      return c * (0.85 + 0.3 * fbm(uv * 20.0, vec2(20.0), 3)) + vec3(0.02, 0.03, 0.0) * smoothstep(0.3, 0.8, fbm(uv * 6.0 + 2.0, vec2(6.0), 3)); }
    float height(vec2 uv) { return 0.02 * rd(uv); }
    float rough(vec2 uv) { return 0.92; }
  ` },
  pegboard: { tile: 0.6, code: `
    float hole(vec2 uv) { vec2 f = fract(uv * 24.0) - 0.5; return smoothstep(0.17, 0.13, length(f)); }
    vec3 albedo(vec2 uv) { return mix(vec3(0.42, 0.42, 0.41) * (0.95 + 0.05 * fbm(uv * 10.0, vec2(10.0), 3)), vec3(0.02), hole(uv)); }
    float height(vec2 uv) { return -0.002 * hole(uv); }
    float rough(vec2 uv) { return 0.7; }
  ` },
  // flat-woven wool rug with a quiet diamond pattern
  rug: { tile: 1.2, code: `
    float loops(vec2 uv) { vec2 p = uv * vec2(180.0, 240.0); vec2 f = fract(p) - 0.5; return 1.0 - smoothstep(0.1, 0.5, length(f)); }
    vec3 albedo(vec2 uv) { vec2 d = abs(fract(uv * 4.0) - 0.5); float dia = abs(d.x + d.y - 0.32);
      float line = smoothstep(0.03, 0.012, dia);
      vec3 c = vec3(0.70, 0.64, 0.54) * (0.92 + 0.1 * fbm(uv * 12.0, vec2(12.0), 3));
      c = mix(c, vec3(0.44, 0.39, 0.32), line * 0.7);
      return c * (0.86 + 0.14 * loops(uv)); }
    float height(vec2 uv) { return 0.0012 * loops(uv) + 0.0004 * fbm(uv * 30.0, vec2(30.0), 2); }
    float rough(vec2 uv) { return 0.97; }
  ` },
  // mottled limewash (tinted clay by the material colour)
  limewash: { tile: 2.0, code: `
    float br(vec2 uv) { vec2 w = vec2(fbm(uv * 2.0, vec2(2.0), 3), fbm(uv * 2.0 + 9.0, vec2(2.0), 3));
      return fbm(uv * vec2(5.0, 9.0) + w * 1.5, vec2(5.0, 9.0), 6); }
    vec3 albedo(vec2 uv) { return vec3(0.9 + 0.14 * br(uv)) * (0.97 + 0.03 * fbm(uv * 40.0, vec2(40.0), 2)); }
    float height(vec2 uv) { return 0.0004 * br(uv) + 0.00008 * fbm(uv * 60.0, vec2(60.0), 3); }
    float rough(vec2 uv) { return 0.9; }
  ` },
  // brushed steel
  brushed: { tile: 0.5, code: `
    vec3 albedo(vec2 uv) { return vec3(0.96 + 0.04 * fbm(vec2(uv.x * 2.0, uv.y * 600.0), vec2(2.0, 600.0), 3)); }
    float height(vec2 uv) { return 0.000012 * fbm(vec2(uv.x * 3.0, uv.y * 900.0), vec2(3.0, 900.0), 3); }
    float rough(vec2 uv) { return 0.26 + 0.06 * fbm(vec2(uv.x * 2.0, uv.y * 300.0), vec2(2.0, 300.0), 2); }
  ` },
  // pool water: a tileable swell for the animated normal map
  water: { tile: 4.0, code: `
    vec3 albedo(vec2 uv) { return vec3(1.0); }
    float height(vec2 uv) { return 0.025 * fbm(uv * 4.0, vec2(4.0), 6) + 0.01 * fbm(uv * 12.0 + 3.0, vec2(12.0), 4); }
    float rough(vec2 uv) { return 0.0; }
  ` },
};

// ------------------------------------------------------------------ generator
export class TexGen {
  constructor(renderer, { size = 1024, heroSize = 2048, aniso = 8 } = {}) {
    this.renderer = renderer;
    this.size = size; this.heroSize = heroSize; this.aniso = aniso;
    this.scene = new T.Scene();
    this.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.cache = new Map();
  }
  pass(code, main, size, { srgb = false, tile = 1, strength = 1 } = {}) {
    const rt = new T.WebGLRenderTarget(size, size, {
      type: T.UnsignedByteType, format: T.RGBAFormat, colorSpace: srgb ? T.SRGBColorSpace : T.NoColorSpace,
      generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter,
      wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, depthBuffer: false, anisotropy: this.aniso,
    });
    this.quad.material = new T.ShaderMaterial({
      vertexShader: VS, fragmentShader: LIB + code + main,
      uniforms: { uTexel: { value: new T.Vector2(1 / size, 1 / size) }, uTile: { value: tile }, uStrength: { value: strength } },
      depthTest: false, depthWrite: false,
    });
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.scene, this.cam);
    this.renderer.setRenderTarget(prev);
    this.quad.material.dispose();
    return rt.texture;
  }
  // { map, normalMap, roughnessMap } for a recipe
  get(name, { hero = false, strength = 1, rough = true } = {}) {
    const key = name + '|' + strength + '|' + hero;
    if (this.cache.has(key)) return this.cache.get(key);
    const r = RECIPES[name];
    const size = hero ? this.heroSize : this.size;
    const out = {
      map: this.pass(r.code, MAIN_COLOR, size, { srgb: true }),
      normalMap: this.pass(r.code, MAIN_NORMAL, size, { tile: r.tile, strength }),
      roughnessMap: rough ? this.pass(r.code, MAIN_ROUGH, Math.max(256, size / 2)) : null,
      tile: r.tile,
    };
    this.cache.set(key, out);
    return out;
  }
}

// ------------------------------------------------------------------ canvas art (generative, in the spirit of the
// af Klint and Klee prints the Blender scene hung), drawn at load
export function artTexture(kind, w = 512, h = 640, seed = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  if (kind === 'circles') {
    g.fillStyle = '#e9dfcc'; g.fillRect(0, 0, w, h);
    const cols = ['#d9643a', '#2f3b5c', '#e8b04b', '#9cb8a8', '#c85a7c', '#f2efe6'];
    for (let i = 0; i < 9; i++) {
      const r = (0.12 + rnd() * 0.22) * w, x = (0.15 + rnd() * 0.7) * w, y = (0.12 + rnd() * 0.76) * h;
      g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.92;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      if (rnd() > 0.5) { g.fillStyle = cols[(i + 2) % cols.length]; g.beginPath(); g.arc(x, y, r, Math.PI * rnd(), Math.PI * (1 + rnd())); g.fill(); }
    }
    g.globalAlpha = 1; g.strokeStyle = '#2b2a28'; g.lineWidth = w * 0.006;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(rnd() * w, rnd() * h); g.bezierCurveTo(rnd() * w, rnd() * h, rnd() * w, rnd() * h, rnd() * w, rnd() * h); g.stroke(); }
  } else if (kind === 'grid') {
    const cols = ['#c8553d', '#e3b23c', '#5b8e7d', '#3d5a80', '#ee8959', '#98c1d9', '#b5838d', '#e0d7c6'];
    const n = 7, m = 9;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.fillRect(i * w / n, j * h / m, w / n + 1, h / m + 1);
    }
    g.globalAlpha = 0.25; g.fillStyle = '#000';
    for (let k = 0; k < 4000; k++) g.fillRect(rnd() * w, rnd() * h, 1.2, 1.2);
    g.globalAlpha = 1; g.strokeStyle = '#1f1d1a'; g.lineWidth = w * 0.008;
    g.beginPath(); g.moveTo(w * 0.1, h * 0.85); g.lineTo(w * 0.5, h * 0.25); g.lineTo(w * 0.9, h * 0.85); g.stroke();
    g.fillStyle = '#f2a541'; g.beginPath(); g.arc(w * 0.75, h * 0.2, w * 0.07, 0, Math.PI * 2); g.fill();
  } else if (kind === 'petals') {
    g.fillStyle = '#f0e8da'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const cols = ['#1e3d59', '#f5c0a8', '#ff6e40', '#ffc13b', '#4a7c59'];
    for (let ring = 4; ring > 0; ring--) {
      const n = 6 + ring * 2, R = ring * w * 0.1;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + ring;
        g.fillStyle = cols[(i + ring) % cols.length]; g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6, R * 0.35, R * 0.12, a, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1; g.fillStyle = '#1e3d59'; g.beginPath(); g.arc(cx, cy, w * 0.06, 0, Math.PI * 2); g.fill();
  } else {   // abstract washes
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#d8cbb3'); grd.addColorStop(1, '#a79b86');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      g.globalAlpha = 0.35 + rnd() * 0.4; g.fillStyle = ['#3e4a3d', '#c27c4e', '#ece4d4', '#2c3640'][i % 4];
      g.fillRect(rnd() * w * 0.6, rnd() * h * 0.7, w * (0.2 + rnd() * 0.5), h * (0.1 + rnd() * 0.3));
    }
    g.globalAlpha = 1;
  }
  // canvas grain
  const im = g.getImageData(0, 0, w, h);
  for (let i = 0; i < im.data.length; i += 4) { const n = (rnd() - 0.5) * 14; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
  g.putImageData(im, 0, 0);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// leaf clusters for the tree crowns: alpha-tested cards, drawn on a canvas
export function leafTexture(size = 512, seed = 3, tone = 0) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  let s = seed * 7919 + 13;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  g.clearRect(0, 0, size, size);
  const N = 70;
  for (let i = 0; i < N; i++) {
    const r = Math.sqrt(rnd()) * size * 0.42, a = rnd() * Math.PI * 2;
    const x = size / 2 + Math.cos(a) * r, y = size / 2 + Math.sin(a) * r;
    const L = size * (0.07 + rnd() * 0.05), W = L * (0.38 + rnd() * 0.12), rot = rnd() * Math.PI * 2;
    const lt = 0.55 + rnd() * 0.45;
    const hue = tone ? [84 + rnd() * 16, 30 + rnd() * 16] : [76 + rnd() * 22, 34 + rnd() * 18];
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = `hsl(${hue[0]}, ${hue[1]}%, ${(10 + lt * 17).toFixed(1)}%)`;
    g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -W, L / 2, 0); g.quadraticCurveTo(0, W, -L / 2, 0); g.fill();
    g.strokeStyle = `hsla(${hue[0]}, 30%, 40%, 0.5)`; g.lineWidth = size * 0.002; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
    g.restore();
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
  return t;
}
