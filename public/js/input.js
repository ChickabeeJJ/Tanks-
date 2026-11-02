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

  // Floating joysticks: touch the empty game area to spawn a stick under your thumb.
  // Left half = move. Right half = aim + shoot in battle (camera turn in the lobby).
  // Buttons are DOM elements above the canvas, so a stick can never cover or block them.
  touchMode: 'lobby',
  setupTouch() {
    this.touch = true;
    document.body.classList.add('touch');
    const root = document.getElementById('touch');
    const mk = (kind) => {
      const base = document.createElement('div');
      base.className = 'joy ' + kind;
      base.innerHTML = `<div class="ring"></div><div class="knob"><svg viewBox="0 0 24 24">${kind === 'move'
        ? '<path d="M12 3l3 4h-6zM12 21l-3-4h6zM3 12l4-3v6zM21 12l-4 3V9z" fill="currentColor"/>'
        : '<circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2.4"/>'}</svg></div>`;
      root.appendChild(base);
      return { base, knob: base.querySelector('.knob') };
    };
    const sticks = { move: mk('move'), aim: mk('aim') };
    const R = 58;
    const active = {}; // touch id -> { kind, cx, cy, lx }
    const show = (kind, x, y) => {
      const j = sticks[kind];
      j.base.style.left = x + 'px';
      j.base.style.top = y + 'px';
      j.base.classList.add('on');
      j.knob.style.transform = 'translate(-50%,-50%)';
    };
    const hide = (kind) => { sticks[kind].base.classList.remove('on'); };
    const stateOf = (kind) => (kind === 'move' ? this.joyMove : this.joyAim);
    this.canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth / 2;
        let kind = left ? 'move' : 'aim';
        if (!left && this.touchMode !== 'arena') kind = 'cam';
        if (Object.values(active).some((a) => a.kind === kind)) continue;
        active[t.identifier] = { kind, cx: t.clientX, cy: t.clientY, lx: t.clientX };
        if (kind !== 'cam') {
          show(kind, t.clientX, t.clientY);
          const st = stateOf(kind);
          st.active = true; st.x = 0; st.y = 0; st.mag = 0;
        }
      }
      e.preventDefault();
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const a = active[t.identifier];
        if (!a) continue;
        if (a.kind === 'cam') { this.dragYaw += (t.clientX - a.lx) * 1.5; a.lx = t.clientX; continue; }
        let dx = t.clientX - a.cx, dy = t.clientY - a.cy;
        const m = Math.hypot(dx, dy);
        if (m > R) { // the stick follows your thumb if you drag past the edge
          a.cx += (dx / m) * (m - R); a.cy += (dy / m) * (m - R);
          sticks[a.kind].base.style.left = a.cx + 'px';
          sticks[a.kind].base.style.top = a.cy + 'px';
          dx = t.clientX - a.cx; dy = t.clientY - a.cy;
        }
        const st = stateOf(a.kind);
        st.x = dx / R; st.y = dy / R; st.mag = Math.min(1, Math.hypot(dx, dy) / R);
        sticks[a.kind].knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        const a = active[t.identifier];
        if (!a) continue;
        delete active[t.identifier];
        if (a.kind === 'cam') continue;
        const st = stateOf(a.kind);
        st.active = false; st.x = st.y = st.mag = 0;
        hide(a.kind);
      }
    };
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('touchcancel', end);
  },
};
