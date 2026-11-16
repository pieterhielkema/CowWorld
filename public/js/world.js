import { THREE, GEO, mat, part, makeBird } from './models.js';

/** Playable half-extent of the farm. */
export const BOUND = 116;
/** Half-extent drawn on the minimap. */
export const MAP = 125;

export const P = {
  spawn: { x: 0, z: 16 },
  barn: { x: 0, z: -8 },
  coop: { x: -46, z: -6 },
  pond: { x: 52, z: 28, r: 17 },
  mud: { x: -34, z: 42, r: 6 },
  meadow: { x: 20, z: 50 },
  shed: { x: 30, z: -18 },
  windmill: { x: 86, z: 80 },
  stones: { x: 98, z: -98 },
  corn: { x0: -94, x1: -54, z0: -84, z1: -44 },
  orchard: { x0: 28, x1: 88, z0: -76, z1: -40 },
  forest: { x0: -114, x1: -58, z0: 18, z1: 112 },
};

/** Fixed positions for quest things, shared by world generation (to keep them clear) and quests. */
export const SPOTS = {
  clover: [[14, 44], [24, 42], [30, 50], [26, 58], [16, 58], [10, 51]],
  chicks: [[-84, 4], [-20, -56], [62, -22], [-6, 84]],
  crows: [[-90, -78], [-78, -70], [-66, -80], [-86, -56], [-70, -52], [-58, -64]],
  bales: [[-6, -30], [6, -37], [14, -28]],
  mushrooms: [[-70, 34], [-96, 50], [-80, 72], [-104, 92], [-66, 102]],
};

const PATHS = [
  { x0: -2.5, z0: -2, x1: 2.5, z1: 70 },
  { x0: -76, z0: 8, x1: 40, z1: 12 },
  { x0: 16, z0: -34, x1: 20, z1: 8 },
  { x0: -76, z0: -40, x1: -72, z1: 8 },
  { x0: -30, z0: 12, x1: -26, z1: 36 },
  { x0: 2.5, z0: 66, x1: 78, z1: 70 },
];

// Areas where random scenery must not grow: [x, z, radius]
const ZONES = [
  [0, -8, 13], [0, 16, 7], [-46, -2, 11], [-34, 42, 13], [52, 28, 29], [20, 50, 15],
  [30, -18, 9], [4, -34, 17], [86, 80, 10], [98, -98, 10], [-74, -40, 6], [30, 5, 4], [78, 73, 4],
  ...SPOTS.chicks.map(([x, z]) => [x, z, 4]),
];
const RECTS = [P.corn, P.orchard, P.forest, ...PATHS];

function blocked(x, z, pad) {
  for (const [zx, zz, r] of ZONES) if (Math.hypot(x - zx, z - zz) < r + pad) return true;
  for (const r of RECTS) if (x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) return true;
  return false;
}

export const inPond = (x, z) => Math.hypot(x - P.pond.x, z - P.pond.z) < P.pond.r - 0.8;
export const inMud = (x, z) => Math.hypot(x - P.mud.x, z - P.mud.z) < P.mud.r;

/** Static obstacles. circles: {x,z,r}; boxes: {x0,x1,z0,z1}. */
export const col = { circles: [], boxes: [] };

/** Pushes the circle (p.x, p.z, r) out of every static obstacle. */
export function resolve(p, r) {
  for (const c of col.circles) {
    const dx = p.x - c.x, dz = p.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.001;
      p.x = c.x + (dx / d) * rr;
      p.z = c.z + (dz / d) * rr;
    }
  }
  for (const b of col.boxes) {
    const cx = Math.max(b.x0, Math.min(b.x1, p.x)), cz = Math.max(b.z0, Math.min(b.z1, p.z));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.z = cz + (dz / d) * r;
    } else {
      const l = p.x - b.x0, rt = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rt, t, bt);
      if (m === l) p.x = b.x0 - r;
      else if (m === rt) p.x = b.x1 + r;
      else if (m === t) p.z = b.z0 - r;
      else p.z = b.z1 + r;
    }
  }
}

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Collects static scenery and renders each geometry+colour pair as one InstancedMesh. */
class Batch {
  constructor(castShadow) {
    this.castShadow = castShadow;
    this.groups = new Map();
    this.d = new THREE.Object3D();
  }
  add(geo, color, x, y, z, sx, sy = sx, sz = sx, ry = 0) {
    const key = geo + ':' + color;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { geo, color, m: [] }));
    const d = this.d;
    d.position.set(x, y, z);
    d.scale.set(sx, sy, sz);
    d.rotation.set(0, ry, 0);
    d.updateMatrix();
    g.m.push(d.matrix.clone());
  }
  build(scene) {
    for (const g of this.groups.values()) {
      const im = new THREE.InstancedMesh(GEO[g.geo], mat(g.color), g.m.length);
      g.m.forEach((mx, i) => im.setMatrixAt(i, mx));
      im.castShadow = this.castShadow;
      im.receiveShadow = true;
      im.frustumCulled = false;
      scene.add(im);
    }
  }
}

function pine(b, x, z, s) {
  b.add('cyl', 0x7a5230, x, 1 * s, z, 0.7 * s, 2 * s, 0.7 * s);
  b.add('cone', 0x2f7d3b, x, 3.2 * s, z, 4 * s, 3.4 * s, 4 * s);
  b.add('cone', 0x37904a, x, 5 * s, z, 3 * s, 3 * s, 3 * s);
  b.add('cone', 0x3fa055, x, 6.5 * s, z, 2 * s, 2.4 * s, 2 * s);
}

function oak(b, x, z, s) {
  b.add('cyl', 0x7a5230, x, 1.4 * s, z, 0.8 * s, 2.8 * s, 0.8 * s);
  b.add('ball', 0x4c9a3c, x, 4.3 * s, z, 4.6 * s, 3.8 * s, 4.6 * s);
  b.add('ball', 0x5aad48, x + 1.1 * s, 5.3 * s, z + 0.4 * s, 2.6 * s);
  b.add('ball', 0x448c36, x - 1.2 * s, 4.0 * s, z - 0.5 * s, 2.8 * s);
}

function house(scene, x, z, w, h, d, wall, roof) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  part('box', wall, g, 0, h / 2, 0, w, h, d);
  const rh = h * 0.6;
  part('prism', roof, g, 0, h + rh / 3, 0, d + 0.8, rh / 1.5, (w + 1.6) / 1.732).rotation.y = Math.PI / 2;
  col.boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  scene.add(g);
  return g;
}

export function buildWorld(scene) {
  const solid = new Batch(true);
  const deco = new Batch(false);
  const R = rng(1337);
  const flat = (r, color, y) => deco.add('box', color, (r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.02, r.z1 - r.z0);

  // --- ground ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), mat(0x79c257));
  ground.receiveShadow = true;
  scene.add(ground);
  const greens = [0x84cc5e, 0x70ba50, 0x8dd166];
  for (let i = 0; i < 30; i++) {
    deco.add('disc', greens[i % 3], (R() * 2 - 1) * 120, 0.02 + i * 0.002, (R() * 2 - 1) * 120, 5 + R() * 9, 1, 5 + R() * 9);
  }
  flat(P.forest, 0x69b04c, 0.09);
  flat(P.corn, 0x9a7446, 0.09);
  for (const p of PATHS) flat(p, 0xdcc08a, 0.1);

  // --- barn ---
  const barn = house(scene, P.barn.x, P.barn.z, 16, 7, 12, 0xc0392b, 0x7b2a22);
  part('box', 0x5a2d22, barn, 0, 2.3, 6.03, 4.6, 4.6, 0.1);
  part('box', 0xf5efe0, barn, 0, 4.75, 6.05, 5.2, 0.3, 0.12);
  part('box', 0xf5efe0, barn, -2.45, 2.3, 6.05, 0.3, 4.6, 0.12);
  part('box', 0xf5efe0, barn, 2.45, 2.3, 6.05, 0.3, 4.6, 0.12);
  part('box', 0xf5efe0, barn, 0, 2.3, 6.1, 6.2, 0.25, 0.1).rotation.z = Math.PI / 4;
  part('box', 0xf5efe0, barn, 0, 2.3, 6.1, 6.2, 0.25, 0.1).rotation.z = -Math.PI / 4;
  part('box', 0xf5efe0, barn, 0, 8.4, 6.25, 1.6, 1.6, 0.3);
  part('box', 0x3a2e28, barn, 0, 8.4, 6.3, 1.1, 1.1, 0.3);
  // haystacks and a well by the barn
  for (const [x, z, s] of [[11.5, -3, 1], [13.5, -6, 0.75]]) {
    solid.add('cone', 0xe2c15a, x, 1.4 * s, z, 3.4 * s, 2.8 * s, 3.4 * s);
    col.circles.push({ x, z, r: 1.5 * s });
  }
  solid.add('cyl', 0x9a9a9a, -11, 0.6, 5, 2.4, 1.2, 2.4);
  solid.add('cyl', 0x3f7fbf, -11, 1.16, 5, 1.9, 0.1, 1.9);
  solid.add('cyl', 0x7a5230, -12.1, 1.6, 5, 0.2, 3.2, 0.2);
  solid.add('cyl', 0x7a5230, -9.9, 1.6, 5, 0.2, 3.2, 0.2);
  solid.add('cone', 0x8a4b32, -11, 3.7, 5, 3.4, 1.4, 3.4);
  col.circles.push({ x: -11, z: 5, r: 1.5 });

  // --- chicken coop ---
  const coop = house(scene, P.coop.x, P.coop.z, 7, 3.6, 5, 0xe9d8a6, 0xa8443a);
  part('box', 0x4a3426, coop, 0, 0.9, 2.53, 1.3, 1.8, 0.1);
  part('box', 0x8a5a3c, coop, 0, 0.15, 3.6, 1.3, 0.12, 2.2).rotation.x = 0.12;

  // --- hay shelter (bale quest target) ---
  const shed = new THREE.Group();
  shed.position.set(P.shed.x, 0, P.shed.z);
  part('box', 0xcaa46a, shed, 0, 0.1, 0, 10, 0.06, 7.4);
  part('box', 0x8a5a3c, shed, 0, 1.6, -3.9, 10.4, 3.2, 0.4);
  part('box', 0x8a5a3c, shed, -5, 1.1, -2, 0.4, 2.2, 3.6);
  part('box', 0x8a5a3c, shed, 5, 1.1, -2, 0.4, 2.2, 3.6);
  part('prism', 0xa8443a, shed, 0, 3.2 + 0.33, -3.6, 10.8, 1 / 1.5, 2.4 / 1.732);
  scene.add(shed);
  col.boxes.push(
    { x0: P.shed.x - 5.2, x1: P.shed.x + 5.2, z0: P.shed.z - 4.1, z1: P.shed.z - 3.7 },
    { x0: P.shed.x - 5.2, x1: P.shed.x - 4.8, z0: P.shed.z - 3.8, z1: P.shed.z - 0.2 },
    { x0: P.shed.x + 4.8, x1: P.shed.x + 5.2, z0: P.shed.z - 3.8, z1: P.shed.z - 0.2 },
  );

  // --- windmill ---
  const mill = new THREE.Group();
  mill.position.set(P.windmill.x, 0, P.windmill.z);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 3.1, 11, 8), mat(0xf1e6cf));
  tower.position.y = 5.5;
  tower.castShadow = tower.receiveShadow = true;
  mill.add(tower);
  part('cone', 0xa8443a, mill, 0, 12.4, 0, 4.8, 2.8, 4.8);
  part('box', 0x5a2d22, mill, 0, 1.2, 3.0, 1.4, 2.4, 0.3);
  const blades = new THREE.Group();
  blades.position.set(0, 9.6, 2.7);
  part('cyl', 0x5a2d22, blades, 0, 0, 0, 0.7, 0.6, 0.7).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    part('box', 0x7a5230, arm, 0, 3.4, 0, 0.18, 6.8, 0.12);
    part('box', 0xf5efe0, arm, 0.55, 4.2, 0, 1.0, 4.8, 0.06);
    blades.add(arm);
  }
  mill.add(blades);
  scene.add(mill);
  col.circles.push({ x: P.windmill.x, z: P.windmill.z, r: 3.5 });

  // --- pond ---
  deco.add('disc', 0xe6d7a3, P.pond.x, 0.11, P.pond.z, P.pond.r + 2, 1, P.pond.r + 2);
  deco.add('disc', 0x4aa3df, P.pond.x, 0.14, P.pond.z, P.pond.r, 1, P.pond.r);
  deco.add('disc', 0x6bb8e8, P.pond.x - 3, 0.15, P.pond.z + 2, P.pond.r * 0.55, 1, P.pond.r * 0.45);
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2, d = 4 + R() * 10;
    deco.add('disc', 0x4f9f58, P.pond.x + Math.cos(a) * d, 0.17, P.pond.z + Math.sin(a) * d, 0.7 + R() * 0.5, 1, 0.7 + R() * 0.5);
  }
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, d = P.pond.r + 0.3 + R() * 1.6;
    const x = P.pond.x + Math.cos(a) * d, z = P.pond.z + Math.sin(a) * d, h = 1.6 + R();
    solid.add('cyl', 0x5d8f3a, x, h / 2, z, 0.12, h, 0.12);
    solid.add('cyl', 0x6b4a2b, x, h, z, 0.22, 0.5, 0.22);
  }

  // --- mud pit + pig pen ---
  deco.add('disc', 0x7a5a3a, P.mud.x, 0.12, P.mud.z, P.mud.r, 1, P.mud.r);
  deco.add('disc', 0x8a6a45, P.mud.x + 1, 0.13, P.mud.z - 1, P.mud.r * 0.5, 1, P.mud.r * 0.4);
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.6)), horiz = z0 === z1;
    for (let i = 0; i <= n; i++) solid.add('box', 0x8f6a42, x0 + ((x1 - x0) * i) / n, 0.65, z0 + ((z1 - z0) * i) / n, 0.26, 1.3, 0.26);
    for (const y of [0.5, 1.0]) solid.add('box', 0xb08a5a, (x0 + x1) / 2, y, (z0 + z1) / 2, horiz ? len : 0.12, 0.14, horiz ? 0.12 : len);
    col.boxes.push({ x0: Math.min(x0, x1) - 0.15, x1: Math.max(x0, x1) + 0.15, z0: Math.min(z0, z1) - 0.15, z1: Math.max(z0, z1) + 0.15 });
  };
  fence(-45, 31, -45, 53);
  fence(-45, 53, -23, 53);
  fence(-45, 31, -33, 31);

  // --- corn field ---
  fence(-94, -43, -80, -43);
  fence(-68, -43, -54, -43);
  for (let x = P.corn.x0 + 2; x < P.corn.x1; x += 4) {
    for (let z = P.corn.z0 + 2; z < P.corn.z1 - 1; z += 2.2) {
      const h = 2.4 + R() * 0.8, jx = x + (R() - 0.5) * 0.5;
      solid.add('cyl', 0x6aa84f, jx, h / 2, z, 0.26, h, 0.26);
      solid.add('cone', 0x7cbf5a, jx, h * 0.8, z, 1.2, 1.3, 1.2);
      solid.add('ball', 0xf2d04a, jx + 0.28, h * 0.55, z, 0.34, 0.7, 0.34);
    }
  }

  // --- orchard ---
  fence(27, -76, 27, -62);
  fence(27, -52, 27, -39);
  fence(27, -39, 50, -39);
  fence(60, -39, 88, -39);
  const appleTrees = [];
  for (let x = 34; x <= 82; x += 12) {
    for (let z = -70; z <= -46; z += 12) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      part('cyl', 0x7a5230, g, 0, 1.4, 0, 0.8, 2.8, 0.8);
      const crown = new THREE.Group();
      crown.position.y = 2.6;
      g.add(crown);
      part('ball', 0x4c9a3c, crown, 0, 1.8, 0, 4.8, 3.8, 4.8);
      part('ball', 0x5aad48, crown, 1.2, 2.7, 0.5, 2.6);
      part('ball', 0x448c36, crown, -1.3, 1.5, -0.6, 2.8);
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + R(), el = 0.2 + R() * 0.9;
        part('ball', 0xd8342b, crown, Math.cos(a) * 2.3 * Math.cos(el), 1.8 + Math.sin(el) * 1.85, Math.sin(a) * 2.3 * Math.cos(el), 0.42);
      }
      scene.add(g);
      col.circles.push({ x, z, r: 0.8 });
      appleTrees.push({ x, z, crown, cd: 0, shake: 0 });
    }
  }

  // --- stone circle ---
  deco.add('disc', 0xb9c2a0, P.stones.x, 0.1, P.stones.z, 7, 1, 7);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.39, x = P.stones.x + Math.cos(a) * 5.5, z = P.stones.z + Math.sin(a) * 5.5;
    solid.add('box', i % 2 ? 0x8f9499 : 0xa3a8ad, x, 1.5, z, 1.3, 3 + (i % 3) * 0.5, 1.0, -a);
    col.circles.push({ x, z, r: 0.85 });
  }
  solid.add('cyl', 0x9a9fa5, P.stones.x, 0.3, P.stones.z, 2.2, 0.6, 2.2);

  // --- forest ---
  const placed = [];
  for (let tries = 0; placed.length < 90 && tries < 4000; tries++) {
    const x = P.forest.x0 + 2 + R() * (P.forest.x1 - P.forest.x0 - 4), z = P.forest.z0 + 2 + R() * (P.forest.z1 - P.forest.z0 - 4);
    if (SPOTS.mushrooms.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 5)) continue;
    if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 5.4)) continue;
    placed.push([x, z]);
    (R() < 0.8 ? pine : oak)(solid, x, z, 0.9 + R() * 0.5);
    col.circles.push({ x, z, r: 0.75 });
  }

  // --- scattered trees, bushes, rocks ---
  for (let n = 0, tries = 0; n < 30 && tries < 3000; tries++) {
    const x = (R() * 2 - 1) * 110, z = (R() * 2 - 1) * 110;
    if (blocked(x, z, 4)) continue;
    (R() < 0.4 ? pine : oak)(solid, x, z, 0.9 + R() * 0.5);
    col.circles.push({ x, z, r: 0.8 });
    n++;
  }
  for (let n = 0, tries = 0; n < 36 && tries < 3000; tries++) {
    const x = (R() * 2 - 1) * 112, z = (R() * 2 - 1) * 112;
    if (blocked(x, z, 2)) continue;
    if (n % 2) {
      const s = 0.8 + R() * 0.9;
      solid.add('ball', 0x9a9fa5, x, 0.35 * s, z, 1.6 * s, 1.0 * s, 1.3 * s, R() * 3);
      col.circles.push({ x, z, r: 0.7 * s });
    } else {
      solid.add('ball', 0x3f9447, x, 0.6, z, 2.0, 1.5, 2.0);
      solid.add('ball', 0x4fa656, x + 0.7, 0.5, z + 0.3, 1.3);
      col.circles.push({ x, z, r: 0.9 });
    }
    n++;
  }

  // --- tree wall around the farm ---
  for (let i = -132; i <= 132; i += 4.5) {
    for (const row of [121, 127, 133]) {
      for (const side of [0, 1, 2, 3]) {
        const along = i + (R() - 0.5) * 3, off = row + (R() - 0.5) * 3, s = 1.1 + R() * 0.6;
        const x = side === 0 ? along : side === 1 ? along : side === 2 ? -off : off;
        const z = side === 0 ? -off : side === 1 ? off : along;
        (R() < 0.6 ? pine : oak)(solid, x, z, s);
      }
    }
  }

  // --- grass tufts and flowers ---
  const petals = [0xffffff, 0xffe066, 0xf6a5c8, 0xc9a0ff, 0xff8f6b];
  for (let i = 0; i < 1500; i++) {
    const x = (R() * 2 - 1) * 119, z = (R() * 2 - 1) * 119;
    if (inPond(x, z) || inMud(x, z) || blocked(x, z, -1.5) && !inForest(x, z)) continue;
    if (i % 4 === 0) {
      deco.add('cyl', 0x4f9f3f, x, 0.2, z, 0.06, 0.4, 0.06);
      deco.add('ball', petals[i % 5], x, 0.45, z, 0.28, 0.2, 0.28);
    } else {
      deco.add('cone', i % 3 ? 0x5fae45 : 0x8fd368, x, 0.25, z, 0.35, 0.5 + R() * 0.3, 0.35);
    }
  }

  solid.build(scene);
  deco.build(scene);

  // --- wandering hens ---
  const hens = [];
  for (let i = 0; i < 5; i++) {
    const mesh = makeBird(i % 2 ? 0xfdfdfd : 0xb5713a, 0.85, 0xf2a23a, 0xd8342b);
    const h = { mesh, x: P.coop.x + (R() - 0.5) * 12, z: P.coop.z + 7 + R() * 6, tx: 0, tz: 0, wait: R() * 3 };
    h.tx = h.x;
    h.tz = h.z;
    mesh.position.set(h.x, 0, h.z);
    scene.add(mesh);
    hens.push(h);
  }

  return {
    appleTrees,
    update(dt, t) {
      blades.rotation.z -= dt * 0.7;
      for (const h of hens) {
        const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz);
        if (d < 0.2) {
          h.wait -= dt;
          h.mesh.rotation.x = Math.max(0, Math.sin(t * 5 + h.tx)) * 0.5;
          if (h.wait <= 0) {
            h.wait = 1 + Math.random() * 4;
            h.tx = P.coop.x + (Math.random() - 0.5) * 16;
            h.tz = P.coop.z + 5 + Math.random() * 9;
          }
        } else {
          h.x += (dx / d) * 2.2 * dt;
          h.z += (dz / d) * 2.2 * dt;
          h.mesh.rotation.x = 0;
          h.mesh.rotation.y = Math.atan2(dx, dz);
          h.mesh.position.set(h.x, Math.abs(Math.sin(t * 12 + h.tx)) * 0.12, h.z);
        }
      }
    },
  };
}

function inForest(x, z) {
  const f = P.forest;
  return x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1;
}

/** Paints the static part of the minimap onto a size×size canvas context. */
export function drawMapBase(c, size) {
  const k = size / (MAP * 2), f = (v) => (v + MAP) * k;
  const rect = (r, color) => {
    c.fillStyle = color;
    c.fillRect(f(r.x0), f(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
  };
  const disc = (x, z, r, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(f(x), f(z), r * k, 0, Math.PI * 2);
    c.fill();
  };
  c.fillStyle = '#3f8a45';
  c.fillRect(0, 0, size, size);
  rect({ x0: -BOUND - 2, x1: BOUND + 2, z0: -BOUND - 2, z1: BOUND + 2 }, '#7cc45a');
  rect(P.forest, '#4f9f4a');
  rect(P.corn, '#d8c35a');
  rect(P.orchard, '#63b04f');
  for (const p of PATHS) rect(p, '#dcc08a');
  disc(P.pond.x, P.pond.z, P.pond.r, '#4aa3df');
  disc(P.mud.x, P.mud.z, P.mud.r, '#7a5a3a');
  disc(P.stones.x, P.stones.z, 6, '#a3a8ad');
  disc(P.windmill.x, P.windmill.z, 4, '#f1e6cf');
  rect({ x0: -8, x1: 8, z0: -14, z1: -2 }, '#c0392b');
  rect({ x0: P.coop.x - 4, x1: P.coop.x + 4, z0: P.coop.z - 3, z1: P.coop.z + 3 }, '#e9d8a6');
  rect({ x0: P.shed.x - 5, x1: P.shed.x + 5, z0: P.shed.z - 4, z1: P.shed.z + 3 }, '#8a5a3c');
}
