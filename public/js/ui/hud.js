// Always-on HUD: XP bar, Q/E panels, side buttons, leaderboard, toasts, chat.
import { STATS } from '../../shared/config.js';
import { xpForLevel, fmt, fmtFull } from '../../shared/progression.js';
import { tankIcon } from '../render/thumbs.js';
import { profile, rankTier, dayId } from '../profile.js';
import { SDK } from '../sdk.js';
import { Audio } from '../audio.js';
import { ic, STAT_ICONS } from './icons.js';

const $ = (sel, root = document) => root.querySelector(sel);

export function createHUD(G) {
  const root = document.getElementById('hud');
  root.innerHTML = `
  <div id="chat">
    <div class="log"></div>
    <input class="hidden" maxlength="80" placeholder="Type a message, Enter to send">
  </div>
  <div id="topbar">
    <div class="rbtn sq qe arena-only" id="qbtn" title="Tank upgrades (Q)"><img class="tico" alt=""><span class="kl lbl">Q</span><span class="badge br hidden"></span></div>
    <div id="xpwrap">
      <div id="xpbar">
        <div class="track"><div class="fill"><div class="gloss"></div><div class="shine"></div></div></div>
        <div class="txt lbl"></div>
        <span class="star l">${ic('star', 54).replace('url(#icol)', 'url(#icolT)')}</span><span class="star r">${ic('star', 54).replace('url(#icol)', 'url(#icolT)')}</span>
      </div>
      <div id="lvl" class="lbl"></div>
    </div>
    <div class="rbtn sq qe teal arena-only" id="ebtn" title="Stat upgrades (E)">${ic('statup', 40)}<span class="kl lbl">E</span><span class="badge br hidden"></span></div>
    <div id="xpgain"></div>
  </div>
  <div id="teamscore" class="hidden"></div>
  <div class="rbtn wbtn yellow hidden" id="b-recover" title="Restore the tank and stats you had when you died">${ic('reload', 26).replace(' filter="url(#icol)"', '')}<span class="lbl">Recover Last</span></div>
  <div id="qpanel" class="hidden"></div>
  <div id="epanel" class="hidden"></div>
  <div id="left">
    <div class="rbtn big yellow" id="b-store">${ic('basket', 50)}<span class="lbl">Store</span><span class="badge hidden"></span></div>
    <div class="rbtn big lobby-only" id="b-bag">${ic('box', 46)}<span class="lbl">Bag</span></div>
    <div class="rbtn big arena-only" id="b-list">${ic('target', 46)}<span class="lbl">List</span></div>
    <div class="rbtn big" id="b-index">${ic('book', 46)}<span class="lbl">Index</span><span class="key">X</span></div>
    <div class="row mini-row">
      <div class="rbtn mini" id="b-settings" title="Settings">${ic('gear', 24)}</div>
      <div class="rbtn mini" id="b-invite" title="Invite friends">${ic('people', 24)}</div>
    </div>
  </div>
  <div id="right">
    <div class="gems" id="gems" title="Gems">${ic('plus', 26)}<span class="v lbl">0</span>${ic('gem', 30)}</div>
    <div class="row">
      <div class="rbtn big" id="b-gifts">${ic('gift', 48)}<span class="lbl">Gifts</span><span class="key">G</span><span class="badge hidden"></span></div>
      <div class="rbtn big" id="b-quest">${ic('clipboard', 46)}<span class="lbl">Quest</span><span class="badge hidden"></span></div>
    </div>
    <div class="rbtn wbtn" id="b-rank"><span class="lbl rk">Rank 1</span>${ic('shield', 30)}<span class="badge hidden"></span></div>
    <div class="rbtn wbtn" id="xpad" title="Free XP (every 3 minutes)"><i class="cd"></i><span class="lbl v">+1,000</span>${ic('star', 30)}</div>
  </div>
  <div id="bottomleft">
    <div class="rbtn wbtn arena-only" id="b-leave" title="Return to lobby">${ic('door', 26)}<span class="lbl lv">Lobby</span></div>
  </div>
  <div id="bottomright">
    <div class="rbtn tog" id="t-fire" title="Auto fire (F)">${ic('burst', 30)}<span class="key l">F</span></div>
    <div class="rbtn tog" id="t-flip" title="Turn camera 180 degrees (C)"><span class="lbl" style="font-size:15px">180</span><span class="key l">C</span></div>
    <div class="rbtn tog" id="t-spin" title="Auto spin (R)">${ic('spin', 30).replace(' filter="url(#icol)"', '')}<span class="key l">R</span></div>
    <div class="rbtn tog" id="t-lock" title="Shift lock camera (Shift)">${ic('unlock', 28)}</div>
  </div>
  <div id="bottomcenter" class="lobby-only"><div class="rbtn playbtn green" id="playbtn">${ic('play', 30)}<span class="lbl">Play</span></div></div>
  <div id="toasts"></div>
  <div id="bigmsg" class="lbl"></div>`;

  const els = {
    xpFill: $('#xpbar .fill', root), xpTxt: $('#xpbar .txt', root), lvl: $('#lvl', root), xpbar: $('#xpbar', root),
    gems: $('#gems .v', root), q: $('#qpanel', root), e: $('#epanel', root),
    qBadge: $('#qbtn .badge', root), eBadge: $('#ebtn .badge', root), toasts: $('#toasts', root), qIcon: $('#qbtn .tico', root),
    giftsBadge: $('#b-gifts .badge', root), questBadge: $('#b-quest .badge', root), rankBadge: $('#b-rank .badge', root),
    rank: $('#b-rank .rk', root), xpad: $('#xpad .v', root), big: $('#bigmsg', root), gain: $('#xpgain', root),
    chatLog: $('#chat .log', root), chatIn: $('#chat input', root), storeBadge: $('#b-store .badge', root),
    leave: $('#b-leave', root), leaveTxt: $('#b-leave .lv', root), lock: $('#t-lock', root),
  };
  els.qIcon.src = tankIcon('double');

  const click = (id, fn) => $(id, root).addEventListener('click', (e) => { Audio.unlock(); Audio.click(); fn(e); });
  click('#b-store', () => G.menus.open('store'));
  click('#b-bag', () => G.menus.open('bag'));
  click('#b-list', () => G.menus.open('list'));
  click('#b-index', () => G.menus.open('index'));
  click('#b-settings', () => G.menus.open('settings'));
  click('#b-leave', () => G.leaveMatch());
  click('#b-invite', () => G.invite());
  click('#gems', () => G.menus.open('store', 'gems'));
  click('#b-gifts', () => G.menus.open('gifts'));
  click('#b-quest', () => G.menus.open('quests'));
  click('#b-rank', () => G.menus.open('rank'));
  click('#xpad', () => G.claimXp());
  click('#b-recover', () => G.arena && G.arena.recoverLast());
  // free XP cooldown: dimmed button, draining fill and a mm:ss countdown until it is ready again
  setInterval(() => {
    const btn = $('#xpad', root);
    const left = Math.max(0, (profile.d.store.xpAdAt || 0) - Date.now());
    const cool = left > 0;
    btn.classList.toggle('cooling', cool);
    btn.querySelector('.cd').style.width = cool ? `${(left / 180000) * 100}%` : '0%';
    const sec = Math.ceil(left / 1000);
    const txt = cool ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '+1,000';
    if (els.xpad.textContent !== txt) els.xpad.textContent = txt;
  }, 250);
  click('#playbtn', () => G.play('ffa'));
  click('#qbtn', () => hud.toggleQ());
  click('#ebtn', () => hud.toggleE());
  click('#t-fire', () => G.toggle('autoFire'));
  click('#t-flip', () => G.toggle('flip'));
  click('#t-spin', () => G.toggle('autoSpin'));
  click('#t-lock', () => G.toggle('lock'));

  els.chatIn.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const v = els.chatIn.value.trim();
      if (v) G.sendChat(v);
      els.chatIn.value = '';
      hud.closeChat();
    } else if (e.key === 'Escape') hud.closeChat();
  });

  let lastXp = null, lastLv = null;

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
      this.setCombat(0);
      if (mode !== 'arena') { this.renderTeams(null); this.setRecover(false); }
    },

    setToggles(t) {
      $('#t-fire', root).classList.toggle('on', !!t.autoFire);
      $('#t-spin', root).classList.toggle('on', !!t.autoSpin);
      els.lock.classList.toggle('on', !!t.lock);
      els.lock.innerHTML = ic(t.lock ? 'lock' : 'unlock', 28);
    },

    // In-match "Lobby" button: turns red while in combat (leaving then counts as a kill).
    setCombat(sec) {
      const c = sec > 0;
      els.leave.classList.toggle('red', c);
      els.leaveTxt.textContent = c ? `Combat ${Math.ceil(sec)}s` : 'Lobby';
    },

    refresh() {
      const d = profile.d;
      const need = xpForLevel(d.level);
      const pct = Math.min(100, (d.xp / need) * 100);
      if (lastLv !== null && d.level > lastLv) {
        els.xpFill.style.transition = 'none';
        els.xpFill.style.width = '0%';
        requestAnimationFrame(() => { els.xpFill.style.transition = ''; els.xpFill.style.width = pct + '%'; });
        this.pulse();
      } else els.xpFill.style.width = pct + '%';
      if (lastXp !== null && lastLv === d.level && d.xp > lastXp) this.gainPop(d.xp - lastXp);
      lastXp = d.xp;
      lastLv = d.level;
      els.xpTxt.textContent = `${fmt(d.xp)}/${fmt(need)}`;
      els.lvl.textContent = `Level ${d.level}`;
      els.gems.textContent = fmt(d.gems);
      els.rank.textContent = `Rank ${d.rank.idx}`;
      els.rank.parentElement.title = `${rankTier(d.rank.idx)} Rank ${d.rank.idx}`;
      badge(els.giftsBadge, profile.giftsReady());
      $('#b-gifts', root).classList.toggle('ready', profile.giftsReady() > 0);
      badge(els.questBadge, profile.questsReady());
      badge(els.rankBadge, profile.rankReady());
      badge(els.storeBadge, d.store.starterDay !== dayId() ? 1 : 0);
    },

    pulse() {
      els.xpbar.classList.remove('pulse');
      void els.xpbar.offsetWidth;
      els.xpbar.classList.add('pulse');
    },
    gainPop(n) {
      const el = document.createElement('div');
      el.className = 'gainpop lbl';
      el.textContent = '+' + fmt(n);
      els.gain.appendChild(el);
      while (els.gain.children.length > 3) els.gain.firstChild.remove();
      setTimeout(() => el.remove(), 900);
      els.xpbar.classList.remove('bump');
      void els.xpbar.offsetWidth;
      els.xpbar.classList.add('bump');
    },

    // ---------------- Q (tank upgrades)
    toggleQ() { if (this.mode !== 'arena') return; this.qOpen ? this.closeQ() : this.openQ(); },
    openQ() { this.qOpen = true; this.closeE(); els.q.classList.remove('hidden'); $('#topbar', root).classList.add('mode-q'); this._qKey = ''; G.arena && G.arena.refreshQ(); },
    closeQ() { this.qOpen = false; els.q.classList.add('hidden'); $('#topbar', root).classList.remove('mode-q'); },
    renderQ(opts) {
      badge(els.qBadge, opts.filter((o) => o.usable).length);
      if (!this.qOpen) return;
      const key = opts.map((o) => o.def.id + o.tag).join();
      if (key === this._qKey) return;
      this._qKey = key;
      if (!opts.length) {
        els.q.innerHTML = '<div class="tcard empty lbl">No upgrades right now.<br>Level up to unlock more!</div>';
        return;
      }
      els.q.innerHTML = '';
      for (const o of opts) {
        const c = document.createElement('div');
        c.className = 'tcard' + (o.usable ? '' : ' locked');
        const tagIcon = o.tagCls === 'gems' ? ic('gem', 14) : o.tagCls === 'quest' ? ic('clipboard', 14) : '';
        c.innerHTML = `<span class="nm lbl">${o.def.name}</span><img src="${tankIcon(o.def.id)}" alt=""><span class="tag lbl ${o.tagCls || ''}">${o.tag || ''}${tagIcon}</span>`;
        c.addEventListener('click', () => { Audio.click(); G.arena && G.arena.chooseUpgrade(o.def.id); });
        els.q.appendChild(c);
      }
    },

    // ---------------- E (stats)
    toggleE() { if (this.mode !== 'arena') return; this.eOpen ? this.closeE() : this.openE(); },
    openE() { this.eOpen = true; this._eRows = null; this.closeQ(); els.e.classList.remove('hidden'); $('#topbar', root).classList.add('mode-e'); this._eKey = ''; G.arena && G.arena.refreshE(); },
    closeE() { this.eOpen = false; els.e.classList.add('hidden'); $('#topbar', root).classList.remove('mode-e'); },
    renderE(me) {
      badge(els.eBadge, me ? me.sp : 0);
      if (!this.eOpen || !me) return;
      // Build the rows once per opening; afterwards only update the numbers (no rebuild = no flash).
      if (!this._eRows) {
        els.e.innerHTML = '';
        this._eRows = [];
        for (let i = 0; i < 8; i++) {
          const s = STATS[i];
          const row = document.createElement('div');
          row.className = 'stat';
          const left = i % 2 === 0;
          const capBtn = `<div class="cap" title="Raise the cap in the Upgrades Shop">${ic('gem', 20)}</div>`;
          row.innerHTML = `${left ? capBtn : ''}<div class="sb" style="--c:${s.color}">${ic(STAT_ICONS[i], 30)}<span class="lbl">${s.name}</span><span class="k">${i + 1}</span></div><div class="val lbl" style="--c:${s.color}">${me.st[i]}</div>${left ? '' : capBtn}`;
          row.querySelector('.sb').addEventListener('click', () => G.arena && G.arena.statUp(i));
          row.querySelector('.cap').addEventListener('click', () => G.menus.open('upgrades'));
          els.e.appendChild(row);
          this._eRows.push({ row, val: row.querySelector('.val'), v: me.st[i] });
        }
      }
      this._eRows.forEach((r, i) => {
        r.row.classList.toggle('maxed', me.st[i] >= me.cp[i]); // cap button shows only on maxed stats
        if (r.v === me.st[i]) return;
        r.v = me.st[i];
        r.val.textContent = r.v;
        r.val.classList.remove('bump'); void r.val.offsetWidth; r.val.classList.add('bump');
      });
      els.e.classList.toggle('nopts', me.sp <= 0);
    },

    renderLB() { /* leaderboards removed */ },

    setRecover(on) {
      const el = $('#b-recover', root);
      if (el.classList.contains('hidden') === !on) return;
      el.classList.toggle('hidden', !on || this.mode !== 'arena');
    },

    // team modes: live team scores under the XP bar
    renderTeams(scores, myTeam, target) {
      const el = $('#teamscore', root);
      if (!scores) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      const key = scores.join() + '|' + myTeam;
      if (key === this._tsKey) return;
      this._tsKey = key;
      const names = ['Blue', 'Red', 'Green', 'Purple'];
      const cols = ['#2f9dff', '#f0464f', '#3fcf5a', '#a64ef0'];
      const best = Math.max(...scores);
      el.innerHTML = scores.map((v, i) => `<div class="ts ${i + 1 === myTeam ? 'me' : ''} ${v === best && v > 0 ? 'lead' : ''}" style="--c:${cols[i]}">
        <span class="tn">${names[i]}</span><b class="lbl">${v}</b><i style="width:${Math.min(100, (v / target) * 100)}%"></i></div>`).join('') + `<div class="ts-goal">First to ${target} kills</div>`;
    },

    toast(text, cls = 'green', ms = 2200) {
      const el = document.createElement('div');
      el.className = `toast lbl ${cls}`;
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
