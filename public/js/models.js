import * as THREE from '../vendor/three.module.min.js';
export { THREE };

const mats = new Map();
export function mat(color, extra) {
  const key = extra ? color + ':' + JSON.stringify(extra) : color;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
    mats.set(key, m);
  }
  return m;
}

// Unit-sized shared geometries; meshes are sized through scale.
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  ball: new THREE.IcosahedronGeometry(0.5, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 7),
  // Triangular prism along x, apex up: 1 long, 1.5 high, 1.732 wide, base at y = -0.5.
  prism: (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2);
    g.rotateZ(Math.PI / 2);
    return g;
  })(),
  disc: (() => {
    const g = new THREE.CircleGeometry(1, 40);
    g.rotateX(-Math.PI / 2);
    return g;
  })(),
  torus: new THREE.TorusGeometry(2.2, 0.2, 8, 28),
};

export function part(geo, color, parent, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(GEO[geo], mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export const SPOTS_HEX = [0x2b2b2b, 0x7a4a2a, 0xd08a3c, 0x7d8794, 0xd9779b, 0x3f6fb5];
export const SPOT_CSS = SPOTS_HEX.map((c) => '#' + c.toString(16).padStart(6, '0'));

export function makeCow(spotIdx = 0) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const W = 0xfbf7ef;
  const S = SPOTS_HEX[spotIdx % SPOTS_HEX.length];
  const PINK = 0xf3a6b5;
  const DARK = 0x3a2e28;

  part('box', W, body, 0, 1.3, 0, 1.15, 1.0, 2.0);
  part('box', S, body, 0.33, 1.58, -0.4, 0.52, 0.48, 0.75);
  part('box', S, body, -0.35, 1.3, 0.35, 0.48, 0.55, 0.65);
  part('box', S, body, 0.05, 1.7, 0.6, 0.6, 0.22, 0.5);
  part('box', PINK, body, 0, 0.74, -0.45, 0.45, 0.2, 0.5);

  const head = new THREE.Group();
  head.position.set(0, 1.7, 1.15);
  body.add(head);
  part('box', W, head, 0, 0, 0.15, 0.8, 0.75, 0.75);
  part('box', S, head, 0.22, 0.14, 0.17, 0.4, 0.5, 0.74);
  part('box', PINK, head, 0, -0.17, 0.6, 0.62, 0.36, 0.3);
  part('box', DARK, head, -0.24, 0.12, 0.535, 0.1, 0.12, 0.04);
  part('box', DARK, head, 0.24, 0.12, 0.555, 0.1, 0.12, 0.04);
  part('box', 0xc97f90, head, -0.14, -0.14, 0.755, 0.08, 0.08, 0.02);
  part('box', 0xc97f90, head, 0.14, -0.14, 0.755, 0.08, 0.08, 0.02);
  part('box', S, head, -0.52, 0.22, 0, 0.3, 0.16, 0.12);
  part('box', S, head, 0.52, 0.22, 0, 0.3, 0.16, 0.12);
  part('cone', 0xeadfc8, head, -0.26, 0.5, 0, 0.14, 0.3, 0.14);
  part('cone', 0xeadfc8, head, 0.26, 0.5, 0, 0.14, 0.3, 0.14);

  const legs = [];
  for (const [lx, lz] of [[-0.38, 0.72], [0.38, 0.72], [-0.38, -0.72], [0.38, -0.72]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.85, lz);
    part('box', W, leg, 0, -0.38, 0, 0.27, 0.76, 0.27);
    part('box', DARK, leg, 0, -0.78, 0, 0.29, 0.16, 0.29);
    body.add(leg);
    legs.push(leg);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 1.7, -1.0);
  tail.rotation.x = 0.35;
  part('box', W, tail, 0, -0.35, 0, 0.08, 0.7, 0.08);
  part('box', S, tail, 0, -0.76, 0, 0.16, 0.2, 0.16);
  body.add(tail);

  const bell = new THREE.Group();
  part('box', 0xb8342b, bell, 0, 1.28, 1.02, 1.2, 0.12, 0.2);
  part('ball', 0xffc928, bell, 0, 1.0, 1.1, 0.36);
  bell.visible = false;
  body.add(bell);

  g.userData = { body, head, legs, tail, bell, phase: 0, seed: Math.random() * 10 };
  return g;
}

/** speed: 0..1, graze: 0..1 (head down), moo: 0..1 (head up). */
export function animateCow(cow, dt, t, speed, graze = 0, moo = 0) {
  const u = cow.userData;
  if (speed > 0.03) u.phase += dt * (7 + 7 * speed);
  const amp = Math.min(1, speed * 2) * 0.65;
  const sw = Math.sin(u.phase) * amp;
  u.legs[0].rotation.x = sw;
  u.legs[3].rotation.x = sw;
  u.legs[1].rotation.x = -sw;
  u.legs[2].rotation.x = -sw;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.08 * Math.min(1, speed * 2);
  u.tail.rotation.z = Math.sin(t * 3 + u.seed) * 0.35;
  u.head.rotation.x = graze * 0.95 - moo * 0.55 + Math.sin(t * 1.3 + u.seed) * 0.04;
  u.head.position.y = 1.7 - graze * 0.45;
}

export function makeQuadruped(o) {
  const { w, h, l, leg, color, snout, hs = 0.6 } = o;
  const g = new THREE.Group();
  const top = leg + h;
  part('box', color, g, 0, leg + h / 2, 0, w, h, l);
  const hd = new THREE.Group();
  hd.position.set(0, top - h * 0.2 + (o.neck || 0), l / 2 + hs * 0.3);
  g.add(hd);
  part('box', color, hd, 0, 0, 0, hs, hs, hs);
  if (snout) part('box', snout, hd, 0, -hs * 0.15, hs * 0.6, hs * 0.6, hs * 0.4, hs * 0.3);
  for (const s of [-1, 1]) {
    part('box', 0x222222, hd, s * hs * 0.28, hs * 0.15, hs * 0.51, 0.08, 0.1, 0.03);
    part('box', o.ear ?? color, hd, s * hs * 0.5, hs * 0.45, -hs * 0.1, hs * 0.3, hs * 0.35, hs * 0.12);
    if (o.horns) part('cone', 0xe8dcc0, hd, s * hs * 0.25, hs * 0.75, -hs * 0.2, 0.12, 0.45, 0.12).rotation.x = -0.4;
    for (const f of [-1, 1]) part('box', o.legColor ?? color, g, s * (w / 2 - 0.13), leg / 2, f * (l / 2 - 0.16), 0.22, leg, 0.22);
  }
  if (o.beard) part('box', 0xf2f2f2, hd, 0, -hs * 0.65, hs * 0.4, 0.14, 0.34, 0.1);
  part('box', color, g, 0, top - 0.12, -l / 2 - 0.12, 0.12, 0.12, 0.3);
  return g;
}

export function makeBird(color, s = 1, beak = 0xf2a23a, comb) {
  const g = new THREE.Group();
  const b = new THREE.Group();
  b.scale.setScalar(s);
  g.add(b);
  part('ball', color, b, 0, 0.6, 0, 0.8, 0.72, 1.0);
  part('ball', color, b, 0, 1.08, 0.35, 0.52);
  part('cone', beak, b, 0, 1.04, 0.68, 0.16, 0.28, 0.16).rotation.x = Math.PI / 2;
  part('box', 0x1c1c1c, b, -0.17, 1.14, 0.53, 0.06, 0.07, 0.04);
  part('box', 0x1c1c1c, b, 0.17, 1.14, 0.53, 0.06, 0.07, 0.04);
  part('box', color, b, 0, 0.82, -0.52, 0.3, 0.32, 0.3);
  if (comb) part('box', comb, b, 0, 1.38, 0.35, 0.08, 0.16, 0.28);
  part('box', beak, b, -0.15, 0.14, 0, 0.06, 0.28, 0.06);
  part('box', beak, b, 0.15, 0.14, 0, 0.06, 0.28, 0.06);
  return g;
}

export function makeFarmer() {
  const g = new THREE.Group();
  const BLUE = 0x3b5ba5, RED = 0xc94f3d, SKIN = 0xf1c7a0, STRAW = 0xe6c66a;
  part('box', BLUE, g, -0.22, 0.55, 0, 0.32, 1.1, 0.36);
  part('box', BLUE, g, 0.22, 0.55, 0, 0.32, 1.1, 0.36);
  part('box', 0x4a3426, g, -0.22, 0.08, 0.06, 0.34, 0.16, 0.5);
  part('box', 0x4a3426, g, 0.22, 0.08, 0.06, 0.34, 0.16, 0.5);
  part('box', BLUE, g, 0, 1.45, 0, 0.86, 0.7, 0.5);
  part('box', RED, g, 0, 1.98, 0, 0.88, 0.4, 0.52);
  part('box', RED, g, -0.56, 1.65, 0, 0.22, 0.95, 0.26);
  part('box', RED, g, 0.56, 1.65, 0, 0.22, 0.95, 0.26);
  part('ball', SKIN, g, -0.56, 1.1, 0, 0.26);
  part('ball', SKIN, g, 0.56, 1.1, 0, 0.26);
  part('ball', SKIN, g, 0, 2.52, 0, 0.66);
  part('box', 0x1c1c1c, g, -0.13, 2.56, 0.31, 0.07, 0.08, 0.04);
  part('box', 0x1c1c1c, g, 0.13, 2.56, 0.31, 0.07, 0.08, 0.04);
  part('ball', 0x9a9a9a, g, 0, 2.5, -0.18, 0.6);
  part('cyl', STRAW, g, 0, 2.8, 0, 1.25, 0.06, 1.25);
  part('cyl', STRAW, g, 0, 2.95, 0, 0.66, 0.3, 0.66);
  g.scale.setScalar(1.2);
  return g;
}

export function makeScarecrow() {
  const g = new THREE.Group();
  part('cyl', 0x7a5230, g, 0, 1.6, 0, 0.16, 3.2, 0.16);
  part('box', 0x7a5230, g, 0, 2.3, 0, 2.8, 0.14, 0.14);
  part('box', 0x5d7fb3, g, 0, 2.0, 0, 0.95, 1.1, 0.42);
  part('box', 0x8a5a3c, g, 0, 1.2, 0, 0.9, 0.6, 0.4);
  part('box', 0xe6c66a, g, -1.45, 2.3, 0, 0.3, 0.4, 0.3);
  part('box', 0xe6c66a, g, 1.45, 2.3, 0, 0.3, 0.4, 0.3);
  part('ball', 0xe8d2a0, g, 0, 3.0, 0, 0.78);
  part('box', 0x1c1c1c, g, -0.16, 3.06, 0.36, 0.1, 0.1, 0.05);
  part('box', 0x1c1c1c, g, 0.16, 3.06, 0.36, 0.1, 0.1, 0.05);
  part('box', 0xc94f3d, g, 0, 2.9, 0.38, 0.26, 0.05, 0.05);
  part('cyl', 0x6b4a2b, g, 0, 3.32, 0, 1.3, 0.06, 1.3);
  part('cone', 0x6b4a2b, g, 0, 3.7, 0, 0.75, 0.8, 0.75);
  return g;
}
