// Outside: lawn, grass blades, clipped hedges, procedural trees, the alpine ring of mountains, sky and the pool.
import * as T from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Z2Y, B, mulberry, vnoise3, mat4 } from './kit.js';
import { DRIVE_Y0, WALL_Y, PX0, PX1, PY0, PY1, PC } from './house.js';
import { leafTexture } from './tex.js';

export const wind = { uTime: { value: 0 } };
export const PLOT = [-12.0, WALL_Y + 0.3, 26.0, 29.0];

// ------------------------------------------------------------------ lawn and hedges (into the kit)
export function buildLawnAndHedges(K, M, { step = 0.1 } = {}) {
  K.zone('GROUND');
  const cut = [PX0 - PC, PX1 + PC, PY0 - PC, PY1 + PC];
  const [x0, x1, y0, y1, z] = [-330, 345, -320, 335, -0.02];
  const quads = [[x0, x1, y0, cut[2]], [x0, x1, cut[3], y1], [x0, cut[0], cut[2], cut[3]], [cut[1], x1, cut[2], cut[3]]];
  const pos = [], idx = [];
  for (const [a, b, c, d] of quads) {
    const k = pos.length / 3;
    pos.push(a, c, z, b, c, z, b, d, z, a, d, z); idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  K.mesh(g, M.lawn, new T.Matrix4(), { uvMode: 'world' });
  const [HX_, HY_, HX2, HY2] = PLOT;
  const hedge = (a, b, c, d, h) => K.mesh(hedgeGeo(b - a, d - c, h, step), M.hedge, mat4([(a + b) / 2, (c + d) / 2, -0.01]), { uvMode: 'local' });
  for (const [a, b] of [[HX_, -0.75], [4.95, 7.25], [10.15, HX2]]) hedge(a, b, HY_, HY_ + 0.7, 1.1);
  hedge(HX_, HX2, HY2 - 0.7, HY2, 1.8);
  hedge(HX_, HX_ + 0.7, HY_, HY2, 1.6);
  hedge(HX2 - 0.7, HX2, HY_, HY2, 1.6);
  K.zone('EXT');
  for (const [a, c, b, d, zz, h] of K.marks.planterHedges || []) K.mesh(hedgeGeo(b - a, d - c, h, Math.min(step, 0.06), 0.08), M.hedge, mat4([(a + b) / 2, (c + d) / 2, zz]), { uvMode: 'local' });
}

// clipped hedge: a rounded box surface on a grid, pushed in and out by two octaves of noise
export function hedgeGeo(sx, sy, sz, step = 0.1, R = 0.14) {
  R = Math.min(R, sx / 2 - 0.01, sy / 2 - 0.01, sz / 2 - 0.01);
  const hx = sx / 2, hy = sy / 2, hz = sz / 2, ix = hx - R, iy = hy - R, iz = hz - R;
  const pos = [], idx = [];
  const face = (axis, sign) => {
    if (axis === 2 && sign < 0) return;   // no bottom
    const ax = [[1, 2], [0, 2], [0, 1]][axis], h = [hx, hy, hz];
    const nu = Math.max(3, Math.ceil(2 * h[ax[0]] / step)), nv = Math.max(3, Math.ceil(2 * h[ax[1]] / step));
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const q = [0, 0, 0]; q[axis] = sign * h[axis];
      const su = i / nu * 2 - 1, sv = j / nv * 2 - 1;
      q[ax[0]] = Math.sign(su) * Math.pow(Math.abs(su), 0.85) * h[ax[0]]; q[ax[1]] = Math.sign(sv) * Math.pow(Math.abs(sv), 0.85) * h[ax[1]];
      pos.push(q[0], q[1], q[2]);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      const flip = axis === 1 ? sign < 0 : sign > 0;
      if (flip) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
    }
  };
  for (let a = 0; a < 3; a++) { face(a, 1); face(a, -1); }
  const out = [];
  for (let k = 0; k < pos.length; k += 3) {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2];
    const cx = Math.max(-ix, Math.min(ix, x)), cy = Math.max(-iy, Math.min(iy, y)), cz = Math.max(-iz, Math.min(iz, z));
    let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    let px = cx + dx * R, py = cy + dy * R, pz = cz + dz * R;
    const wx = px * 2.2, wy = py * 2.2, wz = pz * 2.2;
    const n = (vnoise3(wx, wy, wz) - 0.5) * 0.07 + (vnoise3(wx * 3.7 + 9, wy * 3.7, wz * 3.7) - 0.5) * 0.035;
    const bottom = Math.min(1, (pz + hz) / 0.25);          // stay on the ground at the foot
    px += dx * n * bottom; py += dy * n * bottom; pz += dz * n * bottom;
    out.push(px, py, pz + hz);
  }
  let g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(out, 3)); g.setIndex(idx);
  g = mergeVertices(g, 1e-5); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ trees
function frameAround(d) {
  const a = Math.abs(d.z) < 0.9 ? new T.Vector3(0, 0, 1) : new T.Vector3(1, 0, 0);
  const u = new T.Vector3().crossVectors(d, a).normalize(), v = new T.Vector3().crossVectors(d, u).normalize();
  return [u, v];
}
// a broad, gnarled crown in the manner of the scanned island trees (Blender coordinates, z up, base at origin)
export function treeTemplate(seed, { depth = 4, trunk = 2.3, lean = 0.25, spread = 0.8, cards = 3 } = {}) {
  const rnd = mulberry(seed);
  const branches = [], clusters = [];
  function grow(p0, dir, len, r0, level) {
    const n = level === 0 ? 8 : level === 1 ? 6 : 4;
    const pts = [p0.clone()], rads = [r0];
    let p = p0.clone(); const d = dir.clone();
    for (let i = 1; i <= n; i++) {
      d.x += (rnd() - 0.5) * (level === 0 ? 0.3 : 0.55); d.y += (rnd() - 0.5) * (level === 0 ? 0.3 : 0.55); d.z += (rnd() - 0.5) * 0.3;
      d.z += level === 0 ? 0.04 : level >= 3 ? -0.06 : 0.05;
      d.normalize();
      p = p.clone().addScaledVector(d, len / n); pts.push(p); rads.push(r0 * (1 - 0.38 * i / n));
    }
    branches.push({ pts, rads, level });
    if (level >= depth) {
      for (let k = 0; k < 3; k++) {
        const t = Math.floor(n * (0.45 + 0.55 * rnd()));
        clusters.push(pts[Math.min(n, t)].clone().add(new T.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() * 0.5).multiplyScalar(0.7)));
      }
      return;
    }
    const kids = level === 0 ? 3 + (rnd() < 0.5 ? 1 : 0) : 2 + (rnd() < 0.45 ? 1 : 0);
    const [u, v] = frameAround(d);
    for (let k = 0; k < kids; k++) {
      const at = level === 0 ? n : n - Math.floor(rnd() * 2);
      const az = k / kids * Math.PI * 2 + rnd() * 1.1;
      const tilt = (level === 0 ? 0.8 * spread + 0.25 : 0.5) + rnd() * 0.35;
      const cd = d.clone().multiplyScalar(Math.cos(tilt)).add(u.clone().multiplyScalar(Math.cos(az) * Math.sin(tilt))).add(v.clone().multiplyScalar(Math.sin(az) * Math.sin(tilt))).normalize();
      grow(pts[at], cd, len * (0.66 + 0.16 * rnd()), rads[at] * 0.64, level + 1);
    }
    if (level >= 2 && level < depth) for (let k = 0; k < 2; k++) clusters.push(pts[Math.floor(n * (0.5 + rnd() * 0.5))].clone().add(new T.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() * 0.4).multiplyScalar(0.8)));
  }
  const d0 = new T.Vector3((rnd() - 0.5) * lean * 2, (rnd() - 0.5) * lean * 2, 1).normalize();
  grow(new T.Vector3(0, 0, 0), d0, trunk, 0.24, 0);
  // bark tubes
  const geos = [];
  for (const b of branches) {
    if (b.rads[0] < 0.012) continue;
    const radial = b.level === 0 ? 9 : b.level === 1 ? 7 : 5;
    const pos = [], nor = [], uv = [], idx = [];
    let along = 0;
    let [u, v] = frameAround(b.pts[1].clone().sub(b.pts[0]).normalize());
    for (let i = 0; i < b.pts.length; i++) {
      const t = (i < b.pts.length - 1 ? b.pts[i + 1].clone().sub(b.pts[i]) : b.pts[i].clone().sub(b.pts[i - 1])).normalize();
      // parallel transport of the frame
      u = u.clone().sub(t.clone().multiplyScalar(u.dot(t))).normalize(); v = new T.Vector3().crossVectors(t, u).normalize();
      if (i > 0) along += b.pts[i].distanceTo(b.pts[i - 1]);
      const r = b.rads[i] * (i === 0 && b.level === 0 ? 1.5 : 1);
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const nn = u.clone().multiplyScalar(c).add(v.clone().multiplyScalar(s));
        const p = b.pts[i].clone().addScaledVector(nn, r);
        pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); uv.push(a * 0.25, along * 0.5);
      }
    }
    const W = radial + 1;
    for (let i = 0; i < b.pts.length - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * W + j, bb = a + 1, c = a + W, d = c + 1; idx.push(a, bb, d, a, d, c);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    geos.push(g);
  }
  const bark = mergeGeometries(geos, false);
  bark.computeBoundingBox();
  // leaf cards around every cluster
  const center = new T.Vector3(); clusters.forEach((c) => center.add(c)); center.multiplyScalar(1 / Math.max(1, clusters.length));
  const leaves = [];
  for (const c of clusters) for (let k = 0; k < cards; k++) {
    const p = c.clone().add(new T.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.55));
    const q = new T.Quaternion().setFromEuler(new T.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
    const nOut = p.clone().sub(center).multiply(new T.Vector3(1, 1, 0.8)).normalize().add(new T.Vector3(0, 0, 0.35)).normalize();
    leaves.push({ p, q, s: 0.75 + rnd() * 0.5, n: nOut });
  }
  const box = new T.Box3().setFromPoints([...clusters, new T.Vector3()]);
  box.union(bark.boundingBox);
  return { bark, leaves, height: box.max.z, crownR: Math.max(box.max.x - box.min.x, box.max.y - box.min.y) / 2 };
}

// place templates: merged bark (static) and one instanced mesh of leaf cards per leaf texture
export function buildTrees(scene, M, templates, placements, { leafSize = 512, shadows = true } = {}) {
  const barkGeos = [];
  const leafTex = [leafTexture(leafSize, 3, 0), leafTexture(leafSize, 8, 1)];
  const inst = [[], []];
  const tmpM = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3();
  placements.forEach((pl, i) => {
    const tp = templates[pl.t % templates.length];
    const k = pl.h / tp.height;
    const place = new T.Matrix4().multiplyMatrices(Z2Y, mat4([pl.x, pl.y, 0], [0, 0, pl.r], [k, k, k]));
    const g = tp.bark.clone(); g.applyMatrix4(place); barkGeos.push(g);
    const rotOnly = new T.Quaternion(); place.decompose(new T.Vector3(), rotOnly, new T.Vector3());
    for (const lf of tp.leaves) {
      p.copy(lf.p).applyMatrix4(place);
      q.copy(rotOnly).multiply(lf.q);
      const sc = lf.s * Math.min(1.6, Math.max(0.8, k * 1.05));
      s.set(sc, sc, sc);
      tmpM.compose(p, q, s);
      // outward normal in world space, stored in the card's local frame
      const nW = lf.n.clone().applyQuaternion(rotOnly).normalize();
      const nL = nW.applyQuaternion(q.clone().invert());
      inst[(i + (lf.p.x > 0 ? 1 : 0)) % 2].push({ m: tmpM.clone(), n: nL });
    }
  });
  const bark = new T.Mesh(mergeGeometries(barkGeos, false), M.bark);
  bark.castShadow = shadows; bark.receiveShadow = true; bark.name = 'bark';
  scene.add(bark);
  const leafMeshes = [];
  inst.forEach((list, ti) => {
    const card = new T.PlaneGeometry(1, 1);
    const mesh = new T.InstancedMesh(card, makeLeafMaterial(leafTex[ti]), list.length);
    const nArr = new Float32Array(list.length * 3);
    list.forEach((e, k) => { mesh.setMatrixAt(k, e.m); nArr[k * 3] = e.n.x; nArr[k * 3 + 1] = e.n.y; nArr[k * 3 + 2] = e.n.z; });
    card.setAttribute('aLeafN', new T.InstancedBufferAttribute(nArr, 3));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadows; mesh.receiveShadow = true;
    mesh.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: leafTex[ti], alphaTest: 0.5 });
    mesh.userData.noAO = true; mesh.name = 'leaves' + ti;
    mesh.computeBoundingSphere();
    scene.add(mesh); leafMeshes.push(mesh);
  });
  return { bark, leafMeshes };
}

function makeLeafMaterial(map) {
  const m = new T.MeshStandardMaterial({ map, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.75, metalness: 0, color: new T.Color(0.95, 1.0, 0.9) });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime;
    sh.vertexShader = 'attribute vec3 aLeafN;\nuniform float uTime;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aLeafN;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float ph = ip.x * 0.31 + ip.z * 0.27;
        float gust = 0.55 + 0.45 * sin(uTime * 0.37 + ip.x * 0.04);
        float sway = clamp(ip.y * 0.1, 0.0, 1.0);
        transformed.x += sin(uTime * 1.7 + ph + position.y * 2.0) * 0.06 * gust;
        transformed.z += cos(uTime * 1.3 + ph * 1.3) * 0.05 * gust;
        transformed.y += sin(uTime * 2.3 + ph * 2.1 + position.x * 3.0) * 0.04 * gust * sway;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', T.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      // light through the leaves: a little of the sun shines through the crown
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.05, 0.07, 0.02);');
  };
  m.customProgramCacheKey = () => 'leaf';
  return m;
}

// ------------------------------------------------------------------ grass blades
export function buildGrass(scene, count, holes, rect) {
  if (!count) return null;
  // one blade: a tapered, slightly curved strip, 3 segments
  const segs = 2, pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, w = 0.011 * (1 - t * 0.92);
    pos.push(-w, t, 0, w, t, 0); uv.push(0, t, 1, t);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const blade = new T.InstancedBufferGeometry();
  blade.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  blade.setAttribute('normal', new T.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  blade.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  blade.setIndex(idx);
  const off = new Float32Array(count * 4), col = new Float32Array(count);
  const rnd = mulberry(91);
  const inHole = (x, y) => holes.some(([a, b, c, d]) => x >= a && x <= b && y >= c && y <= d);
  let n = 0, tries = 0;
  const [rx0, ry0, rx1, ry1] = rect;
  while (n < count && tries < count * 3) {
    tries++;
    const x = rx0 + rnd() * (rx1 - rx0), y = ry0 + rnd() * (ry1 - ry0);
    if (inHole(x, y)) continue;
    off[n * 4] = x; off[n * 4 + 1] = -y; off[n * 4 + 2] = rnd() * 6.283; off[n * 4 + 3] = 0.06 + rnd() * 0.07;
    col[n] = rnd(); n++;
  }
  blade.setAttribute('aOff', new T.InstancedBufferAttribute(off.subarray(0, n * 4), 4));
  blade.setAttribute('aCol', new T.InstancedBufferAttribute(col.subarray(0, n), 1));
  blade.instanceCount = n;
  const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: T.DoubleSide, envMapIntensity: 0.6 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime;
    sh.vertexShader = 'attribute vec4 aOff;\nattribute float aCol;\nuniform float uTime;\nvarying float vCol;\nvarying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = position;
      float h = aOff.w; vH = position.y; vCol = aCol;
      float c = cos(aOff.z), s = sin(aOff.z);
      transformed.y *= h;
      float bend = position.y * position.y;
      float gust = 0.5 + 0.5 * sin(uTime * 0.6 + aOff.x * 0.09 + aOff.y * 0.05);
      transformed.z += bend * (0.035 + 0.025 * sin(aOff.z * 3.0)) ;
      transformed = vec3(transformed.x * c - transformed.z * s, transformed.y, transformed.x * s + transformed.z * c);
      transformed.x += bend * sin(uTime * 1.9 + aOff.x * 0.7 + aOff.y * 0.4) * 0.025 * gust;
      transformed.z += bend * cos(uTime * 1.4 + aOff.y * 0.6) * 0.018 * gust;
      // fade out with distance to keep the far lawn cheap
      vec4 wp0 = modelMatrix * vec4(aOff.x, 0.0, aOff.y, 1.0);
      float dist = length(cameraPosition - wp0.xyz);
      transformed *= 1.0 - smoothstep(26.0, 34.0, dist);
      transformed += vec3(aOff.x, -0.015, aOff.y);`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    sh.fragmentShader = 'varying float vCol;\nvarying float vH;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 dark = vec3(0.028, 0.06, 0.011), lite = vec3(0.12, 0.2, 0.038), dry = vec3(0.2, 0.19, 0.07);
        vec3 gc = mix(dark, lite, vCol); gc = mix(gc, dry, step(0.93, vCol) * 0.6);
        diffuseColor.rgb = gc * (0.55 + 0.6 * vH);`)
      .replace('#include <normal_fragment_begin>', T.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => 'grass';
  const mesh = new T.Mesh(blade, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false;
  mesh.userData.noAO = true; mesh.name = 'grass';
  scene.add(mesh);
  return mesh;
}

// ------------------------------------------------------------------ mountains: a ring of alpine ridges, hazed
export function buildMountains(scene, haze, { segs = 720, rings = 100 } = {}) {
  const pos = [], col = [], idx = [];
  const R0 = 300, R1 = 15000;
  // domain-warped ridged multifractal: sharp alpine crests, softer valleys
  const hAt = (x, y) => {
    const wx = x + 1400 * (vnoise3(x / 5000, y / 5000, 1.1) - 0.5), wy = y + 1400 * (vnoise3(x / 5000, y / 5000, 7.7) - 0.5);
    let sum = 0, amp = 1, f = 1 / 3000, prev = 1, norm = 0;
    for (let k = 0; k < 7; k++) {
      let n = 1 - Math.abs(vnoise3(wx * f + k * 13.1, wy * f - k * 7.3, 3.3 + k) * 2 - 1); n *= n;
      sum += n * amp * (0.35 + 0.65 * prev); norm += amp; prev = n; amp *= 0.5; f *= 2.03;
    }
    return sum / norm;
  };
  const H = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, r = R0 * Math.pow(R1 / R0, t);
    for (let j = 0; j <= segs; j++) {
      const a = j / segs * Math.PI * 2, x = 8 + Math.cos(a) * r, y = 6 + Math.sin(a) * r;
      const ramp = Math.min(1, Math.max(0, (r - 1100) / 4500)) ** 1.1;
      const near = Math.min(1, Math.max(0, (r - R0) / 600));
      const valley = 0.55 + 0.45 * Math.abs(Math.sin(a * 1.5 + 0.6));
      const h = (hAt(x, y) * 3600 * valley * ramp + 40 * vnoise3(x / 160, y / 160, 1.7) * near) - 2;
      pos.push(x, y, h); H.push(h);
    }
  }
  const W = segs + 1;
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, d, b, a, c, d); }
  let g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let k = 0; k < H.length; k++) {
    const h = H[k], slope = 1 - nrm.getZ(k), x = pos[k * 3], y = pos[k * 3 + 1];
    const v = vnoise3(x / 60, y / 60, 5.1), v2 = vnoise3(x / 15, y / 15, 2.2);
    let c = [0.026, 0.042, 0.02];                                                   // conifer forest
    if (h < 80 && slope < 0.12) c = [0.07, 0.1, 0.03];                              // valley meadows
    const tree = 1500 + v * 350;
    const rockK = Math.min(1, Math.max(0, (h - tree) / 250) + Math.max(0, slope - 0.55) * 2.0);
    c = c.map((cc, i) => cc * (1 - rockK) + [0.16, 0.145, 0.125][i] * rockK);
    if (h > tree && slope < 0.35) c = c.map((cc, i) => cc * 0.5 + [0.08, 0.09, 0.04][i] * 0.5 * (1 - Math.max(0, (h - tree - 500) / 300)));
    const snowK = Math.min(1, Math.max(0, (h - (2150 + v * 350)) / 160)) * (slope < 0.55 ? 1 : 0.3);
    c = c.map((cc) => cc * (1 - snowK) + 0.78 * snowK);
    const m = 0.8 + 0.4 * v2; col.push(c[0] * m, c[1] * m, c[2] * m);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.applyMatrix4(Z2Y);
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHaze = haze.color; sh.uniforms.uHazeK = haze.k;
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uHaze;\nuniform float uHazeK;\nvarying vec3 vWp;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float dd = length(vWp.xz - cameraPosition.xz);
      float hz = 1.0 - exp(-dd * uHazeK);
      hz *= 1.0 - 0.3 * smoothstep(200.0, 1400.0, vWp.y);
      outgoingLight = mix(outgoingLight, uHaze, clamp(hz, 0.0, 0.92));
      #include <opaque_fragment>`);
  };
  const mesh = new T.Mesh(g, mat);
  mesh.name = 'mountains'; mesh.userData.noAO = true;
  scene.add(mesh);
  return mesh;
}

// ------------------------------------------------------------------ sky (Preetham) with a soft cloud layer
export function makeSky(sunDir, { scale = 1 } = {}) {
  const sky = new Sky();
  sky.scale.setScalar(9000);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.6; u.rayleigh.value = 1.05; u.mieCoefficient.value = 0.0035; u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(sunDir);
  sky.material.uniforms.uScale = { value: scale };
  sky.material.uniforms.uTime = wind.uTime;
  sky.material.uniforms.uNoDisk = { value: 0 };
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('uniform vec3 up;', `uniform vec3 up;\nuniform float uScale;\nuniform float uTime;\nuniform float uNoDisk;
      float ch(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1.0, 0.0)), f.x), mix(ch(i + vec2(0.0, 1.0)), ch(i + vec2(1.0, 1.0)), f.x), f.y); }
      float cf(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 6; k++) { s += a * cn(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }`)
    .replace('L0 += ( vSunE * 19000.0 * Fex ) * sundisk;', 'L0 += ( vSunE * 19000.0 * Fex ) * sundisk * (1.0 - uNoDisk);')
    .replace('gl_FragColor = vec4( retColor, 1.0 );', `
      vec3 dir = normalize( vWorldPosition - cameraPosition );
      float el = dir.y;
      if (el > 0.015) {
        vec2 cp = dir.xz / (el + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
        float c = cf(cp);
        float cov = smoothstep(0.52, 0.78, c) * smoothstep(0.015, 0.12, el) * (1.0 - smoothstep(0.55, 0.95, el) * 0.6);
        float lit = 0.75 + 0.35 * max(0.0, dot(dir, vSunDirection));
        vec3 cloud = vec3(1.0, 0.98, 0.95) * lit * (0.55 + 0.6 * smoothstep(0.55, 0.85, c));
        retColor = mix(retColor, cloud * max(0.35, length(retColor) * 0.9), cov * 0.85);
      }
      gl_FragColor = vec4( retColor * uScale, 1.0 );`);
  return sky;
}

// ------------------------------------------------------------------ pool water
export function buildWater(scene, normalMap) {
  const g = new T.PlaneGeometry(PX1 - PX0, PY1 - PY0, 1, 1);
  const uvA = g.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * (PX1 - PX0) / 4, uvA.getY(i) * (PY1 - PY0) / 4);
  g.rotateX(-Math.PI / 2);
  const mat = new T.MeshPhysicalMaterial({
    color: new T.Color(0.015, 0.12, 0.15), roughness: 0.1, metalness: 0, transparent: true, opacity: 0.78,
    normalMap, normalScale: new T.Vector2(0.22, 0.22), clearcoat: 0, ior: 1.33, specularIntensity: 0.8, depthWrite: false,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime;
    sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      vec3 nA = texture2D(normalMap, vNormalMapUv + vec2(uTime * 0.012, uTime * 0.007)).xyz * 2.0 - 1.0;
      vec3 nB = texture2D(normalMap, vNormalMapUv * 1.7 + vec2(-uTime * 0.009, uTime * 0.013)).xyz * 2.0 - 1.0;
      vec3 mapN = normalize(vec3((nA.xy + nB.xy) * normalScale, 1.0));
      normal = normalize( tbn * mapN );`);
  };
  mat.userData = { cast: false, noAO: true, water: true };
  const m = new T.Mesh(g, mat);
  m.position.copy(B((PX0 + PX1) / 2, (PY0 + PY1) / 2, -0.09));
  m.renderOrder = 1; m.userData.noAO = true; m.name = 'water';
  scene.add(m);
  return m;
}

// caustics dancing on the pool shell (added to the tile materials)
export function addCaustics(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTime = wind.uTime;
    sh.vertexShader = 'varying vec3 vWpC;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWpC = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWpC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec2 p = vWpC.xz * 1.6; float t = uTime * 0.6; float c = 0.0; vec2 i = p;
        for (int n = 0; n < 4; n++) { float tt = t * (1.0 - 3.5 / float(n + 1)); i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x)); c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.006), p.y / (cos(i.y + tt) / 0.006))); }
        c /= 4.0; c = 1.17 - pow(max(c, 0.0), 1.4); c = min(pow(abs(c), 8.0), 2.0);
        float depthK = smoothstep(0.05, -0.3, vWpC.y);
        totalEmissiveRadiance += diffuseColor.rgb * c * 0.35 * depthK;
      }`);
  };
  mat.customProgramCacheKey = () => 'caustic' + mat.name;
}

// ------------------------------------------------------------------ swallows
export function buildBirds(scene) {
  const birds = [];
  const wingGeo = new T.BufferGeometry();
  wingGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, -0.06, 0, 0, 0.1, 0.38, 0.02, 0.02], 3));
  const mat = new T.MeshBasicMaterial({ color: 0x23262b, side: T.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const b = new T.Group(), l = new T.Mesh(wingGeo, mat), r = new T.Mesh(wingGeo, mat);
    r.scale.x = -1; b.add(l, r); b.scale.setScalar(1.3);
    b.userData = { l, r, rad: 14 + i * 4.5, h: 17 + i * 2.5, sp: 0.16 + i * 0.03, ph: i * 1.3, cx: 13 + i, cz: -(10 + i * 2) };
    l.userData.noAO = r.userData.noAO = true;
    birds.push(b); scene.add(b);
  }
  return (t) => {
    for (const b of birds) {
      const u = b.userData, a = t * u.sp + u.ph, rad = u.rad * (1 + 0.25 * Math.sin(t * 0.07 + u.ph));
      b.position.set(u.cx + Math.cos(a) * rad, u.h + Math.sin(t * 0.5 + u.ph) * 1.5, u.cz + Math.sin(a) * rad * 0.7);
      b.rotation.y = -a + Math.PI;
      const flap = Math.sin(t * 0.6 + u.ph) > 0.4 ? 0.12 : Math.sin(t * 13 + u.ph * 5) * 0.75;
      u.l.rotation.z = flap; u.r.rotation.z = -flap;
    }
  };
}

// lawn holes for the grass blades (Blender plan rectangles)
export const GRASS_HOLES = [[-0.9, 14.9, -1.4, 14.3], [-0.5, 4.7, -40, 0], [3.4, 14.4, -2.6, -0.9], [7.9, 14.6, 13.0, 17.8], [9.0, 11.3, 17.0, 17.8],
  [-40, 40, -40, DRIVE_Y0 + 0.4], [7.1, 10.3, -40, -1.0], [PX0 - PC - 0.1, PX1 + PC + 0.1, PY0 - PC - 2.3, PY1 + PC + 0.1],
  [-0.6, 4.7, -0.2, 6.5], [-12.5, 26.5, WALL_Y - 0.5, WALL_Y + 1.05], [-12.5, -11.2, -20, 30], [25.2, 26.5, -20, 30], [-12.5, 26.5, 28.2, 30],
  [8.1, 9.0, 16.3, 17.2], [13.7, 14.6, 16.4, 17.3], [12.4, 13.15, 17.6, 18.4], [22.85, 23.6, 17.6, 18.4], [6.9, 7.5, -1.9, -1.2], [9.9, 10.5, -1.9, -1.2]];
