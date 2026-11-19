// A small modelling kit in Blender's coordinates (z up, metres), mirroring the helpers of scripts/world.py, so the
// house can be described the same way. Every primitive is baked into world space and merged per (zone, material);
// build() turns the buckets into a handful of meshes in three.js coordinates (y up).
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const Z2Y = new T.Matrix4().makeRotationX(-Math.PI / 2);      // (x, y, z) -> (x, z, -y)
export const B = (x, y, z) => new T.Vector3(x, z, -y);

export function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// small 3D value noise for wrinkles and lumps
function hash3(x, y, z) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    r += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return r;
}

const _e = new T.Euler(0, 0, 0, 'ZYX');      // Blender 'XYZ' euler == three 'ZYX' (X applied first)
const _q = new T.Quaternion();
export function mat4(loc = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  _e.set(rot[0], rot[1], rot[2], 'ZYX'); _q.setFromEuler(_e);
  return new T.Matrix4().compose(new T.Vector3(loc[0], loc[1], loc[2]), _q, new T.Vector3(scale[0], scale[1], scale[2]));
}

// ------------------------------------------------------------------ geometry generators (local, z up)
// surface of revolution around z from an (r, z) profile; split normals at sharp corners; uvs in metres
export function latheGeo(prof, seg = 48, crease = 40) {
  const P = prof.length;
  let A = 0;
  for (let i = 0; i < P; i++) { const [r0, z0] = prof[i], [r1, z1] = prof[(i + 1) % P]; A += r0 * z1 - r1 * z0; }
  const sg = A >= 0 ? 1 : -1;
  const segN = [];
  for (let i = 0; i < P - 1; i++) {
    const dr = prof[i + 1][0] - prof[i][0], dz = prof[i + 1][1] - prof[i][1];
    const l = Math.hypot(dr, dz) || 1e-9; segN.push([sg * dz / l, -sg * dr / l]);
  }
  const L = [0];
  for (let i = 1; i < P; i++) L.push(L[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const rmax = Math.max(...prof.map((p) => p[0]), 1e-3);
  const cosC = Math.cos(crease * Math.PI / 180);
  // rings: [r, z, nr, nz, arc]
  const rings = [], segRing = [];
  for (let i = 0; i < P; i++) {
    const nPrev = i > 0 ? segN[i - 1] : null, nNext = i < P - 1 ? segN[i] : null;
    if (nPrev && nNext && nPrev[0] * nNext[0] + nPrev[1] * nNext[1] > cosC) {
      const nr = nPrev[0] + nNext[0], nz = nPrev[1] + nNext[1], l = Math.hypot(nr, nz) || 1;
      rings.push([prof[i][0], prof[i][1], nr / l, nz / l, L[i]]); const k = rings.length - 1;
      segRing[i] = { end: k, start: k };
    } else {
      const ent = {};
      if (nPrev) { rings.push([prof[i][0], prof[i][1], nPrev[0], nPrev[1], L[i]]); ent.end = rings.length - 1; }
      if (nNext) { rings.push([prof[i][0], prof[i][1], nNext[0], nNext[1], L[i]]); ent.start = rings.length - 1; }
      segRing[i] = ent;
    }
  }
  const pos = [], nor = [], uv = [], idx = [];
  for (const [r, z, nr, nz, arc] of rings) {
    for (let j = 0; j <= seg; j++) {
      const t = j / seg * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      pos.push(r * c, r * s, z); nor.push(nr * c, nr * s, nz);
      if (Math.abs(nz) > 0.7) uv.push(r * c, r * s); else uv.push(t * rmax, arc);
    }
  }
  const W = seg + 1;
  for (let i = 0; i < P - 1; i++) {
    const a = segRing[i].start, b = segRing[i + 1].end;
    for (let j = 0; j < seg; j++) {
      const p0 = a * W + j, p1 = a * W + j + 1, q0 = b * W + j, q1 = b * W + j + 1;
      if (sg > 0) idx.push(p0, p1, q1, p0, q1, q0); else idx.push(p0, q1, p1, p0, q0, q1);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function cylProfile(r1, r2, h, bevel = 0) {
  if (bevel <= 0) return [[0, 0], [r1, 0], [r2, h], [0, h]];
  const b = Math.min(bevel, r1 * 0.5, r2 * 0.5, h * 0.5), p = [[0, 0]];
  for (let k = 0; k <= 3; k++) { const a = -Math.PI / 2 + k / 3 * Math.PI / 2; p.push([r1 - b + Math.cos(a) * b, b + Math.sin(a) * b]); }
  for (let k = 0; k <= 3; k++) { const a = k / 3 * Math.PI / 2; p.push([r2 - b + Math.cos(a) * b, h - b + Math.sin(a) * b]); }
  p.push([0, h]);
  return p;
}

// a soft upholstered block: rounded box, puffed faces and faint wrinkles (Blender's cushion())
export function cushionGeo(sx, sy, sz, puff = 0.035, round = 0.06, wrinkle = 0.006, seed = 1) {
  const R = Math.max(0.004, Math.min(round, sx / 2 - 1e-3, sy / 2 - 1e-3, sz / 2 - 1e-3));
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const ix = hx - R, iy = hy - R, iz = hz - R;
  const step = Math.min(R / 1.8, 0.045);
  const n = (L) => Math.max(4, Math.min(48, Math.ceil(L / step)));
  const pos = [], idx = [];
  const face = (axis, sign) => {
    const ax = [[1, 2], [0, 2], [0, 1]][axis];
    const h = [hx, hy, hz];
    const nu = n(2 * h[ax[0]]), nv = n(2 * h[ax[1]]);
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const q = [0, 0, 0];
      q[axis] = sign * h[axis];
      // cluster vertices towards the edges, where the rounding is
      const su = i / nu * 2 - 1, sv = j / nv * 2 - 1;
      const cu = Math.sign(su) * Math.pow(Math.abs(su), 0.8), cv = Math.sign(sv) * Math.pow(Math.abs(sv), 0.8);
      q[ax[0]] = cu * h[ax[0]]; q[ax[1]] = cv * h[ax[1]];
      pos.push(q[0], q[1], q[2]);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      const flip = (axis === 1) ? sign < 0 : sign > 0;
      if (flip) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
    }
  };
  for (let a = 0; a < 3; a++) { face(a, 1); face(a, -1); }
  const out = [];
  for (let k = 0; k < pos.length; k += 3) {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2];
    const cx = Math.max(-ix, Math.min(ix, x)), cy = Math.max(-iy, Math.min(iy, y)), cz = Math.max(-iz, Math.min(iz, z));
    let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    let px = cx + dx * R, py = cy + dy * R, pz = cz + dz * R;
    const fx = Math.max(0, 1 - (x / hx) ** 2), fy = Math.max(0, 1 - (y / hy) ** 2), fz = Math.max(0, 1 - (z / hz) ** 2);
    px += Math.sign(x) * puff * 0.5 * fy * fz * Math.abs(dx);
    py += Math.sign(y) * puff * 0.5 * fx * fz * Math.abs(dy);
    pz += (z > 0 ? puff : -puff * 0.3) * fx * fy * Math.abs(dz);
    if (wrinkle > 0) {
      const w = (vnoise3(px * 11 + seed * 3.1, py * 11, pz * 11) - 0.5) * 2 * wrinkle;
      px += dx * w; py += dy * w; pz += dz * w;
    }
    out.push(px, py, pz + hz);
  }
  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(out, 3));
  g.setIndex(idx);
  g = mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ the kit
export class Kit {
  constructor(seed = 7) {
    this.buckets = new Map();
    this.zoneName = 'EXT';
    this.rnd = mulberry(seed);
    this.stack = [new T.Matrix4()];
    this.lights = [];
    this.flames = [];
    this.marks = {};
  }
  zone(z) { this.zoneName = z; }
  r(a = 0, b = 1) { return a + (b - a) * this.rnd(); }
  pick(a) { return a[Math.floor(this.rnd() * a.length) % a.length]; }
  group(loc, rot, fn) { this.stack.push(this.top().clone().multiply(mat4(loc, rot))); try { fn(); } finally { this.stack.pop(); } }
  top() { return this.stack[this.stack.length - 1]; }

  // uv by projection along the dominant normal axis (in metres), optionally turned so wood runs along long faces
  static project(g, size, grain) {
    const p = g.attributes.position, nrm = g.attributes.normal, n = p.count;
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let u, v, swap = false;
      if (nx >= ny && nx >= nz) { u = y; v = z; if (grain && size) swap = size[2] > size[1]; }
      else if (ny >= nz) { u = x; v = z; if (grain && size) swap = size[2] > size[0]; }
      else { u = x; v = y; if (grain && size) swap = size[1] > size[0]; }
      if (swap) { const t = u; u = v; v = t; }
      uv[i * 2] = u; uv[i * 2 + 1] = v;
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  }

  // add a local geometry: uvMode 'local' | 'world' | 'own'
  push(g, mat, m, { uvMode = 'local', size = null, uvRot = 0, uvOff = null } = {}) {
    if (!mat) return;
    const world = this.top().clone().multiply(m);
    const ud = mat.userData || {};
    if (!g.attributes.normal) g.computeVertexNormals();
    if (uvMode === 'local') Kit.project(g, size, ud.grain);
    g.applyMatrix4(world);
    if (uvMode === 'world') Kit.project(g, null, false);
    const tile = ud.tile || 1, rot = uvRot || ud.uvRot || 0;
    const uv = g.attributes.uv;
    if (uv) {
      const c = Math.cos(rot), s = Math.sin(rot);
      for (let i = 0; i < uv.count; i++) {
        let u = uv.getX(i), v = uv.getY(i);
        if (uvOff) { u += uvOff[0]; v += uvOff[1]; }
        uv.setXY(i, (u * c - v * s) / tile, (u * s + v * c) / tile);
      }
    }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.index) { const a = []; for (let i = 0; i < g.attributes.position.count; i++) a.push(i); g.setIndex(a); }
    const key = this.zoneName + '|' + mat.uuid;
    let b = this.buckets.get(key);
    if (!b) { b = { zone: this.zoneName, mat, geos: [] }; this.buckets.set(key, b); }
    b.geos.push(g);
  }

  // ---- primitives (Blender semantics: loc is the bottom centre)
  box(size, loc, mat, { bevel = 0, rot = [0, 0, 0], uv = null, uvRot = 0, scale = null } = {}) {
    const [sx, sy, sz] = size;
    if (sx <= 0 || sy <= 0 || sz <= 0) return;
    let g;
    const mn = Math.min(sx, sy, sz);
    if (bevel >= 0.004 && mn > 0.012) {
      const r = Math.min(bevel, mn / 2 - 1e-4);
      g = new RoundedBoxGeometry(sx, sy, sz, bevel > 0.012 ? 2 : 1, r);
    } else g = new T.BoxGeometry(sx, sy, sz);
    g.translate(0, 0, sz / 2);
    const rotated = rot[0] || rot[1] || rot[2];
    const mode = uv || ((mat && mat.userData && (mat.userData.grain || mat.userData.local)) || rotated ? 'local' : 'world');
    this.push(g, mat, mat4(loc, rot, scale || [1, 1, 1]), { uvMode: mode, size: [sx, sy, sz], uvRot });
  }
  cyl(r1, r2, h, loc, mat, { seg = 48, bevel = 0, rot = [0, 0, 0], scale = null } = {}) {
    if (h <= 0) return;
    this.push(latheGeo(cylProfile(r1, r2, h, bevel), seg), mat, mat4(loc, rot, scale || [1, 1, 1]), { uvMode: 'own' });
  }
  lathe(prof, loc, mat, { seg = 48, sx = 1, sy = 1, rot = [0, 0, 0] } = {}) {
    this.push(latheGeo(prof, seg), mat, mat4(loc, rot, [sx, sy, 1]), { uvMode: 'own' });
  }
  rod(a, b, r, mat, seg = 16) {
    const A = new T.Vector3(...a), Bv = new T.Vector3(...b), d = Bv.clone().sub(A), L = d.length();
    if (L < 1e-6) return;
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d.normalize());
    const m = new T.Matrix4().compose(A, q, new T.Vector3(1, 1, 1));
    this.push(latheGeo(cylProfile(r, r, L), seg), mat, m, { uvMode: 'own' });
  }
  plane(w, h, loc, mat, rot = [0, 0, 0], { unit = false } = {}) {
    const g = new T.PlaneGeometry(w, h);
    if (!unit) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); }
    else { const t = (mat.userData && mat.userData.tile) || 1; const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * t, uv.getY(i) * t); }
    this.push(g, mat, mat4(loc, rot), { uvMode: 'own' });
  }
  cushion(size, loc, mat, { puff = 0.035, round = 0.06, rot = [0, 0, 0], wrinkle = 0.006 } = {}) {
    const g = cushionGeo(size[0], size[1], size[2], puff, round, wrinkle, Math.floor(this.rnd() * 100));
    this.push(g, mat, mat4(loc, rot), { uvMode: 'local', size });
  }
  // raw geometry already in local coordinates
  mesh(g, mat, m = new T.Matrix4(), opts = {}) { this.push(g, mat, m, opts); }

  light(spec) { const w = this.top(); const p = new T.Vector3(...spec.pos).applyMatrix4(w); this.lights.push({ ...spec, pos: [p.x, p.y, p.z], zone: spec.zone || this.zoneName }); }

  // ---- merge into meshes (three coordinates)
  build(root, variant = (m) => m) {
    const meshes = [];
    for (const b of this.buckets.values()) {
      let g;
      try { g = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false); } catch (e) { console.warn('merge failed', b.mat.name, e); continue; }
      if (!g) { console.warn('merge returned null', b.mat.name); continue; }
      g.applyMatrix4(Z2Y);
      g.computeBoundingSphere(); g.computeBoundingBox();
      const mat = variant(b.mat, b.zone);
      const mesh = new T.Mesh(g, mat);
      mesh.name = b.zone + ':' + (b.mat.name || '');
      mesh.castShadow = mat.userData.cast !== false;
      mesh.receiveShadow = mat.userData.receive !== false;
      mesh.userData.zone = b.zone;
      if (mat.userData.noAO) mesh.userData.noAO = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      root.add(mesh); meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}
