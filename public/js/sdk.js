// Thin, failure-proof wrapper around the CrazyGames HTML5 SDK v3.
// Everything degrades gracefully when the SDK is missing (local dev / other hosts).
const muteListeners = new Set();

export const SDK = {
  sdk: null,
  env: 'disabled',
  playing: false,
  settings: { muteAudio: false, disableChat: false },

  async init() {
    try {
      const cg = window.CrazyGames && window.CrazyGames.SDK;
      if (!cg) return;
      await cg.init();
      this.sdk = cg;
      this.env = cg.environment || 'crazygames';
      try {
        this.settings = Object.assign(this.settings, cg.game.settings || {});
        cg.game.addSettingsChangeListener((s) => {
          this.settings = Object.assign(this.settings, s || {});
          muteListeners.forEach((f) => f());
        });
      } catch { /* old sdk */ }
    } catch (e) {
      console.warn('[sdk] init failed', e);
      this.sdk = null;
    }
  },

  get available() { return !!this.sdk && this.env !== 'disabled'; },

  call(fn) {
    if (!this.sdk) return undefined;
    try { return fn(this.sdk); } catch (e) { console.warn('[sdk]', e); return undefined; }
  },

  loadingStart() { this.call((s) => s.game.loadingStart()); },
  loadingStop() { this.call((s) => s.game.loadingStop()); },
  gameplayStart() {
    if (this.playing) return;
    this.playing = true;
    this.call((s) => s.game.gameplayStart());
  },
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    this.call((s) => s.game.gameplayStop());
  },
  happytime() { this.call((s) => s.game.happytime()); },

  onAudioChange(f) { muteListeners.add(f); },
  get muted() { return !!this.settings.muteAudio; },
  get chatDisabled() { return !!this.settings.disableChat; },

  async getUser() {
    if (!this.sdk) return null;
    try { return await this.sdk.user.getUser(); } catch { return null; }
  },

  // --- persistence: CrazyGames data module (synced to the player's CrazyGames account)
  // plus a localStorage mirror. Both are always written; reads return both copies.
  getItems(k) {
    let cg = null, ls = null;
    try { if (this.sdk && this.sdk.data) cg = this.sdk.data.getItem(k); } catch { cg = null; }
    try { ls = localStorage.getItem(k); } catch { ls = null; }
    return { cg, ls };
  },
  getItem(k) {
    const { cg, ls } = this.getItems(k);
    return cg != null ? cg : ls;
  },
  setItem(k, v) {
    try { if (this.sdk && this.sdk.data) this.sdk.data.setItem(k, v); } catch (e) { console.warn('[sdk] data.setItem failed', e); }
    try { localStorage.setItem(k, v); } catch { /* private mode */ }
  },

  // --- multiplayer invites
  inviteLink(params) {
    const r = this.call((s) => s.game.inviteLink(params));
    if (r) return r;
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  },
  getInviteParam(name) {
    const r = this.call((s) => s.game.getInviteParam(name));
    if (r) return r;
    try { return new URL(location.href).searchParams.get(name); } catch { return null; }
  },
  showInviteButton(params) { return this.call((s) => s.game.showInviteButton(params)); },
  hideInviteButton() { this.call((s) => s.game.hideInviteButton()); },
  get instantMultiplayer() { return !!this.call((s) => s.game.isInstantMultiplayer); },
};
