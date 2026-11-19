// Procedural stand-ins for the scanned Poly Haven pieces of the Blender scene. Convention (Blender coordinates):
// (x, y, z) is the floor point under the piece; at rz = 0 a seat faces -y.
import * as T from 'three';
import { mat4, latheGeo } from './kit.js';

// Eames-style lounge chair: walnut shells, black leather cushions, swivel star base
export function loungeChair(K, M, x, y, z, rz, h = 0.82) {
  const s = h / 0.82;
  K.group([x, y, z], [0, 0, rz], () => {
    // star base and column
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2;
      K.box([0.34 * s, 0.035 * s, 0.03 * s], [Math.cos(a) * 0.17 * s, Math.sin(a) * 0.17 * s, 0.03 * s], M.blackMetal, { bevel: 0.006, rot: [0, 0, a] });
      K.cyl(0.018 * s, 0.018 * s, 0.03 * s, [Math.cos(a) * 0.33 * s, Math.sin(a) * 0.33 * s, 0], M.blackMetal, { seg: 12 });
    }
    K.cyl(0.035 * s, 0.03 * s, 0.22 * s, [0, 0, 0.05 * s], M.steel, { seg: 20 });
    // seat shell and cushion, tilted back
    K.group([0, 0.02 * s, 0.3 * s], [-0.12, 0, 0], () => {
      K.box([0.68 * s, 0.6 * s, 0.03 * s], [0, 0, 0], M.walnut, { bevel: 0.012 });
      K.cushion([0.62 * s, 0.56 * s, 0.11 * s], [0, -0.01 * s, 0.03 * s], M.leatherBlack, { puff: 0.03, round: 0.04, wrinkle: 0.004 });
    });
    // back shell and cushion, reclined
    K.group([0, 0.3 * s, 0.38 * s], [-0.32, 0, 0], () => {
      K.box([0.66 * s, 0.03 * s, 0.5 * s], [0, 0.03 * s, 0], M.walnut, { bevel: 0.012 });
      K.cushion([0.6 * s, 0.1 * s, 0.46 * s], [0, -0.03 * s, 0.02 * s], M.leatherBlack, { puff: 0.03, round: 0.04, wrinkle: 0.004 });
    });
    // armrests
    for (const sx of [-1, 1]) {
      K.box([0.07 * s, 0.5 * s, 0.03 * s], [sx * 0.37 * s, 0.05 * s, 0.52 * s], M.walnut, { bevel: 0.01, rot: [-0.18, 0, 0] });
      K.cushion([0.08 * s, 0.44 * s, 0.035 * s], [sx * 0.37 * s, 0.05 * s, 0.55 * s], M.leatherBlack, { puff: 0.01, round: 0.015, rot: [-0.18, 0, 0], wrinkle: 0 });
      K.box([0.02 * s, 0.02 * s, 0.16 * s], [sx * 0.33 * s, 0.1 * s, 0.38 * s], M.blackMetal, {});
    }
  });
}

// modern armchair with oak frame and a linen seat and back pillow
export function armChair(K, M, x, y, z, rz, h = 0.82) {
  const s = h / 0.82;
  K.group([x, y, z], [0, 0, rz], () => {
    for (const [lx, ly] of [[-0.28, -0.26], [0.28, -0.26], [-0.28, 0.26], [0.28, 0.26]]) {
      K.box([0.04 * s, 0.04 * s, 0.4 * s], [lx * s, ly * s, 0], M.oak, { bevel: 0.006, rot: [ly > 0 ? 0.06 : 0, 0, 0] });
    }
    K.box([0.62 * s, 0.6 * s, 0.05 * s], [0, 0, 0.36 * s], M.oak, { bevel: 0.008 });
    K.cushion([0.56 * s, 0.54 * s, 0.1 * s], [0, -0.01 * s, 0.41 * s], M.linenOat, { puff: 0.035, round: 0.04 });
    for (const sx of [-1, 1]) K.box([0.05 * s, 0.56 * s, 0.035 * s], [sx * 0.3 * s, 0, 0.62 * s], M.oak, { bevel: 0.008 });
    for (const sx of [-1, 1]) K.box([0.035 * s, 0.035 * s, 0.22 * s], [sx * 0.3 * s, -0.2 * s, 0.41 * s], M.oak, { bevel: 0.006 });
    K.group([0, 0.28 * s, 0.42 * s], [-0.2, 0, 0], () => {
      K.box([0.6 * s, 0.035 * s, 0.4 * s], [0, 0.02 * s, 0], M.oak, { bevel: 0.008 });
      K.cushion([0.54 * s, 0.12 * s, 0.36 * s], [0, -0.06 * s, 0.03 * s], M.linenOat, { puff: 0.04, round: 0.045 });
    });
  });
}

// upholstered dining chair: dark leather seat and curved back on walnut legs
export function diningChair(K, M, x, y, z, rz, h = 0.9) {
  const s = h / 0.9;
  K.group([x, y, z], [0, 0, rz], () => {
    for (const [lx, ly] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      K.box([0.035 * s, 0.035 * s, 0.46 * s], [lx * s, ly * s, 0], M.walnut, { bevel: 0.005, rot: [ly > 0 ? 0.07 : -0.03, 0, 0] });
    }
    K.cushion([0.46 * s, 0.46 * s, 0.09 * s], [0, 0, 0.44 * s], M.chesterLeather, { puff: 0.025, round: 0.035, wrinkle: 0.003 });
    K.group([0, 0.22 * s, 0.5 * s], [-0.12, 0, 0], () => {
      K.cushion([0.44 * s, 0.07 * s, 0.42 * s], [0, 0, 0], M.chesterLeather, { puff: 0.02, round: 0.03, wrinkle: 0.003 });
    });
  });
}

// round walnut side table on three legs
export function sideTable(K, M, x, y, z, h = 0.5) {
  K.cyl(0.24, 0.24, 0.03, [x, y, z + h - 0.03], M.walnut, { seg: 48, bevel: 0.006 });
  K.cyl(0.2, 0.2, 0.02, [x, y, z + h * 0.35], M.walnut, { seg: 40, bevel: 0.004 });
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI * 2 + 0.3;
    K.rod([x + Math.cos(a) * 0.19, y + Math.sin(a) * 0.19, z], [x + Math.cos(a) * 0.16, y + Math.sin(a) * 0.16, z + h - 0.03], 0.014, M.walnut, 10);
  }
}

export function vase(K, M, x, y, z, h = 0.3, kind = 0) {
  const s = h;
  const prof = kind === 0
    ? [[0, 0], [0.12, 0], [0.16, 0.08], [0.17, 0.3], [0.13, 0.62], [0.06, 0.85], [0.065, 1.0], [0.055, 1.0], [0.05, 0.86], [0, 0.82]]
    : [[0, 0], [0.18, 0], [0.24, 0.12], [0.26, 0.38], [0.2, 0.64], [0.14, 0.78], [0.15, 1.0], [0.13, 1.0], [0.12, 0.8], [0, 0.76]];
  K.lathe(prof.map(([r, zz]) => [r * s, zz * s]), [x, y, z], kind === 0 ? M.ceramic : M.stoneware, { seg: 40 });
}

export function candleholders(K, M, x, y, z, h = 0.28) {
  [[0, 0, 1.0], [0.09, 0.05, 0.75], [-0.08, 0.06, 0.6]].forEach(([dx, dy, f]) => {
    const H = h * f;
    K.lathe([[0, 0], [0.05, 0], [0.05, 0.01], [0.015, 0.03], [0.012, H * 0.6], [0.022, H * 0.62], [0.012, H * 0.66], [0.012, H * 0.62 + 0.05], [0.028, H * 0.62 + 0.06], [0.028, H * 0.62 + 0.07], [0, H * 0.62 + 0.07]],
      [x + dx, y + dy, z], M.brass, { seg: 24 });
    K.cyl(0.011, 0.011, H * 0.38, [x + dx, y + dy, z + H * 0.62 + 0.07], M.candle, { seg: 12 });
    K.flames.push({ pos: [x + dx, y + dy, z + H + 0.07], small: true });
  });
}

export function kettle(K, M, x, y, z, h = 0.24, rz = 0) {
  const s = h / 0.24;
  K.group([x, y, z], [0, 0, rz], () => {
    K.lathe([[0, 0], [0.08, 0], [0.095, 0.03], [0.098, 0.12], [0.08, 0.19], [0.05, 0.205], [0, 0.205]].map(([r, zz]) => [r * s, zz * s]), [0, 0, 0], M.creamEnamel, { seg: 40 });
    K.lathe([[0, 0], [0.02, 0], [0.018, 0.02], [0, 0.03]].map(([r, zz]) => [r * s, zz * s]), [0, 0, 0.205 * s], M.blackMetal, { seg: 16 });
    // handle arc and spout
    const pts = []; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; pts.push([-0.09 * s - Math.sin(a) * 0.06 * s, 0, 0.06 * s + (1 - Math.cos(a)) * 0.08 * s]); }
    for (let k = 0; k < 8; k++) K.rod(pts[k], pts[k + 1], 0.012 * s, M.blackMetal, 8);
    K.rod([0.08 * s, 0, 0.06 * s], [0.15 * s, 0, 0.16 * s], 0.014 * s, M.creamEnamel, 10);
  });
}

export function jug(K, M, x, y, z, h = 0.2) {
  const s = h / 0.2;
  K.lathe([[0, 0], [0.06, 0], [0.075, 0.05], [0.07, 0.13], [0.055, 0.17], [0.06, 0.2], [0.054, 0.2], [0.05, 0.17], [0.064, 0.13], [0, 0.02]].map(([r, zz]) => [r * s, zz * s]), [x, y, z], M.ceramic, { seg: 36 });
  const pts = []; for (let k = 0; k <= 6; k++) { const a = Math.PI * k / 6; pts.push([x + 0.07 * s + Math.sin(a) * 0.04 * s, y, z + 0.06 * s + (1 - Math.cos(a)) * 0.05 * s]); }
  for (let k = 0; k < 6; k++) K.rod(pts[k], pts[k + 1], 0.008 * s, M.ceramic, 8);
}

export function pot(K, M, x, y, z, h = 0.15) {
  const s = h / 0.15;
  K.cyl(0.11 * s, 0.11 * s, 0.12 * s, [x, y, z], M.potRed, { seg: 40, bevel: 0.008 });
  K.lathe([[0, 0], [0.115 * s, 0], [0.11 * s, 0.015 * s], [0.04 * s, 0.03 * s], [0, 0.032 * s]], [x, y, z + 0.12 * s], M.potRed, { seg: 40 });
  K.cyl(0.018 * s, 0.022 * s, 0.025 * s, [x, y, z + 0.145 * s], M.blackMetal, { seg: 16 });
  for (const sx of [-1, 1]) K.box([0.04 * s, 0.05 * s, 0.015 * s], [x + sx * 0.125 * s, y, z + 0.09 * s], M.blackMetal, { bevel: 0.004 });
}

export function alarmClock(K, M, x, y, z, h = 0.1, rz = 0) {
  const s = h / 0.1;
  K.group([x, y, z], [0, 0, rz], () => {
    K.cyl(0.042 * s, 0.042 * s, 0.035 * s, [0, 0.0175 * s, 0.045 * s], M.brass, { seg: 32, bevel: 0.004, rot: [Math.PI / 2, 0, 0] });
    K.cyl(0.036 * s, 0.036 * s, 0.002, [0, -0.018 * s, 0.045 * s], M.cupWhite, { seg: 32, rot: [Math.PI / 2, 0, 0] });
    for (const sx of [-1, 1]) { K.lathe([[0, 0], [0.018 * s, 0], [0.02 * s, 0.01 * s], [0, 0.022 * s]], [sx * 0.025 * s, 0, 0.082 * s], M.brass, { seg: 16, rot: [0, sx * 0.4, 0] }); K.rod([sx * 0.02 * s, 0, 0.012 * s], [sx * 0.03 * s, 0, 0], 0.004 * s, M.brass, 6); }
  });
}

export function mantelClock(K, M, x, y, z, h = 0.22, rz = 0) {
  const s = h / 0.22;
  K.group([x, y, z], [0, 0, rz], () => {
    K.box([0.26 * s, 0.1 * s, 0.02 * s], [0, 0, 0], M.walnut, { bevel: 0.004 });
    K.box([0.22 * s, 0.09 * s, 0.13 * s], [0, 0, 0.02 * s], M.walnut, { bevel: 0.006 });
    K.cyl(0.11 * s, 0.11 * s, 0.09 * s, [0, 0.045 * s, 0.15 * s], M.walnut, { seg: 40, rot: [Math.PI / 2, 0, 0] });
    K.cyl(0.065 * s, 0.065 * s, 0.004, [0, -0.046 * s, 0.12 * s], M.cupWhite, { seg: 32, rot: [Math.PI / 2, 0, 0] });
    K.cyl(0.07 * s, 0.07 * s, 0.006, [0, -0.044 * s, 0.12 * s], M.brass, { seg: 32, rot: [Math.PI / 2, 0, 0] });
  });
}
