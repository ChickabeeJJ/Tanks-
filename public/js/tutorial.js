// Short visual tutorial: animated floor arrows + a step card. Skippable, shown once.
// PC and mobile get different instructions/illustrations.
import * as THREE from '../vendor/three.module.min.js';
import { profile } from './profile.js';
import { Input } from './input.js';
import { LOBBY } from './render/scene.js';
import { Audio } from './audio.js';

const KEY = (k) => `<span class="kc">${k}</span>`;

export class Tutorial {
  constructor(G) {
    this.G = G;
    this.step = null;
    this.t = 0;
    this.card = document.createElement('div');
    this.card.className = 'tut hidden';
    document.getElementById('ui').appendChild(this.card);
    this.arrows = null;
  }

  get done() { return !!profile.d.tutorialDone; }

  // ---------------------------------------------------------------- steps
  steps() {
    const m = Input.touch;
    return {
      move: {
        title: 'Drive your tank',
        art: m
          ? '<div class="tut-drag"><div class="pad"></div><div class="finger"></div></div>'
          : `<div class="tut-keys"><div>${KEY('W')}</div><div>${KEY('A')}${KEY('S')}${KEY('D')}</div></div>`,
        text: m ? 'Touch and drag on the <b>left side</b> of the screen' : 'Use <b>W A S D</b> to drive',
      },
      portal: {
        title: 'Head into battle',
        art: '<div class="tut-portal"></div>',
        text: 'Follow the arrows into the <b>Battle</b> portal',
      },
      shoot: {
        title: 'Destroy shapes for XP',
        art: m
          ? '<div class="tut-drag right"><div class="pad"></div><div class="finger"></div></div>'
          : '<div class="tut-mouse"><div class="btnL"></div></div>',
        text: m ? 'Drag on the <b>right side</b> to aim and shoot' : 'Aim with the mouse, <b>hold Left Click</b> to shoot',
      },
      upgrade: {
        title: 'Get stronger',
        art: m ? '<div class="tut-tap"><span class="kc wide">Stats</span></div>' : `<div class="tut-keys"><div>${KEY('E')}${KEY('1')}${KEY('Q')}</div></div>`,
        text: m ? 'Tap the <b>green arrows</b> to upgrade stats, the <b>tank button</b> to evolve'
          : 'Press <b>E</b> then <b>1-8</b> for stats, <b>Q</b> to evolve your tank',
      },
    };
  }

  show(id) {
    this.step = id;
    this.t = 0;
    const s = this.steps()[id];
    const order = ['move', 'portal', 'shoot', 'upgrade'];
    const idx = order.indexOf(id);
    this.card.innerHTML = `<div class="tut-art">${s.art}</div>
      <div class="tut-body"><div class="tut-title lbl">${s.title}</div><div class="tut-text">${s.text}</div>
      <div class="tut-dots">${order.map((o, i) => `<i class="${i < idx ? 'done' : i === idx ? 'on' : ''}"></i>`).join('')}</div></div>
      <button class="tut-skip">Skip tutorial</button>`;
    this.card.querySelector('.tut-skip').onclick = () => this.finish(true);
    this.card.classList.remove('hidden');
    this.card.classList.remove('pop');
    void this.card.offsetWidth;
    this.card.classList.add('pop');
  }

  finish(skipped) {
    profile.d.tutorialDone = true;
    profile.saveNow();
    this.step = null;
    this.card.classList.add('hidden');
    this.clearArrows();
    if (!skipped) { this.G.hud.toast("You're ready! Have fun!", 'gold', 2600); Audio.reward(); }
  }

  // ---------------------------------------------------------------- lifecycle hooks
  enterLobby() {
    if (this.done) return;
    this.startPos = null;
    this.show(this.step === 'portal' ? 'portal' : 'move');
  }
  enterArena() {
    if (this.done) return;
    this.clearArrows();
    this.shapes0 = profile.d.totalShapes;
    this.show('shoot');
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    if (!this.step || this.done) return;
    const G = this.G;
    // stay out of the way while a menu is open (and pause the step timers)
    this.card.classList.toggle('covered', G.menus.isOpen);
    if (G.menus.isOpen) return;
    this.t += dt;
    if (G.state === 'lobby' && G.lobby) {
      const p = G.lobby.pos;
      if (this.step === 'move') {
        if (!this.startPos) this.startPos = { x: p.x, z: p.z };
        if (Math.hypot(p.x - this.startPos.x, p.z - this.startPos.z) > 7 || this.t > 9) { Audio.click(); this.show('portal'); }
      }
      if (this.step === 'portal') {
        const po = LOBBY.portals.find((x) => x.id === 'ffa');
        this.drawPath(G.scene, p.x, p.z, po.x, po.z - 2, dt);
      } else this.clearArrows();
    } else if (G.state === 'arena' && G.arena && G.arena.me) {
      const a = G.arena;
      if (this.step === 'shoot') {
        this.pointAtShape(a, dt);
        if (profile.d.totalShapes - this.shapes0 >= 3 || this.t > 20) { this.clearArrows(); Audio.click(); this.show('upgrade'); this.sp0 = a.me.sp; }
      } else if (this.step === 'upgrade') {
        if (G.hud.eOpen || G.hud.qOpen || a.me.sp < this.sp0 || this.t > 14) this.finish(false);
      }
    }
  }

  // animated chevrons on the floor from the player to a target
  drawPath(scene, x0, z0, x1, z1, dt) {
    if (!this.arrows) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.9, -0.7); shape.lineTo(0, 0.5); shape.lineTo(0.9, -0.7); shape.lineTo(0.9, -0.1); shape.lineTo(0, 1.1); shape.lineTo(-0.9, -0.1); shape.closePath();
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      this.arrows = { group: new THREE.Group(), list: [], geo };
      for (let i = 0; i < 24; i++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
        m.scale.setScalar(1.6);
        m.renderOrder = 4;
        this.arrows.group.add(m);
        this.arrows.list.push(m);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 5, 40), new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2;
      this.arrows.ring = ring;
      this.arrows.group.add(ring);
      scene.add(this.arrows.group);
    }
    const A = this.arrows;
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    const ux = dx / (L || 1), uz = dz / (L || 1);
    const ang = Math.atan2(-ux, -uz); // the arrow tip points -z after rotateX(-90deg)
    const spacing = 3.2, phase = (this.t * 6) % spacing;
    A.list.forEach((m, i) => {
      const d = 4 + i * spacing + phase;
      if (d > L - 3) { m.visible = false; return; }
      m.visible = true;
      m.position.set(x0 + ux * d, 0.12, z0 + uz * d);
      m.rotation.y = ang;
      const wave = 0.5 + 0.5 * Math.sin(this.t * 6 - i * 0.7);
      m.material.opacity = 0.35 + 0.6 * wave;
    });
    A.ring.position.set(x1, 0.14, z1 + 2);
    A.ring.scale.setScalar(1 + 0.12 * Math.sin(this.t * 5));
  }

  // bouncing arrow over the nearest small shape
  pointAtShape(a, dt) {
    const snap = a.snaps[a.snaps.length - 1];
    if (!snap) return;
    let best = null, bd = 1e9;
    const px = a.renderX(), pz = a.renderZ();
    for (const s of snap.sh) {
      if (s[1] > 1) continue; // cubes only
      const d = (s[2] - px) ** 2 + (s[3] - pz) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return;
    if (!this.pointer) {
      const g = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 4), new THREE.MeshBasicMaterial({ color: 0xffd21f, toneMapped: false }));
      cone.rotation.x = Math.PI;
      g.add(cone);
      this.pointer = g;
      a.root.add(g);
    }
    if (this.pointer.parent !== a.root) a.root.add(this.pointer);
    this.pointer.position.set(best[2], 4 + Math.abs(Math.sin(this.t * 4)) * 1.2, best[3]);
    this.pointer.rotation.y += dt * 3;
  }

  clearArrows() {
    if (this.arrows) {
      this.arrows.group.parent && this.arrows.group.parent.remove(this.arrows.group);
      this.arrows.list.forEach((m) => m.material.dispose());
      this.arrows.ring.material.dispose();
      this.arrows.geo.dispose();
      this.arrows = null;
    }
    if (this.pointer) { this.pointer.parent && this.pointer.parent.remove(this.pointer); this.pointer = null; }
  }
}

