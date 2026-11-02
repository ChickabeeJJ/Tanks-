// Always-on HUD: XP bar, Q/E panels, side buttons, leaderboard, toasts, chat.
import { STATS } from '../../shared/config.js';
import { xpForLevel, fmt, fmtFull } from '../../shared/progression.js';
import { tankIcon } from '../render/textures.js';
import { profile, rankTier, dayId } from '../profile.js';
import { SDK } from '../sdk.js';
import { Audio } from '../audio.js';

const $ = (sel, root = document) => root.querySelector(sel);

export function createHUD(G) {
  const root = document.getElementById('hud');
  root.innerHTML = `
  <div id="chat">
    <div class="log"></div>
    <input class="hidden" maxlength="80" placeholder="Type a message, Enter to send">
  </div>
  <div id="topbar">
    <div class="rbtn qe arena-only" id="qbtn" title="Tank upgrades (Q)"><img class="ico" style="width:36px;height:36px" src="${tankIcon('double', 64)}"><span class="key">Q</span><span class="badge hidden"></span></div>
    <div id="xpwrap"><div id="xpbar"><div class="fill"></div><span class="star l">⭐</span><div class="txt stroke"></div><span class="star r">⭐</span></div><div id="lvl" class="stroke"></div></div>
    <div class="rbtn qe arena-only" id="ebtn" title="Stat upgrades (E)" style="background:linear-gradient(#6ff07f,#22b947)"><span class="ico">⏫</span><span class="key">E</span><span class="badge hidden"></span></div>
  </div>
  <div id="qpanel" class="hidden"></div>
  <div id="epanel" class="hidden"></div>
  <div id="lb" class="hidden arena-only"></div>
  <div id="left">
    <div class="rbtn" id="b-store" style="background:linear-gradient(#ffe36b,#f5ad13)"><span class="ico">🧺</span><span class="stroke-s">Store</span><span class="badge hidden"></span></div>
    <div class="rbtn lobby-only" id="b-bag" style="background:linear-gradient(#e0a26a,#a8642c)"><span class="ico">🎒</span><span class="stroke-s">Bag</span></div>
    <div class="rbtn arena-only" id="b-list" style="background:linear-gradient(#ff8b97,#e3283c)"><span class="ico">📜</span><span class="stroke-s">List</span></div>
    <div class="rbtn" id="b-index"><span class="ico">📘</span><span class="stroke-s">Index</span><span class="key">X</span></div>
    <div class="row">
      <div class="mini" id="b-settings" title="Settings">⚙️</div>
      <div class="mini arena-only" id="b-leave" title="Back to lobby" style="background:linear-gradient(#ffb070,#e0681e)">🏠</div>
      <div class="mini" id="b-invite" title="Invite friends" style="background:linear-gradient(#6ff07f,#22b947)">👥</div>
    </div>
  </div>
  <div id="right">
    <div class="pill" id="gems" title="Gems"><span>➕</span><span class="v stroke-s">0</span><span>💎</span></div>
    <div class="row">
      <div class="rbtn" id="b-gifts" style="background:linear-gradient(#ff8b97,#e3283c)"><span class="ico">🎁</span><span class="stroke-s">Gifts</span><span class="key">G</span><span class="badge hidden"></span></div>
      <div class="rbtn" id="b-quest" style="background:linear-gradient(#ffffff,#c9d8e6)"><span class="ico">📋</span><span class="stroke-s">Quest</span><span class="badge hidden"></span></div>
    </div>
    <div class="rbtn wbtn" id="b-rank"><span class="stroke-s rk">Rank 1</span><span>🛡️</span><span class="badge hidden"></span></div>
    <div class="rbtn wbtn" id="xpad" title="Watch an ad for XP"><span class="stroke-s v">+0</span><span>⭐</span></div>
  </div>
  <div id="bottomright">
    <div class="rbtn tog" id="t-fire" title="Auto fire (F)"><span>💥</span><span class="key">F</span></div>
    <div class="rbtn tog" id="t-flip" title="Turn camera 180° (C)"><span class="stroke-s" style="font-size:15px">180</span><span class="key">C</span></div>
    <div class="rbtn tog" id="t-spin" title="Auto spin (R)"><span>🔄</span><span class="key">R</span></div>
    <div class="rbtn tog" id="t-lock" title="Shift lock camera (Shift)"><span>🔒</span></div>
  </div>
  <div id="bottomcenter" class="lobby-only"><button class="btn green stroke" id="playbtn">▶ Play</button></div>
  <div id="toasts"></div>
  <div id="bigmsg" class="stroke"></div>`;

  const els = {
    xpFill: $('#xpbar .fill', root), xpTxt: $('#xpbar .txt', root), lvl: $('#lvl', root),
    gems: $('#gems .v', root), q: $('#qpanel', root), e: $('#epanel', root), lb: $('#lb', root),
    qBadge: $('#qbtn .badge', root), eBadge: $('#ebtn .badge', root), toasts: $('#toasts', root),
    giftsBadge: $('#b-gifts .badge', root), questBadge: $('#b-quest .badge', root), rankBadge: $('#b-rank .badge', root),
    rank: $('#b-rank .rk', root), xpad: $('#xpad .v', root), big: $('#bigmsg', root),
    chatLog: $('#chat .log', root), chatIn: $('#chat input', root), storeBadge: $('#b-store .badge', root),
  };

  const click = (id, fn) => $(id, root).addEventListener('click', (e) => { Audio.unlock(); Audio.click(); fn(e); });
  click('#b-store', () => G.menus.open('store'));
  click('#b-bag', () => G.menus.open('bag'));
  click('#b-list', () => G.menus.open('list'));
  click('#b-index', () => G.menus.open('index'));
  click('#b-settings', () => G.menus.open('settings'));
  click('#b-leave', () => G.toLobby());
  click('#b-invite', () => G.invite());
  click('#gems', () => G.menus.open('store', 'gems'));
  click('#b-gifts', () => G.menus.open('gifts'));
  click('#b-quest', () => G.menus.open('quests'));
  click('#b-rank', () => G.menus.open('rank'));
  click('#xpad', () => G.adXp());
  click('#playbtn', () => G.play('ffa'));
  click('#qbtn', () => hud.toggleQ());
  click('#ebtn', () => hud.toggleE());
  click('#t-fire', () => G.toggle('autoFire'));
  click('#t-flip', () => G.toggle('flip'));
  click('#t-spin', () => G.toggle('autoSpin'));
  click('#t-lock', () => G.toggle('lock'));

  // chat
  els.chatIn.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const v = els.chatIn.value.trim();
      if (v) G.sendChat(v);
      els.chatIn.value = '';
      hud.closeChat();
    } else if (e.key === 'Escape') hud.closeChat();
  });

  const hud = {
    els,
    qOpen: false,
    eOpen: false,
    mode: 'lobby',

    setMode(mode) {
      this.mode = mode;
      document.body.classList.toggle('in-arena', mode === 'arena');
      document.body.classList.toggle('in-lobby', mode === 'lobby');
      root.querySelectorAll('.arena-only').forEach((el) => el.classList.toggle('hidden', mode !== 'arena'));
      root.querySelectorAll('.lobby-only').forEach((el) => el.classList.toggle('hidden', mode !== 'lobby'));
      if (mode !== 'arena') { this.closeQ(); this.closeE(); }
      els.lb.classList.toggle('hidden', mode !== 'arena');
    },

    setToggles(t) {
      $('#t-fire', root).classList.toggle('on', !!t.autoFire);
      $('#t-spin', root).classList.toggle('on', !!t.autoSpin);
      $('#t-lock', root).classList.toggle('on', !!t.lock);
    },

    refresh() {
      const d = profile.d;
      const need = xpForLevel(d.level);
      els.xpFill.style.width = `${Math.min(100, (d.xp / need) * 100)}%`;
      els.xpTxt.textContent = `${fmt(d.xp)}/${fmt(need)}`;
      els.lvl.textContent = `Level ${d.level}`;
      els.gems.textContent = fmt(d.gems);
      els.rank.textContent = `Rank ${d.rank.idx}`;
      els.rank.parentElement.title = `${rankTier(d.rank.idx)} Rank ${d.rank.idx}`;
      els.xpad.textContent = '+' + fmtFull(profile.xpLv(0.25));
      badge(els.giftsBadge, profile.giftsReady());
      badge(els.questBadge, profile.questsReady());
      badge(els.rankBadge, profile.rankReady());
      badge(els.storeBadge, d.store.starterDay !== dayId() ? 1 : 0);
    },

    // ---------------- Q (tank upgrades)
    toggleQ() { if (this.mode !== 'arena') return; this.qOpen ? this.closeQ() : this.openQ(); },
    openQ() { this.qOpen = true; this.closeE(); els.q.classList.remove('hidden'); G.arena && G.arena.refreshQ(); },
    closeQ() { this.qOpen = false; els.q.classList.add('hidden'); },
    renderQ(opts) {
      badge(els.qBadge, opts.filter((o) => o.usable).length);
      if (!this.qOpen) return;
      if (!opts.length) {
        els.q.innerHTML = '<div class="tcard" style="width:240px;grid-column:span 5;height:auto;padding:8px">No upgrades right now.<br>Level up to unlock more!</div>';
        return;
      }
      els.q.innerHTML = '';
      for (const o of opts) {
        const c = document.createElement('div');
        c.className = 'tcard stroke-s';
        c.innerHTML = `<span class="nm">${o.def.name}</span><img src="${tankIcon(o.def.id, 96)}"><span class="tag ${o.tagCls || ''}">${o.tag || ''}</span>`;
        c.addEventListener('click', () => { Audio.click(); G.arena && G.arena.chooseUpgrade(o.def.id); });
        els.q.appendChild(c);
      }
    },

    // ---------------- E (stats)
    toggleE() { if (this.mode !== 'arena') return; this.eOpen ? this.closeE() : this.openE(); },
    openE() { this.eOpen = true; this.closeQ(); els.e.classList.remove('hidden'); this._eKey = ''; G.arena && G.arena.refreshE(); },
    closeE() { this.eOpen = false; els.e.classList.add('hidden'); },
    renderE(me) {
      badge(els.eBadge, me ? me.sp : 0);
      if (!this.eOpen || !me) return;
      const key = me.st.join() + '|' + me.cp.join() + '|' + me.sp;
      if (key === this._eKey) return;
      this._eKey = key;
      els.e.innerHTML = '';
      const order = [0, 1, 2, 3, 4, 5, 6, 7];
      for (const i of order) {
        const s = STATS[i];
        const maxed = me.st[i] >= me.cp[i];
        const row = document.createElement('div');
        row.className = 'stat' + (maxed ? ' maxed' : '');
        const capBtn = maxed ? '<div class="cap" title="Raise the cap in the Upgrades Shop">💎</div>' : '';
        const left = i % 2 === 0;
        row.innerHTML = `${left ? capBtn : ''}<div class="sb stroke-s" style="background:${s.color}"><span>${s.icon}</span><span>${s.name}</span><span class="k">${i + 1}</span></div><div class="val stroke-s" style="background:${s.color}">${me.st[i]}</div>${left ? '' : capBtn}`;
        row.querySelector('.sb').addEventListener('click', () => G.arena && G.arena.statUp(i));
        const cb = row.querySelector('.cap');
        if (cb) cb.addEventListener('click', () => G.menus.open('upgrades'));
        els.e.appendChild(row);
      }
    },

    renderLB(lb) {
      if (!lb) return;
      const max = Math.max(1, ...lb.rows.map((r) => r[1]));
      els.lb.innerHTML = lb.rows.slice(0, 6).map((r, i) => `
        <div class="r stroke-s ${r[2] ? 'me' : ''}"><span>${i + 1}</span><span class="n">${esc(r[0])}</span><span class="v">${r[1]}</span><div class="bar" style="width:${(r[1] / max) * 100}%"></div></div>`).join('')
        + (lb.you > 6 ? `<div class="you stroke-s">You: #${lb.you} of ${lb.n}</div>` : '');
    },

    // ---------------- toasts
    toast(text, cls = 'green', ms = 2200) {
      const el = document.createElement('div');
      el.className = `toast stroke ${cls}`;
      el.textContent = text;
      els.toasts.appendChild(el);
      while (els.toasts.children.length > 4) els.toasts.firstChild.remove();
      setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-14px)'; }, ms);
      setTimeout(() => el.remove(), ms + 450);
    },
    big(text, ms = 1600) {
      els.big.textContent = text;
      clearTimeout(this._bigT);
      this._bigT = setTimeout(() => { els.big.textContent = ''; }, ms);
    },

    // ---------------- chat
    openChat() {
      if (SDK.chatDisabled) { this.toast('Chat is disabled in your settings', 'red'); return; }
      els.chatIn.classList.remove('hidden');
      els.chatIn.focus();
    },
    closeChat() { els.chatIn.blur(); els.chatIn.classList.add('hidden'); },
    chatLine(name, msg, color) {
      if (SDK.chatDisabled && name) return;
      const l = document.createElement('div');
      l.className = 'l';
      l.innerHTML = name ? `<b style="color:${color || '#ffd84a'}">${esc(name)}:</b> ${esc(msg)}` : `<i>${esc(msg)}</i>`;
      els.chatLog.appendChild(l);
      while (els.chatLog.children.length > 8) els.chatLog.firstChild.remove();
      setTimeout(() => l.classList.add('old'), 15000);
    },
  };
  return hud;
}

function badge(el, n) {
  el.classList.toggle('hidden', !n);
  el.textContent = n > 99 ? '99+' : n;
}
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
