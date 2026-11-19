// Material library: the Blender scene's materials rebuilt on procedural maps (tex.js).
// userData.tile = metres per texture repeat, grain = wood runs along the long side of each face.
import * as T from 'three';
import { artTexture } from './tex.js';

export function makeMaterials(tg, { lite = false } = {}) {
  const M = {};
  const pbr = (name, recipe, o = {}) => {
    const t = tg.get(recipe, { hero: !!o.hero, strength: o.normal ?? 1 });
    const params = {
      name, color: new T.Color(...(o.tint || [1, 1, 1])), map: t.map, normalMap: t.normalMap,
      roughnessMap: o.roughConst !== undefined ? null : t.roughnessMap,
      roughness: o.roughConst !== undefined ? o.roughConst : (o.roughMul ?? 1), metalness: o.metal || 0,
    };
    const phys = o.coat || o.sheen || o.physical;
    const m = phys ? new T.MeshPhysicalMaterial(params) : new T.MeshStandardMaterial(params);
    if (o.coat) { m.clearcoat = o.coat; m.clearcoatRoughness = o.coatRough ?? 0.12; }
    if (o.sheen) { m.sheen = o.sheen; m.sheenRoughness = o.sheenRough ?? 0.6; m.sheenColor = new T.Color(...(o.sheenColor || o.tint || [1, 1, 1])).multiplyScalar(0.6); }
    if (o.side) m.side = o.side;
    m.userData = { tile: (o.tile ?? t.tile), grain: !!o.grain, uvRot: o.uvRot || 0, local: !!o.local };
    return m;
  };
  const flat = (name, color, o = {}) => {
    const params = { name, color: new T.Color(...color), roughness: o.rough ?? 0.5, metalness: o.metal || 0 };
    const phys = o.coat || o.transmission || o.sheen;
    const m = phys ? new T.MeshPhysicalMaterial(params) : new T.MeshStandardMaterial(params);
    if (o.coat) { m.clearcoat = o.coat; m.clearcoatRoughness = o.coatRough ?? 0.08; }
    if (o.emit) { m.emissive = new T.Color(...o.emit); m.emissiveIntensity = o.emitStrength ?? 1; m.userData.emissive = true; }
    if (o.side) m.side = o.side;
    m.userData = { ...m.userData, tile: 1 };
    return m;
  };
  // glass: reflections stay at full strength, the view through is only lightly tinted (premultiplied blend)
  const glass = (name, tint = [0.9, 0.95, 0.95], alpha = 0.1, rough = 0.03) => {
    const m = new T.MeshStandardMaterial({ name, color: new T.Color(0, 0, 0), roughness: rough, metalness: 0, transparent: true, opacity: alpha, premultipliedAlpha: true, side: T.DoubleSide, depthWrite: false });
    m.userData = { tile: 1, cast: false, noAO: true, glass: true, tint };
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <premultiplied_alpha_fragment>', `gl_FragColor.rgb += vec3(${tint.map((v) => (v * 0.03).toFixed(4)).join(', ')}) * (1.0 - gl_FragColor.a);`);
    };
    m.customProgramCacheKey = () => 'glass' + tint.join();
    return m;
  };

  // ---- exterior
  M.siding = pbr('Siding', 'siding', { tint: [0.03, 0.031, 0.034], roughMul: 1.0 });
  M.trim = flat('Trim', [0.022, 0.022, 0.024], { rough: 0.45 });
  M.door = pbr('DoorOak', 'veneer', { tint: [0.46, 0.29, 0.15], grain: true, coat: 0.2, tile: 1.1 });
  M.roof = pbr('RoofSeam', 'seam', { tint: [0.036, 0.038, 0.042], metal: 0.35 });
  M.cedar = pbr('Cedar', 'cedar', { tint: [1.0, 0.9, 0.82] });
  M.deck = pbr('Deck', 'cedar', { tint: [0.75, 0.68, 0.6], uvRot: Math.PI / 2 });
  M.granite = pbr('Granite', 'concrete', { tint: [0.5, 0.5, 0.5], tile: 2.4 });
  M.concrete = pbr('Concrete', 'concrete', { tint: [1.02, 1.0, 0.97] });
  M.paving = pbr('Paving', 'porcelain', { tint: [1.18, 1.12, 1.03], tile: 2.4 });
  M.drive = pbr('DrivePavers', 'pavers', { tint: [1.1, 1.1, 1.12] });
  M.pathStone = pbr('PathStone', 'sandstone', { tint: [1.12, 1.1, 1.06] });
  M.asphalt = pbr('Asphalt', 'asphalt', {});
  M.gravel = pbr('Gravel', 'gravel', { tint: [1.0, 0.98, 0.95] });
  M.black = flat('BlackFrame', [0.012, 0.012, 0.013], { rough: 0.35 });
  M.glass = glass('WinGlass', [0.85, 0.93, 0.95], 0.06, 0.02);
  M.glassDark = glass('DormerGlass', [0.5, 0.6, 0.65], 0.25, 0.02);
  M.wineGlass = glass('WineGlass', [1, 1, 1], 0.05, 0.01);
  M.showerGlass = glass('ShowerGlass', [0.9, 0.97, 0.97], 0.06, 0.01);
  M.soil = pbr('Soil', 'gravel', { tint: [0.22, 0.17, 0.12] });
  M.lawn = pbr('LawnTex', 'grass', { tint: [0.95, 1.0, 0.92], roughConst: 1.0 });
  M.lawn.envMapIntensity = 0.45;
  M.cushionGrey = pbr('PorchCushion', 'linen', { tint: [0.5, 0.51, 0.53], sheen: 0.4 });
  M.brass = pbr('Brass', 'brushed', { tint: [0.78, 0.56, 0.28], metal: 1, roughMul: 1.15 });
  M.garageIn = flat('GarageInside', [0.3, 0.29, 0.27], { rough: 0.9 });
  M.hedge = pbr('Hedge', 'hedge', { tint: [0.9, 0.95, 0.85], normal: 1.2 });
  M.hedge.envMapIntensity = 0.6;
  // ---- interior shell
  M.plaster = pbr('Plaster', 'stucco', { tint: [1.03, 1.01, 0.97], hero: true, normal: 1.1 });
  M.ceiling = pbr('Ceiling', 'stucco', { tint: [1.06, 1.05, 1.03], normal: 0.5, tile: 2.2 });
  M.limewash = pbr('Limewash', 'limewash', { tint: [0.74, 0.58, 0.45] });
  M.paint = flat('WhitePaint', [0.82, 0.81, 0.79], { rough: 0.42 });
  M.floor = pbr('OakFloor', 'planks', { tint: [1.0, 0.96, 0.9], hero: true, coat: 0.3, coatRough: 0.12 });
  M.floorWarm = pbr('OakFloorWarm', 'planks', { tint: [0.9, 0.78, 0.66], coat: 0.25, coatRough: 0.14, hero: true });
  M.floorDark = pbr('Herringbone', 'herring', { tint: [1.0, 0.95, 0.9], coat: 0.25, coatRough: 0.12, uvRot: Math.PI / 4, hero: true });
  M.bathFloor = pbr('PorcelainGrey', 'porcelain', { tint: [0.84, 0.85, 0.86], coat: 0.2 });
  M.stone = pbr('FieldStone', 'rock', { tint: [1.05, 1.02, 0.98], hero: true, normal: 1.2 });
  M.rock = pbr('RockWall', 'rock', { tint: [0.98, 0.96, 0.93], hero: true, normal: 1.2 });
  M.soot = flat('Soot', [0.02, 0.018, 0.017], { rough: 0.9 });
  M.charcoal = flat('Charcoal', [0.035, 0.036, 0.038], { rough: 0.48, coat: 0.1 });
  M.cupWhite = flat('CupWhite', [0.86, 0.85, 0.82], { rough: 0.15, coat: 0.6 });
  M.tea = flat('Tea', [0.16, 0.07, 0.02], { rough: 0.05, coat: 1.0 });
  M.fruitGreen = flat('FruitGreen', [0.35, 0.5, 0.12], { rough: 0.35, coat: 0.3 });
  M.fruitOrange = flat('FruitOrange', [0.75, 0.32, 0.04], { rough: 0.45, coat: 0.2 });
  M.candle = flat('Candle', [0.92, 0.9, 0.84], { rough: 0.5 });
  M.paper = flat('Paper', [0.82, 0.8, 0.74], { rough: 0.8 });
  M.garageFloor = pbr('GarageConcrete', 'concrete', { tint: [0.95, 0.95, 0.97], coat: 0.25, coatRough: 0.3 });
  M.garageWall = pbr('GarageWall', 'concrete', { tint: [0.72, 0.72, 0.73], tile: 2.6 });
  M.stainless = pbr('Stainless', 'brushed', { tint: [0.62, 0.63, 0.64], metal: 1 });
  M.steel = pbr('Steel', 'brushed', { tint: [0.55, 0.56, 0.57], metal: 1 });
  M.crateBlue = flat('CrateBlue', [0.08, 0.2, 0.42], { rough: 0.5 });
  M.cableOrange = flat('CableOrange', [0.8, 0.28, 0.03], { rough: 0.5 });
  M.pegboard = pbr('Pegboard', 'pegboard', {});
  M.chesterLeather = pbr('ChesterLeather', 'leather', { tint: [0.17, 0.085, 0.045], coat: 0.25, coatRough: 0.35 });
  M.benchVelvet = pbr('Velvet', 'linen', { tint: [0.11, 0.15, 0.085], sheen: 1.0, sheenRough: 0.45, sheenColor: [0.3, 0.38, 0.24] });
  M.toolYellow = flat('ToolYellow', [0.85, 0.6, 0.04], { rough: 0.4, coat: 0.3 });
  M.toolRed = flat('ToolRed', [0.6, 0.06, 0.04], { rough: 0.45, coat: 0.2 });
  M.toolBlue = flat('ToolBlue', [0.08, 0.2, 0.55], { rough: 0.45, coat: 0.2 });
  M.cardboard = flat('Cardboard', [0.55, 0.4, 0.24], { rough: 0.85 });
  M.binGreen = flat('BinGreen', [0.16, 0.3, 0.2], { rough: 0.55 });
  M.amber = flat('AmberGlass', [0.35, 0.16, 0.04], { rough: 0.08, coat: 1.0 });
  M.ledStrip = flat('LedStrip', [1, 1, 1], { rough: 0.3, emit: [1.0, 0.94, 0.85], emitStrength: 2.5 });
  M.mirrorGlow = flat('MirrorGlow', [1, 1, 1], { rough: 0.3, emit: [1.0, 0.85, 0.62], emitStrength: 3 });
  M.oak = pbr('Oak', 'veneer', { tint: [0.6, 0.38, 0.19], grain: true, coat: 0.1, coatRough: 0.3 });
  M.walnut = pbr('Walnut', 'veneer', { tint: [0.2, 0.115, 0.065], grain: true, coat: 0.15, coatRough: 0.25, tile: 0.9 });
  M.marble = pbr('Marble', 'marble', { hero: true, coat: 0.5, coatRough: 0.06 });
  M.blackMarble = pbr('BlackMarble', 'marble', { tint: [0.07, 0.07, 0.075], coat: 0.5, coatRough: 0.06 });
  M.travertine = pbr('Travertine', 'travertine', { tint: [1.0, 0.98, 0.95], hero: true });
  M.bark = pbr('Bark', 'bark', { tint: [0.62, 0.56, 0.5] });
  M.bark.envMapIntensity = 0.5;
  M.blackMetal = flat('BlackMetal', [0.02, 0.02, 0.022], { rough: 0.35, metal: 0.6 });
  M.ceramic = flat('Ceramic', [0.82, 0.8, 0.76], { rough: 0.25, coat: 0.5 });
  M.stoneware = pbr('Stoneware', 'concrete', { tint: [0.95, 0.88, 0.78], tile: 0.4, roughMul: 0.9 });
  M.creamEnamel = flat('CreamEnamel', [0.82, 0.76, 0.62], { rough: 0.2, coat: 0.6 });
  M.potRed = flat('EnamelRed', [0.45, 0.06, 0.04], { rough: 0.25, coat: 0.6 });
  M.porcelain = flat('Porcelain', [0.9, 0.89, 0.87], { rough: 0.08, coat: 1.0 });
  M.mirror = flat('Mirror', [0.95, 0.95, 0.95], { rough: 0.02, metal: 1.0 });
  M.screen = flat('Screen', [0.005, 0.005, 0.006], { rough: 0.05, coat: 1.0 });
  M.bulb = flat('Bulb', [1, 1, 1], { rough: 0.3, emit: [1.0, 0.82, 0.6], emitStrength: 6 });
  M.shade = flat('Shade', [0.92, 0.86, 0.72], { rough: 0.9, emit: [1.0, 0.78, 0.5], emitStrength: 0.5, side: T.DoubleSide });
  M.stain = flat('Stain', [0.18, 0.18, 0.18], { rough: 0.25 });
  // ---- textiles
  const fab = (name, tint, o = {}) => pbr(name, o.recipe || 'linen', { tint, sheen: o.sheen ?? 0.5, sheenRough: 0.7, ...o });
  M.linen = fab('Linen', [0.88, 0.85, 0.79]);
  M.linenWhite = fab('LinenWhite', [0.93, 0.92, 0.89]);
  M.linenOat = fab('LinenOat', [0.72, 0.64, 0.52]);
  M.linenRust = fab('LinenRust', [0.6, 0.3, 0.2]);
  M.woolRust = fab('WoolRust', [0.58, 0.28, 0.18], { recipe: 'knit', sheen: 0.8 });
  M.linenGrey = fab('LinenGrey', [0.3, 0.31, 0.33]);
  M.velvet = fab('VelvetMoss', [0.13, 0.17, 0.09], { sheen: 1.0, sheenColor: [0.3, 0.38, 0.24] });
  M.knit = fab('Knit', [0.93, 0.92, 0.9], { recipe: 'knit', sheen: 0.8 });
  M.towel = fab('Towel', [0.92, 0.9, 0.86], { recipe: 'knit', sheen: 0.5 });
  M.duvet = fab('Duvet', [0.93, 0.92, 0.89], { side: T.DoubleSide });
  M.knitThrow = fab('KnitThrow', [0.9, 0.88, 0.84], { recipe: 'knit', sheen: 0.8, side: T.DoubleSide });
  M.rug = pbr('Rug', 'rug', { tint: [1.0, 0.98, 0.95] });
  M.leather = pbr('Leather', 'leather', { tint: [0.22, 0.12, 0.06], coat: 0.2, coatRough: 0.4 });
  M.leatherBlack = pbr('LeatherBlack', 'leather', { tint: [0.035, 0.033, 0.032], coat: 0.25, coatRough: 0.35 });
  M.sheer = new T.MeshStandardMaterial({ name: 'Sheer', color: new T.Color(0.92, 0.9, 0.86), roughness: 0.95, transparent: true, opacity: 0.72, side: T.DoubleSide, depthWrite: false });
  M.sheer.userData = { tile: 1, cast: false, noAO: true };
  // ---- art (generated on canvases)
  const art = (name, kind, seed) => { const m = new T.MeshStandardMaterial({ name, map: artTexture(kind, 512, 640, seed), roughness: 0.82 }); m.userData = { tile: 1 }; return m; };
  M.art = art('Art', 'washes', 2);
  M.art2 = art('Art2', 'circles', 5);
  M.art3 = art('Art3', 'grid', 11);
  M.art4 = art('Art4', 'petals', 7);
  // ---- pool
  M.poolShell = pbr('PoolShell', 'porcelain', { tint: [0.72, 1.0, 1.08], tile: 0.6, coat: 0.3 });
  M.poolFloor = pbr('PoolFloor', 'porcelain', { tint: [0.68, 0.96, 1.04], tile: 0.6 });
  M.tb0 = flat('TableBook0', [0.12, 0.16, 0.22], { rough: 0.6 });
  M.tb1 = flat('TableBook1', [0.75, 0.72, 0.64], { rough: 0.6 });
  M.tb2 = flat('TableBook2', [0.55, 0.32, 0.2], { rough: 0.6 });
  const BOOKS = [[0.06, 0.08, 0.13], [0.3, 0.08, 0.06], [0.35, 0.22, 0.1], [0.55, 0.5, 0.42], [0.08, 0.16, 0.1],
    [0.03, 0.03, 0.035], [0.22, 0.16, 0.11], [0.42, 0.33, 0.22], [0.16, 0.05, 0.05], [0.28, 0.27, 0.25]].map((c, i) => flat('Book' + i, c, { rough: 0.6 }));
  for (const m of [M.glass, M.glassDark, M.wineGlass, M.showerGlass, M.bulb, M.ledStrip, M.mirrorGlow]) m.userData.cast = false;
  M.shade.userData.cast = true;
  return { M, BOOKS };
}
