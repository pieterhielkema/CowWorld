import { THREE, makeCow, animateCow, SPOT_CSS } from './models.js';
import { buildWorld, resolve, BOUND, MAP, P, inPond, inMud, drawMapBase } from './world.js';
import { Quests, QUESTS } from './quests.js';
import { ui } from './ui.js';
import { audio } from './audio.js';
import { Net } from './net.js';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'cowworld.me';
const WALK = 8.5;
const RUN = 13;
const MOO_CD = 0.6;
const GRAZE_T = 0.7;
const STICK_R = 50;
const MM = 180;

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (k, dt) => 1 - Math.exp(-k * dt);
const pitchFor = (color) => 0.85 + (color | 0) * 0.07;
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- renderer, scene, camera, lights ----------

// Touch mode: on from the start for phones/tablets, and switched on by the first real touch elsewhere.
const coarse = window.matchMedia('(pointer: coarse)').matches;
function setTouch() {
  if (ui.touch) return;
  ui.touch = true;
  document.body.classList.add('touch');
}
if (coarse) setTouch();
window.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && setTouch(), true);

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Phones have dense screens and weak GPUs: render fewer pixels and a smaller shadow map.
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8f5);
scene.fog = new THREE.Fog(0x9fd8f5, 90, 230);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 420);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9bbf7a, 1.5));
const sun = new THREE.DirectionalLight(0xfff1d0, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);

function fit() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', fit);
// iOS reports the old size for a moment after rotating.
window.addEventListener('orientationchange', () => setTimeout(fit, 300));

// ---------- world, player, quests ----------

const world = buildWorld(scene);

const me = { x: P.spawn.x, z: P.spawn.z, r: 0, y: 0, speed: 0, grazeT: 0, mooT: 0, name: 'Cow', color: 0, joined: false };

try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY));
  if (saved) {
    if (typeof saved.name === 'string') me.name = saved.name.trim().slice(0, 16) || 'Cow';
    if (Number.isInteger(saved.color) && saved.color >= 0 && saved.color < SPOT_CSS.length) me.color = saved.color;
  }
} catch {}

let cow = makeCow(me.color);
scene.add(cow);
const myLabel = ui.label(me.name, 'me');

const remotes = new Map();
let online = false;

const quests = new Quests({
  scene,
  me,
  ui,
  audio,
  appleTrees: world.appleTrees,
  onChange() {
    renderQuestLog();
    renderScoreboard();
    net.send({ t: 'stat', q: quests.stars, bell: quests.bell });
  },
});

const npcLabels = quests.npcs.map((n) => ({ npc: n, label: ui.label(n.name, 'npc') }));

function renderQuestLog() {
  ui.renderQuests(quests.stars, QUESTS.length, quests.log());
}

function renderScoreboard() {
  const rows = [{ name: me.name, css: SPOT_CSS[me.color], q: quests.stars, bell: quests.bell, me: true }];
  for (const p of remotes.values()) rows.push({ name: p.name, css: SPOT_CSS[p.color] || SPOT_CSS[0], q: p.q, bell: p.bell, me: false });
  rows.sort((a, b) => b.q - a.q);
  ui.renderPlayers(online, rows);
}

// ---------- remote cows ----------

const remoteText = (p) => (p.q ? `★${p.q} ${p.name}` : p.name);

function addRemote(d) {
  removeRemote(d.id);
  const color = Number.isInteger(d.color) ? d.color : 0;
  const p = {
    id: d.id,
    name: String(d.name || 'Cow'),
    color,
    q: d.q | 0,
    bell: !!d.bell,
    x: +d.x || 0,
    z: +d.z || 0,
    r: +d.r || 0,
    y: 0,
    tx: +d.x || 0,
    tz: +d.z || 0,
    tr: +d.r || 0,
    moving: false,
    mooT: 0,
    cow: makeCow(color),
    label: null,
  };
  p.label = ui.label(remoteText(p));
  p.cow.position.set(p.x, 0, p.z);
  p.cow.rotation.y = p.r;
  scene.add(p.cow);
  remotes.set(p.id, p);
  return p;
}

function removeRemote(id) {
  const p = remotes.get(id);
  if (!p) return;
  scene.remove(p.cow);
  p.label.remove();
  remotes.delete(id);
}

function clearRemotes() {
  for (const id of [...remotes.keys()]) removeRemote(id);
}

// ---------- networking ----------

const net = new Net({
  status(v) {
    online = v;
    if (!v) clearRemotes();
    // Hello carries no heading, so force a fresh pos after every (re)connect.
    else sent.m = -1;
    renderScoreboard();
  },
  welcome(m) {
    clearRemotes();
    for (const p of m.players || []) addRemote(p);
    renderScoreboard();
  },
  join(m) {
    if (!m.p) return;
    const p = addRemote(m.p);
    ui.chat(null, `${p.name} joined the herd`, 'sys');
    renderScoreboard();
  },
  leave(m) {
    const p = remotes.get(m.id);
    if (!p) return;
    ui.chat(null, `${p.name} left the herd`, 'sys');
    removeRemote(m.id);
    renderScoreboard();
  },
  pos(m) {
    const p = remotes.get(m.id);
    if (!p) return;
    p.tx = +m.x || 0;
    p.tz = +m.z || 0;
    p.tr = +m.r || 0;
    p.moving = !!m.m;
  },
  moo(m) {
    const p = remotes.get(m.id);
    if (!p) return;
    p.label.say('Moo!', 2000);
    p.mooT = MOO_CD;
    const vol = Math.max(0, 1 - Math.hypot(p.x - me.x, p.z - me.z) / 70);
    audio.moo(vol, pitchFor(p.color));
  },
  chat(m) {
    const p = remotes.get(m.id);
    if (!p || typeof m.text !== 'string') return;
    ui.chat(p.name, m.text);
    p.label.say(m.text);
  },
  stat(m) {
    const p = remotes.get(m.id);
    if (!p) return;
    p.q = m.q | 0;
    p.bell = !!m.bell;
    p.label.setText(remoteText(p));
    renderScoreboard();
  },
});

// ---------- join screen ----------

const joinForm = $('join');
const nameInput = $('name');
const colorsBox = $('colors');
const chatInput = $('chatinput');

nameInput.value = me.name === 'Cow' ? '' : me.name;

const swatches = SPOT_CSS.map((css, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch' + (i === me.color ? ' on' : '');
  b.style.background = css;
  b.setAttribute('aria-label', `Colour ${i + 1}`);
  b.addEventListener('click', () => setColor(i));
  colorsBox.append(b);
  return b;
});

function setColor(i) {
  if (i === me.color) return;
  me.color = i;
  swatches.forEach((s, j) => s.classList.toggle('on', j === i));
  const bell = cow.userData.bell.visible;
  scene.remove(cow);
  cow = makeCow(i);
  cow.userData.bell.visible = bell;
  scene.add(cow);
}

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (me.joined) return;
  me.name = nameInput.value.trim().slice(0, 16) || 'Cow';
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ name: me.name, color: me.color }));
  } catch {}
  audio.init();
  me.joined = true;
  joinForm.hidden = true;
  $('hud').hidden = false;
  document.activeElement?.blur?.();
  myLabel.setText(me.name);
  net.connect(() => ({ t: 'hello', name: me.name, color: me.color, x: me.x, z: me.z, q: quests.stars, bell: quests.bell }));
  renderQuestLog();
  renderScoreboard();
  ui.toast(`Welcome to the farm, ${me.name}! Talk to Farmer Greta by the barn to get started.`, 6000);
});

// ---------- input ----------

const keys = new Set();
const touch = { id: null, sx: 0, sy: 0, x: 0, y: 0 };
let zoom = 1;
let nearest = null;

const typing = () => document.activeElement === chatInput;
const blocked = () => !me.joined || ui.dialogOpen || typing();

function act() {
  if (!me.joined) return;
  if (ui.dialogOpen) ui.advance();
  else nearest?.run();
}

function moo() {
  if (!me.joined || me.mooT > 0) return;
  audio.moo(1, pitchFor(me.color));
  myLabel.say('Moo!', 2000);
  me.mooT = MOO_CD;
  net.send({ t: 'moo' });
  quests.onMoo();
}

function space() {
  if (!me.joined) return;
  if (ui.dialogOpen) ui.advance();
  else moo();
}

window.addEventListener('keydown', (e) => {
  if (!me.joined || typing()) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const c = e.code;
  if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
  keys.add(c);
  if (e.repeat) return;
  if (c === 'KeyE') act();
  else if (c === 'Space') space();
  else if (c === 'Enter' || c === 'NumpadEnter') {
    e.preventDefault();
    if (ui.dialogOpen) ui.advance();
    else {
      keys.clear();
      chatInput.focus();
    }
  }
});

window.addEventListener('keyup', (e) => keys.delete(e.code));

window.addEventListener('blur', () => {
  keys.clear();
  resetStick();
});

// Phones suspend audio and stall timers in the background; recover cleanly on return.
document.addEventListener('visibilitychange', () => {
  keys.clear();
  resetStick();
  if (!document.hidden && me.joined) audio.init();
});

chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') chatInput.blur();
});

// Sending goes through the form so on-screen keyboards' "send" key works too.
$('chatform').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim().slice(0, 120);
  if (text) {
    ui.chat(me.name, text);
    myLabel.say(text);
    net.send({ t: 'chat', text });
  }
  chatInput.value = '';
  chatInput.blur();
});

chatInput.addEventListener('blur', () => document.body.classList.remove('chatting'));

// Must be a click: iOS only opens the keyboard for focus() inside a tap handler.
$('btn-chat').addEventListener('click', () => {
  if (!me.joined || ui.dialogOpen) return;
  keys.clear();
  resetStick();
  document.body.classList.add('chatting');
  chatInput.focus();
});

$('dialog').addEventListener('click', () => ui.advance());
$('hint').addEventListener('click', () => act());

// Pinch to zoom; any touch on the world also dismisses the chat keyboard.
const pinch = new Map();
let pinchD = 0;
const pinchDist = () => {
  const [a, b] = [...pinch.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
canvas.addEventListener('pointerdown', (e) => {
  if (typing()) chatInput.blur();
  if (e.pointerType === 'mouse') return;
  pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch.size === 2) pinchD = pinchDist();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pinch.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pinch.size !== 2) return;
  const d = pinchDist();
  if (pinchD > 0 && d > 0) zoom = Math.max(0.55, Math.min(1.6, zoom * (pinchD / d)));
  pinchD = d;
});
for (const ev of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(ev, (e) => {
    pinch.delete(e.pointerId);
    pinchD = 0;
  });
}
document.addEventListener('contextmenu', (e) => {
  if (ui.touch && e.target !== chatInput && e.target !== nameInput) e.preventDefault();
});
// Safari ignores user-scalable=no; stop its page-level pinch zoom.
document.addEventListener('gesturestart', (e) => e.preventDefault());

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    zoom = Math.max(0.55, Math.min(1.6, zoom * Math.exp(e.deltaY * 0.001)));
  },
  { passive: false },
);

const stick = $('stick');
const ring = $('ring');
const knob = $('knob');
const RING_R = 60;

function resetStick() {
  touch.id = null;
  touch.x = touch.y = 0;
  knob.style.transform = 'translate(0px,0px)';
  ring.style.left = ring.style.top = ring.style.bottom = '';
}

stick.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (typing()) chatInput.blur();
  if (touch.id !== null) return;
  touch.id = e.pointerId;
  touch.x = touch.y = 0;
  // Centre the ring under the thumb, kept fully on screen.
  const box = stick.getBoundingClientRect();
  const cx = Math.max(RING_R + 4, Math.min(box.width - RING_R, e.clientX - box.left));
  const cy = Math.max(RING_R, Math.min(box.height - RING_R - 4, e.clientY - box.top));
  touch.sx = box.left + cx;
  touch.sy = box.top + cy;
  ring.style.left = `${cx - RING_R}px`;
  ring.style.top = `${cy - RING_R}px`;
  ring.style.bottom = 'auto';
  try {
    stick.setPointerCapture(e.pointerId);
  } catch {}
});

stick.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touch.id) return;
  let dx = e.clientX - touch.sx, dy = e.clientY - touch.sy;
  const len = Math.hypot(dx, dy);
  if (len > STICK_R) {
    dx *= STICK_R / len;
    dy *= STICK_R / len;
  }
  touch.x = dx / STICK_R;
  touch.y = dy / STICK_R;
  knob.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
});

for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stick.addEventListener(ev, (e) => {
    if (e.pointerId === touch.id) resetStick();
  });
}

$('btn-act').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  act();
});
$('btn-moo').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  space();
});

// ---------- per-frame helpers ----------

function updateMe(dt) {
  me.grazeT = Math.max(0, me.grazeT - dt);
  me.mooT = Math.max(0, me.mooT - dt);

  let ix = 0, iz = 0, run = false;
  if (!blocked() && me.grazeT <= 0) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    const kl = Math.hypot(ix, iz);
    if (kl > 0) {
      ix /= kl;
      iz /= kl;
      run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    } else if (Math.hypot(touch.x, touch.y) > 0.12) {
      ix = touch.x;
      iz = touch.y;
      run = true;
    }
  }

  const mag = Math.hypot(ix, iz);
  me.speed = 0;
  if (mag > 0) {
    let sp = (run ? RUN : WALK) * mag;
    if (inPond(me.x, me.z)) sp *= 0.55;
    else if (inMud(me.x, me.z)) sp *= 0.7;
    const ox = me.x, oz = me.z;
    me.x += (ix / mag) * sp * dt;
    me.z += (iz / mag) * sp * dt;
    resolve(me, 0.9);
    me.x = Math.max(-BOUND, Math.min(BOUND, me.x));
    me.z = Math.max(-BOUND, Math.min(BOUND, me.z));
    me.speed = dt > 0 ? Math.hypot(me.x - ox, me.z - oz) / dt : 0;
    me.r = wrap(me.r + angDiff(Math.atan2(ix, iz), me.r) * ease(12, dt));
  }
  me.y += ((inPond(me.x, me.z) ? -0.7 : 0) - me.y) * ease(6, dt);
}

function updateRemotes(dt, t) {
  const k = ease(10, dt);
  for (const p of remotes.values()) {
    p.x += (p.tx - p.x) * k;
    p.z += (p.tz - p.z) * k;
    p.r = wrap(p.r + angDiff(p.tr, p.r) * k);
    p.y += ((inPond(p.x, p.z) ? -0.7 : 0) - p.y) * ease(6, dt);
    p.mooT = Math.max(0, p.mooT - dt);
    p.cow.position.set(p.x, p.y, p.z);
    p.cow.rotation.y = p.r;
    p.cow.userData.bell.visible = p.bell;
    animateCow(p.cow, dt, t, p.moving ? 0.65 : 0, 0, p.mooT / MOO_CD);
  }
}

const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const wantPos = new THREE.Vector3();
const wantLook = new THREE.Vector3();
let camInit = false;

function updateCamera(dt, t) {
  if (me.joined) {
    wantPos.set(me.x, me.y + 30 * zoom, me.z + 24 * zoom);
    wantLook.set(me.x, me.y + 1, me.z - 2);
  } else {
    wantPos.set(me.x + Math.sin(t * 0.25) * 9, me.y + 7, me.z + 13);
    wantLook.set(me.x, me.y + 1.2, me.z);
  }
  if (!camInit) {
    camPos.copy(wantPos);
    camLook.copy(wantLook);
    camInit = true;
  } else {
    const k = ease(5, dt);
    camPos.lerp(wantPos, k);
    camLook.lerp(wantLook, k);
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  sun.position.set(me.x + 35, 60, me.z + 25);
  sun.target.position.set(me.x, 0, me.z);
}

const proj = new THREE.Vector3();

function placeLabel(label, x, y, z, show) {
  if (!show) {
    label.place(0, 0, false);
    return;
  }
  proj.set(x, y, z).project(camera);
  const w = window.innerWidth, h = window.innerHeight;
  const sx = (proj.x + 1) * 0.5 * w, sy = (1 - proj.y) * 0.5 * h;
  label.place(sx, sy, proj.z < 1 && sx > -60 && sx < w + 60 && sy > -60 && sy < h + 60);
}

function placeLabels() {
  placeLabel(myLabel, me.x, me.y + 3.1, me.z, me.joined);
  for (const p of remotes.values()) placeLabel(p.label, p.x, p.y + 3.1, p.z, true);
  for (const { npc, label } of npcLabels) {
    label.setMark(quests.mark(npc.id));
    placeLabel(label, npc.x, npc.h, npc.z, true);
  }
}

const sent = { x: NaN, z: NaN, r: NaN, m: -1, at: 0 };

function sendPos(now) {
  if (!me.joined || !online || now - sent.at < 100) return;
  const x = r2(me.x), z = r2(me.z), r = r2(me.r), m = me.speed > 0.05 ? 1 : 0;
  if (x === sent.x && z === sent.z && r === sent.r && m === sent.m) return;
  Object.assign(sent, { x, z, r, m, at: now });
  net.send({ t: 'pos', x, z, r, m });
}

// ---------- minimap ----------

const mm = $('minimap');
mm.width = mm.height = MM;
const mctx = mm.getContext('2d');
const mmBase = document.createElement('canvas');
mmBase.width = mmBase.height = MM;
drawMapBase(mmBase.getContext('2d'), MM);
const toMap = (v) => (v + MAP) * (MM / (2 * MAP));

function dot(x, z, r, fill, stroke) {
  mctx.beginPath();
  mctx.arc(toMap(x), toMap(z), r, 0, Math.PI * 2);
  mctx.fillStyle = fill;
  mctx.fill();
  if (stroke) {
    mctx.lineWidth = 1.5;
    mctx.strokeStyle = stroke;
    mctx.stroke();
  }
}

function drawMinimap() {
  mctx.drawImage(mmBase, 0, 0);
  for (const [x, z] of quests.mapDots()) dot(x, z, 2.2, '#ffd23f');
  for (const n of quests.npcs) {
    const m = quests.mark(n.id);
    dot(n.x, n.z, 3, m === '!' ? '#ffd23f' : m === '?' ? '#5fdc6a' : '#ffffff', '#1d2a1f');
  }
  for (const p of remotes.values()) dot(p.x, p.z, 3.2, SPOT_CSS[p.color] || SPOT_CSS[0], '#ffffff');

  const cx = toMap(me.x), cz = toMap(me.z);
  const hx = Math.sin(me.r), hz = Math.cos(me.r);
  mctx.beginPath();
  mctx.moveTo(cx + hx * 7, cz + hz * 7);
  mctx.lineTo(cx - hx * 4 + hz * 4.5, cz - hz * 4 - hx * 4.5);
  mctx.lineTo(cx - hx * 4 - hz * 4.5, cz - hz * 4 + hx * 4.5);
  mctx.closePath();
  mctx.fillStyle = '#ffffff';
  mctx.fill();
  mctx.lineWidth = 1.5;
  mctx.strokeStyle = '#1d2a1f';
  mctx.stroke();
}

// ---------- main loop ----------

let last = performance.now();
let frame = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const t = now / 1000;

  updateMe(dt);
  quests.update(dt, t);
  world.update(dt, t);

  cow.position.set(me.x, me.y, me.z);
  cow.rotation.y = me.r;
  const graze = me.grazeT > 0 ? Math.max(0, Math.min(1, Math.sin(Math.PI * (1 - me.grazeT / GRAZE_T)))) : 0;
  animateCow(cow, dt, t, me.speed / RUN, graze, me.mooT / MOO_CD);
  cow.userData.bell.visible = quests.bell;

  updateRemotes(dt, t);
  updateCamera(dt, t);

  renderer.render(scene, camera);
  placeLabels();

  nearest = me.joined && !ui.dialogOpen ? quests.nearest() : null;
  ui.hint(nearest ? nearest.text : null);

  sendPos(now);
  if (frame++ % 5 === 0) drawMinimap();
}

requestAnimationFrame(loop);
