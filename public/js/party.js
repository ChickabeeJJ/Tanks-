// Parties: a lightweight WebSocket to the game server that stays open in the lobby.
// The leader picks a mode and starts; every member is then sent into the same server/team.
import { resolveServer } from './net.js';
import { profile } from './profile.js';
import { SDK } from './sdk.js';
import { MODES, partyCap } from '../shared/config.js';

export function createParty(G) {
  const P = {
    state: null, // { code, leader, mode, members:[{id,name,level,skin}], you, max }
    status: 'idle', // idle | connecting | online | offline
    error: '',
    ws: null,
    listeners: new Set(),
    on(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
    emit() { for (const f of this.listeners) { try { f(); } catch (e) { console.warn(e); } } },
    get inParty() { return !!this.state; },
    get isLeader() { return !!this.state && this.state.leader === this.state.you; },
    get size() { return this.state ? this.state.members.length : 0; },
    fits(mode) { return this.size <= partyCap(mode); },

    async connect() {
      if (this.ws && this.ws.readyState <= 1) return this.status === 'online' || this.waitOpen();
      this.status = 'connecting'; this.emit();
      const url = await resolveServer();
      if (!url) { this.status = 'offline'; this.emit(); return false; }
      return new Promise((resolve) => {
        let ws;
        try { ws = new WebSocket(url); } catch { this.status = 'offline'; this.emit(); resolve(false); return; }
        this.ws = ws;
        const to = setTimeout(() => { if (ws.readyState !== 1) { try { ws.close(); } catch { /* */ } this.status = 'offline'; this.emit(); resolve(false); } }, 12000);
        ws.onopen = () => { clearTimeout(to); this.status = 'online'; this.emit(); resolve(true); };
        ws.onerror = () => {};
        ws.onclose = () => {
          clearTimeout(to);
          const had = !!this.state;
          this.ws = null; this.state = null; this.status = 'offline';
          this.syncInvite();
          if (had) G.hud.toast('Lost connection to your party', 'red');
          this.emit();
          resolve(false);
        };
        ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } this.onMsg(m); };
      });
    },
    waitOpen() { return new Promise((r) => { const off = this.on(() => { if (this.status !== 'connecting') { off(); r(this.status === 'online'); } }); }); },
    send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
    me() { const d = profile.d; return { name: d.name || 'Guest', level: profile.level, skin: d.skin }; },

    onMsg(m) {
      if (m.t === 'party') {
        const was = this.state;
        this.state = m; this.error = '';
        if (!was) G.hud.toast(m.leader === m.you ? `Party ${m.code} created!` : `Joined party ${m.code}!`, 'green');
        else if (m.members.length > was.members.length) G.hud.toast(`${m.members[m.members.length - 1].name} joined the party`, 'blue');
        this.syncInvite();
      } else if (m.t === 'p_err') {
        this.error = m.msg; G.hud.toast(m.msg, 'red', 3000);
      } else if (m.t === 'p_left') {
        this.state = null; this.syncInvite(); G.hud.toast(m.reason || 'You left the party', 'red');
      } else if (m.t === 'p_go') {
        G.menus.close();
        G.hud.toast(`Party is heading into ${MODES[m.mode].name}!`, 'gold');
        G.play(m.mode, m.room, m.team);
      }
      this.emit();
    },

    async create() { if (await this.connect()) this.send({ t: 'p_create', ...this.me() }); },
    async join(code) { if (await this.connect()) this.send({ t: 'p_join', code, ...this.me() }); },
    leave() { this.send({ t: 'p_leave' }); this.state = null; this.syncInvite(); this.emit(); },
    setMode(mode) { if (this.isLeader) this.send({ t: 'p_mode', mode }); },
    kick(id) { if (this.isLeader) this.send({ t: 'p_kick', id }); },
    start() {
      if (!this.isLeader) return;
      const mode = this.state.mode;
      if (!this.fits(mode)) { G.hud.toast(`Party of ${this.size} is too big for ${MODES[mode].name} (max ${partyCap(mode)})`, 'red', 3000); return; }
      this.send({ t: 'p_start' });
    },
    inviteLink() { return this.state ? SDK.inviteLink({ party: this.state.code }) : ''; },

    // CrazyGames: the room the player is in (updateRoom / leftRoom) and their own invite button,
    // shown while the party menu is open (and in a match).
    menuOpen: false,
    syncInvite() {
      const inMatch = G.state === 'arena' && G.arena && G.arena.online && G.arena.roomId;
      if (this.state) {
        const params = { party: this.state.code };
        if (inMatch) { params.room = G.arena.roomId; params.mode = G.arena.mode; }
        SDK.updateRoom('party-' + this.state.code, this.size < this.state.max, params);
        if (this.menuOpen || inMatch) SDK.showInviteButton(params); else SDK.hideInviteButton();
      } else if (inMatch) {
        const params = { room: G.arena.roomId, mode: G.arena.mode };
        SDK.updateRoom(G.arena.roomId, true, params);
        SDK.showInviteButton(params);
      } else {
        SDK.leftRoom();
        SDK.hideInviteButton();
      }
    },
  };
  // keep the party's view of you current (level ups, skin changes)
  let lastSig = '';
  profile.on(() => {
    if (!P.state) return;
    const me = P.me(), sig = me.name + me.level + me.skin;
    if (sig !== lastSig) { lastSig = sig; P.send({ t: 'p_profile', ...me }); }
  });
  return P;
}
