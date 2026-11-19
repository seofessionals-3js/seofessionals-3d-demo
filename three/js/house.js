// The Linden house, ported from scripts/world.py (Blender coordinates, metres): shell, porch, roofs, hardscape,
// pool and all seven rooms with their furniture. Lights are recorded as specs (K.lights) for the light pool.
import * as T from 'three';
import { mat4, latheGeo } from './kit.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { loungeChair, armChair, diningChair, sideTable, vase, candleholders, kettle, jug, pot, alarmClock, mantelClock } from './furniture.js';

export const FL = 0.45, TOP = 3.4, CEIL = 3.35;
export const HX0 = 4.2, HX1 = 14.0, HY0 = 2.2, HY1 = 13.6;
export const ET = 0.22, IT = 0.12;
export const ROOMS = {
  hall: [8.0, 2.2, 9.4, 9.6], study: [4.2, 2.2, 8.0, 6.2], living: [9.4, 2.2, 14.0, 8.0],
  kitchen: [9.4, 8.0, 14.0, 13.6], bath: [4.2, 6.2, 8.0, 9.6], bed: [4.2, 9.6, 9.4, 13.6], garage: [0.0, 0.0, 4.2, 6.2],
};
export const GY1 = 6.2;
export const DOOR_X = 8.7;
export const DRIVE_Y0 = -19.25;
export const WALL_Y = DRIVE_Y0 + 0.15;
export const PX0 = 13.5, PX1 = 22.5, PY0 = 19.0, PY1 = 23.0, PC = 0.35;
export const CHY = 5.1;
export const FT = [12.8, 15.4];
export const TY1 = 17.2;
// the front door hinges on its right jamb (seen from the street)
export const DOOR_HINGE = [DOOR_X + 0.5 - 0.01, HY0 + 0.02, FL];

export function buildHouse(K, M, BOOKS) {
  const R = (a, b) => K.r(a, b);
  const box = (size, loc, mat, bevel = 0, rot = [0, 0, 0], o = {}) => K.box(size, loc, mat, { bevel, rot, ...o });
  const cyl = (r1, r2, h, loc, mat, seg = 48, bevel = 0, rot = [0, 0, 0], scale = null) => K.cyl(r1, r2, h, loc, mat, { seg, bevel, rot, scale });
  const rod = (a, b, r, mat, seg = 16) => K.rod(a, b, r, mat, seg);
  const lathe = (prof, loc, mat, seg = 48, sx = 1, sy = 1) => K.lathe(prof, loc, mat, { seg, sx, sy });
  const plane = (w, h, loc, mat, rot = [0, 0, 0], unit = false) => K.plane(w, h, loc, mat, rot, { unit });
  const cushion = (size, loc, mat, puff = 0.035, round = 0.06, rot = [0, 0, 0], wrinkle = 0.006) => K.cushion(size, loc, mat, { puff, round, rot, wrinkle });
  const PI = Math.PI;
  const light = (type, pos, energy, color = [1.0, 0.8, 0.58], extra = {}) => K.light({ type, pos, energy, color, ...extra });

  function segBox(alongX, c, a, b, za, zb, t, off, mat, bevel = 0) {
    if (alongX) box([b - a, t, zb - za], [(a + b) / 2, c + off, za], mat, bevel);
    else box([t, b - a, zb - za], [c + off, (a + b) / 2, za], mat, bevel);
  }
  function wall(alongX, c, a0, a1, z0, z1, holes, mat, { t = IT, skin = null, skinSide = 0, sides = [], base = true, casingSides = [], skinZ0 = null, core = true } = {}) {
    const cuts = [...new Set([a0, a1, ...holes.map((h) => h[0]), ...holes.map((h) => h[1])])].sort((p, q) => p - q);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k], b = cuts[k + 1];
      if (b - a < 1e-6) continue;
      const hs = holes.filter((h) => h[0] <= a + 1e-6 && h[1] >= b - 1e-6).sort((p, q) => p[2] - q[2]);
      let z = z0; const spans = [];
      for (const h of hs) { if (h[2] > z) spans.push([z, h[2]]); z = h[3]; }
      if (z < z1) spans.push([z, z1]);
      for (const [za, zb] of spans) {
        if (core) segBox(alongX, c, a, b, za, zb, t, 0, mat);
        if (skin) { const zs0 = skinZ0 !== null && za <= z0 + 1e-6 ? skinZ0 : za; segBox(alongX, c, a, b, zs0, zb, 0.03, skinSide * (t / 2 + 0.015), skin); }
        if (base && za <= z0 + 1e-6) for (const s of sides) segBox(alongX, c, a, b, z0, z0 + 0.07, 0.01, s * (t / 2 + 0.005), M.paint);
      }
    }
    for (const [h0, h1, zb, , kind] of holes) {
      if (kind === 'win') for (const s of casingSides) segBox(alongX, c, h0, h1, zb - 0.03, zb, t / 2 + 0.03, s * (t / 4 + 0.015), M.travertine, 0.003);
    }
  }
  function windowUnit(alongX, c, h0, h1, zb, zt, outward, kind = 'win') {
    const w = h1 - h0, h = zt - zb, mid = (h0 + h1) / 2, fd = 0.08, fw = 0.045;
    const sgn = outward === '+y' || outward === '+x' ? 1 : -1;
    const put = (a, b, za, zb_, t, off, mat) => segBox(alongX, c, a, b, za, zb_, t, off, mat, 0.002);
    put(h0, h1, zb, zb + fw, fd, 0, M.black); put(h0, h1, zt - fw, zt, fd, 0, M.black);
    put(h0, h0 + fw, zb, zt, fd, 0, M.black); put(h1 - fw, h1, zb, zt, fd, 0, M.black);
    if (kind === 'door') put(mid - 0.025, mid + 0.025, zb, zt, fd, 0, M.black);
    const off = sgn * (ET / 2 + 0.035);
    put(h0 - 0.04, h1 + 0.04, zt, zt + 0.04, 0.07, off, M.black);
    if (kind === 'win') put(h0 - 0.06, h1 + 0.06, zb - 0.03, zb, 0.12, sgn * (ET / 2 + 0.05), M.black);
    for (const s of [h0 - 0.04, h1]) put(s, s + 0.04, kind !== 'win' ? zb : zb - 0.03, zt, 0.07, off, M.black);
    if (alongX) plane(w - 2 * fw, h - 2 * fw, [mid, c, zb + h / 2], M.glass, [PI / 2, 0, 0]);
    else plane(w - 2 * fw, h - 2 * fw, [c, mid, zb + h / 2], M.glass, [PI / 2, 0, PI / 2]);
    K.marks.windows = K.marks.windows || [];
    K.marks.windows.push({ alongX, c, h0, h1, zb, zt, sgn });
  }
  function doorLeaf(alongX, c, h0, h1, z0, h, { hinge = 'a', swing = 1, angle = 1.2, mat = null, front = false } = {}) {
    const w = h1 - h0, piv = hinge === 'a' ? h0 + 0.01 : h1 - 0.01;
    const loc = alongX ? [piv, c, z0] : [c, piv, z0];
    const sgn = hinge === 'a' ? 1 : -1;
    const baseRot = alongX ? 0 : PI / 2;
    mat = mat || M.paint;
    const thick = front ? 0.06 : 0.04;
    K.group(loc, [0, 0, baseRot + sgn * swing * angle], () => {
      box([w - 0.02, thick, h - 0.01], [sgn * (w - 0.02) / 2, 0, 0.005], mat, 0.003);
      if (front) {
        for (const s of [-1, 1]) {
          box([0.03, 0.03, 1.4], [sgn * (w - 0.12), s * (thick / 2 + 0.05), 0.4], M.blackMetal, 0.006);
          for (const zz of [0.5, 1.7]) box([0.02, 0.05, 0.02], [sgn * (w - 0.12), s * (thick / 2 + 0.025), zz], M.blackMetal);
        }
      } else {
        for (const s of [-1, 1]) {
          box([0.14, 0.018, 0.018], [sgn * (w - 0.14), s * 0.035, 1.0], M.blackMetal, 0.004);
          cyl(0.025, 0.025, 0.012, [sgn * (w - 0.08), s * 0.026, 1.01], M.blackMetal, 20, 0, [PI / 2, 0, 0]);
        }
      }
    });
  }
  function booksRow(x0, y0, z, length, depth, alongX = true, tall = [0.19, 0.29]) {
    let pos = 0;
    while (pos < length - 0.04) {
      if (K.rnd() < 0.08) { pos += R(0.04, 0.12); continue; }
      const wd = R(0.018, 0.05), hh = R(tall[0], tall[1]), dd = depth * R(0.75, 0.95);
      if (pos + wd > length) break;
      const mat = K.pick(BOOKS);
      if (alongX) box([wd, dd, hh], [x0 + pos + wd / 2, y0, z], mat);
      else box([dd, wd, hh], [x0, y0 + pos + wd / 2, z], mat);
      pos += wd + 0.002;
    }
  }
  function shelfUnit(x0, x1, yBack, z0, z1, depth, facing, shelves, mat, { books = true, cabinetH = 0 } = {}) {
    const s = facing === '+y' ? 1 : -1, yc = yBack + s * depth / 2, w = x1 - x0, t = 0.025;
    box([t, depth, z1 - z0], [x0 + t / 2, yc, z0], mat, 0.003);
    box([t, depth, z1 - z0], [x1 - t / 2, yc, z0], mat, 0.003);
    box([w, depth, t], [(x0 + x1) / 2, yc, z1 - t], mat, 0.003);
    box([w, 0.012, z1 - z0], [(x0 + x1) / 2, yBack + s * 0.006, z0], mat);
    let zs = z0 + cabinetH;
    if (cabinetH > 0) {
      box([w, depth - 0.06, 0.1], [(x0 + x1) / 2, yc - s * 0.03, z0], M.soot);
      box([w - 2 * t, depth - 0.04, cabinetH - 0.1], [(x0 + x1) / 2, yc - s * 0.02, z0 + 0.1], mat);
      const nd = Math.max(1, Math.round(w / 0.5));
      for (let k = 0; k < nd; k++) {
        const xa = x0 + t + (w - 2 * t) * k / nd, xb = x0 + t + (w - 2 * t) * (k + 1) / nd;
        box([xb - xa - 0.004, 0.022, cabinetH - 0.12], [(xa + xb) / 2, yBack + s * (depth + 0.001), z0 + 0.1], mat, 0.002);
      }
      box([w, depth + 0.02, 0.03], [(x0 + x1) / 2, yc + s * 0.01, zs], mat, 0.004);
      zs += 0.03;
    }
    const levels = []; for (let k = 1; k <= shelves; k++) levels.push(zs + (z1 - t - zs) * k / (shelves + 1));
    for (const zz of levels) box([w - 2 * t, depth - 0.015, 0.022], [(x0 + x1) / 2, yc + s * 0.007, zz], mat, 0.002);
    if (books) {
      [zs, ...levels].forEach((zz, i) => {
        if (zz + 0.32 > z1) return;
        if (K.rnd() < 0.25 && i > 0) return;
        const s0 = x0 + t + R(0, 0.15), s1 = x1 - t - R(0, 0.25);
        booksRow(s0, yBack + s * (depth * 0.5 + 0.01), zz + 0.022, s1 - s0, depth * 0.85, true);
      });
    }
  }
  function shelfUnitY(y0, y1, xBack, z0, z1, depth, facing, shelves, mat, { books = true, cabinetH = 0 } = {}) {
    const s = facing === '+x' ? 1 : -1, xc = xBack + s * depth / 2, w = y1 - y0, t = 0.025;
    box([depth, t, z1 - z0], [xc, y0 + t / 2, z0], mat, 0.003);
    box([depth, t, z1 - z0], [xc, y1 - t / 2, z0], mat, 0.003);
    box([depth, w, t], [xc, (y0 + y1) / 2, z1 - t], mat, 0.003);
    box([0.012, w, z1 - z0], [xBack + s * 0.006, (y0 + y1) / 2, z0], mat);
    let zs = z0 + cabinetH;
    if (cabinetH > 0) {
      box([depth - 0.06, w, 0.1], [xc - s * 0.03, (y0 + y1) / 2, z0], M.soot);
      const nd = Math.max(1, Math.round(w / 0.5));
      for (let k = 0; k < nd; k++) {
        const ya = y0 + t + (w - 2 * t) * k / nd, yb = y0 + t + (w - 2 * t) * (k + 1) / nd;
        box([0.022, yb - ya - 0.004, cabinetH - 0.12], [xBack + s * (depth + 0.001), (ya + yb) / 2, z0 + 0.1], mat, 0.002);
      }
      box([depth, w - 2 * t, cabinetH - 0.1], [xc, (y0 + y1) / 2, z0 + 0.1], mat);
      box([depth + 0.02, w, 0.03], [xc + s * 0.01, (y0 + y1) / 2, zs], mat, 0.004);
      zs += 0.03;
    }
    const levels = []; for (let k = 1; k <= shelves; k++) levels.push(zs + (z1 - t - zs) * k / (shelves + 1));
    for (const zz of levels) box([depth - 0.015, w - 2 * t, 0.022], [xc + s * 0.007, (y0 + y1) / 2, zz], mat, 0.002);
    if (books && shelves) {
      [zs, ...levels].forEach((zz, i) => {
        if (zz + 0.32 > z1) return;
        if (K.rnd() < 0.25 && i > 0) return;
        const s0 = y0 + t + R(0, 0.15), s1 = y1 - t - R(0, 0.25);
        booksRow(xBack + s * (depth * 0.5 + 0.01), s0, zz + 0.022, s1 - s0, depth * 0.85, false);
      });
    }
  }
  function pendant(x, y, zBottom, { r = 0.17, h = 0.2, mat = null, energy = 40, cordTo = CEIL } = {}) {
    mat = mat || M.brass;
    rod([x, y, zBottom + h], [x, y, cordTo], 0.004, M.blackMetal, 6);
    cyl(0.05, 0.05, 0.02, [x, y, cordTo - 0.02], M.blackMetal, 24);
    lathe([[0.02, h], [0.05, h], [r * 0.55, h * 0.75], [r * 0.9, h * 0.25], [r, 0], [r - 0.004, 0], [r * 0.9 - 0.004, h * 0.25], [r * 0.55 - 0.004, h * 0.75], [0.046, h - 0.004]], [x, y, zBottom], mat, 48);
    lathe([[0, 0.08], [0.035, 0.07], [0.045, 0.045], [0.035, 0.015], [0, 0]], [x, y, zBottom - 0.03], M.bulb, 24);
    light('point', [x, y, zBottom - 0.02], energy, [1.0, 0.8, 0.58], { distance: 6 });
  }
  function tableLamp(x, y, z, { baseMat = null, energy = 25, h = 0.38, shade = [0.16, 0.2] } = {}) {
    lathe([[0, 0], [0.07, 0], [0.1, 0.06], [0.11, h * 0.45], [0.06, h * 0.9], [0.015, h], [0, h]], [x, y, z], baseMat || M.ceramic, 40);
    K.lathe([[shade[1], 0], [shade[0], 0.26], [shade[0] - 0.004, 0.26], [shade[1] - 0.004, 0]], [x, y, z + h + 0.04], M.shade, { seg: 64 });
    light('point', [x, y, z + h + 0.12], energy, [1.0, 0.78, 0.52], { distance: 5 });
  }
  function frameArt(x, y, z, w, h, facing, mat = null, frame = null) {
    mat = mat || M.art; frame = frame || M.blackMetal; const d = 0.03;
    if (facing === '+y' || facing === '-y') {
      const s = facing === '+y' ? 1 : -1;
      box([w + 0.06, d, h + 0.06], [x, y + s * d / 2, z - 0.03], frame, 0.003);
      box([w, 0.004, h], [x, y + s * (d + 0.002), z], M.paint);
      plane(w * 0.72, h * 0.72, [x, y + s * (d + 0.0045), z + h / 2], mat, [PI / 2, 0, s < 0 ? 0 : PI], true);
    } else {
      const s = facing === '+x' ? 1 : -1;
      box([d, w + 0.06, h + 0.06], [x + s * d / 2, y, z - 0.03], frame, 0.003);
      box([0.004, w, h], [x + s * (d + 0.002), y, z], M.paint);
      plane(w * 0.72, h * 0.72, [x + s * (d + 0.0045), y, z + h / 2], mat, [PI / 2, 0, s > 0 ? PI / 2 : -PI / 2], true);
    }
  }
  const rug = (x, y, w, d, mat, rot = 0) => box([w, d, 0.015], [x, y, FL], mat, 0.006, [0, 0, rot]);
  function topiary(x, y, z, r) {
    let g = new T.IcosahedronGeometry(r, 4);
    g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-6);
    const p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const n = v.clone().normalize();
      v.copy(n).multiplyScalar(r * (1 + 0.035 * Math.sin(n.x * 9 + n.y * 7) * Math.cos(n.z * 8) + 0.02 * Math.sin(n.x * 23 + n.z * 19)));
      v.z *= 0.9; p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    K.mesh(g, M.hedge, mat4([x, y, z + r * 0.9]), { uvMode: 'local' });
  }
  function kuebel(x, y, z0 = 0, { r = 0.32, h = 0.78, ball = 0.36, square = false } = {}) {
    if (square) box([2 * r, 2 * r, h], [x, y, z0], M.granite, 0.012);
    else cyl(r, r * 0.86, h, [x, y, z0], M.granite, 48, 0.01);
    cyl(r * 0.82, r * 0.82, 0.02, [x, y, z0 + h - 0.05], M.soil, 32);
    topiary(x, y, z0 + h - 0.06, ball);
  }
  function drape(cx, cy0, cy1, top, halfW, mat, { hang = 0.32, footHang = 0.3, fold = null, seed = 3 } = {}) {
    const rnd = (() => { let s = seed * 9973 + 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const nx = 70, ny = 60, W = halfW + hang + 0.05;
    const waves = []; for (let k = 0; k < 9; k++) waves.push([1.5 + rnd() * 3.5, 1.5 + rnd() * 3.5, rnd() * 6.28, 0.004 + rnd() * 0.008]);
    const pos = [], idx = [];
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = -W + 2 * W * i / nx, v = cy0 + (cy1 - cy0 + footHang) * j / ny;
        const ax = Math.abs(u) - halfW;
        let z = top, x = u, y = v;
        if (ax > 0) {
          const r = 0.08;
          if (ax < r * PI / 2) { const a = ax / r; x = Math.sign(u) * (halfW + r * Math.sin(a)); z = top - r * (1 - Math.cos(a)); }
          else { x = Math.sign(u) * (halfW + r + (rnd() - 0.5) * 0.008); z = top - r - (ax - r * PI / 2); }
        }
        if (v > cy1) {
          const fv = v - cy1, r = 0.08;
          if (fv < r * PI / 2) { const a = fv / r; y = cy1 + r * Math.sin(a); z -= r * (1 - Math.cos(a)); }
          else { y = cy1 + r; z -= r + (fv - r * PI / 2); }
        }
        let nn = 0; for (const [fx, fy, ph, amp] of waves) nn += amp * Math.sin(fx * x * 2.1 + fy * y * 1.7 + ph);
        const side = ax > 0 || v > cy1 ? 1.0 : 0.45;
        pos.push(cx + x + (ax > 0 ? nn * 0.6 : 0), y, z + nn * side);
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    K.mesh(g, mat, new T.Matrix4(), { uvMode: 'local' });
    if (fold) cushion([2 * halfW + 0.1, fold[1], 0.07], [cx, fold[0], top - 0.01], mat, 0.03, 0.035, [0, 0, 0], 0.012);
  }
  function curtain(x, y, w, h, mat, alongX = true) {
    const nseg = 50, pos = [], idx = [], uv = [];
    for (let i = 0; i <= nseg; i++) {
      const t = i / nseg, a = (t - 0.5) * w, o = Math.sin(t * PI * 7) * 0.04;
      const p0 = alongX ? [x + a, y + o, FL + 0.02] : [x + o, y + a, FL + 0.02];
      const p1 = alongX ? [x + a, y + o, FL + h] : [x + o, y + a, FL + h];
      pos.push(...p0, ...p1); uv.push(t * w * 1.3, 0, t * w * 1.3, h);
    }
    for (let i = 0; i < nseg; i++) { const a = i * 2; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    K.mesh(g, mat, new T.Matrix4(), { uvMode: 'own' });
  }
  function hipRoof(x0, y0, x1, y1, ze, pitchDeg, mat, ridgeAlong = 'x') {
    const half = ridgeAlong === 'x' ? (y1 - y0) / 2 : (x1 - x0) / 2;
    const zr = ze + half * Math.tan(pitchDeg * PI / 180);
    let V, F;
    if (ridgeAlong === 'x') {
      const ym = (y0 + y1) / 2;
      V = [[x0, y0, ze], [x1, y0, ze], [x1, y1, ze], [x0, y1, ze], [x0 + half, ym, zr], [x1 - half, ym, zr]];
      F = [[0, 1, 5, 4], [2, 3, 4, 5], [3, 0, 4], [1, 2, 5]];
    } else {
      const xm = (x0 + x1) / 2;
      V = [[x0, y0, ze], [x1, y0, ze], [x1, y1, ze], [x0, y1, ze], [xm, y0 + half, zr], [xm, y1 - half, zr]];
      F = [[0, 1, 4], [1, 2, 5, 4], [2, 3, 5], [3, 0, 4, 5]];
    }
    const pos = [], uv = [], idx = [];
    const thick = 0.1;
    for (const f of F) {
      const vs = f.map((i) => new T.Vector3(...V[i]));
      const e = vs[1].clone().sub(vs[0]).normalize();
      const nrm = vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).normalize();
      if (nrm.z < 0) nrm.negate();
      const up = nrm.clone().cross(e).normalize(); if (up.z < 0) up.negate();
      const base = pos.length / 3;
      for (const p of vs) { const d = p.clone().sub(vs[0]); pos.push(p.x + nrm.x * thick, p.y + nrm.y * thick, p.z + nrm.z * thick); uv.push(d.dot(e), d.dot(up)); }
      // fan triangulation, wound so the face points up/out
      for (let k = 1; k < vs.length - 1; k++) {
        const a = vs[0], b = vs[k], c = vs[k + 1];
        const fn = b.clone().sub(a).cross(c.clone().sub(a));
        if (fn.dot(nrm) >= 0) idx.push(base, base + k, base + k + 1); else idx.push(base, base + k + 1, base + k);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    // flat shading per face: split already (each face has its own vertices)
    K.mesh(g, mat, new T.Matrix4(), { uvMode: 'own' });
    const a = V[4], b = V[5];
    const lift = (p) => [p[0], p[1], p[2] + thick];
    rod(lift(a), lift(b), 0.05, mat, 6);
    for (const [i, j] of ridgeAlong === 'x' ? [[0, 4], [3, 4], [1, 5], [2, 5]] : [[0, 4], [1, 4], [2, 5], [3, 5]]) rod(lift(V[i]), lift(V[j]), 0.04, mat, 6);
    return zr;
  }
  function downlight(x, y, energy = 22, z = CEIL) {
    cyl(0.055, 0.055, 0.006, [x, y, z - 0.006], M.paint, 24);
    cyl(0.035, 0.035, 0.004, [x, y, z - 0.009], M.bulb, 20);
    light('spot', [x, y, z - 0.08], energy, [1.0, 0.8, 0.6], { dir: [0, 0, -1], angle: 0.95, distance: 5 });
  }

  // ================================================================== EXTERIOR SHELL
  K.zone('EXT');
  box([HX1 - HX0, HY1 - HY0, FL - 0.02], [(HX0 + HX1) / 2, (HY0 + HY1) / 2, 0], M.rock, 0.01);
  box([HX1 - HX0, HY0, FL], [(HX0 + HX1) / 2, HY0 / 2, 0], M.rock, 0.01);
  box([HX1 - HX0, HY0, 0.03], [(HX0 + HX1) / 2, HY0 / 2, FL], M.concrete, 0.008);
  K.zone('garage');
  box([4.2, GY1, 0.12], [2.1, GY1 / 2, 0], M.garageFloor, 0.01);
  wall(true, 0.0, 0.0, 4.2, 0.12, 3.25, [[0.6, 3.6, 0.12, 2.37, 'door']], M.garageWall, { t: ET });
  wall(false, 0.0, 0.0, GY1, 0.12, 3.25, [], M.garageWall, { t: ET });
  wall(true, GY1, 0.0, HX0 - ET / 2, 0.12, 3.25, [], M.garageWall, { t: ET });
  box([4.2, GY1, 0.04], [2.1, GY1 / 2, 3.2], M.garageIn);
  K.zone('EXT');
  wall(true, 0.0, 0.0, 4.2, 0.12, 3.25, [[0.6, 3.6, 0.12, 2.37, 'door']], M.siding, { t: ET, skin: M.siding, skinSide: -1, core: false, base: false });
  wall(false, 0.0, 0.0, GY1, 0.12, 3.25, [], M.siding, { t: ET, skin: M.siding, skinSide: -1, core: false, base: false });
  wall(true, GY1, 0.0, HX0 - ET / 2, 0.12, 3.25, [], M.siding, { t: ET, skin: M.siding, skinSide: 1, core: false, base: false });
  const gx = 2.1, gz0 = 0.12, gw = 3.0, gh = 2.25;
  box([gw, 0.06, gh], [gx, 0.08 - 0.12, gz0], M.cedar, 0.004);
  box([gw + 0.16, 0.08, 0.08], [gx, -0.03 - 0.12, gz0 + gh], M.black, 0.002);
  for (const s of [-1, 1]) box([0.08, 0.08, gh], [gx + s * (gw / 2 + 0.04), -0.03 - 0.12, gz0], M.black, 0.002);
  wall(false, HX0, 0.0, HY0, FL, TOP, [], M.siding, { t: ET });

  const FRONT_H = [[5.3, 6.9, FL + 0.5, FL + 2.45, 'win'], [DOOR_X - 0.5, DOOR_X + 0.5, FL, FL + 2.2, 'door'], [11.15, 12.75, FL + 0.8, FL + 2.45, 'win']];
  const RIGHT_H = [[2.7, 3.9, FL + 0.95, FL + 2.45, 'win'], [6.3, 7.5, FL + 0.95, FL + 2.45, 'win']];
  const BACK_H = [[5.5, 7.3, FL + 0.7, FL + 2.45, 'win'], [9.55, 10.75, FL, FL + 2.3, 'door'], [12.37, 13.67, FL + 1.1, FL + 2.45, 'win']];
  const LEFT_H = [[6.45, 8.05, FL + 0.55, FL + 2.6, 'win'], [10.9, 12.3, FL + 0.7, FL + 2.45, 'win']];
  function extWall(zoneName, alongX, c, a0, a1, holes, outward, inner = null, casing = true) {
    K.zone(zoneName);
    const ins = outward === '+y' || outward === '+x' ? -1 : 1;
    wall(alongX, c, a0, a1, FL, TOP, holes, inner || M.plaster, { t: ET, sides: [ins], casingSides: casing ? [ins] : [] });
    K.zone('EXT');
    wall(alongX, c, a0, a1, FL, TOP, holes, M.siding, { t: ET, base: false, skin: M.siding, skinSide: -ins, core: false });
  }
  extWall('study', true, HY0, HX0 - ET / 2, 8.0, FRONT_H.filter((h) => h[1] <= 8.0), '-y');
  extWall('hall', true, HY0, 8.0, 9.4, FRONT_H.filter((h) => h[0] >= 8.0 && h[0] < 9.4), '-y');
  extWall('living', true, HY0, 9.4, HX1 + ET / 2, FRONT_H.filter((h) => h[0] >= 9.4), '-y');
  extWall('living', false, HX1, HY0, 8.0, RIGHT_H.filter((h) => h[1] <= 8.0), '+x');
  extWall('kitchen', false, HX1, 8.0, HY1 + ET / 2, RIGHT_H.filter((h) => h[0] >= 8.0), '+x');
  extWall('bed', true, HY1, HX0 - ET / 2, 9.4, BACK_H.filter((h) => h[1] <= 9.4), '+y');
  extWall('kitchen', true, HY1, 9.4, HX1, BACK_H.filter((h) => h[0] >= 9.4), '+y');
  K.zone('study'); wall(false, HX0, HY0, GY1, FL, TOP, [[4.75, 5.65, FL, FL + 2.15, 'door']], M.plaster, { t: ET, sides: [1] });
  extWall('bath', false, HX0, GY1, 9.6, LEFT_H.filter((h) => h[1] <= 9.6), '-x');
  extWall('bed', false, HX0, 9.6, HY1, LEFT_H.filter((h) => h[0] >= 9.6), '-x');

  K.zone('EXT');
  for (const h of FRONT_H) if (h[4] === 'win') windowUnit(true, HY0, h[0], h[1], h[2], h[3], '-y');
  for (const h of RIGHT_H) windowUnit(false, HX1, h[0], h[1], h[2], h[3], '+x');
  for (const h of BACK_H) windowUnit(true, HY1, h[0], h[1], h[2], h[3], '+y', h[4]);
  for (const h of LEFT_H) windowUnit(false, HX0, h[0], h[1], h[2], h[3], '-x');
  box([1.14, 0.09, 0.07], [DOOR_X, HY0 - 0.12, FL + 2.2], M.black, 0.002);
  for (const s of [-1, 1]) box([0.07, 0.09, 2.2], [DOOR_X + s * 0.535, HY0 - 0.12, FL], M.black, 0.002);
  K.zone('DOOR');
  doorLeaf(true, HY0 + 0.02, DOOR_X - 0.5, DOOR_X + 0.5, FL, 2.19, { hinge: 'b', swing: 1, angle: 0, mat: M.door, front: true });
  K.zone('EXT');
  // porch: slim black steel posts and beam, cedar ceiling with downlights
  for (const x of [4.45, 7.55, 10.15, 13.75]) box([0.14, 0.14, TOP - FL - 0.24], [x, 0.3, FL], M.blackMetal, 0.003);
  box([9.9, 0.2, 0.24], [9.1, 0.3, TOP - 0.24], M.blackMetal, 0.004);
  box([9.8, 2.2, 0.02], [9.1, 1.1, TOP + 0.05], M.cedar);
  for (const x of [5.2, 6.9, 8.7, 10.5, 12.2, 13.3]) {
    cyl(0.045, 0.045, 0.01, [x, 1.1, TOP + 0.04], M.bulb, 24);
    light('spot', [x, 1.1, TOP - 0.02], 14, [1.0, 0.78, 0.55], { dir: [0, 0, -1], angle: 1.0, distance: 5, outdoor: true });
  }
  // roofs
  const OV = 0.6;
  hipRoof(HX0 - OV, -OV - 0.2, HX1 + OV, HY1 + OV, TOP + 0.12, 28, M.roof, 'y');
  hipRoof(-OV, -OV - 0.2, HX0 + 0.3, GY1 + OV, 3.37, 28, M.roof, 'y');
  for (const [sz, loc] of [
    [[HX1 - HX0 + 2 * OV, 0.04, 0.22], [(HX0 + HX1) / 2, -OV - 0.2, TOP - 0.1]],
    [[HX1 - HX0 + 2 * OV, 0.04, 0.22], [(HX0 + HX1) / 2, HY1 + OV, TOP - 0.1]],
    [[0.04, HY1 + 2 * OV + 0.2, 0.22], [HX1 + OV, (HY1 - 0.2) / 2, TOP - 0.1]],
    [[0.04, HY1 + 2 * OV + 0.2, 0.22], [HX0 - OV, (HY1 - 0.2) / 2, TOP - 0.1]],
    [[HX0 + OV + 0.3, 0.04, 0.22], [(HX0 + 0.3 - OV) / 2, -OV - 0.2, 3.15]],
    [[0.04, GY1 + 2 * OV + 0.2, 0.22], [-OV, (GY1 - 0.2) / 2, 3.15]]]) box(sz, loc, M.trim, 0.004);
  box([HX1 - HX0 + 2 * OV, HY1 + 2 * OV + 0.2, 0.02], [(HX0 + HX1) / 2, (HY1 - 0.2) / 2, TOP + 0.1], M.cedar);
  box([HX0 + OV + 0.3, GY1 + 2 * OV + 0.2, 0.02], [(HX0 + 0.3 - OV) / 2, (GY1 - 0.2) / 2, 3.35], M.cedar);
  const DX0 = 7.4, DX1 = 10.6, DY0 = 1.65;
  box([DX1 - DX0, 3.0, 1.45], [(DX0 + DX1) / 2, DY0 + 1.5, 4.25], M.siding);
  box([2.5, 0.06, 0.66], [(DX0 + DX1) / 2, DY0 - 0.02, 4.83], M.black, 0.002);
  box([2.4, 0.02, 0.56], [(DX0 + DX1) / 2, DY0 - 0.06, 4.88], M.glassDark);
  hipRoof(DX0 - 0.35, DY0 - 0.35, DX1 + 0.35, DY0 + 3.0, 5.72, 22, M.roof);
  box([DX1 - DX0 + 0.7, 0.03, 0.14], [(DX0 + DX1) / 2, DY0 - 0.35, 5.6], M.trim);
  // fieldstone chimney on the right wall
  box([0.75, 1.5, 5.4], [HX1 + ET / 2 + 0.375, CHY, 0.0], M.stone, 0.01);
  box([0.65, 1.0, 2.6], [HX1 + ET / 2 + 0.33, CHY, 5.4], M.stone, 0.01);
  box([0.8, 1.15, 0.08], [HX1 + ET / 2 + 0.33, CHY, 8.0], M.concrete, 0.006);
  function wallLight(x, y, z, facing = '-y') {
    const s = facing === '-y' ? -1 : 1;
    cyl(0.045, 0.045, 0.3, [x, y + s * 0.07, z - 0.15], M.blackMetal, 24);
    box([0.04, 0.06, 0.04], [x, y + s * 0.03, z - 0.02], M.blackMetal);
    for (const [dz, sz] of [[-0.15, -1], [0.15, 1]]) cyl(0.035, 0.035, 0.004, [x, y + s * 0.07, z + dz - (sz < 0 ? 0.004 : 0)], M.bulb, 20);
    light('point', [x, y + s * 0.07, z + 0.2], 6, [1.0, 0.76, 0.52], { distance: 3, outdoor: true });
    light('point', [x, y + s * 0.07, z - 0.2], 6, [1.0, 0.76, 0.52], { distance: 3, outdoor: true });
  }
  for (const x of [DOOR_X - 0.85, DOOR_X + 0.85]) wallLight(x, HY0 - ET / 2 - 0.035, FL + 1.9);
  function porchChair(x, y, rz) {
    K.group([x, y, FL], [0, 0, rz], () => {
      box([0.78, 0.74, 0.4], [0, 0, 0], M.black, 0.02);
      cushion([0.66, 0.62, 0.14], [0, 0.04, 0.4], M.cushionGrey, 0.03, 0.04);
      cushion([0.66, 0.16, 0.42], [0, -0.28, 0.45], M.cushionGrey, 0.03, 0.05);
      box([0.08, 0.74, 0.62], [-0.35, 0, 0], M.black, 0.02);
      box([0.08, 0.74, 0.62], [0.35, 0, 0], M.black, 0.02);
    });
  }
  porchChair(11.75, 1.25, 170 * PI / 180);
  porchChair(13.05, 1.25, 190 * PI / 180);
  cyl(0.28, 0.28, 0.42, [12.4, 0.75, FL], M.concrete, 48, 0.01);
  box([2.2, 0.45, 0.06], [5.9, 1.75, FL + 0.42], M.cedar, 0.004);
  for (const dx of [-0.95, 0.95]) box([0.06, 0.4, 0.42], [5.9 + dx, 1.75, FL], M.blackMetal, 0.002);
  cushion([2.0, 0.42, 0.07], [5.9, 1.75, FL + 0.48], M.cushionGrey, 0.015, 0.02);

  // ---- hardscape
  [[-0.25, 0.3], [-0.65, 0.15], [-1.05, 0.0]].forEach(([y, z]) => box([2.4, 0.42, 0.15], [DOOR_X, y, z], M.pathStone, 0.006));
  box([2.4, 0.1, FL - 0.03], [DOOR_X, -0.02, 0], M.granite);
  box([5.0, -DRIVE_Y0, 0.06], [2.1, DRIVE_Y0 / 2, -0.05], M.drive, 0.004);
  for (const s of [-1, 1]) box([0.02, -DRIVE_Y0, 0.08], [2.1 + s * 2.51, DRIVE_Y0 / 2, -0.06], M.blackMetal);
  for (let y = DRIVE_Y0 + 0.65; y < -1.55; y += 1.0) box([1.7, 0.86, 0.06], [DOOR_X, y, -0.04], M.pathStone, 0.004, [0, 0, 0], { uvRot: K.r(0, 6.28) });
  for (const s of [-1, 1]) box([0.5, -DRIVE_Y0 - 1.3, 0.04], [DOOR_X + s * 1.3, (DRIVE_Y0 - 1.25) / 2, -0.035], M.gravel);
  for (let k = 0, yb = -17; yb < -2; k++, yb += 3) {
    for (const s of [-1, 1]) {
      if ((k + (s > 0 ? 1 : 0)) % 2) continue;
      const xb = DOOR_X + s * 1.3;
      box([0.11, 0.11, 0.62], [xb, yb, -0.02], M.blackMetal, 0.004);
      box([0.112, 0.112, 0.05], [xb, yb, 0.47], M.bulb);
    }
  }
  for (const [a, b] of [[-12.0, -0.6], [4.8, 7.4], [10.0, 26.0]]) {
    box([b - a, 0.28, 0.62], [(a + b) / 2, WALL_Y, -0.02], M.rock, 0.006);
    box([b - a + 0.02, 0.32, 0.04], [(a + b) / 2, WALL_Y, 0.6], M.granite, 0.003);
  }
  box([0.36, 0.02, 0.1], [7.0, WALL_Y - 0.15, 0.36], M.blackMetal);
  K.zone('GROUND');
  box([80, 2.4, 0.06], [6, DRIVE_Y0 - 1.2, -0.04], M.concrete, 0.003);
  box([80, 0.2, 0.18], [6, DRIVE_Y0 - 2.5, -0.14], M.granite, 0.01);
  box([80, 8.0, 0.04], [6, DRIVE_Y0 - 6.6, -0.16], M.asphalt);
  K.zone('EXT');
  function planter(x0, x1, y0 = -1.25, y1 = -0.02, h = 0.48) {
    box([x1 - x0, 0.28, h], [(x0 + x1) / 2, y0 + 0.14, 0], M.granite, 0.015);
    box([0.28, y1 - y0, h], [x0 + 0.14, (y0 + y1) / 2, 0], M.granite, 0.015);
    box([0.28, y1 - y0, h], [x1 - 0.14, (y0 + y1) / 2, 0], M.granite, 0.015);
    box([x1 - x0 - 0.5, y1 - y0 - 0.3, h - 0.05], [(x0 + x1) / 2, (y0 + y1) / 2 + 0.05, 0], M.soil);
  }
  planter(4.3, 7.85); planter(9.55, 14.3);
  K.marks.planterHedges = [[4.3, 7.85], [9.55, 14.3]].map(([x0, x1]) => [x0 + 0.31, -1.02, x1 - 0.31, -0.24, 0.43, 0.36]);
  for (const x of [DOOR_X - 1.55, DOOR_X + 1.55]) kuebel(x, -1.55, 0.0, { r: 0.3, h: 0.8, ball: 0.33 });
  box([6.4, TY1 - HY1, FL - 0.02], [11.3, (HY1 + TY1) / 2, 0], M.paving, 0.006);
  box([2.0, 0.4, 0.2], [10.15, TY1 + 0.2, 0.0], M.paving, 0.006);
  box([0.8, 1.5, 0.36], [FT[0], FT[1], FL], M.concrete, 0.01);
  box([0.36, 1.1, 0.02], [FT[0], FT[1], FL + 0.36], M.soot);
  K.flames.push({ fireTable: true, pos: [FT[0], FT[1], FL + 0.38] });
  light('point', [FT[0], FT[1], FL + 0.65], 40, [1.0, 0.55, 0.22], { distance: 5, flicker: true, outdoor: true });
  function outSofa(cx, cy, face) {
    const s = face === '+x' ? 1 : -1;
    box([0.86, 2.0, 0.3], [cx, cy, FL + 0.04], M.cedar, 0.01);
    for (const dy of [-0.9, 0.9]) box([0.8, 0.06, 0.04], [cx, cy + dy, FL], M.blackMetal);
    cushion([0.76, 1.92, 0.16], [cx + s * 0.04, cy, FL + 0.34], M.cushionGrey, 0.03, 0.05);
    cushion([0.2, 1.92, 0.45], [cx - s * 0.32, cy, FL + 0.42], M.cushionGrey, 0.035, 0.06, [0, s * 0.18, 0]);
  }
  outSofa(11.78, FT[1], '+x'); outSofa(13.88, FT[1], '-x');
  kuebel(8.55, 16.75, FL - 0.02, { r: 0.3, h: 0.7, ball: 0.3, square: true });
  kuebel(14.15, 16.85, FL - 0.02, { r: 0.3, h: 0.7, ball: 0.3, square: true });

  // ---- pool: stone coping, tiled shell, timber sun deck
  K.zone('GROUND');
  for (const [a, b, c_, d] of [[PX0 - PC, PX1 + PC, PY0 - PC, PY0], [PX0 - PC, PX1 + PC, PY1, PY1 + PC], [PX0 - PC, PX0, PY0, PY1], [PX1, PX1 + PC, PY0, PY1]]) {
    box([b - a, d - c_, 0.06], [(a + b) / 2, (c_ + d) / 2, -0.03], M.pathStone, 0.004);
  }
  for (const [a, b, c_, d] of [[PX0, PX1, PY0 - 0.05, PY0], [PX0, PX1, PY1, PY1 + 0.05], [PX0 - 0.05, PX0, PY0, PY1], [PX1, PX1 + 0.05, PY0, PY1]]) {
    box([b - a, d - c_, 1.45], [(a + b) / 2, (c_ + d) / 2, -1.45], M.poolShell);
  }
  box([PX1 - PX0, PY1 - PY0, 0.05], [(PX0 + PX1) / 2, (PY0 + PY1) / 2, -1.45], M.poolFloor);
  box([PX1 - PX0 + 2 * PC, 2.2, 0.06], [(PX0 + PX1) / 2, PY0 - PC - 1.1, -0.03], M.deck, 0.003);
  for (const x of [PX0 - 0.9, PX1 + 0.9]) kuebel(x, PY0 - 1.0, 0.0, { r: 0.36, h: 0.9, ball: 0.4, square: true });
  for (let k = 0; k < 3; k++) {
    const x = PX0 + 1.6 + k * 2.6;
    box([0.68, 1.95, 0.24], [x, PY0 - PC - 1.1, 0.03], M.cedar, 0.008);
    cushion([0.64, 1.45, 0.07], [x, PY0 - PC - 0.85, 0.27], M.linenWhite, 0.012, 0.03);
    cushion([0.64, 0.55, 0.07], [x, PY0 - PC - 1.82, 0.45], M.linenWhite, 0.012, 0.03, [-0.75, 0, 0]);
  }
  K.zone('EXT');

  // ================================================================== INTERIOR SHELL
  for (const [k, [x0, y0, x1, y1]] of Object.entries(ROOMS)) {
    if (k === 'garage') continue;
    K.zone(k);
    const fm = { bath: M.bathFloor, study: M.floorDark, bed: M.floorWarm }[k] || M.floor;
    box([x1 - x0, y1 - y0, 0.02], [(x0 + x1) / 2, (y0 + y1) / 2, FL - 0.02], fm);
    box([x1 - x0, y1 - y0, 0.05], [(x0 + x1) / 2, (y0 + y1) / 2, CEIL], M.ceiling);
  }
  const STUDY_DOOR = [4.6, 5.5], BATH_DOOR = [6.55, 7.35], BED_DOOR = [8.3, 9.1];
  const LIV_OPEN = [6.2, 7.75], KIT_OPEN = [8.45, 9.45];
  K.zone('hall');
  wall(false, 8.0, HY0 + ET / 2, 9.6, FL, CEIL, [[...STUDY_DOOR, FL, FL + 2.15, 'door'], [...BATH_DOOR, FL, FL + 2.15, 'door']], M.plaster, { sides: [-1, 1], casingSides: [-1, 1] });
  wall(false, 9.4, HY0 + ET / 2, 9.6, FL, CEIL, [[...LIV_OPEN, FL, FL + 2.35, 'open'], [...KIT_OPEN, FL, FL + 2.15, 'open']], M.plaster, { sides: [-1, 1], casingSides: [-1, 1] });
  K.zone('study');
  wall(true, 6.2, HX0 + ET / 2, 8.0 - IT / 2, FL, CEIL, [], M.plaster, { sides: [-1, 1] });
  K.zone('bed');
  wall(true, 9.6, HX0 + ET / 2, 9.4 + IT / 2, FL, CEIL, [[...BED_DOOR, FL, FL + 2.15, 'door']], M.plaster, { sides: [-1, 1], casingSides: [-1, 1] });
  wall(false, 9.4, 9.6 + IT / 2, HY1 - ET / 2, FL, CEIL, [], M.plaster, { sides: [-1, 1] });
  K.zone('study'); doorLeaf(false, 8.0 - 0.03, ...STUDY_DOOR, FL, 2.14, { hinge: 'b', swing: 1, angle: 1.75 });
  K.zone('bath'); doorLeaf(false, 8.0 - 0.03, ...BATH_DOOR, FL, 2.14, { hinge: 'b', swing: 1, angle: 3.05 });
  K.zone('bed'); doorLeaf(true, 9.6 + 0.03, ...BED_DOOR, FL, 2.14, { hinge: 'b', swing: 1, angle: 1.4 });

  // ================================================================== HALL
  K.zone('hall');
  rug(8.7, 5.6, 0.85, 6.4, M.rug);
  const bx_ = 8.0 + IT / 2 + 0.23;
  box([0.42, 1.2, 0.05], [bx_, 3.05, FL + 0.42], M.oak, 0.006);
  for (const y of [2.5, 3.6]) box([0.38, 0.05, 0.42], [bx_, y, FL], M.oak, 0.004);
  box([0.36, 1.1, 0.025], [bx_, 3.05, FL + 0.1], M.oak, 0.003);
  cushion([0.4, 1.15, 0.06], [bx_, 3.05, FL + 0.47], M.linenOat, 0.015, 0.02);
  box([0.025, 1.2, 0.12], [8.0 + IT / 2 + 0.03, 3.05, FL + 1.62], M.oak, 0.004);
  for (let k = 0; k < 5; k++) rod([8.0 + IT / 2 + 0.04, 2.6 + k * 0.22, FL + 1.66], [8.0 + IT / 2 + 0.11, 2.6 + k * 0.22, FL + 1.72], 0.008, M.brass, 8);
  cushion([0.3, 0.55, 0.04], [8.0 + IT / 2 + 0.25, 3.4, FL + 0.5], M.woolRust, 0.01, 0.02, [0, 0, 0.15], 0.01);
  for (const y of [2.7, 2.86]) box([0.27, 0.1, 0.09], [8.0 + IT / 2 + 0.24, y, FL], M.leather, 0.035);
  frameArt(9.4 - IT / 2 - 0.005, 4.7, FL + 1.25, 0.68, 0.91, '-x', M.art2);
  frameArt(9.4 - IT / 2 - 0.005, 3.45, FL + 1.45, 0.62, 0.5, '-x', M.art3);
  frameArt(8.0 + IT / 2 + 0.005, 8.45, FL + 1.25, 0.6, 0.8, '+x', M.art4);
  frameArt(9.4 - IT / 2 - 0.005, 5.65, FL + 1.38, 0.45, 0.6, '-x');
  for (const y of [3.3, 4.6, 5.9, 7.2, 8.6]) downlight(8.7, y, 20);

  // ================================================================== STUDY / LIBRARY
  K.zone('study');
  const studyGreen = M.walnut;
  const sx0 = HX0 + ET / 2, sy0 = HY0 + ET / 2, sx1 = 8.0 - IT / 2, sy1 = 6.2 - IT / 2;
  const WS0 = 5.3 - 0.08, WS1 = 6.9 + 0.08;
  box([WS1 - WS0, 0.55, 0.42], [(WS0 + WS1) / 2, sy0 + 0.275, FL], studyGreen, 0.006);
  for (let k = 0; k < 3; k++) {
    const xa = WS0 + (WS1 - WS0) * k / 3 + 0.03, xb = WS0 + (WS1 - WS0) * (k + 1) / 3 - 0.03;
    box([xb - xa, 0.02, 0.28], [(xa + xb) / 2, sy0 + 0.56, FL + 0.08], studyGreen, 0.004);
    box([0.12, 0.02, 0.015], [(xa + xb) / 2, sy0 + 0.575, FL + 0.27], M.brass, 0.003);
  }
  cushion([WS1 - WS0 - 0.04, 0.53, 0.09], [(WS0 + WS1) / 2, sy0 + 0.28, FL + 0.42], M.linenOat, 0.02, 0.03);
  box([0.32, 0.22, 0.03], [WS0 + 0.45, sy0 + 0.32, FL + 0.51], M.paper, 0.004, [0, 0, 0.3]);
  cushion([0.45, 0.4, 0.05], [WS1 - 0.4, sy0 + 0.3, FL + 0.53], M.knit, 0.01, 0.02, [0, 0, -0.1], 0.012);
  shelfUnit(sx0, WS0, sy0, FL, CEIL - 0.02, 0.36, '+y', 5, studyGreen, { cabinetH: 0.75 });
  shelfUnit(WS1, sx1, sy0, FL, CEIL - 0.02, 0.36, '+y', 5, studyGreen, { cabinetH: 0.75 });
  box([WS1 - WS0, 0.36, 0.25], [(WS0 + WS1) / 2, sy0 + 0.18, CEIL - 0.27], studyGreen, 0.004);
  shelfUnit(sx0 + 0.05, sx1 - 0.05, sy1, FL, CEIL - 0.02, 0.36, '-y', 5, studyGreen, { cabinetH: 0.8 });
  box([1.5, 0.75, 0.04], [5.9, 4.3, FL + 0.72], M.walnut, 0.006);
  for (const sx of [-0.68, 0.68]) box([0.05, 0.65, 0.72], [5.9 + sx, 4.3, FL], M.walnut, 0.004);
  box([1.3, 0.04, 0.05], [5.9, 4.6, FL + 0.18], M.walnut, 0.003);
  box([0.6, 0.6, 0.1], [5.9, 4.3, FL + 0.62], M.walnut, 0.004);
  box([0.62, 0.42, 0.004], [5.75, 4.2, FL + 0.76], M.leatherBlack, 0.002);
  armChair(K, M, 5.9, 4.95, FL, 0, 0.82);
  const LX = 5.32, LY = 4.55;
  cyl(0.08, 0.09, 0.025, [LX, LY, FL + 0.76], M.brass, 32);
  rod([LX, LY, FL + 0.785], [LX + 0.07, LY - 0.12, FL + 1.18], 0.008, M.brass, 8);
  rod([LX + 0.07, LY - 0.12, FL + 1.18], [LX + 0.25, LY - 0.28, FL + 1.12], 0.008, M.brass, 8);
  lathe([[0.012, 0.13], [0.03, 0.13], [0.07, 0.03], [0.075, 0.0], [0.071, 0.0], [0.066, 0.03], [0.026, 0.126]], [LX + 0.25, LY - 0.28, FL + 0.99], M.brass, 32);
  light('spot', [LX + 0.25, LY - 0.28, FL + 1.0], 14, [1.0, 0.72, 0.42], { dir: [0, 0, -1], angle: 1.1, distance: 3 });
  box([0.21, 0.3, 0.012], [5.95, 4.15, FL + 0.765], M.leatherBlack, 0.003, [0, 0, -0.15]);
  rod([6.12, 4.05, FL + 0.775], [6.2, 4.22, FL + 0.775], 0.004, M.brass, 8);
  [[0.24, 0.17, 0.035, 0.1], [0.22, 0.16, 0.03, -0.12], [0.2, 0.15, 0.028, 0.25]].forEach(([w, d_, h, rz], k) => {
    box([w, d_, h], [6.42, 4.5, FL + 0.76 + [0, 0.035, 0.065][k]], BOOKS[(k * 3) % BOOKS.length], 0.003, [0, 0, rz]);
  });
  function teacup(x, y, z) {
    lathe([[0, 0], [0.07, 0], [0.075, 0.008], [0, 0.006]], [x, y, z], M.cupWhite, 32);
    lathe([[0, 0.006], [0.03, 0.006], [0.045, 0.03], [0.048, 0.065], [0.044, 0.065], [0.041, 0.032], [0, 0.012]], [x, y, z], M.cupWhite, 32);
    cyl(0.041, 0.041, 0.002, [x, y, z + 0.052], M.tea, 24);
  }
  teacup(6.55, 4.12, FL + 0.76);
  alarmClock(K, M, 6.55, 3.98, FL + 0.76, 0.1, -0.5);
  function chesterfield(x, y, rz) {
    K.group([x, y, FL], [0, 0, rz], () => {
      box([0.82, 0.78, 0.1], [0, 0, 0.04], M.walnut, 0.01);
      cushion([0.86, 0.82, 0.3], [0, 0, 0.12], M.chesterLeather, 0.02, 0.06);
      cushion([0.58, 0.62, 0.14], [0, 0.04, 0.42], M.chesterLeather, 0.04, 0.05);
      cushion([0.86, 0.2, 0.46], [0, -0.33, 0.42], M.chesterLeather, 0.04, 0.07);
      for (const s of [-1, 1]) cushion([0.16, 0.82, 0.36], [s * 0.36, 0, 0.42], M.chesterLeather, 0.04, 0.08);
      for (const [bx, bz] of [[-0.25, 0.62], [0.0, 0.62], [0.25, 0.62], [-0.12, 0.74], [0.12, 0.74]]) cyl(0.012, 0.012, 0.01, [bx, -0.225, bz], M.leatherBlack, 10, 0, [PI / 2, 0, 0]);
    });
  }
  chesterfield(7.15, 3.2, 215 * PI / 180);
  cyl(0.26, 0.26, 0.03, [7.55, 3.95, FL + 0.55], M.walnut, 48, 0.004);
  cyl(0.035, 0.035, 0.55, [7.55, 3.95, FL], M.walnut, 16);
  cyl(0.18, 0.2, 0.03, [7.55, 3.95, FL], M.walnut, 40, 0.004);
  teacup(7.48, 3.88, FL + 0.58);
  box([0.2, 0.14, 0.03], [7.62, 4.05, FL + 0.58], BOOKS[1], 0.003, [0, 0, 0.4]);
  wall(false, sx0 + 0.006, sy0 + 0.36, sy1 - 0.36, FL, CEIL, [[4.75, 5.65, FL, FL + 2.15, 'door']], M.limewash, { t: 0.012, base: false });
  rug(6.2, 4.2, 2.9, 2.3, M.rug);
  mantelClock(K, M, 4.75, 6.0, FL + 0.83, 0.22, PI);
  for (const [x, y] of [[4.9, 3.4], [7.3, 4.9]]) downlight(x, y, 9);

  // ================================================================== LIVING ROOM
  K.zone('living');
  const lx0 = 9.4 + IT / 2, ly0 = HY0 + ET / 2, lx1 = HX1 - ET / 2, ly1 = 8.0;
  for (const [x, y] of [[10.6, 3.4], [12.8, 3.4], [10.6, 6.6], [12.8, 6.6]]) downlight(x, y, 22);
  const FX = lx1 - 0.45, FY0 = CHY - 1.2, FY1 = CHY + 1.2, OW = 1.6, OH = 0.42, OZ = FL + 0.42;
  const stone = (size, loc) => box(size, loc, M.travertine, 0.004);
  stone([0.45, FY1 - FY0, OZ - FL], [FX + 0.225, CHY, FL]);
  stone([0.45, (FY1 - FY0 - OW) / 2, OH], [FX + 0.225, FY0 + (FY1 - FY0 - OW) / 4, OZ]);
  stone([0.45, (FY1 - FY0 - OW) / 2, OH], [FX + 0.225, FY1 - (FY1 - FY0 - OW) / 4, OZ]);
  stone([0.45, FY1 - FY0, CEIL - OZ - OH], [FX + 0.225, CHY, OZ + OH]);
  box([0.4, FY1 - FY0, 0.06], [FX - 0.2, CHY, FL], M.blackMarble, 0.004);
  box([0.02, OW, OH], [lx1 - 0.03, CHY, OZ], M.soot);
  box([0.42, 0.02, OH], [FX + 0.21, CHY - OW / 2, OZ], M.soot);
  box([0.42, 0.02, OH], [FX + 0.21, CHY + OW / 2, OZ], M.soot);
  box([0.44, OW, 0.02], [FX + 0.22, CHY, OZ + OH - 0.02], M.soot);
  box([0.44, OW, 0.02], [FX + 0.22, CHY, OZ], M.soot);
  box([0.3, OW - 0.12, 0.05], [FX + 0.24, CHY, OZ + 0.02], M.blackMetal, 0.01);
  K.flames.push({ fireplace: true, pos: [FX + 0.24, CHY, OZ + 0.05], length: OW - 0.2 });
  light('point', [FX + 0.1, CHY, OZ + 0.2], 90, [1.0, 0.55, 0.22], { distance: 6, flicker: true });
  box([0.03, 1.36, 0.96], [FX - 0.015, CHY, FL + 1.55], M.oak, 0.003);
  plane(1.3, 0.9, [FX - 0.032, CHY, FL + 1.55 + 0.48], M.art3, [PI / 2, 0, -PI / 2], true);
  for (const [a, b] of [[ly0, FY0 - 0.03], [FY1 + 0.03, ly1 + 0.6]]) shelfUnitY(a, b, lx1, FL, FL + 0.6, 0.42, '-x', 0, M.oak, { books: false, cabinetH: 0.57 });
  vase(K, M, lx1 - 0.2, 2.95, FL + 0.6, 0.42, 1);
  tableLamp(lx1 - 0.2, 3.55, FL + 0.6, { energy: 18 });
  function sofa(cx, cy, length = 2.8, depth = 1.0, mat = null) {
    mat = mat || M.linen;
    const xBack = cx - depth / 2;
    box([depth - 0.12, length - 0.15, 0.08], [cx, cy, FL], M.soot);
    cushion([depth, length, 0.26], [cx, cy, FL + 0.06], mat, 0.01, 0.04);
    for (const s of [-1, 1]) cushion([depth, 0.24, 0.36], [cx, cy + s * (length / 2 - 0.12), FL + 0.3], mat, 0.012, 0.06);
    cushion([0.2, length - 0.48, 0.42], [xBack + 0.1, cy, FL + 0.3], mat, 0.015, 0.05);
    const seatL = (length - 0.48) / 3;
    for (let k = 0; k < 3; k++) {
      const y = cy - (length - 0.48) / 2 + seatL * (k + 0.5);
      cushion([depth - 0.24, seatL - 0.01, 0.18], [cx + 0.1, y, FL + 0.31], mat, 0.04, 0.06);
      cushion([0.26, seatL - 0.02, 0.5], [xBack + 0.3, y, FL + 0.48], mat, 0.05, 0.08, [0, -0.22, 0]);
    }
    [[-1.0, 0.2], [-0.5, -0.1]].forEach(([y, rz], k) => {
      cushion([0.16, 0.5, 0.5], [xBack + 0.48, cy + y, FL + 0.5], k === 0 ? M.linenGrey : M.velvet, 0.07, 0.07, [0, -0.3, rz]);
    });
    cushion([0.55, 0.9, 0.035], [cx + 0.15, cy - 0.35, FL + 0.53], M.knit, 0.012, 0.015, [0, 0.06, 0.12], 0.02);
  }
  sofa(10.15, CHY, 2.8);
  rug(11.55, CHY, 3.5, 3.4, M.rug);
  cyl(0.6, 0.6, 0.06, [11.55, CHY, FL + 0.3], M.travertine, 96, 0.006);
  cyl(0.42, 0.42, 0.3, [11.55, CHY, FL], M.travertine, 96, 0.006);
  vase(K, M, 11.4, CHY - 0.2, FL + 0.36, 0.22, 0);
  [[0.32, 0.24, 0.035, 'tb0', 0.35], [0.28, 0.21, 0.03, 'tb1', 0.47], [0.25, 0.19, 0.028, 'tb2', 0.6]].forEach(([w, d_, h, m, r], k) => {
    box([w, d_, h], [11.75, CHY + 0.22, FL + 0.36 + [0, 0.035, 0.065][k]], M[m], 0.003, [0, 0, r]);
  });
  loungeChair(K, M, 12.45, 3.2, FL, 150 * PI / 180, 0.82);
  loungeChair(K, M, 11.0, 3.05, FL, 195 * PI / 180, 0.82);
  sideTable(K, M, 10.15, 3.4, FL, 0.5);
  vase(K, M, 10.15, 3.4, FL + 0.5, 0.3, 1);
  frameArt(9.4 + IT / 2 + 0.005, CHY, FL + 1.25, 1.2, 1.2, '+x', M.art2, M.oak);
  lathe([[0, 0], [0.04, 0], [0.042, 0.09], [0.038, 0.09], [0.036, 0.008], [0, 0.008]], [11.25, CHY + 0.3, FL + 0.36], M.ceramic, 32);
  cyl(0.036, 0.036, 0.002, [11.25, CHY + 0.3, FL + 0.43], M.tea, 20);
  box([0.22, 0.29, 0.008], [11.8, CHY - 0.25, FL + 0.36], M.paper, 0.002, [0, 0, 0.5]);
  candleholders(K, M, lx1 - 0.22, 7.6, FL + 0.6, 0.28);
  [[0.2, 0.03], [0.18, 0.025]].forEach(([w, h], k) => box([w, 0.14, h], [lx1 - 0.2, 6.8, FL + 0.6 + 0.03 * k], BOOKS[(k * 4 + 2) % BOOKS.length], 0.003, [0, 0, 0.2 * k]));
  for (const x of [10.95, 12.95]) curtain(x, ly0 + 0.16, 0.45, 2.75, M.sheer);
  box([2.6, 0.025, 0.025], [11.95, ly0 + 0.16, FL + 2.8], M.blackMetal);

  // ================================================================== KITCHEN AND DINING
  K.zone('kitchen');
  const kx1 = HX1 - ET / 2, ky1 = HY1 - ET / 2;
  const KW = kx1, CY0 = 9.25, CY1 = ky1 - 0.02;
  const tallUnit = (y0, y1, mat = null) => box([0.64, y1 - y0, CEIL - FL - 0.02], [KW - 0.32, (y0 + y1) / 2, FL], mat || M.oak, 0.002);
  const OT0 = CY0, OT1 = CY0 + 0.66;
  tallUnit(OT0, OT1);
  [FL + 0.85, FL + 1.47].forEach((z) => {
    box([0.02, 0.6, 0.58], [KW - 0.652, (OT0 + OT1) / 2, z], M.steel, 0.004);
    box([0.004, 0.5, 0.36], [KW - 0.664, (OT0 + OT1) / 2, z + 0.12], M.screen, 0.002);
    box([0.03, 0.46, 0.018], [KW - 0.68, (OT0 + OT1) / 2, z + 0.5], M.steel, 0.006);
  });
  const RB0 = OT1, RB1 = 12.35;
  box([0.56, RB1 - RB0, 0.1], [KW - 0.32, (RB0 + RB1) / 2, FL], M.soot);
  box([0.62, RB1 - RB0, 0.76], [KW - 0.31, (RB0 + RB1) / 2, FL + 0.1], M.oak, 0.002);
  const nd = Math.round((RB1 - RB0) / 0.6);
  for (let k = 0; k < nd; k++) {
    const ya = RB0 + (RB1 - RB0) * k / nd, yb = RB0 + (RB1 - RB0) * (k + 1) / nd;
    box([0.003, yb - ya - 0.004, 0.003], [KW - 0.622, (ya + yb) / 2, FL + 0.48], M.soot);
    box([0.003, 0.003, 0.76], [KW - 0.622, yb, FL + 0.1], M.soot);
  }
  box([0.66, RB1 - RB0 + 0.01, 0.04], [KW - 0.33, (RB0 + RB1) / 2, FL + 0.86], M.marble, 0.003);
  wall(false, KW - 0.006, RB0, RB1, FL + 0.9, FL + 1.55, [], M.marble, { t: 0.012, base: false });
  box([0.52, 0.78, 0.006], [KW - 0.33, 10.95, FL + 0.9], M.screen, 0.002);
  box([0.36, RB1 - RB0, CEIL - FL - 1.55], [KW - 0.18, (RB0 + RB1) / 2, FL + 1.55], M.oak, 0.002);
  for (let k = 1; k < nd; k++) { const yb = RB0 + (RB1 - RB0) * k / nd; box([0.003, 0.003, CEIL - FL - 1.6], [KW - 0.362, yb, FL + 1.58], M.soot); }
  box([0.02, RB1 - RB0 - 0.1, 0.01], [KW - 0.3, (RB0 + RB1) / 2, FL + 1.545], M.ledStrip);
  light('rect', [KW - 0.3, (RB0 + RB1) / 2, FL + 1.53], 9, [1.0, 0.86, 0.68], { w: 0.08, h: RB1 - RB0 - 0.1, dir: [0, 0, -1] });
  box([0.34, 0.8, 0.02], [KW - 0.18, 10.95, FL + 1.545], M.steel);
  const FR0 = RB1, FR1 = CY1;
  box([0.64, FR1 - FR0, CEIL - FL - 1.95], [KW - 0.32, (FR0 + FR1) / 2, FL + 1.93], M.oak, 0.002);
  box([0.68, FR1 - FR0 - 0.04, 1.9], [KW - 0.34, (FR0 + FR1) / 2, FL + 0.02], M.stainless, 0.01);
  box([0.004, 0.006, 1.86], [KW - 0.682, (FR0 + FR1) / 2, FL + 0.04], M.soot);
  for (const dy of [-0.05, 0.05]) box([0.03, 0.025, 1.1], [KW - 0.71, (FR0 + FR1) / 2 + dy, FL + 0.5], M.stainless, 0.008);
  box([0.004, 0.16, 0.24], [KW - 0.682, (FR0 + FR1) / 2 - 0.25, FL + 1.25], M.screen);
  kettle(K, M, KW - 0.3, 11.75, FL + 0.9, 0.24, -1.2);
  box([0.38, 0.26, 0.36], [KW - 0.3, 12.1, FL + 0.9], M.blackMetal, 0.02);
  box([0.025, 0.45, 0.32], [KW - 0.05, 10.3, FL + 0.9], M.walnut, 0.01, [0, -0.12, 0]);
  jug(K, M, KW - 0.25, 10.15, FL + 0.9, 0.2);
  pot(K, M, KW - 0.33, 10.85, FL + 0.91, 0.15);
  const IX = 11.62, IY = 11.15, IW = 1.05, ID = 2.5;
  box([IW - 0.14, ID - 0.14, 0.1], [IX, IY, FL], M.soot);
  box([IW - 0.04, ID - 0.04, 0.86], [IX, IY, FL + 0.02], M.marble, 0.003);
  box([IW, ID, 0.04], [IX, IY, FL + 0.88], M.marble, 0.003);
  for (const sgn of [-1, 1]) box([IW, 0.04, 0.88], [IX, IY + sgn * (ID / 2 - 0.02), FL], M.marble, 0.003);
  box([0.42, 0.62, 0.004], [IX + 0.1, IY + 0.35, FL + 0.921], M.blackMetal, 0.002);
  rod([IX + 0.38, IY + 0.35, FL + 0.92], [IX + 0.38, IY + 0.35, FL + 1.32], 0.012, M.blackMetal, 16);
  rod([IX + 0.38, IY + 0.35, FL + 1.32], [IX + 0.12, IY + 0.35, FL + 1.28], 0.011, M.blackMetal, 16);
  lathe([[0, 0], [0.1, 0], [0.17, 0.05], [0.18, 0.08], [0.17, 0.08], [0.16, 0.055], [0, 0.012]], [IX - 0.05, IY - 0.6, FL + 0.92], M.walnut, 48);
  [[0.03, 0.02, 'fruitGreen'], [-0.05, -0.03, 'fruitOrange'], [0.06, -0.06, 'fruitGreen'], [-0.02, 0.07, 'fruitOrange'], [0, -0.01, 'fruitOrange']].forEach(([fx, fy, m]) => {
    lathe([[0, 0], [0.03, 0.006], [0.04, 0.035], [0.03, 0.068], [0, 0.072]], [IX - 0.05 + fx, IY - 0.6 + fy, FL + 0.95], M[m], 20);
  });
  for (let k = 0; k < 3; k++) {
    const py = IY - 0.8 + k * 0.8;
    rod([IX, py, FL + 1.9], [IX, py, CEIL], 0.004, M.blackMetal, 6);
    box([0.05, 0.6, 0.035], [IX, py, FL + 1.88], M.blackMetal, 0.008);
    box([0.03, 0.56, 0.004], [IX, py, FL + 1.877], M.ledStrip);
    light('rect', [IX, py, FL + 1.86], 12, [1.0, 0.84, 0.64], { w: 0.04, h: 0.56, dir: [0, 0, -1] });
  }
  for (const [x, y] of [[10.3, 12.6], [10.3, 9.9]]) downlight(x, y, 20);
  box([1.3, 0.38, 0.05], [12.9, ky1 - 0.22, FL + 0.42], M.oak, 0.006);
  for (const dx of [-0.55, 0.55]) box([0.05, 0.34, 0.42], [12.9 + dx, ky1 - 0.22, FL], M.blackMetal, 0.002);
  const DTX = 11.7, DTY = 8.3;
  box([2.3, 1.0, 0.04], [DTX, DTY, FL + 0.72], M.oak, 0.004);
  for (const sx of [-0.95, 0.95]) box([0.08, 0.8, 0.72], [DTX + sx, DTY, FL], M.blackMetal, 0.004);
  for (let k = 0; k < 3; k++) {
    const x = DTX - 0.7 + k * 0.7;
    diningChair(K, M, x, DTY - 0.62, FL, PI, 0.9);
    diningChair(K, M, x, DTY + 0.62, FL, 0, 0.9);
  }
  pendant(DTX, DTY, FL + 1.55, { r: 0.32, h: 0.18, mat: M.brass, energy: 45 });
  box([2.0, 0.36, 0.004], [DTX, DTY, FL + 0.76], M.linenOat, 0.001);
  for (const dx of [-0.25, 0.0, 0.25]) {
    cyl(0.03, 0.035, 0.06, [DTX + dx, DTY + 0.05, FL + 0.765], M.brass, 20);
    cyl(0.012, 0.012, 0.22 + (dx === 0 ? 0.04 : 0), [DTX + dx, DTY + 0.05, FL + 0.825], M.candle, 12);
  }
  lathe([[0, 0], [0.09, 0], [0.16, 0.06], [0.17, 0.09], [0.16, 0.09], [0.15, 0.065], [0, 0.012]], [DTX + 0.6, DTY - 0.05, FL + 0.765], M.ceramic, 48);
  [[0.03, 0.02, 'fruitGreen'], [-0.05, -0.03, 'fruitOrange'], [0.06, -0.06, 'fruitOrange'], [-0.02, 0.07, 'fruitGreen']].forEach(([fx, fy, m]) => {
    lathe([[0, 0], [0.03, 0.006], [0.04, 0.035], [0.03, 0.068], [0, 0.072]], [DTX + 0.6 + fx, DTY - 0.05 + fy, FL + 0.79], M[m], 20);
  });
  for (const dx of [-0.7, 0.0]) for (const sgn of [-1, 1]) {
    cyl(0.13, 0.12, 0.012, [DTX + dx, DTY + sgn * 0.32, FL + 0.765], M.cupWhite, 40, 0.003);
    lathe([[0, 0], [0.035, 0], [0.035, 0.004], [0.006, 0.01], [0.006, 0.08], [0.04, 0.12], [0.042, 0.19], [0.039, 0.19], [0.037, 0.12], [0, 0.088]], [DTX + dx + 0.16, DTY + sgn * 0.42, FL + 0.765], M.wineGlass, 24);
  }
  frameArt(HX1 - ET / 2 - 0.005, 8.1, FL + 1.45, 1.0, 0.75, '-x', M.art4, M.blackMetal);

  // ================================================================== BATHROOM
  K.zone('bath');
  const bx0 = HX0 + ET / 2, by0 = 6.2 + IT / 2, bx1 = 8.0 - IT / 2, by1 = 9.6 - IT / 2;
  for (const [alongX, c, a0, a1, sg, holes] of [[true, by0, bx0, bx1, 1, []], [true, by1, bx0, bx1, -1, []],
    [false, bx0, by0, by1, 1, [[6.45, 8.05, FL + 0.55, FL + 2.6, 'win']]], [false, bx1, by0, by1, -1, [[...BATH_DOOR, FL, FL + 2.15, 'door']]]]) {
    wall(alongX, c + sg * 0.006, a0, a1, FL, CEIL, holes, M.marble, { t: 0.012, base: false });
  }
  const TUBY = 7.25;
  lathe([[0, 0.03], [0.3, 0.03], [0.36, 0.08], [0.4, 0.35], [0.41, 0.58], [0.4, 0.6], [0.37, 0.6], [0.355, 0.56], [0.34, 0.3], [0.29, 0.12], [0, 0.11]], [bx0 + 0.6, TUBY, FL], M.porcelain, 64, 1.0, 2.05);
  const FX_ = bx0 + 1.22, FY_ = TUBY + 0.62;
  rod([FX_, FY_, FL], [FX_, FY_, FL + 0.95], 0.018, M.blackMetal, 16);
  rod([FX_, FY_, FL + 0.95], [FX_ - 0.12, FY_, FL + 1.0], 0.014, M.blackMetal, 12);
  rod([FX_ - 0.12, FY_, FL + 1.0], [FX_ - 0.24, FY_, FL + 0.9], 0.014, M.blackMetal, 12);
  rod([FX_ + 0.03, FY_, FL + 0.6], [FX_ + 0.03, FY_, FL + 0.82], 0.016, M.blackMetal, 12);
  box([0.62, 0.16, 0.02], [bx0 + 0.6, TUBY - 0.05, FL + 0.6], M.walnut, 0.004);
  lathe([[0, 0], [0.035, 0], [0.035, 0.07], [0, 0.07]], [bx0 + 0.45, TUBY - 0.05, FL + 0.62], M.candle, 20);
  K.flames.push({ pos: [bx0 + 0.45, TUBY - 0.05, FL + 0.69], small: true });
  const SX1 = bx0 + 1.25, SY0 = 8.4;
  box([SX1 - bx0 - 0.05, 0.012, 2.05], [(bx0 + SX1) / 2 + 0.03, SY0, FL + 0.02], M.showerGlass);
  box([0.04, 0.03, 0.06], [bx0 + 0.04, SY0, FL + 1.2], M.blackMetal);
  rod([bx0 + 0.6, by1, FL + 2.2], [bx0 + 0.6, by1 - 0.4, FL + 2.2], 0.012, M.blackMetal, 12);
  box([0.25, 0.25, 0.015], [bx0 + 0.6, by1 - 0.42, FL + 2.18], M.blackMetal, 0.004);
  box([0.06, 0.02, 0.18], [bx0 + 0.6, by1 - 0.01, FL + 1.05], M.blackMetal, 0.005);
  rod([bx0 + 0.6, by1 - 0.02, FL + 0.95], [bx0 + 0.6, by1 - 0.02, FL + 1.5], 0.008, M.blackMetal, 8);
  box([0.45, 0.012, 0.3], [bx0 + 0.6, by1 - 0.012, FL + 1.25], M.soot);
  [-0.12, 0.0, 0.12].forEach((dx, k) => lathe([[0, 0], [0.03, 0], [0.03, 0.15], [0.012, 0.18], [0, 0.18]], [bx0 + 0.6 + dx, by1 - 0.06, FL + 1.25], k !== 1 ? M.amber : M.cupWhite, 20));
  box([0.06, 0.8, 0.004], [bx0 + 1.1, (SY0 + by1) / 2, FL], M.steel);
  const VX0 = bx0 + 1.45, VX1 = bx1 - 0.12, VY = by1;
  box([VX1 - VX0, 0.52, 0.5], [(VX0 + VX1) / 2, VY - 0.26, FL + 0.32], M.oak, 0.003);
  for (let k = 1; k < 3; k++) { const x = VX0 + (VX1 - VX0) * k / 3; box([0.003, 0.003, 0.5], [x, VY - 0.522, FL + 0.32], M.soot); }
  box([VX1 - VX0, 0.003, 0.003], [(VX0 + VX1) / 2, VY - 0.522, FL + 0.57], M.soot);
  box([VX1 - VX0 + 0.02, 0.56, 0.04], [(VX0 + VX1) / 2, VY - 0.28, FL + 0.82], M.marble, 0.003);
  for (const x of [VX0 + (VX1 - VX0) * 0.27, VX0 + (VX1 - VX0) * 0.73]) {
    box([0.46, 0.32, 0.006], [x, VY - 0.3, FL + 0.857], M.soot, 0.02);
    rod([x, VY, FL + 1.06], [x, VY - 0.2, FL + 1.06], 0.011, M.blackMetal, 12);
    box([0.2, 0.012, 0.06], [x, VY - 0.006, FL + 1.03], M.blackMetal, 0.003);
  }
  lathe([[0, 0], [0.035, 0], [0.035, 0.13], [0.012, 0.15], [0.012, 0.19], [0, 0.19]], [(VX0 + VX1) / 2 - 0.05, VY - 0.12, FL + 0.86], M.amber, 20);
  lathe([[0, 0], [0.03, 0], [0.03, 0.11], [0.011, 0.13], [0.011, 0.16], [0, 0.16]], [(VX0 + VX1) / 2 + 0.05, VY - 0.12, FL + 0.86], M.amber, 20);
  cushion([0.3, 0.22, 0.06], [VX1 - 0.25, VY - 0.2, FL + 0.86], M.towel, 0.01, 0.02);
  const MW = VX1 - VX0 - 0.1, MH = 0.95, MZ = FL + 1.25;
  box([MW - 0.1, 0.004, MH - 0.1], [(VX0 + VX1) / 2, VY - 0.012, MZ + 0.05], M.mirrorGlow);
  box([MW, 0.03, MH], [(VX0 + VX1) / 2, VY - 0.045, MZ], M.brass, 0.003);
  plane(MW - 0.03, MH - 0.03, [(VX0 + VX1) / 2, VY - 0.062, MZ + MH / 2], M.mirror, [PI / 2, 0, 0]);
  light('rect', [(VX0 + VX1) / 2, VY - 0.08, MZ - 0.02], 25, [1.0, 0.85, 0.62], { w: MW, h: 0.05, dir: [0, 0, -1] });
  const CX = bx0 + 0.75, CY_ = 7.0;
  rod([CX, CY_, FL + 2.25], [CX, CY_, CEIL], 0.004, M.blackMetal, 6);
  for (let k = 0; k < 8; k++) { const a = k * PI / 4; rod([CX + 0.11 * Math.cos(a), CY_ + 0.11 * Math.sin(a), FL + 1.95], [CX + 0.11 * Math.cos(a), CY_ + 0.11 * Math.sin(a), FL + 2.25], 0.004, M.blackMetal, 6); }
  for (const z of [FL + 1.95, FL + 2.1, FL + 2.25]) lathe([[0.108, 0], [0.114, 0], [0.114, 0.008], [0.108, 0.008]], [CX, CY_, z], M.blackMetal, 32);
  lathe([[0, 0], [0.04, 0.02], [0.045, 0.06], [0.03, 0.1], [0, 0.11]], [CX, CY_, FL + 2.05], M.bulb, 20);
  light('point', [CX, CY_, FL + 2.1], 18, [1.0, 0.78, 0.5], { distance: 5 });
  rug((VX0 + VX1) / 2, 8.75, 1.4, 0.7, M.rug);

  // ================================================================== GARAGE (workshop)
  K.zone('garage');
  const GX0 = 0.11, GX1 = HX0 - ET / 2, GY0_ = 0.11, GY1_ = GY1 - ET / 2;
  box([0.42, 1.0, FL - 0.12], [GX1 - 0.21, 5.2, 0.12], M.granite, 0.006);
  box([0.32, 1.0, (FL - 0.12) / 2], [GX1 - 0.58, 5.2, 0.12], M.granite, 0.006);
  for (const gx_ of [1.3, 2.5, 3.7]) box([0.006, GY1_ - GY0_, 0.003], [gx_, (GY0_ + GY1_) / 2, 0.12], M.soot);
  for (const gy_ of [1.3, 2.5, 3.7, 4.9]) box([GX1 - GX0, 0.006, 0.003], [(GX0 + GX1) / 2, gy_, 0.12], M.soot);
  cyl(0.35, 0.35, 0.001, [2.4, 1.6, 0.121], M.stain, 32, 0, [0, 0, 0], [1.4, 0.8, 1]);
  box([0.02, 3.8, 1.35], [GX0 + 0.01, 3.1, 1.05], M.pegboard);
  box([0.36, 4.0, 0.035], [GX0 + 0.18, 3.1, 2.48], M.oak, 0.004);
  for (const y of [1.25, 3.1, 4.95]) box([0.3, 0.03, 0.18], [GX0 + 0.15, y, 2.3], M.blackMetal);
  const X = GX0 + 0.02;
  const hammer = (y, z, m) => { rod([X + 0.02, y, z - 0.16], [X + 0.02, y, z + 0.12], 0.013, m, 10); box([0.03, 0.13, 0.035], [X + 0.025, y + 0.02, z + 0.11], M.blackMetal, 0.006); };
  const spanner = (y, z, L) => { box([0.012, 0.022, L], [X + 0.012, y, z - L / 2], M.stainless, 0.004); cyl(0.022, 0.022, 0.012, [X + 0.012, y, z + 0.01], M.stainless, 16, 0, [0, PI / 2, 0]); };
  const driver = (y, z, m) => { rod([X + 0.03, y, z], [X + 0.03, y, z + 0.11], 0.014, m, 10); rod([X + 0.03, y, z - 0.15], [X + 0.03, y, z], 0.004, M.stainless, 6); };
  const pliers = (y, z, m) => { for (const a of [-0.18, 0.18]) box([0.012, 0.016, 0.2], [X + 0.015, y, z - 0.1], m, 0.004, [a, 0, 0]); box([0.014, 0.03, 0.06], [X + 0.015, y, z + 0.02], M.blackMetal, 0.004); };
  const saw = (y, z) => { box([0.004, 0.5, 0.12], [X + 0.01, y + 0.25, z - 0.08], M.stainless); box([0.03, 0.12, 0.13], [X + 0.02, y - 0.02, z - 0.085], M.toolRed, 0.015); };
  const tape = (y, z) => cyl(0.04, 0.04, 0.035, [X + 0.03, y, z], M.toolYellow, 24, 0.006, [0, PI / 2, 0]);
  const coil = (y, z, m, r = 0.12) => K.lathe([[r - 0.025, -0.02], [r + 0.025, -0.02], [r + 0.025, 0.02], [r - 0.025, 0.02]], [X + 0.04, y, z], m, { seg: 36, rot: [0, PI / 2, 0] });
  const drill = (y, z) => { box([0.07, 0.18, 0.07], [X + 0.05, y, z], M.toolYellow, 0.02); box([0.05, 0.05, 0.14], [X + 0.05, y - 0.04, z - 0.14], M.blackMetal, 0.015); box([0.07, 0.08, 0.05], [X + 0.05, y - 0.04, z - 0.18], M.blackMetal, 0.01); };
  for (let k = 0; k < 12; k++) spanner(1.35 + k * 0.045, 2.2, 0.12 + k * 0.012);
  [M.toolRed, M.toolYellow, M.blackMetal, M.toolRed, M.toolBlue, M.toolYellow, M.blackMetal].forEach((m, k) => driver(2.05 + k * 0.05, 2.1, m));
  tape(2.55, 2.15); tape(2.65, 2.15);
  [M.toolRed, M.toolBlue, M.toolRed].forEach((m, k) => pliers(2.85 + k * 0.07, 2.22, m));
  box([0.08, 0.42, 0.26], [X + 0.04, 3.4, 2.0], M.toolRed, 0.012);
  for (let k = 0; k < 8; k++) driver(3.75 + k * 0.05, 2.1, k % 2 ? M.blackMetal : M.toolYellow);
  coil(4.6, 2.12, M.cableOrange, 0.13);
  [M.walnut, M.toolRed, M.blackMetal].forEach((m, k) => hammer(1.4 + k * 0.18, 1.62, m));
  saw(2.0, 1.72); drill(2.75, 1.66); drill(2.98, 1.66);
  for (let k = 0; k < 5; k++) { box([0.03, 0.05, 0.24], [X + 0.03, 3.35 + k * 0.08, 1.58], k % 2 ? M.blackMetal : M.toolBlue, 0.006); box([0.012, 0.012, 0.3], [X + 0.02, 3.37 + k * 0.08, 1.48], M.stainless); }
  coil(4.25, 1.62, M.binGreen, 0.17);
  box([0.025, 0.6, 0.05], [X + 0.02, 4.55, 1.4], M.toolYellow, 0.006);
  for (let k = 0; k < 6; k++) box([0.12, 0.13, 0.09], [X + 0.06, 1.45 + k * 0.15, 1.12], [M.crateBlue, M.toolRed, M.toolYellow][k % 3], 0.008);
  box([0.16, 0.3, 0.18], [GX0 + 0.12, 4.45, 1.02], M.toolYellow, 0.02);
  cyl(0.14, 0.14, 0.03, [GX0 + 0.02, 5.5, 2.15], M.cupWhite, 40, 0, [0, PI / 2, 0]);
  cyl(0.15, 0.15, 0.025, [GX0 + 0.015, 5.5, 2.15], M.blackMetal, 40, 0, [0, PI / 2, 0]);
  cyl(0.08, 0.09, 0.03, [GX0 + 0.55, 2.3, 1.02], M.blackMetal, 24);
  rod([GX0 + 0.55, 2.3, 1.05], [GX0 + 0.45, 2.45, 1.45], 0.01, M.blackMetal, 8);
  lathe([[0.012, 0.12], [0.03, 0.12], [0.075, 0.02], [0.08, 0.0], [0.075, 0.0], [0.07, 0.02], [0.026, 0.116]], [GX0 + 0.45, 2.55, 1.33], M.blackMetal, 28);
  light('spot', [GX0 + 0.45, 2.55, 1.34], 12, [1.0, 0.85, 0.65], { dir: [0, 0, -1], angle: 1.0, distance: 3 });
  for (const dx of [-0.2, 0.2]) rod([3.55 + dx, GY1_ - 0.05, 2.4], [3.55 + dx, GY1_ - 0.6, 0.12], 0.02, M.stainless, 8);
  for (let k = 1; k < 7; k++) { const t = k / 7; rod([3.35, GY1_ - 0.6 + 0.55 * t, 0.12 + 2.28 * t], [3.75, GY1_ - 0.6 + 0.55 * t, 0.12 + 2.28 * t], 0.012, M.stainless, 6); }
  cyl(0.2, 0.2, 0.45, [0.75, 5.0, 0.12], M.toolRed, 32, 0.02);
  cyl(0.21, 0.19, 0.12, [0.75, 5.0, 0.57], M.blackMetal, 32, 0.02);
  for (let y = 1.2; y < 4.95;) { const w = R(0.25, 0.45); box([0.3, w, R(0.18, 0.3)], [GX0 + 0.18, y + w / 2, 2.515], K.pick([M.cardboard, M.crateBlue, M.binGreen, M.cardboard]), 0.006); y += w + R(0.04, 0.1); }
  const WB0 = 2.0, WB1 = 4.2;
  box([0.72, WB1 - WB0, 0.05], [GX0 + 0.37, (WB0 + WB1) / 2, 0.97], M.oak, 0.004);
  for (const [xx, yy] of [[GX0 + 0.06, WB0 + 0.05], [GX0 + 0.68, WB0 + 0.05], [GX0 + 0.06, WB1 - 0.05], [GX0 + 0.68, WB1 - 0.05]]) box([0.05, 0.05, 0.85], [xx, yy, 0.12], M.blackMetal);
  box([0.66, WB1 - WB0 - 0.1, 0.025], [GX0 + 0.37, (WB0 + WB1) / 2, 0.3], M.oak);
  box([0.62, 0.55, 0.5], [GX0 + 0.37, WB1 - 0.35, 0.42], M.charcoal, 0.006);
  for (let k = 0; k < 3; k++) box([0.003, 0.53, 0.003], [GX0 + 0.68, WB1 - 0.35, 0.58 + k * 0.13], M.soot);
  box([0.3, 0.5, 0.22], [GX0 + 0.35, 3.0, 1.02], M.toolYellow, 0.015);
  box([0.31, 0.51, 0.03], [GX0 + 0.35, 3.0, 1.23], M.blackMetal, 0.01);
  for (let k = 0; k < 3; k++) box([0.12, 0.9, 0.025], [GX0 + 0.45 + k * 0.03, 2.4, 1.02 + k * 0.025], M.oak, 0.003, [0, 0, 0.05 * k]);
  box([0.12, 0.18, 0.12], [GX0 + 0.62, 2.15, 1.02], M.toolBlue, 0.01);
  box([0.55, 0.7, 0.9], [GX0 + 0.3, 0.6, 0.2], M.toolRed, 0.012);
  for (let k = 0; k < 5; k++) box([0.003, 0.66, 0.003], [GX0 + 0.58, 0.6, 0.35 + k * 0.15], M.soot);
  for (const [xx, yy] of [[GX0 + 0.1, 0.35], [GX0 + 0.5, 0.35], [GX0 + 0.1, 0.85], [GX0 + 0.5, 0.85]]) cyl(0.035, 0.035, 0.03, [xx, yy, 0.13], M.blackMetal, 12, 0, [PI / 2, 0, 0]);
  const SHX0 = 1.3, SHX1 = 3.2;
  for (const xx of [SHX0, SHX1]) for (const yy of [GY1_ - 0.05, GY1_ - 0.5]) box([0.03, 0.03, 2.2], [xx, yy, 0.12], M.steel);
  [0.25, 0.75, 1.25, 1.75, 2.25].forEach((z, k) => {
    box([SHX1 - SHX0 + 0.03, 0.5, 0.02], [(SHX0 + SHX1) / 2, GY1_ - 0.27, z], M.steel);
    let xx = SHX0 + 0.1;
    while (xx < SHX1 - 0.3 && k < 4) { const w = R(0.3, 0.5); box([w, 0.42, R(0.2, 0.32)], [xx + w / 2, GY1_ - 0.27, z + 0.02], K.pick([M.binGreen, M.crateBlue, M.cardboard, M.cardboard]), 0.01); xx += w + 0.06; }
  });
  cyl(0.22, 0.2, 0.62, [GX0 + 0.3, 1.25, 0.12], M.charcoal, 32, 0.01);
  cyl(0.15, 0.12, 0.28, [GX0 + 0.33, 4.6, 0.12], M.toolYellow, 28, 0.006);
  for (const x of [1.0, 2.1, 3.2]) {
    box([0.08, 5.2, 0.03], [x, GY1 / 2, 3.165], M.ledStrip, 0.004);
    light('rect', [x, GY1 / 2, 3.14], 55, [1.0, 0.96, 0.9], { w: 0.08, h: 5.2, dir: [0, 0, -1] });
  }

  // ================================================================== BEDROOM
  K.zone('bed');
  const ex0 = HX0 + ET / 2, ey0 = 9.6 + IT / 2, ex1 = 9.4 - IT / 2, ey1 = HY1 - ET / 2;
  wall(true, ey0 + 0.006, ex0, ex1, FL, CEIL, [[...BED_DOOR, FL, FL + 2.15, 'door']], M.limewash, { t: 0.012, base: false });
  const BX = 6.4;
  box([1.98, 2.18, 0.32], [BX, ey0 + 1.13, FL + 0.08], M.walnut, 0.012);
  box([1.75, 1.95, 0.08], [BX, ey0 + 1.12, FL], M.soot);
  box([2.3, 0.08, 1.3], [BX, ey0 + 0.06, FL + 0.08], M.walnut, 0.01);
  for (let k = 1; k < 7; k++) box([0.006, 0.084, 1.0], [BX - 1.06 + k * 2.12 / 7, ey0 + 0.06, FL + 0.14], M.soot);
  cushion([1.82, 2.0, 0.24], [BX, ey0 + 1.14, FL + 0.38], M.linenWhite, 0.015, 0.06);
  drape(BX, ey0 + 0.62, ey0 + 2.12, FL + 0.64, 0.92, M.duvet, { hang: 0.34, footHang: 0.3, fold: [ey0 + 0.72, 0.28], seed: 5 });
  drape(BX, ey0 + 1.62, ey0 + 2.13, FL + 0.69, 0.98, M.knitThrow, { hang: 0.22, footHang: 0.18, seed: 9 });
  [[BX - 0.45, M.linenWhite, 0.05], [BX + 0.45, M.linenWhite, -0.05], [BX - 0.42, M.linenGrey, 0.1], [BX + 0.42, M.benchVelvet, -0.08], [BX, M.benchVelvet, 0.0]].forEach(([x, mat, rz], k) => {
    const yy = ey0 + (k < 2 ? 0.32 : k < 4 ? 0.45 : 0.55);
    cushion([k < 4 ? 0.68 : 0.5, 0.18, k < 4 ? 0.44 : 0.32], [x, yy, FL + 0.62], mat, 0.07, 0.07, [-0.35, 0, rz]);
  });
  for (const x of [BX - 1.35, BX + 1.35]) {
    box([0.52, 0.42, 0.5], [x, ey0 + 0.24, FL + 0.08], M.walnut, 0.008);
    box([0.46, 0.36, 0.08], [x, ey0 + 0.24, FL], M.soot);
    box([0.5, 0.012, 0.16], [x, ey0 + 0.455, FL + 0.4], M.walnut, 0.003);
    box([0.46, 0.34, 0.2], [x, ey0 + 0.27, FL + 0.13], M.soot);
    for (let k = 0; k < 4; k++) box([0.035, 0.2, 0.18 - 0.02 * (k % 2)], [x - 0.15 + k * 0.045, ey0 + 0.28, FL + 0.13], BOOKS[(k * 2 + Math.floor(x)) % BOOKS.length]);
    tableLamp(x, ey0 + 0.25, FL + 0.58, { baseMat: M.ceramic, energy: 20, h: 0.32, shade: [0.13, 0.17] });
  }
  frameArt(BX, ey0 + 0.012, FL + 1.5, 1.1, 0.89, '+y', M.art3, M.oak);
  rug(BX, ey0 + 1.75, 2.7, 3.0, M.rug);
  box([1.4, 0.42, 0.06], [BX, ey0 + 2.5, FL + 0.4], M.walnut, 0.006);
  for (const dx of [-0.6, 0.6]) box([0.05, 0.38, 0.4], [BX + dx, ey0 + 2.5, FL], M.walnut, 0.004);
  cushion([1.38, 0.4, 0.08], [BX, ey0 + 2.5, FL + 0.46], M.benchVelvet, 0.02, 0.025);
  box([0.22, 0.16, 0.03], [BX - 0.4, ey0 + 2.48, FL + 0.55], BOOKS[3], 0.003, [0, 0, 0.2]);
  const WX0 = ex1 - 0.62;
  box([0.62, ey1 - ey0 - 0.9, CEIL - FL - 0.02], [WX0 + 0.31, (ey0 + 0.9 + ey1) / 2, FL], M.oak, 0.004);
  for (let k = 0; k < 5; k++) {
    const ya = ey0 + 0.9 + (ey1 - ey0 - 0.9) * k / 5 + 0.004, yb = ey0 + 0.9 + (ey1 - ey0 - 0.9) * (k + 1) / 5 - 0.004;
    box([0.02, yb - ya, CEIL - FL - 0.16], [WX0 - 0.01, (ya + yb) / 2, FL + 0.08], M.oak, 0.002);
    box([0.025, 0.015, 1.2], [WX0 - 0.03, k % 2 === 0 ? yb - 0.04 : ya + 0.04, FL + 0.5], M.blackMetal, 0.003);
  }
  loungeChair(K, M, ex0 + 0.75, 12.9, FL, 44 * PI / 180, 0.8);
  sideTable(K, M, ex0 + 0.4, 12.15, FL, 0.5);
  teacup(ex0 + 0.38, 12.1, FL + 0.5);
  box([0.2, 0.14, 0.025], [ex0 + 0.45, 12.25, FL + 0.5], BOOKS[6], 0.003, [0, 0, 0.5]);
  for (const x of [6.0, 6.8]) curtain(x < 6.4 ? x - 0.65 : x + 0.65, ey1 - 0.16, 0.4, 2.75, M.sheer);
  box([2.6, 0.025, 0.025], [6.4, ey1 - 0.16, FL + 2.8], M.blackMetal);
  for (const yy of [10.65, 12.55]) curtain(ex0 + 0.16, yy, 0.42, 2.75, M.sheer, false);
  box([0.025, 2.2, 0.025], [ex0 + 0.16, 11.6, FL + 2.8], M.blackMetal);
  for (const [x, y] of [[5.2, 11.6], [7.6, 11.6]]) downlight(x, y, 16);
}
