// Keyboard / mouse / touch input. Exposes a polled state + action callbacks.
export const Input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, nx: 0, ny: 0, down: false, right: false },
  wheel: 0,
  dragYaw: 0,
  lockDX: 0,
  locked: false,
  touch: false,
  joyMove: { x: 0, y: 0, active: false },
  joyAim: { x: 0, y: 0, active: false, mag: 0 },
  onKey: null, // (code, event) => void   (for one-shot actions)
  canvas: null,
  typing: false,

  init(canvas) {
    this.canvas = canvas;
    const isTyping = (e) => {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    };
    // Held-key tracking. A key only counts as held until we see its keyup, OR until anything
    // happens that can swallow that keyup (focus/menu/pointer-lock changes, OS shortcuts).
    // Without this, keys get "stuck" and the tank keeps drifting in that direction.
    const MODS = ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight'];
    const release = () => this.releaseAll();
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      // Browser/OS shortcuts (Ctrl+…, Cmd+…, Alt+…) often never deliver the keyup: don't track them,
      // and drop everything held because focus may be about to move.
      if (e.ctrlKey || e.metaKey || (e.altKey && !MODS.includes(e.code))) { release(); return; }
      if (!e.repeat && this.onKey) this.onKey(e.code, e);
      if (!MODS.includes(e.code)) this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      // macOS never sends keyup for keys released while Cmd is held; Alt/Win can move focus to the OS/browser UI.
      if (['MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'AltLeft', 'AltRight', 'ContextMenu'].includes(e.code)) release();
    });
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    document.addEventListener('focusin', (e) => { if (isTyping(e)) release(); });
    // block the browser's right-click menu everywhere (right-drag rotates the camera, like Roblox).
    // The menu never opens, so held keys stay held.
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('mousemove', (e) => {
      // trust the real button state (a release outside the window never fires mouseup)
      if (!(e.buttons & 1)) this.mouse.down = false;
      if (!(e.buttons & 2)) this.mouse.right = false;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.ny = -(e.clientY / window.innerHeight) * 2 + 1;
      if (this.locked) this.lockDX += e.movementX;
      else if (this.mouse.right) this.dragYaw += e.movementX;
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) this.setupTouch();
  },

  releaseAll() {
    this.keys.clear();
    this.mouse.down = false;
    this.mouse.right = false;
  },

  down(...codes) { return codes.some((c) => this.keys.has(c)); },

  requestLock() { try { this.canvas.requestPointerLock(); } catch { /* not allowed */ } },
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); },

  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; },
  consumeYaw() { const y = this.dragYaw; this.dragYaw = 0; return y; },
  consumeLock() { const y = this.lockDX; this.lockDX = 0; return y; },

  // move vector in camera space: {f: forward, r: right}
  moveAxes() {
    let f = 0, r = 0;
    if (this.down('KeyW', 'ArrowUp')) f += 1;
    if (this.down('KeyS', 'ArrowDown')) f -= 1;
    if (this.down('KeyD', 'ArrowRight')) r += 1;
    if (this.down('KeyA', 'ArrowLeft')) r -= 1;
    if (this.joyMove.active) { f = -this.joyMove.y; r = this.joyMove.x; }
    const m = Math.hypot(f, r);
    if (m > 1) { f /= m; r /= m; }
    return { f, r };
  },

  firing() {
    return this.mouse.down || this.down('Space') || (this.joyAim.active && this.joyAim.mag > 0.35);
  },

  setupTouch() {
    this.touch = true;
    document.body.classList.add('touch');
    const root = document.getElementById('touch');
    const mk = (side) => {
      const base = document.createElement('div');
      base.className = 'joy ' + side;
      const knob = document.createElement('div');
      knob.className = 'knob';
      base.appendChild(knob);
      root.appendChild(base);
      return { base, knob };
    };
    const L = mk('left'), R = mk('right');
    const bind = (j, state) => {
      let id = null, cx = 0, cy = 0;
      const rad = 55;
      j.base.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        id = t.identifier;
        const r = j.base.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        state.active = true;
        move(t);
        e.preventDefault();
      }, { passive: false });
      const move = (t) => {
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const m = Math.hypot(dx, dy);
        if (m > rad) { dx = (dx / m) * rad; dy = (dy / m) * rad; }
        state.x = dx / rad;
        state.y = dy / rad;
        state.mag = Math.min(1, m / rad);
        j.knob.style.transform = `translate(${dx}px,${dy}px)`;
      };
      window.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) if (t.identifier === id) { move(t); e.preventDefault(); }
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === id) {
          id = null; state.active = false; state.x = state.y = state.mag = 0;
          j.knob.style.transform = '';
        }
      };
      window.addEventListener('touchend', end);
      window.addEventListener('touchcancel', end);
    };
    bind(L, this.joyMove);
    bind(R, this.joyAim);
    // one-finger drag on empty canvas rotates the camera
    let cid = null, lx = 0;
    this.canvas.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; cid = t.identifier; lx = t.clientX; }, { passive: true });
    this.canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === cid) { this.dragYaw += (t.clientX - lx) * 1.5; lx = t.clientX; }
    }, { passive: true });
  },
};
