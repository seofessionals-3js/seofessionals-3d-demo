// Linden house, built entirely in three.js: geometry, materials, trees, mountains and light are generated at load.
import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TexGen } from './tex.js';
import { Kit, B } from './kit.js';
import { makeMaterials } from './mats.js';
import { buildHouse, ROOMS, DOOR_HINGE, FL } from './house.js';
import { buildLawnAndHedges, treeTemplate, buildTrees, buildGrass, buildMountains, makeSky, buildWater, addCaustics, buildBirds, wind, GRASS_HOLES, PLOT } from './garden.js';

const PI = Math.PI;
let LANG = 'de';
try { LANG = localStorage.getItem('seo3d-lang') || ((navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en'); } catch (e) { /* private mode */ }
document.documentElement.lang = LANG;
const L = (de, en) => (LANG === 'en' ? en : de);
const langListeners = [];
document.getElementById('lang').addEventListener('click', () => {
  LANG = LANG === 'en' ? 'de' : 'en';
  document.documentElement.lang = LANG;
  try { localStorage.setItem('seo3d-lang', LANG); } catch (e) { /* ignore */ }
  langListeners.forEach((f) => f());
});
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const loaderEl = $('#loader');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const note = (t) => { $('#load-note').textContent = t; };
const fail = (t) => { note(t); loaderEl.classList.add('failed'); };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const smoothstep = (a, b, v) => smooth(clamp((v - a) / (b - a)));

/* ================= Tone mapping: AgX with the "Medium High Contrast" look of the Cycles renders ================= */
if (T.ShaderChunk.tonemapping_pars_fragment.includes('vec3 AgXToneMapping( vec3 color ) {')) {
  T.ShaderChunk.tonemapping_pars_fragment = T.ShaderChunk.tonemapping_pars_fragment.replace(
    'vec3 AgXToneMapping( vec3 color ) {', 'vec3 AgXToneMappingBase( vec3 color ) {') + `
  vec3 AgXToneMapping( vec3 color ) {
    vec3 c = AgXToneMappingBase( color );
    vec3 d = pow( max( c, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
    d = ( d - 0.5 ) * 1.14 + 0.5;
    float l = dot( d, vec3( 0.2126, 0.7152, 0.0722 ) );
    d = mix( vec3( l ), d, 1.22 );
    return pow( clamp( d, 0.0, 1.0 ), vec3( 2.2 ) );
  }`;
}

T.ShaderChunk.opaque_fragment = 'outgoingLight = min( outgoingLight, vec3( 24.0 ) );\n' + T.ShaderChunk.opaque_fragment;
/* ================= Quality tier ================= */
function recommendTier() {
  const mem = navigator.deviceMemory || 0, coarse = matchMedia('(pointer: coarse)').matches;
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    const lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
  } catch (e) { /* no hint */ }
  const weakGpu = /Mali-[GT]\d|PowerVR|Adreno \(TM\) [1-5]\d\d|Adreno \(TM\) 6[0-3]\d|Intel\(R\) HD Graphics [2-5]/i.test(gpu);
  const phone = coarse && Math.min(screen.width, screen.height) < 600;
  if ((mem && mem <= 4) || weakGpu || phone) return 'sd';
  if (coarse || (mem && mem < 8) || Math.max(screen.width, screen.height) * (devicePixelRatio || 1) < 2200) return 'hd';
  return 'max';
}
function chooseTier() {
  const q = new URLSearchParams(location.search).get('q');
  if (['sd', 'hd', 'max'].includes(q)) return Promise.resolve(q);
  const rec = recommendTier();
  let saved = null;
  try { saved = localStorage.getItem('seo3d-three-tier'); } catch (e) { /* private mode */ }
  const pre = ['sd', 'hd', 'max'].includes(saved) ? saved : rec;
  return new Promise((resolve) => {
    const wait = saved ? 4 : 9;
    loaderEl.classList.add('picking');
    loaderEl.style.setProperty('--wait', wait + 's');
    const btns = $$('.tier');
    btns.forEach((b) => b.classList.toggle('rec', b.dataset.tier === pre));
    const tierNote = () => {
      $('#tiers-note').textContent = saved ? L('Ihre letzte Wahl startet gleich. Tippen Sie, um sie zu ändern.', 'Your last choice starts in a moment. Tap to change it.')
        : L('Tippen Sie auf eine Stufe. Die empfohlene startet von selbst.', 'Tap a level. The recommended one starts by itself.');
      btns.forEach((b) => { b.dataset.rec = L('Empfohlen', 'Recommended'); });
    };
    tierNote(); langListeners.push(tierNote);
    let done = false;
    const go = (t) => {
      if (done) return; done = true; clearTimeout(timer);
      try { localStorage.setItem('seo3d-three-tier', t); } catch (e) { /* ignore */ }
      loaderEl.classList.remove('picking');
      resolve(t);
    };
    const timer = setTimeout(() => go(pre), wait * 1000);
    btns.forEach((b) => b.addEventListener('click', () => go(b.dataset.tier)));
    loaderEl.addEventListener('pointerdown', (e) => { if (!e.target.closest('.tier')) { clearTimeout(timer); $$('.tier .count').forEach((c) => { c.style.animation = 'none'; }); } });
    (btns.find((b) => b.dataset.tier === pre) || btns[0]).focus({ preventScroll: true });
  });
}
const TIER = await chooseTier();
const SD = TIER === 'sd', MAX = TIER === 'max';
note(L('Das Haus wird gebaut · 0 %', 'Building the house · 0 %'));

let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas: $('#scene'), antialias: false, powerPreference: SD ? 'default' : 'high-performance', stencil: false });
} catch (e) { fail(L('Für den Rundgang wird WebGL benötigt. Es ist in diesem Browser ausgeschaltet oder nicht verfügbar.', 'The tour needs WebGL, which is switched off or not available in this browser.')); throw e; }
let dpr = Math.min(window.devicePixelRatio || 1, SD ? 1.25 : MAX ? 2.0 : 1.5);
$('#scene').addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  loaderEl.classList.remove('done'); loaderEl.removeAttribute('aria-hidden');
  fail(L('Der Grafikspeicher dieses Geräts ist voll. Bitte laden Sie die Seite in SD-Qualität.', 'This device ran out of video memory. Please reload the page in SD quality.'));
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cta'; b.textContent = L('In SD neu laden', 'Reload in SD');
  b.addEventListener('click', () => { try { localStorage.setItem('seo3d-three-tier', 'sd'); } catch (er) { /* ignore */ } location.search = '?q=sd'; });
  $('.loader-inner').appendChild(b);
}, false);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.AgXToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
RectAreaLightUniformsLib.init();

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(60, innerWidth / innerHeight, 0.08, 24000);
const pmrem = new T.PMREMGenerator(renderer);
const composer = new EffectComposer(renderer, new T.WebGLRenderTarget(innerWidth * dpr, innerHeight * dpr, { type: T.HalfFloatType, samples: SD ? 0 : 4 }));
composer.setPixelRatio(dpr);
composer.addPass(new RenderPass(scene, camera));
let gtao = null;
if (!SD) {
  gtao = new GTAOPass(scene, camera, innerWidth * dpr, innerHeight * dpr);
  gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: MAX ? 16 : 10, distanceFallOff: 1.0, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: MAX ? 16 : 8 });
  gtao.blendIntensity = 0.9;
  // leaves, glass, grass and water do not occlude in the G-buffer
  gtao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.userData.noAO || (o.material && o.material.transparent)) o.visible = false; });
  };
  composer.addPass(gtao);
}
const bloom = new UnrealBloomPass(new T.Vector2(innerWidth / 2, innerHeight / 2), 0.22, 0.6, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const precompile = () => { renderer.setRenderTarget(composer.readBuffer); renderer.compile(scene, camera); renderer.setRenderTarget(null); };
const renderFrame = () => {
  bloom.threshold = 1.6 / Math.max(0.2, renderer.toneMappingExposure);
  composer.render();
};
// yield to the browser so the progress bar paints (background tabs do not paint, so they do not wait)
const tick = () => new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 60); });
const steps = { n: 0, total: 12 };
const step = async (de, en) => {
  steps.n++;
  const f = Math.min(1, steps.n / steps.total);
  $('#load-bar').style.width = `${(f * 96).toFixed(1)}%`;
  note(L(`${de} · ${Math.round(f * 100)} %`, `${en} · ${Math.round(f * 100)} %`));
  await tick();
};

/* ================= Sun, sky and the light pool ================= */
const SUN_DIR = new T.Vector3(0.52, 0.62, 0.59).normalize();      // three coordinates: from the ground towards the sun
const sun = new T.DirectionalLight(new T.Color(1.0, 0.95, 0.88), 5.0);
sun.castShadow = true;
sun.shadow.mapSize.set(SD ? 2048 : 4096, SD ? 2048 : 4096);
sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2.5;
scene.add(sun, sun.target);
let shadowMode = '';
function setShadowMode(mode) {
  if (mode === shadowMode) return;
  shadowMode = mode;
  const c = mode === 'in' ? B(7.0, 6.8, 1.5) : B(7.0, 5.0, 1.0);
  const half = mode === 'in' ? 9.5 : 31;
  sun.target.position.copy(c); sun.target.updateMatrixWorld();
  sun.position.copy(c).addScaledVector(SUN_DIR, 120);
  const cam = sun.shadow.camera;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.near = 40; cam.far = 220;
  cam.updateProjectionMatrix();
  sun.shadow.needsUpdate = true;
}
setShadowMode('out');

// a fixed pool of lamp lights moves to the lamps nearest the camera (constant light count: no shader rebuilds)
const POOL = { spot: SD ? 3 : 6, point: SD ? 2 : 4, rect: SD ? 1 : 2 };
const pool = [];
function makePool() {
  for (let i = 0; i < POOL.spot; i++) { const l = new T.SpotLight(0xffffff, 0, 5, 0.9, 0.7, 2); l.castShadow = false; scene.add(l, l.target); pool.push({ type: 'spot', l, spec: null, next: null, f: 0 }); }
  for (let i = 0; i < POOL.point; i++) { const l = new T.PointLight(0xffffff, 0, 5, 2); scene.add(l); pool.push({ type: 'point', l, spec: null, next: null, f: 0 }); }
  for (let i = 0; i < POOL.rect; i++) { const l = new T.RectAreaLight(0xffffff, 0, 1, 1); scene.add(l); pool.push({ type: 'rect', l, spec: null, next: null, f: 0 }); }
}
const LAMP_K = { spot: 1 / (4 * PI) * 1.6, point: 1 / (4 * PI) * 1.4, rect: 1 / PI * 0.9 };
function applySpec(s, spec) {
  const l = s.l;
  l.color.setRGB(...spec.color);
  const p = B(...spec.pos);
  l.position.copy(p);
  if (s.type === 'spot') {
    l.target.position.copy(p).add(new T.Vector3(0, -1, 0)); l.target.updateMatrixWorld();
    l.angle = (spec.angle || 0.9) / 1.4; l.penumbra = 0.75; l.distance = spec.distance || 5;
  } else if (s.type === 'point') {
    l.distance = spec.distance || 5;
  } else {
    l.width = spec.w; l.height = spec.h;
    l.up.set(0, 0, -1); l.lookAt(p.x, p.y - 1, p.z);
  }
  s.base = s.type === 'rect' ? spec.energy / Math.max(0.01, spec.w * spec.h) * LAMP_K.rect : spec.energy * LAMP_K[s.type];
}
let lampSpecs = [];
function chooseLamps(camP, room, instant = false) {
  for (const type of ['spot', 'point', 'rect']) {
    const slots = pool.filter((s) => s.type === type);
    const cands = lampSpecs.filter((sp) => sp.type === type).map((sp) => {
      const p = B(...sp.pos), d2 = p.distanceToSquared(camP);
      let score = sp.energy / (1 + d2);
      if (room && sp.zone === room) score *= 6;
      if (!room && !sp.outdoor) score *= 0.25;
      if (room && sp.outdoor) score *= 0.1;
      return { sp, score };
    }).sort((a, b) => b.score - a.score).slice(0, slots.length).map((c) => c.sp);
    const keep = new Set(slots.filter((s) => s.spec && cands.includes(s.spec)).map((s) => s.spec));
    const todo = cands.filter((sp) => !keep.has(sp));
    for (const s of slots) {
      if (s.spec && keep.has(s.spec)) { s.next = null; continue; }
      s.next = todo.length ? todo.shift() : null;
      if (instant) { s.spec = s.next; s.next = null; s.f = s.spec ? 1 : 0; if (s.spec) applySpec(s, s.spec); }
    }
  }
}
function stepLamps(dt, t) {
  for (const s of pool) {
    const want = s.next ? 0 : s.spec ? 1 : 0;
    s.f += clamp(want - s.f, -dt * 3, dt * 3);
    if (s.next && s.f <= 0.001) { s.spec = s.next; s.next = null; applySpec(s, s.spec); }
    let k = s.f;
    if (s.spec && s.spec.flicker) k *= 0.82 + 0.12 * Math.sin(t * 9.1) + 0.06 * Math.sin(t * 23.7 + 1.3);
    s.l.intensity = s.spec ? s.base * k : 0;
  }
}

/* ================= Environments: sky for the outside, captured rooms for the inside ================= */
let skyEnv = null;
const roomEnv = {};
const ENV_SIZE = SD ? 128 : 256;
const BOX = { boxMin: { value: new T.Vector3(-1e4, -1e4, -1e4) }, boxMax: { value: new T.Vector3(1e4, 1e4, 1e4) }, boxProbe: { value: new T.Vector3() } };
const REFLECT_LINE = 'reflectVec = inverseTransformDirection( reflectVec, viewMatrix );';
const boxChunk = T.ShaderChunk.envmap_physical_pars_fragment.replace(REFLECT_LINE, `${REFLECT_LINE}
    if ( all( greaterThan( vBoxPos, boxMin - 0.25 ) ) && all( lessThan( vBoxPos, boxMax + 0.25 ) ) ) {
      vec3 bMax = ( boxMax - vBoxPos ) / reflectVec;
      vec3 bMin = ( boxMin - vBoxPos ) / reflectVec;
      vec3 bFar = max( bMax, bMin );
      float bD = min( min( bFar.x, bFar.y ), bFar.z );
      reflectVec = normalize( vBoxPos + reflectVec * bD - boxProbe );
    }`);
function addBoxProjection(m) {
  if (!T.ShaderChunk.envmap_physical_pars_fragment.includes(REFLECT_LINE)) return;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(m, sh, r);
    Object.assign(sh.uniforms, BOX);
    sh.vertexShader = 'varying vec3 vBoxPos;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vBoxPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = 'uniform vec3 boxMin;\nuniform vec3 boxMax;\nuniform vec3 boxProbe;\nvarying vec3 vBoxPos;\n' + sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>', boxChunk);
  };
  m.customProgramCacheKey = () => 'box|' + (prevKey ? prevKey.call(m) : '');
}
// room-to-room fade of the captured environments (all captures share one PMREM layout)
const ENV_FADE = 0.8;
const envMix = { rt: null, snaps: [], snap: 0, scene: null, cam: null, mat: null, from: null, to: null, t: 1, b0: [new T.Vector3(), new T.Vector3(), new T.Vector3()], b1: [new T.Vector3(), new T.Vector3(), new T.Vector3()] };
function makeEnvRT(w, h) {
  const rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, format: T.RGBAFormat, colorSpace: T.LinearSRGBColorSpace, depthBuffer: false, magFilter: T.LinearFilter, minFilter: T.LinearFilter, generateMipmaps: false });
  rt.texture.mapping = T.CubeUVReflectionMapping;
  return rt;
}
function setupEnvMix(sample) {
  const { width: w, height: h } = sample.image;
  envMix.rt = makeEnvRT(w, h); envMix.snaps = [makeEnvRT(w, h), makeEnvRT(w, h)];
  envMix.mat = new T.ShaderMaterial({ uniforms: { a: { value: null }, b: { value: null }, t: { value: 0 } },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D a;\nuniform sampler2D b;\nuniform float t;\nvarying vec2 vUv;\nvoid main() { gl_FragColor = mix(texture2D(a, vUv), texture2D(b, vUv), t); }',
    depthTest: false, depthWrite: false, toneMapped: false });
  envMix.scene = new T.Scene();
  const q = new T.Mesh(new T.PlaneGeometry(2, 2), envMix.mat); q.frustumCulled = false; envMix.scene.add(q);
  envMix.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}
function mixInto(rt, a, b, t) {
  const u = envMix.mat.uniforms; u.a.value = a; u.b.value = b; u.t.value = t;
  const keep = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(envMix.scene, envMix.cam); renderer.setRenderTarget(keep);
}
function boxOf(rk, o) { const [x0, y0, x1, y1] = ROOMS[rk]; const z0 = rk === 'garage' ? 0.12 : FL; o[0].set(x0, z0, -y1); o[1].set(x1, rk === 'garage' ? 3.2 : 3.35, -y0); o[2].copy(B((x0 + x1) / 2, (y0 + y1) / 2, z0 + 1.45)); }
function setBoxes(v) { BOX.boxMin.value.copy(v[0]); BOX.boxMax.value.copy(v[1]); BOX.boxProbe.value.copy(v[2]); }
let envKey;
function applyRoom(rk) {
  envKey = rk;
  if (!rk || !envMix.rt || !roomEnv[rk]) return;       // outside: the interior keeps the last room's light
  const next = roomEnv[rk];
  if (next === envMix.to && envMix.t >= 1) return;
  let from = envMix.to || next;
  if (envMix.t < 1) { const s = envMix.snaps[envMix.snap ^= 1]; mixInto(s, envMix.from, envMix.to, smooth(envMix.t)); from = s.texture; }
  const cur = [BOX.boxMin.value, BOX.boxMax.value, BOX.boxProbe.value], open = BOX.boxMax.value.x > 1e3;
  boxOf(rk, envMix.b1); envMix.b0.forEach((v, i) => v.copy(open ? envMix.b1[i] : cur[i]));
  envMix.from = from; envMix.to = next; envMix.t = 0;
  mixInto(envMix.rt, from, next, 0);
  setBoxes(envMix.b0);
}
function stepEnv(dt) {
  if (!envMix.rt || envMix.t >= 1) return;
  envMix.t = Math.min(1, envMix.t + (dt > 0 ? dt / ENV_FADE : 1));
  const k = smooth(envMix.t);
  mixInto(envMix.rt, envMix.from, envMix.to, k);
  BOX.boxMin.value.lerpVectors(envMix.b0[0], envMix.b1[0], k);
  BOX.boxMax.value.lerpVectors(envMix.b0[1], envMix.b1[1], k);
  BOX.boxProbe.value.lerpVectors(envMix.b0[2], envMix.b1[2], k);
}
function roomAt(p) {
  const x = p.x, y = -p.z;
  if (p.y > 3.4) return null;
  for (const [k, [x0, y0, x1, y1]] of Object.entries(ROOMS)) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return k;
  return null;
}

/* ================= Flames ================= */
const flameUniforms = wind;
function makeFlameMaterial() {
  return new T.ShaderMaterial({
    uniforms: { uTime: flameUniforms.uTime }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vSeed;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vSeed = fract(sin(dot(wp.xz, vec2(12.9898, 78.233))) * 43758.5453);
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vSeed;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.55; for (int k = 0; k < 4; k++) { s += a * n(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
      void main() {
        float t = uTime * 1.6 + vSeed * 10.0;
        vec2 q = vec2(vUv.x * 5.0 + vSeed * 7.0, vUv.y * 2.2 - t);
        float wob = fbm(vec2(vUv.y * 3.0 - t * 0.7, vSeed * 3.0)) - 0.5;
        float x = abs(vUv.x - 0.5 + wob * 0.18 * vUv.y) * 2.0;
        float tongues = 0.55 + 0.45 * sin(vUv.x * 31.0 + vSeed * 20.0 + fbm(vec2(vUv.x * 6.0, t * 0.5)) * 4.0);
        float body = fbm(q) * pow(max(0.0, 1.0 - vUv.y * 1.35), 1.4) * (0.75 + 0.6 * tongues) - x * x * 0.8;
        float a = smoothstep(0.14, 0.48, body);
        float heat = clamp(body * 1.4, 0.0, 1.0);
        vec3 col = mix(vec3(0.7, 0.12, 0.01), vec3(1.0, 0.42, 0.07), smoothstep(0.2, 0.55, heat));
        col = mix(col, vec3(1.0, 0.72, 0.32), smoothstep(0.65, 1.0, heat));
        gl_FragColor = vec4(col * a * 2.2, a);
      }`,
  });
}
function addFlames(list) {
  const mat = makeFlameMaterial();
  const card = (w, h, p, ry) => { const g = new T.PlaneGeometry(w, h); g.translate(0, h / 2, 0); const f = new T.Mesh(g, mat); f.position.copy(p); f.rotation.y = ry; f.renderOrder = 2; f.userData.noAO = true; scene.add(f); };
  for (const fl of list) {
    if (fl.fireplace) {
      for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5; card(fl.length / 5 * 1.6, 0.3 * (0.85 + Math.random() * 0.25), B(fl.pos[0] + (Math.random() - 0.5) * 0.06, fl.pos[1] - fl.length / 2 + t * fl.length, fl.pos[2]), PI / 2 + (Math.random() - 0.5) * 0.5); }
    } else if (fl.fireTable) {
      for (let i = 0; i < 5; i++) card(0.42, 0.34, B(fl.pos[0] + (Math.random() - 0.5) * 0.05, fl.pos[1] - 0.44 + i * 0.22, fl.pos[2]), PI / 2 + (Math.random() - 0.5) * 0.5);
    } else {
      for (const ry of [0, PI / 2]) card(0.022, 0.05, B(...fl.pos), ry);
    }
  }
}

/* ================= Build ================= */
let M, BOOKS, K, stepBirds = () => {};
const stats = { parts: 0, meshes: 0, lamps: 0, trees: 0 };
const doorParts = [];
async function buildWorld() {
  await step('Materialien werden erzeugt', 'Generating materials');
  const tg = new TexGen(renderer, { size: SD ? 256 : MAX ? 1024 : 512, heroSize: SD ? 512 : MAX ? 2048 : 1024, aniso: Math.min(renderer.capabilities.getMaxAnisotropy(), SD ? 4 : MAX ? 16 : 8) });
  ({ M, BOOKS } = makeMaterials(tg, { lite: SD }));
  await step('Das Haus wird gebaut', 'Building the house');
  K = new Kit(7);
  buildHouse(K, M, BOOKS);
  await step('Garten und Hecken werden gepflanzt', 'Planting the garden and hedges');
  buildLawnAndHedges(K, M, { step: SD ? 0.18 : MAX ? 0.1 : 0.12 });
  lampSpecs = K.lights;
  // lawn: break up the repeat with a slow, large-scale tone variation
  M.lawn.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 big = texture2D(map, vMapUv * 0.071).rgb; vec3 mid = texture2D(map, vMapUv * 0.23 + 0.37).rgb;
        diffuseColor.rgb *= mix(0.78, 1.25, clamp(dot(big, vec3(2.6)) - 0.35, 0.0, 1.0)) * mix(0.9, 1.1, clamp(dot(mid, vec3(3.0)) - 0.4, 0.0, 1.0)); }`);
  };
  M.lawn.customProgramCacheKey = () => 'lawn';
  addCaustics(M.poolShell); addCaustics(M.poolFloor);
  // exterior copies of shared materials reflect the sky; interior ones get the captured rooms with box projection
  const EXT = new Set(['EXT', 'GROUND', 'DOOR']);
  const extVariants = new Map();
  const variant = (m, zone) => {
    if (!EXT.has(zone)) return m;
    if (!extVariants.has(m)) {
      const v = m.clone();
      v.onBeforeCompile = m.onBeforeCompile; v.customProgramCacheKey = m.customProgramCacheKey;
      v.userData = { ...m.userData, ext: true };
      extVariants.set(m, v);
    }
    return extVariants.get(m);
  };
  const root = new T.Group(); root.name = 'world'; scene.add(root);
  await step('Geometrie wird zusammengeführt', 'Merging geometry');
  for (const b of K.buckets.values()) stats.parts += b.geos.length;
  const meshes = K.build(root, variant);
  stats.meshes = meshes.length; stats.lamps = K.lights.length;
  for (const m of new Set(meshes.map((x) => x.material))) if (!m.userData.ext && !m.transparent && !m.userData.noBox) addBoxProjection(m);
  // the front door swings on its hinge
  const pivot = new T.Group(); pivot.position.copy(B(...DOOR_HINGE)); scene.add(pivot); pivot.updateMatrixWorld(true);
  for (const m of meshes) if (m.userData.zone === 'DOOR') { m.matrixAutoUpdate = true; pivot.attach(m); m.updateMatrix(); doorParts.push(m); }
  door.pivot = pivot; door.meshes = doorParts;
  await step('Bäume wachsen', 'Growing the trees');
  const temps = [treeTemplate(11, { cards: SD ? 2 : 3 }), treeTemplate(23, { cards: SD ? 2 : 3, spread: 1.0, lean: 0.35 }), treeTemplate(37, { cards: SD ? 2 : 3, trunk: 2.0, spread: 1.1 })];
  const far = [treeTemplate(51, { depth: 3, cards: 3, trunk: 2.6 }), treeTemplate(67, { depth: 3, cards: 3, trunk: 2.2, spread: 0.9 })];
  const P = [];
  [[-16, 24, 11, 2.0], [30, 26, 11, 1.2], [-32, 40, 12, 0.7], [45, 42, 12, 2.6], [-8, 13, 9, 0.2], [21, 12.5, 9.5, 1.4]].forEach(([x, y, h, r], i) => P.push({ x, y, h, r, t: i % 3 }));
  [[-14, 5, 7, 0.5], [27, 6, 7.5, 2.0], [16.5, -9.5, 6.5, 1.1], [31, 19, 7, 0.3]].forEach(([x, y, h, r], i) => P.push({ x, y, h, r, t: (i + 1) % 3 }));
  const rr = (() => { let s = 77; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  for (let i = 0; i < 11; i++) P.push({ x: -48 + i * 10.5 + (rr() - 0.5) * 4, y: 42 + rr() * 18, h: 9 + rr() * 4, r: rr() * 6.28, t: i % 3 });
  buildTrees(scene, M, temps, P, { leafSize: SD ? 256 : 512 });
  // a looser ring of trees out in the fields, so the meadow meets the mountains
  const P2 = [];
  const nFar = SD ? 36 : MAX ? 90 : 70;
  for (let i = 0; i < nFar; i++) {
    const a = rr() * PI * 2, d = 70 + rr() * 150;
    const x = 8 + Math.cos(a) * d, y = 6 + Math.sin(a) * d;
    if (y < -30 && Math.abs(x - 6) < 50) continue;          // keep the street view open
    P2.push({ x, y, h: 8 + rr() * 6, r: rr() * 6.28, t: i % 2 });
  }
  buildTrees(scene, M, far, P2, { leafSize: SD ? 256 : 512, shadows: false });
  stats.trees = P.length + P2.length;
  await step('Rasen wird gesät', 'Sowing the lawn');
  buildGrass(scene, SD ? 0 : MAX ? 230000 : 110000, GRASS_HOLES, [PLOT[0] + 0.7, PLOT[1] + 0.7, PLOT[2] - 0.7, PLOT[3] - 0.7]);
  await step('Berge und Himmel', 'Mountains and sky');
  const haze = { color: { value: new T.Color(0.55, 0.66, 0.8) }, k: { value: 0.00007 } };
  buildMountains(scene, haze, { segs: SD ? 360 : 720, rings: SD ? 60 : 100 });
  const sky = makeSky(SUN_DIR, { scale: 1.0 });
  sky.userData.noAO = true; sky.renderOrder = -1;
  scene.add(sky);
  // the sky light without the sun disk (the sun itself is the directional light), over a grassy ground
  const envScene = new T.Scene();
  const sky2 = makeSky(SUN_DIR, { scale: 1.0 }); sky2.material.uniforms.uNoDisk.value = 1; sky2.scale.setScalar(500);
  envScene.add(sky2);
  const ground = new T.Mesh(new T.CircleGeometry(400, 32).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: new T.Color(0.07, 0.1, 0.035) }));
  ground.position.y = -1.5; envScene.add(ground);
  skyEnv = pmrem.fromScene(envScene, 0, 0.1, 2000).texture;
  for (const v of extVariants.values()) { v.envMap = skyEnv; v.envMapIntensity = Math.min(v.envMapIntensity, 0.75); v.needsUpdate = true; }
  // everything else outside (trees, grass, mountains) is lit by the sky as well
  scene.traverse((o) => {
    if (!o.isMesh || !o.material || o.parent === root || o.material.isShaderMaterial) return;
    for (const m of [].concat(o.material)) if (!m.envMap && (m.isMeshStandardMaterial)) { m.envMap = skyEnv; m.envMapIntensity = Math.min(m.envMapIntensity, 0.7); m.needsUpdate = true; }
  });
  const water = buildWater(scene, new TexGen(renderer, { size: 512 }).get('water', { strength: 1.2 }).normalMap);
  water.material.envMap = skyEnv;
  addFlames(K.flames);
  stepBirds = reduceMotion ? () => {} : buildBirds(scene);
  makePool();
  await step('Die Räume werden beleuchtet', 'Lighting the rooms');
  await captureRooms();
}
async function captureRooms() {
  const rt = new T.WebGLCubeRenderTarget(ENV_SIZE, { type: T.HalfFloatType });
  const cam = new T.CubeCamera(0.05, 8000, rt);
  scene.add(cam);
  setShadowMode('in');
  const hideOut = scene.children.filter((o) => o.name === 'grass');
  hideOut.forEach((o) => { o.visible = false; });
  const env1 = {};
  scene.environment = null;
  for (const pass of [1, 2]) {
    for (const [k, [x0, y0, x1, y1]] of Object.entries(ROOMS)) {
      const c = B((x0 + x1) / 2, (y0 + y1) / 2, (k === 'garage' ? 0.12 : FL) + 1.45);
      chooseLamps(c, k, true); stepLamps(0, 0);
      if (pass === 2) scene.environment = env1[k];
      cam.position.copy(c); cam.update(renderer, scene);
      const env = pmrem.fromCubemap(rt.texture).texture;
      if (pass === 1) env1[k] = env; else roomEnv[k] = env;
      await tick();
    }
    await step(pass === 1 ? 'Licht wird verteilt' : 'Licht wird verfeinert', pass === 1 ? 'Bouncing the light' : 'Refining the light');
  }
  for (const k in env1) env1[k].dispose();
  hideOut.forEach((o) => { o.visible = true; });
  scene.remove(cam); rt.dispose();
  setupEnvMix(roomEnv.hall);
  mixInto(envMix.rt, roomEnv.hall, roomEnv.hall, 1);
  envMix.to = roomEnv.hall; envMix.t = 1;
  boxOf('hall', envMix.b1); setBoxes(envMix.b1);
  scene.environment = envMix.rt.texture;
}

/* ================= Camera path (Blender coordinates; z is height) ================= */
const CAMS = {
  exterior: [[6.2, -21.5, 1.65], [7.6, 4.0, 2.9]],
  hall: [[8.7, 2.75, FL + 1.5], [8.7, 9.5, FL + 1.25]],
  study: [[7.65, 5.1, FL + 1.5], [5.0, 2.6, FL + 1.1]],
  living: [[9.75, 2.6, FL + 1.45], [13.3, 6.4, FL + 1.25]],
  kitchen: [[9.7, 11.15, FL + 1.5], [13.9, 11.15, FL + 1.3]],
  bath: [[7.75, 6.5, FL + 1.5], [5.0, 9.4, FL + 1.15]],
  garage: [[3.55, 3.1, 0.12 + 1.5], [0.11, 3.1, 1.3]],
  bed: [[8.4, 13.2, FL + 1.5], [5.6, 9.8, FL + 0.95]],
  rear: [[21.0, 25.2, 1.75], [10.5, 13.0, 2.2]],
};
const E = 1.95;
const CP = [
  [[6.2, -21.5, 1.65], 'exterior'],
  [[8.7, -6.0, 1.7], [8.7, 4, 2.0]],
  [[8.7, -0.4, 2.1], [8.7, 6, 1.95]],
  [[8.7, 2.0, E], [8.7, 8, 1.9]],
  [[8.7, 2.75, E], 'hall'],
  [[8.7, 6.95, E], [12, 6.95, 1.8]],
  [[10.4, 7.0, E], [13.6, 5.1, 1.5]],
  [[11.9, 6.95, E], [13.6, 4.2, 1.5]],
  [[10.6, 2.8, E], [13.3, 5.6, 1.45]],
  [[9.75, 2.6, 1.9], 'living'],
  [[11.2, 6.9, E], [11.7, 10, 1.7]],
  [[10.2, 7.4, E], [12, 12, 1.6]],
  [[10.05, 8.45, 2.05], 'kitchen'],
  [[9.95, 8.95, E], [8.0, 8.95, 1.9]],
  [[9.4, 8.95, E], [7.5, 8.9, 1.9]],
  [[8.7, 8.4, E], [8.7, 4.5, 1.8]],
  [[8.6, 5.05, E], [6.5, 4.5, 1.6]],
  [[7.65, 5.1, E], 'study'],
  [[6.2, 5.2, E], [3.0, 5.2, 1.5]],
  [[4.4, 5.2, E], [1.5, 3.8, 1.3]],
  [[3.55, 3.1, 1.62], 'garage'],
  [[3.6, 5.2, 1.75], [7, 5.2, 1.8]],
  [[6.0, 5.2, E], [8.6, 6.0, 1.8]],
  [[8.6, 5.3, E], [8.7, 8, 1.8]],
  [[8.6, 6.95, E], [6, 7.5, 1.6]],
  [[7.55, 7.0, E], [5, 8.5, 1.5]],
  [[7.6, 8.2, E], 'bath'],
  [[7.5, 7.0, E], [9, 7, 1.8]],
  [[8.7, 7.4, E], [8.7, 11, 1.8]],
  [[8.7, 9.9, E], [8.5, 13, 1.6]],
  [[8.4, 13.2, E], 'bed'],
  [[8.7, 10.2, E], [8.7, 8, 1.9]],
  [[8.75, 8.95, E], [11, 9, 1.8]],
  [[9.4, 8.95, E], [10.5, 10.5, 1.8]],
  [[10.1, 9.3, E], [10.15, 14, 1.8]],
  [[10.15, 12.9, E], [10.15, 18, 1.8]],
  [[10.15, 14.6, 1.9], [11, 20, 1.7]],
  [[13, 20, 1.8], [9.5, 12, 2.2]],
  [[18.5, 27.5, 1.75], 'rear'],
  [[22, 32, 3.2], [9, 11, 2.4]],
];
const SEC = [0, 4, 9, 12, 17, 20, 26, 30, 38, 39];
const SECT = 1.5;
let posCurve, tgtCurve;
function buildPath() {
  const pos = [], tgt = [];
  for (const [p, t] of CP) { pos.push(B(...p)); tgt.push(typeof t === 'string' ? B(...CAMS[t][1]) : B(...t)); }
  for (const [k, i] of [['exterior', 0], ['hall', 4], ['living', 9], ['kitchen', 12], ['study', 17], ['garage', 20], ['bath', 26], ['bed', 30], ['rear', 38]]) {
    pos[i].copy(B(...CAMS[k][0])); tgt[i].copy(B(...CAMS[k][1]));
  }
  posCurve = new T.CatmullRomCurve3(pos, false, 'centripetal');
  tgtCurve = new T.CatmullRomCurve3(tgt, false, 'centripetal');
}
const IN_EV = 0.25, OUT_EV = -0.6;
const PORTALS = [[8.7, 2.2], [10.15, 13.6]];
function exposureAt(p) {
  const x = p.x, y = -p.z;
  const room = roomAt(p), inside = room !== null;
  let d = 1e9;
  for (const [px, py] of PORTALS) d = Math.min(d, Math.hypot(x - px, y - py));
  const k = smoothstep(0, 1.5, d), mid = (IN_EV + OUT_EV) / 2;
  const off = room === 'garage' ? -0.2 : 0;
  return inside ? mid + (IN_EV + off - mid) * k : mid + (OUT_EV - mid) * k;
}
function scrollToS() {
  const r = scrollY / (SECT * Math.max(innerHeight, 1)), i = Math.floor(r), u = r - i;
  if (i >= SEC.length - 1) return SEC.length - 1;
  return i + smooth(clamp((u - 0.25) / 0.75));
}
function sToU(s) {
  const i = Math.min(Math.floor(s), SEC.length - 2), f = s - i;
  return (SEC[i] + (SEC[i + 1] - SEC[i]) * f) / (CP.length - 1);
}
let viewShift = 0;
function lookLevel(cam, tgt) {
  const dy = tgt.y - cam.position.y, dist = Math.hypot(tgt.x - cam.position.x, tgt.z - cam.position.z) || 1e-6;
  const pitch = clamp(Math.atan2(dy, dist), -0.45, 0.45);
  cam.lookAt(tgt.x, cam.position.y, tgt.z);
  const shift = Math.tan(pitch) / Math.tan(cam.fov * PI / 360);
  if (Math.abs(shift - viewShift) > 1e-4 || !cam.view) {
    viewShift = shift;
    const w = innerWidth, h = innerHeight;
    cam.setViewOffset(w, h, 0, -shift * h / 2, w, h);
  }
}
function clearShift(cam) { if (cam.view) { cam.clearViewOffset(); viewShift = 0; } }
function fitCamera() {
  const w = innerWidth, h = innerHeight, aspect = w / Math.max(1, h);
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? 78 : aspect < 1.4 ? 68 : 60;
  if (camera.view) camera.setViewOffset(w, h, 0, -viewShift * h / 2, w, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  $('#track').style.height = `${((SEC.length - 1) * SECT + 1) * h}px`;
}

/* ================= Walk mode ================= */
const WALLS = [];
const seg = (x0, y0, x1, y1) => WALLS.push([x0, y0, x1, y1]);
function wallLine(x0, y0, x1, y1, holes = []) {
  const alongX = y0 === y1, a0 = alongX ? x0 : y0, a1 = alongX ? x1 : y1;
  let cur = a0;
  for (const [h0, h1] of holes.sort((p, q) => p[0] - q[0])) { if (h0 > cur) (alongX ? seg(cur, y0, h0, y0) : seg(x0, cur, x0, h0)); cur = h1; }
  if (cur < a1) (alongX ? seg(cur, y0, a1, y0) : seg(x0, cur, x0, a1));
}
wallLine(4.2, 2.2, 14, 2.2, [[8.2, 9.2]]);
wallLine(14, 2.2, 14, 13.6);
wallLine(4.2, 13.6, 14, 13.6, [[9.55, 10.75]]);
wallLine(4.2, 2.2, 4.2, 13.6, [[4.75, 5.65]]);
wallLine(8.0, 2.2, 8.0, 9.6, [[4.6, 5.5], [6.55, 7.35]]);
wallLine(9.4, 2.2, 9.4, 9.6, [[6.2, 7.75], [8.45, 9.45]]);
wallLine(4.2, 6.2, 8.0, 6.2);
wallLine(4.2, 9.6, 9.4, 9.6, [[8.3, 9.1]]);
wallLine(9.4, 9.6, 9.4, 13.6);
wallLine(0, 0, 4.2, 0); wallLine(0, 0, 0, 6.2); wallLine(0, 6.2, 4.2, 6.2);
const BOXES = [
  [9.65, 3.7, 10.65, 6.5], [11.0, 4.55, 12.1, 5.65], [10.62, 2.7, 11.38, 3.42], [12.08, 2.82, 12.82, 3.58],
  [10.5, 7.5, 12.9, 9.12], [11.09, 9.9, 12.15, 12.4], [13.24, 9.25, 14, 13.6], [12.25, 13.17, 13.55, 13.55],
  [13.25, 3.9, 14, 6.3], [13.47, 2.2, 14, 8.6],
  [5.42, 9.7, 7.38, 11.86], [4.85, 9.66, 5.35, 10.1], [7.45, 9.66, 7.95, 10.1], [8.72, 10.56, 9.34, 13.49],
  [4.31, 6.4, 5.15, 8.1], [4.31, 8.39, 5.5, 8.41], [5.6, 9.0, 7.9, 9.54],
  [5.15, 3.92, 6.65, 4.68], [6.7, 2.75, 7.6, 3.65], [7.3, 3.7, 7.8, 4.2], [4.2, 2.2, 8.0, 2.86], [4.2, 5.78, 8.0, 6.2],
  [0.11, 2.0, 0.85, 4.2], [0.11, 0.25, 0.68, 0.95], [1.3, 5.55, 3.25, 6.1], [3.3, 5.4, 3.8, 6.1], [0.5, 4.75, 1.0, 5.25],
  [13.15, 18.65, 22.85, 23.35], [11.35, 14.4, 14.3, 16.4], [8.25, 16.45, 8.85, 17.05], [13.85, 16.55, 14.45, 17.15],
  [12.4, 17.6, 13.1, 18.4], [22.9, 17.6, 23.6, 18.4], [7.0, -1.85, 7.4, -1.25], [10.0, -1.85, 10.4, -1.25],
  [-12, -19.25, -0.6, -18.95], [4.8, -19.25, 7.4, -18.95], [10, -19.25, 26, -18.95],
  [-12, -18.8, -0.75, -18.1], [4.95, -18.8, 7.25, -18.1], [10.15, -18.8, 26, -18.1],
  [-12, 28.3, 26, 29], [-12, -18.8, -11.3, 29], [25.3, -18.8, 26, 29],
];
for (const [x0, y0, x1, y1] of BOXES) { seg(x0, y0, x1, y0); seg(x1, y0, x1, y1); seg(x1, y1, x0, y1); seg(x0, y1, x0, y0); }
function floorAt(x, y) {
  if (x >= 0 && x < 4.2 && y >= 0 && y <= 6.2) return (y > 4.7 && y < 5.7) ? (x > 3.66 ? 0.45 : x > 3.3 ? 0.285 : 0.12) : 0.12;
  if (x >= 4.2 && x <= 14 && y >= 2.2 && y <= 13.6) return 0.45;
  if (x >= 4.2 && x <= 14 && y >= 0 && y < 2.2) return 0.48;
  if (x >= 7.5 && x <= 9.9 && y >= -1.25 && y < 0) return 0.45 * (y + 1.25) / 1.25;
  if (x >= 8.1 && x <= 14.5 && y > 13.6 && y <= 17.2) return 0.43;
  return 0;
}
const RAD = 0.28;
const DOOR_SEG = [8.2, 2.2, 9.2, 2.2];
const door = { pivot: null, angle: 0, from: 0, t: 1, open: false, manualUntil: 0, meshes: [] };
function collide(px, py) {
  for (let it = 0; it < 3; it++) {
    const segs = door.pivot && Math.abs(door.angle) < 0.7 ? WALLS.concat([DOOR_SEG]) : WALLS;
    for (const [x0, y0, x1, y1] of segs) {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9;
      const t = clamp(((px - x0) * dx + (py - y0) * dy) / l2);
      const cx = x0 + dx * t, cy = y0 + dy * t, ex = px - cx, ey = py - cy, d = Math.hypot(ex, ey);
      if (d < RAD) { const k = d > 1e-6 ? (RAD - d) / d : 0; px += ex * k; py += ey * k; }
    }
  }
  return [clamp(px, -40, 50), clamp(py, -30, 45)];
}
const walk = { on: false, yaw: 0, pitch: 0, x: 0, y: 0, keys: new Set(), drag: null, hold: false, sprint: false };
const sprintBtn = $('#sprint');
sprintBtn.addEventListener('click', () => { walk.sprint = !walk.sprint; sprintBtn.setAttribute('aria-pressed', walk.sprint ? 'true' : 'false'); });
function setWalk(on) {
  walk.on = on;
  document.body.classList.toggle('walking', on);
  $('#walk').setAttribute('aria-pressed', on ? 'true' : 'false');
  $('#walk').textContent = on ? L('Zurück zum Rundgang', 'Back to the tour') : L('Frei erkunden', 'Explore freely');
  if (on) {
    const d = new T.Vector3(); camera.getWorldDirection(d);
    walk.yaw = Math.atan2(d.x, -d.z); walk.pitch = Math.asin(clamp(d.y, -1, 1));
    walk.x = camera.position.x; walk.y = -camera.position.z;
    [walk.x, walk.y] = collide(walk.x, walk.y);
  } else fitCamera();
}
$('#walk').addEventListener('click', () => setWalk(!walk.on));
const P = new T.Vector3(), Tg = new T.Vector3(), dir = new T.Vector3(), right = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    if (!walk.on) { if (k.length === 1) setWalk(true); else return; }
    walk.keys.add(k); e.preventDefault();
  }
  if (k === 'shift') walk.keys.add('shift');
  if (k === 'e' && door.pivot && Math.hypot(P.x - 8.7, -P.z - 2.2) < 4) setDoor(!door.open, true);
  if (k === 'escape' && walk.on) setWalk(false);
});
addEventListener('keyup', (e) => walk.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => walk.keys.clear());
const canvasEl = $('#scene');
let holdTimer = 0;
canvasEl.addEventListener('pointerdown', (e) => {
  if (!walk.on) return;
  walk.drag = { x: e.clientX, y: e.clientY, moved: 0 };
  canvasEl.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch') { clearTimeout(holdTimer); holdTimer = setTimeout(() => { if (walk.drag && walk.drag.moved < 12) walk.hold = true; }, 260); }
});
canvasEl.addEventListener('pointermove', (e) => {
  if (!walk.on || !walk.drag) return;
  const dx = e.clientX - walk.drag.x, dy = e.clientY - walk.drag.y;
  walk.drag.moved += Math.abs(dx) + Math.abs(dy);
  walk.drag.x = e.clientX; walk.drag.y = e.clientY;
  const k = (camera.fov * PI / 180) / innerHeight;
  walk.yaw += dx * k; walk.pitch = clamp(walk.pitch - dy * k, -1.2, 1.2);
});
const endDrag = () => { walk.drag = null; walk.hold = false; clearTimeout(holdTimer); };
canvasEl.addEventListener('pointerup', endDrag);
canvasEl.addEventListener('pointercancel', endDrag);
function stepWalk(dt) {
  const f = (walk.keys.has('w') || walk.keys.has('arrowup') || walk.hold ? 1 : 0) - (walk.keys.has('s') || walk.keys.has('arrowdown') ? 1 : 0);
  const sdir = (walk.keys.has('d') ? 1 : 0) - (walk.keys.has('a') ? 1 : 0);
  const turn = (walk.keys.has('arrowright') ? 1 : 0) - (walk.keys.has('arrowleft') ? 1 : 0);
  walk.yaw += turn * dt * 1.6;
  const sp = (walk.keys.has('shift') || walk.sprint ? 3.6 : 1.6) * dt;
  const fx = Math.sin(walk.yaw), fy = Math.cos(walk.yaw);
  const nx = walk.x + (fx * f + fy * sdir) * sp, ny = walk.y + (fy * f - fx * sdir) * sp;
  [walk.x, walk.y] = collide(nx, ny);
  const eye = floorAt(walk.x, walk.y) + 1.6;
  camera.position.lerp(B(walk.x, walk.y, eye), 1 - Math.exp(-dt * 14));
  const d = new T.Vector3(Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), -Math.cos(walk.yaw) * Math.cos(walk.pitch));
  camera.lookAt(camera.position.clone().add(d));
}

/* ================= Front door with sound ================= */
const DOOR_OPEN = -1.45;
let actx = null;
function audio() {
  if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
['pointerdown', 'keydown', 'touchend'].forEach((ev) => addEventListener(ev, audio, { passive: true }));
function noiseBuf(a, dur) {
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function sfx(kind) {
  const a = actx;
  if (!a || a.state !== 'running') return;
  const t0 = a.currentTime + 0.01, out = a.createGain(); out.gain.value = 0.55; out.connect(a.destination);
  const click = (t, f, v) => {
    const s = a.createBufferSource(); s.buffer = noiseBuf(a, 0.06);
    const bf = a.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f; bf.Q.value = 4;
    const g = a.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    s.connect(bf).connect(g).connect(out); s.start(t);
  };
  if (kind === 'open' || kind === 'closing') {
    if (kind === 'open') click(t0, 2600, 0.9);
    const o = a.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(kind === 'open' ? 150 : 210, t0); o.frequency.linearRampToValueAtTime(kind === 'open' ? 230 : 140, t0 + 0.8);
    const lfo = a.createOscillator(); lfo.frequency.value = 19; const lg = a.createGain(); lg.gain.value = 14;
    lfo.connect(lg).connect(o.frequency);
    const bf = a.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1100; bf.Q.value = 9;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.045, t0 + 0.15); g.gain.linearRampToValueAtTime(0.0001, t0 + 0.8);
    const w = a.createBufferSource(); w.buffer = noiseBuf(a, 0.9);
    const wf = a.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    const wg = a.createGain(); wg.gain.setValueAtTime(0.0001, t0); wg.gain.linearRampToValueAtTime(0.08, t0 + 0.35); wg.gain.linearRampToValueAtTime(0.0001, t0 + 0.9);
    o.connect(bf).connect(g).connect(out); w.connect(wf).connect(wg).connect(out);
    o.start(t0); lfo.start(t0); w.start(t0); o.stop(t0 + 0.85); lfo.stop(t0 + 0.85);
  } else if (kind === 'shut') {
    const th = a.createOscillator(); th.type = 'sine';
    th.frequency.setValueAtTime(95, t0); th.frequency.exponentialRampToValueAtTime(42, t0 + 0.25);
    const tg = a.createGain(); tg.gain.setValueAtTime(0.0001, t0); tg.gain.exponentialRampToValueAtTime(0.9, t0 + 0.012); tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    const s = a.createBufferSource(); s.buffer = noiseBuf(a, 0.12);
    const lf = a.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 900;
    const sg = a.createGain(); sg.gain.setValueAtTime(0.5, t0); sg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    th.connect(tg).connect(out); s.connect(lf).connect(sg).connect(out);
    th.start(t0); th.stop(t0 + 0.35); s.start(t0);
    click(t0 + 0.03, 3200, 0.6);
  }
}
function setDoor(open, manual) {
  if (!door.pivot || door.open === open) return;
  door.open = open; door.from = door.angle; door.t = 0;
  if (manual) door.manualUntil = performance.now() + 8000;
  sfx(open ? 'open' : 'closing');
}
function stepDoor(dt) {
  if (!door.pivot) return;
  if (performance.now() > door.manualUntil) {
    const d = Math.hypot(P.x - 8.7, -P.z - 2.2);
    if (!door.open && d < 2.4) setDoor(true);
    else if (door.open && d > 3.6) setDoor(false);
  }
  if (door.t < 1) {
    door.t = Math.min(1, door.t + dt / 1.0);
    door.angle = door.from + ((door.open ? DOOR_OPEN : 0) - door.from) * smooth(door.t);
    door.pivot.rotation.y = door.angle;
    if (door.t === 1 && !door.open) sfx('shut');
  }
}
const ray = new T.Raycaster(), rayPt = new T.Vector2();
let downAt = null;
canvasEl.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
canvasEl.addEventListener('click', (e) => {
  if (!door.pivot || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const r = canvasEl.getBoundingClientRect();
  rayPt.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(rayPt, camera);
  const hit = ray.intersectObjects(door.meshes, false)[0];
  if (hit && hit.distance < 8) setDoor(!door.open, true);
});

/* ================= UI ================= */
const cards = $$('.card');
const navBtns = $$('.rooms button');
const planRooms = $$('.plan .rm'), planTexts = $$('.plan text[data-room]');
const camMark = $('#cam');
const statusText = $('#status-text'), statusStep = $('#status-step'), statusFill = $('#status-fill');
const NAMES_DE = ['Das Haus', 'Diele', 'Wohnzimmer', 'Küche', 'Bibliothek', 'Garage', 'Bad', 'Schlafzimmer', 'Garten', 'Ihr Projekt'];
const NAMES_EN = ['The house', 'Hall', 'Living room', 'Kitchen', 'Library', 'Garage', 'Bathroom', 'Bedroom', 'Garden', 'Your project'];
const ROOM_STOP = { hall: 1, living: 2, kitchen: 3, study: 4, garage: 5, bath: 6, bed: 7 };
function goTo(i) {
  if (walk.on) {
    const k = ['exterior', 'hall', 'living', 'kitchen', 'study', 'garage', 'bath', 'bed', 'rear', 'rear'][i];
    const [p, t] = CAMS[k];
    camera.position.copy(B(...p)); camera.lookAt(B(...t));
    walk.x = p[0]; walk.y = p[1];
    const d = B(...t).sub(camera.position).normalize();
    walk.yaw = Math.atan2(d.x, -d.z); walk.pitch = Math.asin(d.y);
    return;
  }
  window.scrollTo({ top: i * SECT * innerHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
}
$$('[data-go]').forEach((el) => {
  const i = +el.dataset.go;
  el.addEventListener('click', () => goTo(i));
  if (el.tagName !== 'BUTTON') el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(i); } });
});
$('#book').addEventListener('click', () => { $('#contact').hidden = false; });
// on GitHub Pages the rendered edition is one folder up: switch in the same tab
const toRender = $('#to-render');
if (toRender && /\.github\.io$/.test(location.hostname)) { toRender.href = '../'; toRender.removeAttribute('target'); }
$('#tier-switch').addEventListener('click', () => { try { localStorage.removeItem('seo3d-three-tier'); } catch (e) { /* ignore */ } location.href = location.pathname; });

/* ================= Loop ================= */
const ptr = new T.Vector2(), look = new T.Vector2();
addEventListener('pointermove', (e) => { ptr.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });
addEventListener('resize', () => { fitCamera(); });
let sCur = 0, lastActive = -1, lampTimer = 0;
const cardState = cards.map(() => ({ op: -1, shift: 0 }));
const clock = new T.Clock();
function update(dt) {
  if (walk.on) {
    clearShift(camera);
    stepWalk(dt);
    P.copy(camera.position);
  } else {
    const sTarget = scrollToS();
    sCur += (sTarget - sCur) * (1 - Math.exp(-dt * (reduceMotion ? 12 : 3.2)));
    if (Math.abs(sTarget - sCur) < 1e-4) sCur = sTarget;
    const u = sToU(sCur);
    posCurve.getPoint(u, P); tgtCurve.getPoint(u, Tg);
    if (!reduceMotion) {
      look.lerp(ptr, 1 - Math.exp(-dt * 2.2));
      dir.subVectors(Tg, P).normalize();
      right.crossVectors(dir, UP).normalize();
      const amp = roomAt(P) ? 0.25 : 0.6;
      Tg.addScaledVector(right, look.x * amp).addScaledVector(UP, -look.y * amp * 0.5);
    }
    camera.position.copy(P);
    lookLevel(camera, Tg);
  }
  const rk = roomAt(P);
  if (rk !== envKey) applyRoom(rk);
  stepEnv(dt);
  // the sun's shadow map follows: tight around the house inside, the whole garden outside
  const x = P.x, y = -P.z;
  const deep = x > 0.3 && x < 13.7 && y > 0.3 && y < 13.3;
  if (rk && deep) setShadowMode('in'); else if (!rk && (x < -0.5 || x > 14.5 || y < -0.5 || y > 14.2)) setShadowMode('out');
  lampTimer -= dt;
  if (lampTimer <= 0) { chooseLamps(P, rk); lampTimer = 0.25; }
  const t = performance.now() / 1000;
  wind.uTime.value = t;
  stepLamps(dt, t);
  const ev = exposureAt(P);
  renderer.toneMappingExposure += (Math.pow(2, ev) - renderer.toneMappingExposure) * (dt ? 1 - Math.exp(-dt * 2.2) : 1);
  stepBirds(t);
  stepDoor(dt);
  if (!walk.on) {
    cards.forEach((card, i) => {
      const op = 1 - smoothstep(0.1, 0.32, Math.abs(sCur - i));
      const shift = reduceMotion ? 0 : clamp((i - sCur) * 90, -60, 60);
      const st = cardState[i];
      if (Math.abs(op - st.op) > 0.002 || Math.abs(shift - st.shift) > 0.3) {
        st.op = op; st.shift = shift;
        card.style.opacity = op.toFixed(3);
        card.style.setProperty('--shift', `${shift.toFixed(1)}px`);
        card.style.visibility = op < 0.01 ? 'hidden' : 'visible';
        card.inert = op < 0.5;
        card.classList.toggle('on', op > 0.5);
      }
    });
  }
  const active = walk.on ? (rk ? ROOM_STOP[rk] : 0) : clamp(Math.round(sCur), 0, SEC.length - 1);
  if (active !== lastActive) {
    lastActive = active;
    navBtns.forEach((b, i) => b.setAttribute('aria-current', i === active ? 'true' : 'false'));
    planRooms.forEach((r) => r.classList.toggle('on', +r.dataset.room === active));
    planTexts.forEach((tx) => tx.classList.toggle('on', +tx.dataset.room === active));
    statusText.textContent = L(NAMES_DE, NAMES_EN)[active];
    statusStep.textContent = walk.on ? L('Freier Modus', 'Free mode') : active === 0 ? L('Zum Gehen scrollen', 'Scroll to walk') : active >= 8 ? L('Außen', 'Outside') : `${L('Raum', 'Room')} ${String(active).padStart(2, '0')} / 07`;
  }
  statusFill.style.width = walk.on ? '100%' : `${(sCur / (SEC.length - 1) * 100).toFixed(1)}%`;
  camMark.style.display = rk ? '' : 'none';
  if (rk) {
    camera.getWorldDirection(dir);
    const yaw = Math.atan2(-dir.z, dir.x) * 180 / PI;
    const px = (P.x - 4.2) * 10, py = (-P.z - 2.2) * 10;
    camMark.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${yaw.toFixed(1)})`);
  }
}
const tune = { n: 0, acc: 0, done: false };
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (frozen) { requestAnimationFrame(frame); return; }
  update(dt);
  renderFrame();
  if (!tune.done && document.visibilityState === 'visible') {
    if (++tune.n > 20) tune.acc += dt;
    if (tune.n === 140) {
      const avg = tune.acc / 120;
      if (avg > 1 / 30 && dpr > 1) { dpr = Math.max(1, dpr * (avg > 1 / 20 ? 0.6 : 0.8)); renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); fitCamera(); }
      if (avg > 1 / 22 && gtao) gtao.enabled = false;
      if (avg > 1 / 18) bloom.enabled = false;
      tune.done = true;
    }
  }
  requestAnimationFrame(frame);
}
langListeners.push(() => { lastActive = -1; $('#walk').textContent = walk.on ? L('Zurück zum Rundgang', 'Back to the tour') : L('Frei erkunden', 'Explore freely'); $('#sprint').textContent = L('Sprinten', 'Sprint'); });
$('#sprint').textContent = L('Sprinten', 'Sprint'); $('#walk').textContent = L('Frei erkunden', 'Explore freely');

// jump straight to one of the Blender camera views with everything settled (for checks and stills)
let frozen = false;
function snapView(k) {
  const [p, t] = CAMS[k];
  frozen = true;
  clearShift(camera);
  camera.position.copy(B(...p)); P.copy(camera.position);
  lookLevel(camera, B(...t));
  const rk = roomAt(P);
  applyRoom(rk); stepEnv(10);
  const x = P.x, y = -P.z;
  setShadowMode(rk ? 'in' : 'out');
  chooseLamps(P, rk, true); stepLamps(0, performance.now() / 1000);
  renderer.toneMappingExposure = Math.pow(2, exposureAt(P));
  wind.uTime.value = performance.now() / 1000;
  renderFrame();
}
async function boot() {
  buildPath();
  fitCamera();
  const t0 = performance.now();
  await buildWorld();
  await step('Shader werden vorbereitet', 'Preparing shaders');
  camera.position.set(9, 25, 40); camera.lookAt(9, 0, -8);
  precompile();
  sCur = scrollToS();
  update(0);
  chooseLamps(P, roomAt(P), true);
  renderFrame();
  $('#load-bar').style.width = '100%';
  console.info('built in', Math.round(performance.now() - t0), 'ms');
  requestAnimationFrame(() => { loaderEl.classList.add('done'); loaderEl.setAttribute('aria-hidden', 'true'); });
  requestAnimationFrame(frame);
  window.lindenWorld = { scene, camera, renderer, renderFrame, ready: true, posCurve, tgtCurve, SEC, CP, CAMS, applyRoom, roomAt, door, setDoor, lookLevel, exposureAt, sun, pool, setShadowMode, M, update, snapView, stats, unfreeze: () => { frozen = false; } };
}
boot().catch((e) => { console.error(e); if (!loaderEl.classList.contains('failed')) fail(L('Der Rundgang konnte in diesem Browser nicht starten.', 'The tour could not start in this browser.')); });
