import { THREE, GEO, part, makeBird, makeFarmer, makeQuadruped, makeScarecrow } from './models.js';
import { P, SPOTS, BOUND, col, resolve } from './world.js';

const SAVE_KEY = 'cowworld.quests';
const RACE_TIME = 25;
const COW_R = 0.9;
const BALE_R = 1.15;

export const NPCS = {
  greta: {
    name: 'Farmer Greta', x: 7, z: 3, h: 4.1, make: makeFarmer,
    idle: ['Lovely day for it, {name}.', 'Best cow on the farm, you are.'],
  },
  hen: {
    name: 'Henrietta', x: -40, z: 2, h: 2.4, make: () => makeBird(0xfdfdfd, 1.3, 0xf2a23a, 0xd8342b),
    idle: ['Bawk. The chicks are napping. Finally.'],
  },
  pig: {
    name: 'Percy', x: -27, z: 37, h: 2.3,
    make: () => makeQuadruped({ w: 1.1, h: 0.9, l: 1.7, leg: 0.4, color: 0xf2a3b3, snout: 0xe07f95, hs: 0.8 }),
    idle: ['Oink. Full. For now.'],
  },
  stitch: {
    name: 'Stitch', x: -74, z: -40, h: 4.6, make: makeScarecrow,
    idle: ['Not a crow in sight. You are terrifying. Thank you.'],
  },
  rex: {
    name: 'Rex', x: 23, z: -11, h: 2.4,
    make: () => makeQuadruped({ w: 0.7, h: 0.7, l: 1.5, leg: 0.6, color: 0x9a6a3a, snout: 0x3a2a1a, ear: 0x5c3d1e, hs: 0.6, neck: 0.3 }),
    idle: ['Woof! Tidy hay, happy dog.'],
  },
  dobbin: {
    name: 'Dobbin', x: 30, z: 5, h: 2.3, make: () => makeBird(0xf7f3e3, 1.2, 0xf08a24),
    idle: ['Quack. Fastest cow I ever saw. Only cow I ever saw swim, too.'],
  },
  gus: {
    name: 'Old Gus', x: 78, z: 73, h: 2.9,
    make: () => makeQuadruped({ w: 0.8, h: 0.8, l: 1.6, leg: 0.8, color: 0xb9b3a8, snout: 0x8d867a, hs: 0.6, neck: 0.35, horns: true, beard: true }),
    idle: ['Baaah. Good stew, that was.'],
  },
};

export const QUESTS = [
  {
    id: 'clover', npc: 'greta', title: 'Breakfast of Champions', task: 'Graze on clover in the meadow', need: 6,
    intro: [
      'Morning, {name}! Big day on the farm.',
      "A cow can't work on an empty stomach. There's fresh clover in the meadow, south-east of the barn.",
      'Munch six patches (press E next to one), then come back to me.',
    ],
    remind: 'The clover meadow is south-east of here, down the path and left. Six patches!',
    outro: ["Now that's a well-fed cow!", 'The other animals could use a hoof. Look for anyone with a ! over their head.'],
  },
  {
    id: 'chicks', npc: 'hen', title: 'Lost Chicks', task: 'Lead the chicks home to Henrietta', need: 4,
    intro: [
      'Bawk! {name}! My chicks have wandered off again. All four of them!',
      "Walk up to a chick and it will follow you. Bring them home to me, won't you?",
    ],
    remind: 'Four chicks, scattered all over the farm. The yellow dots on your map should help.',
    outro: ['All four, safe and sound! You are a hero, {name}.'],
  },
  {
    id: 'apples', npc: 'pig', title: 'An Apple a Day', task: 'Headbutt apple trees, collect apples', need: 6,
    intro: [
      'Oink. {name}. I am STARVING.',
      'The orchard is up in the north-east. Headbutt a tree (E) and apples fall out.',
      'Bring me six. Seven if you love me.',
    ],
    remind: 'Six apples. Orchard, north-east. Headbutt the trees. Hurry, I am wasting away.',
    outro: ['*crunch* *crunch* ... Oh, that is the good stuff. Thanks, {name}.'],
  },
  {
    id: 'crows', npc: 'stitch', title: 'Scare Tactics', task: 'Moo at the crows in the corn field', need: 6,
    intro: [
      'Psst. Cow. Up here.',
      'The crows in my corn have stopped being scared of me. It is embarrassing.',
      'Get close and MOO at them (Space). Six crows. Please.',
    ],
    remind: 'The crows are hiding between the corn rows behind me. Walk up close and moo!',
    outro: ['Did you see them fly? Magnificent. I owe you one, {name}.'],
  },
  {
    id: 'bales', npc: 'rex', title: 'Roll With It', task: 'Push hay bales into the hay shelter', need: 3,
    intro: [
      'Woof! {name}! Three hay bales rolled off into the field behind the barn.',
      'Push them into this shelter with those big cow shoulders. Just walk into them!',
    ],
    remind: 'Three bales, in the field west of here behind the barn. Walk into them to roll them over here.',
    outro: ['Woof woof! All stacked. Good cow. GOOD cow!'],
  },
  {
    id: 'race', npc: 'dobbin', title: 'Pond Dash', task: 'Run through all the rings in time', need: 8,
    intro: [
      "Quack! Think cows can't swim? Prove it.",
      `Eight rings, around and through my pond, in ${RACE_TIME} seconds. The clock starts at the first golden ring.`,
      'Hold Shift to run. You will need it.',
    ],
    remind: 'Touch the golden ring to start. Follow the gold, and hold Shift!',
    outro: ['Quack-tastic! A swimming cow. Now I have seen everything.'],
  },
  {
    id: 'mushrooms', npc: 'gus', title: 'Forest Stew', task: 'Find red mushrooms in the western forest', need: 5,
    intro: [
      "Baaah. These old legs can't make it to the forest any more.",
      'Five red mushrooms grow in the woods, far to the west. Fetch them for my stew, will you?',
    ],
    remind: 'Five red mushrooms, in the forest on the west side of the farm.',
    outro: ['Baaah-eautiful. Smell that? No? Give it six hours.'],
  },
  {
    id: 'bell', npc: 'greta', title: 'The Golden Cowbell', task: 'Find the bell in the stone circle', need: 1, final: true,
    intro: [
      "You've helped every animal on this farm, {name}.",
      'There is a legend: a golden cowbell rests in the stone circle, far in the north-east corner.',
      'Only the most helpful cow may wear it. Go and get it.',
    ],
    remind: 'The stone circle is in the far north-east corner, past the orchard.',
    outro: ['It suits you! Everyone will hear you coming now.', 'You are the Champion Cow of this farm, {name}. Moo with pride!'],
  },
];

const byId = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function marker(g, y) {
  const m = part('cone', 0xffd23f, g, 0, y, 0, 0.5, 0.7, 0.5);
  m.rotation.x = Math.PI;
  m.castShadow = false;
  return m;
}

export class Quests {
  constructor({ scene, me, ui, audio, appleTrees, onChange }) {
    Object.assign(this, { scene, me, ui, audio, appleTrees, onChange });
    this.state = {};
    this.prog = {};
    this.bell = false;
    this.items = [];
    this.npcs = [];
    this.race = { on: false, t: 0, idx: 0 };

    for (const [id, n] of Object.entries(NPCS)) {
      const mesh = n.make();
      mesh.position.set(n.x, 0, n.z);
      scene.add(mesh);
      col.circles.push({ x: n.x, z: n.z, r: 0.9 });
      this.npcs.push({ id, ...n, mesh });
    }
    for (const q of QUESTS) {
      this.state[q.id] = 'new';
      this.prog[q.id] = 0;
    }
    this.load();
  }

  // ---------- persistence ----------

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s) {
        for (const q of QUESTS) {
          if (['new', 'active', 'ready', 'done'].includes(s.state?.[q.id])) this.state[q.id] = s.state[q.id];
        }
        this.bell = !!s.bell;
      }
    } catch {}
    for (const q of QUESTS) {
      if (this.state[q.id] === 'active') this.spawn(q.id);
      if (this.state[q.id] === 'ready') this.prog[q.id] = q.need;
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ state: this.state, bell: this.bell }));
    } catch {}
  }

  changed() {
    this.save();
    this.onChange?.();
  }

  // ---------- queries ----------

  get stars() {
    return QUESTS.filter((q) => this.state[q.id] === 'done').length;
  }

  get othersDone() {
    return QUESTS.filter((q) => !q.final && this.state[q.id] === 'done').length;
  }

  /** The quest this NPC currently cares about, if any. */
  questFor(npcId) {
    return QUESTS.find((q) => q.npc === npcId && this.state[q.id] !== 'done');
  }

  locked(q) {
    return q.final && this.othersDone < QUESTS.length - 1;
  }

  /** '!' = has a quest for you, '?' = ready to hand in, '…' = in progress. */
  mark(npcId) {
    const q = this.questFor(npcId);
    if (!q || this.locked(q)) return '';
    return { new: '!', ready: '?', active: '…' }[this.state[q.id]] || '';
  }

  /** Active quests for the HUD. */
  log() {
    return QUESTS.filter((q) => this.state[q.id] === 'active' || this.state[q.id] === 'ready').map((q) => ({
      title: q.title,
      task: this.state[q.id] === 'ready' ? `Return to ${NPCS[q.npc].name}` : q.task,
      n: Math.min(this.prog[q.id], q.need),
      need: q.need,
      ready: this.state[q.id] === 'ready',
    }));
  }

  /** Positions worth showing on the minimap. */
  mapDots() {
    const out = [];
    for (const it of this.items) {
      if (it.dead || it.gone || it.locked || it.follow) continue;
      if (it.kind === 'ring' && it.idx !== (this.race.on ? this.race.idx : 0)) continue;
      out.push([it.x, it.z]);
    }
    return out;
  }

  /** The closest thing E would act on right now. */
  nearest() {
    const me = this.me;
    let best = null, bd = Infinity;
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - me.x, n.z - me.z);
      if (d < 4.5 && d < bd) {
        bd = d;
        best = { text: `Talk to ${n.name}`, run: () => this.talk(n) };
      }
    }
    for (const it of this.items) {
      if (it.kind !== 'clover' || it.dead || it.eaten) continue;
      const d = Math.hypot(it.x - me.x, it.z - me.z);
      if (d < 2.8 && d < bd) {
        bd = d;
        best = { text: 'Graze', run: () => this.graze(it) };
      }
    }
    for (const tr of this.appleTrees) {
      const d = Math.hypot(tr.x - me.x, tr.z - me.z);
      if (d < 4 && d < bd) {
        bd = d;
        best = { text: 'Headbutt tree', run: () => this.bonk(tr) };
      }
    }
    return best;
  }

  // ---------- actions ----------

  talk(n) {
    const fill = (s) => s.replaceAll('{name}', this.me.name);
    const q = this.questFor(n.id);
    if (!q) {
      this.ui.dialog(n.name, [fill(n.idle[Math.floor(Math.random() * n.idle.length)])]);
      return;
    }
    if (this.locked(q)) {
      const left = QUESTS.length - 1 - this.othersDone;
      this.ui.dialog(n.name, [
        `Good work so far, ${this.me.name}! ${left} more ${left === 1 ? 'animal needs' : 'animals need'} your help.`,
        'Come back to me when everyone on the farm is happy. I have something special in mind.',
      ]);
      return;
    }
    const st = this.state[q.id];
    if (st === 'new') {
      this.ui.dialog(n.name, q.intro.map(fill), () => {
        this.state[q.id] = 'active';
        this.spawn(q.id);
        this.ui.toast(`New quest: ${q.title}`);
        this.audio.blip(2);
        this.changed();
      });
    } else if (st === 'active') {
      this.ui.dialog(n.name, [fill(q.remind)]);
    } else {
      this.ui.dialog(n.name, q.outro.map(fill), () => {
        this.state[q.id] = 'done';
        this.despawn(q.id);
        this.audio.fanfare();
        this.ui.toast(this.stars === QUESTS.length ? '★ You are the Champion Cow! ★' : `★ Quest complete: ${q.title}`, 5000);
        this.changed();
      });
    }
  }

  graze(it) {
    if (this.me.grazeT > 0) return;
    it.eaten = true;
    this.me.grazeT = 0.7;
    this.audio.munch();
    setTimeout(() => {
      if (it.dead) return;
      this.kill(it);
      this.advance('clover');
    }, 400);
  }

  bonk(tr) {
    tr.shake = 0.5;
    this.me.grazeT = 0.3;
    this.audio.bonk();
    if (this.state.apples !== 'active' || tr.cd > 0) return;
    const lying = this.items.filter((i) => i.kind === 'apple' && !i.dead).length;
    if (lying + this.prog.apples >= byId.apples.need + 2) return;
    tr.cd = 5;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2, d = 2.2 + Math.random() * 1.4;
      const g = new THREE.Group();
      part('ball', 0xd8342b, g, 0, 0, 0, 0.6);
      part('box', 0x5a3a1e, g, 0, 0.34, 0, 0.06, 0.16, 0.06);
      const it = this.add('apple', 'apples', tr.x + Math.cos(a) * d, tr.z + Math.sin(a) * d, g);
      it.y = 4;
      it.vy = 0;
      g.position.y = 4;
    }
  }

  /** Called when the player moos. */
  onMoo() {
    const me = this.me;
    for (const it of this.items) {
      if (it.kind !== 'crow' || it.gone) continue;
      const dx = it.x - me.x, dz = it.z - me.z, d = Math.hypot(dx, dz);
      if (d > 10) continue;
      it.gone = true;
      it.fly = 0;
      it.dx = dx / (d || 1);
      it.dz = dz / (d || 1);
      it.marker.visible = false;
      this.audio.caw();
      this.advance('crows');
    }
  }

  advance(id, to) {
    const q = byId[id];
    if (this.state[id] !== 'active') return;
    this.prog[id] = to ?? this.prog[id] + 1;
    this.audio.blip(this.prog[id]);
    if (this.prog[id] >= q.need) {
      this.state[id] = 'ready';
      this.ui.toast(`Done! Return to ${NPCS[q.npc].name}.`);
      if (id === 'race') this.despawn('race');
    }
    this.changed();
  }

  // ---------- quest objects ----------

  add(kind, q, x, z, mesh, extra) {
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const it = { kind, q, x, z, mesh, dead: false, ...extra };
    this.items.push(it);
    return it;
  }

  kill(it) {
    it.dead = true;
    this.scene.remove(it.mesh);
    this.dirty = true;
  }

  despawn(q) {
    for (const it of this.items) if (it.q === q && !it.dead) this.kill(it);
    if (q === 'bales') col.circles = col.circles.filter((c) => !c.bale);
    if (q === 'race') {
      this.race.on = false;
      this.ui.timer(null);
    }
  }

  spawn(id) {
    this.prog[id] = 0;
    switch (id) {
      case 'clover':
        for (const [x, z] of SPOTS.clover) {
          const g = new THREE.Group();
          for (let i = 0; i < 6; i++) {
            part('ball', i % 2 ? 0x3fa34d : 0x55b85f, g, Math.cos(i * 1.05) * 0.5, 0.25, Math.sin(i * 1.05) * 0.5, 0.6, 0.42, 0.6);
          }
          part('ball', 0xf6a5c8, g, 0, 0.55, 0, 0.32);
          part('ball', 0xffffff, g, 0.42, 0.5, 0.2, 0.24);
          part('ball', 0xf6a5c8, g, -0.35, 0.5, -0.3, 0.24);
          this.add('clover', id, x, z, g, { marker: marker(g, 2.3) });
        }
        break;
      case 'chicks':
        for (const [x, z] of SPOTS.chicks) {
          const g = makeBird(0xffe066, 0.5);
          this.add('chick', id, x, z, g, { marker: marker(g, 2.0), follow: false });
        }
        break;
      case 'crows':
        for (const [x, z] of SPOTS.crows) {
          const g = makeBird(0x26262b, 0.8, 0xf2a23a);
          g.rotation.y = x * 1.7;
          this.add('crow', id, x, z, g, { marker: marker(g, 2.4) });
        }
        break;
      case 'bales':
        for (const [x, z] of SPOTS.bales) {
          const g = new THREE.Group();
          const roll = new THREE.Group();
          roll.position.y = BALE_R;
          part('cyl', 0xe2c15a, roll, 0, 0, 0, BALE_R * 2, 1.9, BALE_R * 2).rotation.z = Math.PI / 2;
          part('box', 0xc9a545, roll, 0, 0, BALE_R - 0.02, 1.92, 0.5, 0.1);
          part('box', 0xc9a545, roll, 0, 0, -BALE_R + 0.02, 1.92, 0.5, 0.1);
          part('box', 0xc9a545, roll, 0, BALE_R - 0.02, 0, 1.92, 0.1, 0.5);
          g.add(roll);
          this.add('bale', id, x, z, g, { roll, vx: 0, vz: 0, home: [x, z] });
        }
        break;
      case 'race': {
        let prev = null;
        for (let i = 0; i < 8; i++) {
          const a = ((215 + i * 45) * Math.PI) / 180, r = i % 2 ? 9 : 25;
          const x = P.pond.x + Math.cos(a) * r, z = P.pond.z + Math.sin(a) * r;
          const mesh = new THREE.Mesh(GEO.torus, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
          const g = new THREE.Group();
          mesh.position.y = 2.1;
          g.add(mesh);
          g.rotation.y = prev ? Math.atan2(x - prev[0], z - prev[1]) : 0.9;
          prev = [x, z];
          this.add('ring', id, x, z, g, { idx: i, ring: mesh });
        }
        this.race = { on: false, t: 0, idx: 0 };
        break;
      }
      case 'mushrooms':
        for (const [x, z] of SPOTS.mushrooms) {
          const g = new THREE.Group();
          part('cyl', 0xf3ead8, g, 0, 0.35, 0, 0.35, 0.7, 0.35);
          part('ball', 0xd8342b, g, 0, 0.75, 0, 1.2, 0.7, 1.2);
          part('ball', 0xffffff, g, 0.3, 0.98, 0.2, 0.2);
          part('ball', 0xffffff, g, -0.3, 0.95, -0.15, 0.18);
          this.add('mushroom', id, x, z, g, { marker: marker(g, 2.4) });
        }
        break;
      case 'bell': {
        const g = new THREE.Group();
        const b = new THREE.Group();
        b.position.y = 1.6;
        part('ball', 0xffc928, b, 0, 0, 0, 1.1, 1.0, 1.1);
        part('cyl', 0xffc928, b, 0, -0.35, 0, 1.25, 0.25, 1.25);
        part('box', 0xb8342b, b, 0, 0.6, 0, 0.3, 0.3, 0.3);
        g.add(b);
        this.add('bell', id, P.stones.x, P.stones.z, g, { marker: marker(g, 3.6), spin: b });
        break;
      }
    }
  }

  // ---------- per-frame ----------

  update(dt, t) {
    const me = this.me, audio = this.audio;

    for (const n of this.npcs) {
      if (n.id === 'stitch') continue;
      const dx = me.x - n.x, dz = me.z - n.z;
      if (dx * dx + dz * dz < 144) n.mesh.rotation.y += angDiff(Math.atan2(dx, dz), n.mesh.rotation.y) * Math.min(1, dt * 5);
      n.mesh.position.y = Math.abs(Math.sin(t * 2 + n.x)) * 0.05;
    }

    for (const tr of this.appleTrees) {
      if (tr.cd > 0) tr.cd -= dt;
      if (tr.shake > 0) {
        tr.shake = Math.max(0, tr.shake - dt);
        tr.crown.rotation.z = Math.sin(tr.shake * 45) * 0.2 * tr.shake;
      }
    }

    let followers = 0;
    const cur = this.race.on ? this.race.idx : 0;
    for (const it of this.items) {
      if (it.dead) continue;
      const dx = it.x - me.x, dz = it.z - me.z, d = Math.hypot(dx, dz);
      if (it.marker?.visible) it.marker.position.y += Math.cos(t * 3 + it.x) * dt * 0.4;

      switch (it.kind) {
        case 'chick':
          if (!it.follow) {
            it.mesh.position.y = Math.abs(Math.sin(t * 4 + it.x)) * 0.15;
            if (d < 4.5) {
              it.follow = true;
              it.marker.visible = false;
              audio.peep();
              if (!this.chickTip) this.ui.toast('A chick is following you! Lead it back to Henrietta.');
              this.chickTip = true;
            }
          } else {
            const k = followers++;
            const tx = me.x - Math.sin(me.r) * (2 + 1.3 * k), tz = me.z - Math.cos(me.r) * (2 + 1.3 * k);
            const ex = tx - it.x, ez = tz - it.z, ed = Math.hypot(ex, ez);
            if (ed > 0.3) {
              const step = Math.min(ed, Math.min(ed * 5, 16) * dt);
              it.x += (ex / ed) * step;
              it.z += (ez / ed) * step;
              it.mesh.rotation.y = Math.atan2(ex, ez);
              it.mesh.position.set(it.x, Math.abs(Math.sin(t * 14 + k)) * 0.25, it.z);
            }
            if (Math.hypot(it.x - NPCS.hen.x, it.z - NPCS.hen.z) < 7) {
              this.kill(it);
              audio.peep();
              this.advance('chicks');
            }
          }
          break;

        case 'apple':
          if (it.y > 0.3) {
            it.vy += 22 * dt;
            it.y = Math.max(0.3, it.y - it.vy * dt);
            it.mesh.position.y = it.y;
          } else if (d < 1.7) {
            this.kill(it);
            this.advance('apples');
          }
          break;

        case 'crow':
          if (it.gone) {
            it.fly += dt;
            it.x += it.dx * 13 * dt;
            it.z += it.dz * 13 * dt;
            it.mesh.position.set(it.x, it.fly * 9, it.z);
            it.mesh.rotation.y = Math.atan2(it.dx, it.dz);
            it.mesh.scale.set(1 + Math.abs(Math.sin(t * 25)) * 0.6, 1, 1);
            if (it.fly > 1.8) this.kill(it);
          } else {
            it.mesh.rotation.x = Math.max(0, Math.sin(t * 3 + it.x)) * 0.5;
          }
          break;

        case 'bale': {
          if (it.locked) break;
          const rr = COW_R + BALE_R;
          if (d < rr && d > 0.001) {
            const s = Math.max(me.speed, 3) * 0.8;
            it.x += (dx / d) * (rr - d);
            it.z += (dz / d) * (rr - d);
            it.vx = (dx / d) * s;
            it.vz = (dz / d) * s;
          }
          it.x += it.vx * dt;
          it.z += it.vz * dt;
          const f = Math.exp(-3.5 * dt);
          it.vx *= f;
          it.vz *= f;
          resolve(it, BALE_R);
          it.x = Math.max(-BOUND + 2, Math.min(BOUND - 2, it.x));
          it.z = Math.max(-BOUND + 2, Math.min(BOUND - 2, it.z));
          // A wedged bale stops the cow instead of being walked through.
          const bx = it.x - me.x, bz = it.z - me.z, bd = Math.hypot(bx, bz);
          if (bd < rr && bd > 0.001) {
            me.x -= (bx / bd) * (rr - bd);
            me.z -= (bz / bd) * (rr - bd);
          }
          const sp = Math.hypot(it.vx, it.vz);
          if (sp > 0.2) {
            it.mesh.rotation.y = Math.atan2(it.vx, it.vz);
            it.roll.rotation.x += (sp * dt) / BALE_R;
          }
          it.mesh.position.set(it.x, 0, it.z);
          if (Math.abs(it.x - P.shed.x) < 4 && Math.abs(it.z - P.shed.z) < 2.8) {
            it.locked = true;
            it.x = P.shed.x - 2.7 + this.prog.bales * 2.7;
            it.z = P.shed.z - 2.2;
            it.mesh.position.set(it.x, 0, it.z);
            it.mesh.rotation.y = Math.PI / 2;
            col.circles.push({ x: it.x, z: it.z, r: BALE_R, bale: true });
            this.advance('bales');
          }
          break;
        }

        case 'ring': {
          const active = it.idx === cur;
          it.ring.material.opacity = active ? 1 : it.idx < cur ? 0.12 : 0.4;
          it.ring.material.color.setHex(active ? 0xffd23f : 0xffffff);
          it.ring.scale.setScalar(active ? 1 + Math.sin(t * 6) * 0.06 : 1);
          if (active && d < 2.8) {
            if (!this.race.on) {
              this.race.on = true;
              this.race.t = RACE_TIME;
            }
            this.race.idx = it.idx + 1;
            this.advance('race', this.race.idx);
          }
          break;
        }

        case 'mushroom':
          if (d < 1.7) {
            this.kill(it);
            this.advance('mushrooms');
          }
          break;

        case 'bell':
          it.spin.rotation.y += dt * 2;
          it.spin.position.y = 1.6 + Math.sin(t * 2) * 0.25;
          if (d < 2.2) {
            this.kill(it);
            this.bell = true;
            audio.fanfare();
            this.advance('bell');
          }
          break;
      }
    }

    if (this.race.on) {
      this.race.t -= dt;
      this.ui.timer(Math.max(0, this.race.t));
      if (this.race.t <= 0) {
        this.race = { on: false, t: 0, idx: 0 };
        this.prog.race = 0;
        this.ui.timer(null);
        this.ui.toast('Too slow! Touch the first golden ring to try again.');
        audio.bonk();
        this.onChange?.();
      }
    }

    if (this.dirty) {
      this.items = this.items.filter((i) => !i.dead);
      this.dirty = false;
    }
  }
}
