// All popup windows: Store, Gifts, Quests, Rank, Index, Bag, Wheel, Chests, Shops, Settings...
import { profile, QUESTS, GIFTS, WHEEL, CHESTS, STORE_GEMS, RANK_TASKS, RANK_TIERS, RANK_COLORS, rankTier, rankNeed, MAX_RANK, capPrice, boostPrice, dayId } from '../profile.js';
import { TANK_LIST, TANKS, childrenOf, pathTo } from '../../shared/tanks.js';
import { SKINS, SKIN_MAP, RARITY } from '../../shared/skins.js';
import { STATS, BASE_CAP, MAX_CAP, MODES } from '../../shared/config.js';
import { fmt, fmtFull } from '../../shared/progression.js';
import { skinPreview } from '../render/textures.js';
import { tankIcon } from '../render/thumbs.js';
import { ic, STAT_ICONS } from './icons.js';
import { SDK } from '../sdk.js';
import { Audio } from '../audio.js';
import { esc } from './hud.js';

const rootEl = () => document.getElementById('modal-root');

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function timeLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
}

function untilMidnight() {
  const n = new Date();
  const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  return m - n;
}

const UNLOCK_TAG = (def) => {
  const u = def.unlock;
  if (u.type === 'gems') return `${ic('gem', 16)} ${fmt(u.price)}`;
  if (u.type === 'quest') return `${ic('clipboard', 16)} Quest`;
  if (u.type === 'chest') return `${ic('chest', 16)} Chest`;
  if (u.type === 'wheel') return `${ic('wheel', 16)} Wheel`;
  return `Lv ${def.level}`;
};

export function createMenus(G) {
  let current = null;
  let timer = 0;

  function close() {
    if (!current) return;
    const c = current;
    current = null;
    clearInterval(timer);
    c.el.remove();
    rootEl().classList.remove('open');
    if (c.onClose) c.onClose();
  }

  function modal({ title, icon = '', wide = false, tabs = null, tab = null, render, onClose, tick }) {
    close();
    const el = h(`<div class="modal ${wide ? 'wide' : ''}">
      <div class="mtitle lbl">${ic(icon, 38)} ${title}</div>
      <div class="mclose">${ic('x', 34)}</div>
      ${tabs ? '<div class="sidetabs"></div>' : ''}
      <div class="mbody"></div></div>`);
    const body = el.querySelector('.mbody');
    const st = { el, body, tab: tab || (tabs && tabs[0].id), onClose };
    el.querySelector('.mclose').addEventListener('click', () => { Audio.click(); el.classList.remove('opening'); close(); });
    const draw = () => { body.innerHTML = ''; render(body, st); };
    st.redraw = draw;
    if (tabs) {
      const tEl = el.querySelector('.sidetabs');
      for (const t of tabs) {
        const b = h(`<div class="rbtn ${t.id === st.tab ? 'sel' : ''}">${ic(t.icon, 32)}<span class="lbl">${t.label}</span></div>`);
        b.addEventListener('click', () => {
          Audio.click();
          st.tab = t.id;
          tEl.querySelectorAll('.rbtn').forEach((x) => x.classList.remove('sel'));
          b.classList.add('sel');
          draw();
        });
        tEl.appendChild(b);
      }
    }
    rootEl().appendChild(el);
    rootEl().classList.add('open');
    current = st;
    draw();
    if (tick) timer = setInterval(() => tick(st), 1000);
    return st;
  }

  rootEl().addEventListener('mousedown', (e) => { if (e.target === rootEl()) close(); });

  const say = (lines, cls = 'green') => { for (const l of [].concat(lines || [])) G.hud.toast(`Received ${l}!`, cls); };

  // ------------------------------------------------------------------ store
  // ------------------------------------------------------------------ store: daily pack, free gems, gem shop
  const dayHash = () => { let x = 0; for (const c of dayId()) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
  const untilTomorrow = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return m - n; };
  function gemPile(n) {
    // 1-3 stacked gems as "bigger pack" art
    const gems = [[0, 0, 1]].concat(n > 1 ? [[-20, 10, 0.8], [20, 10, 0.8]] : []).concat(n > 2 ? [[-34, 24, 0.65], [34, 24, 0.65], [0, 26, 0.75]] : []);
    return `<div class="gpile">${gems.map(([x, y, k]) => `<span style="transform:translate(${x}px,${y}px) scale(${k})">${ic('gem', 54)}</span>`).join('')}</div>`;
  }
  function store(tab) {
    modal({
      title: 'Store', icon: 'basket', wide: true,
      tabs: [{ id: 'pack', label: 'Daily', icon: 'gift' }, { id: 'gems', label: 'Gems', icon: 'gem' }, { id: 'shop', label: 'Shop', icon: 'basket' }], tab: tab || 'pack',
      tick: (st) => { if (st.tab !== 'shop') st.redraw(); },
      render(b, st) {
        const d = profile.d;
        b.appendChild(h(`<div class="sto-bal"><span>Your gems</span>${ic('gem', 24)}<b class="lbl">${fmtFull(d.gems)}</b></div>`));
        if (st.tab === 'pack') {
          const claimed = d.store.starterDay === dayId();
          const xp = profile.xpLv(0.8);
          const card = h(`<div class="sto-pack ${claimed ? 'claimed' : ''}">
            <div class="sp-rays"></div>
            <div class="sp-ribbon lbl">FREE DAILY</div>
            <div class="sp-title lbl">Starter Pack</div>
            <div class="sp-items">
              <div class="sp-item xp">${ic('star', 62)}<span class="sp-amt lbl">+${fmtFull(xp)}</span><span class="sp-lbl">XP</span></div>
              <div class="sp-plus lbl">+</div>
              <div class="sp-item gem">${ic('gem', 62)}<span class="sp-amt lbl">+1,500</span><span class="sp-lbl">Gems</span></div>
            </div>
            <button class="btn ${claimed ? 'gray' : 'yellow glow'} sp-claim">${claimed ? `${ic('clock', 22)} ${timeLeft(untilTomorrow())}` : 'Claim FREE'}</button>
          </div>`);
          b.appendChild(card);
          b.appendChild(h('<div class="muted center sto-note">A new pack every day. Come back tomorrow!</div>'));
          card.querySelector('.sp-claim').addEventListener('click', () => {
            if (d.store.starterDay === dayId()) { Audio.error(); return; }
            d.store.starterDay = dayId();
            flyRewards(card.querySelector('.sp-item.gem'), 'gem', '#gems', 8);
            flyRewards(card.querySelector('.sp-item.xp'), 'star', '#xpbar', 8);
            say(profile.grant({ xp, gems: 1500 }));
            Audio.reward();
            st.redraw();
          });
        } else if (st.tab === 'gems') {
          const g = h('<div class="sto-gems"></div>');
          STORE_GEMS.forEach((p, i) => {
            const left = d.store.gemsAt[i] - Date.now();
            const pct = left > 0 ? 100 - (left / (p.cd * 1000)) * 100 : 100;
            const c = h(`<div class="sg-card t${i} ${left > 0 ? 'cool' : 'ready'}">
              ${i === 2 ? '<div class="sg-best lbl">BEST</div>' : ''}
              <div class="sg-name lbl">${p.name}</div>
              ${gemPile(i + 1)}
              <div class="sg-amt lbl">+${fmtFull(p.gems)}</div>
              <div class="sg-cd"><i style="width:${pct}%"></i></div>
              <button class="btn ${left > 0 ? 'gray' : 'green'} sg-btn">${left > 0 ? timeLeft(left) : 'Claim FREE'}</button></div>`);
            c.querySelector('.sg-btn').addEventListener('click', () => {
              if (d.store.gemsAt[i] > Date.now()) { Audio.error(); return; }
              d.store.gemsAt[i] = Date.now() + p.cd * 1000;
              flyRewards(c, 'gem', '#gems', 6 + i * 3);
              say(profile.grant({ gems: p.gems }));
              Audio.reward();
              st.redraw();
            });
            g.appendChild(c);
          });
          b.appendChild(g);
          b.appendChild(h('<div class="muted center sto-note">Free gems refill over time - check back often!</div>'));
        } else {
          // Gem Shop: today's featured deals (25% off) + always-available items
          const H = dayHash();
          const skinPool = SKINS.filter((x) => x.price > 0 && !profile.ownsSkin(x.id));
          const tankPool = Object.values(TANKS).filter((t) => t.unlock.type === 'gems' && !profile.ownsTank(t.id));
          const fSkin = skinPool.length ? skinPool[H % skinPool.length] : null;
          const fTank = tankPool.length ? tankPool[(H >>> 3) % tankPool.length] : null;
          const off = (p) => Math.round((p * 0.75) / 100) * 100;
          const items = [];
          if (fTank) items.push({ id: 'ft', feat: true, art: `<img src="${tankIcon(fTank.id, 96)}" alt="">`, name: fTank.name, sub: `${fTank.cls} tank · Lv ${fTank.level}+`, was: fTank.unlock.price, price: off(fTank.unlock.price), buy: () => { profile.giveTank(fTank.id); G.onOwnedChanged(); return `${fTank.name} unlocked!`; } });
          if (fSkin) items.push({ id: 'fs', feat: true, art: `<img src="${skinPreview(fSkin.id, 96)}" alt="">`, name: fSkin.name, sub: 'Skin', was: fSkin.price, price: off(fSkin.price), buy: () => { profile.giveSkin(fSkin.id); return `${fSkin.name} skin unlocked!`; } });
          const xpS = profile.xpLv(0.5), xpL = profile.xpLv(2);
          items.push({ id: 'xs', art: `<div class="si-art xp">${ic('star', 64)}</div>`, name: 'XP Pack', sub: `+${fmtFull(xpS)} XP`, price: 2000, buy: () => { profile.addXp(xpS); return `+${fmtFull(xpS)} XP`; }, fly: ['star', '#xpbar'] });
          items.push({ id: 'xl', art: `<div class="si-art xp big">${ic('star', 70)}${ic('star', 40)}</div>`, name: 'Mega XP Pack', sub: `+${fmtFull(xpL)} XP`, price: 6500, buy: () => { profile.addXp(xpL); return `+${fmtFull(xpL)} XP`; }, fly: ['star', '#xpbar'] });
          items.push({ id: 'sp', art: `<div class="si-art wheel">${ic('wheel', 64)}</div>`, name: 'Wheel Spin', sub: '+1 spin', price: 3000, buy: () => { profile.d.wheel.spins++; profile.emit('wheel'); return '+1 Wheel Spin'; } });
          const sec = (title, cls, list) => {
            if (!list.length) return;
            b.appendChild(h(`<div class="sto-sec lbl">${title}${cls === 'feat' ? `<span class="sto-reset">${ic('clock', 16)} New deals in ${timeLeft(untilTomorrow())}</span>` : ''}</div>`));
            const grid = h(`<div class="sto-grid ${cls}"></div>`);
            for (const it of list) {
              const afford = d.gems >= it.price;
              const c = h(`<div class="si ${it.feat ? 'feat' : ''}">
                ${it.feat ? '<div class="si-off lbl">-25%</div>' : ''}
                <div class="si-img">${it.art}</div>
                <div class="si-name lbl">${it.name}</div><div class="si-sub">${it.sub}</div>
                <button class="btn ${afford ? 'green' : 'gray'} si-buy">${it.was ? `<s class="was">${fmt(it.was)}</s> ` : ''}${ic('gem', 20)} ${fmt(it.price)}</button></div>`);
              c.querySelector('.si-buy').addEventListener('click', () => {
                G.menus.open('confirm', `Buy <b>${it.name}</b> for ${ic('gem', 18)} ${fmtFull(it.price)}?`, () => {
                  if (!profile.spend(it.price)) { Audio.error(); G.hud.toast('Not enough Gems!', 'red'); store('shop'); return; }
                  const msg = it.buy();
                  profile.save();
                  G.hud.toast(msg, 'gold');
                  Audio.reward();
                  store('shop');
                  if (it.fly) setTimeout(() => flyRewards(document.querySelector('.sto-bal') || document.body, it.fly[0], it.fly[1], 8), 50);
                }, () => store('shop'));
              });
              grid.appendChild(c);
            }
            b.appendChild(grid);
          };
          sec("Today's Deals", 'feat', items.filter((x) => x.feat));
          sec('Boosts', 'std', items.filter((x) => !x.feat));
        }
      },
    });
  }

  // reward icons burst out of an element and fly to a HUD counter
  function flyRewards(fromEl, icon, targetSel, n = 10) {
    const from = fromEl.getBoundingClientRect();
    const tgt = document.querySelector(targetSel);
    const to = tgt ? tgt.getBoundingClientRect() : { left: innerWidth / 2, top: 20, width: 0, height: 0 };
    const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
    const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
    for (let k = 0; k < n; k++) {
      const el = document.createElement('div');
      el.className = 'flyer';
      el.innerHTML = ic(icon, 34);
      document.body.appendChild(el);
      const ang = Math.random() * Math.PI * 2, rad = 50 + Math.random() * 60;
      const mx = fx + Math.cos(ang) * rad, my = fy + Math.sin(ang) * rad;
      const anim = el.animate([
        { transform: `translate(${fx}px, ${fy}px) scale(.3)`, opacity: 0 },
        { transform: `translate(${mx}px, ${my}px) scale(1.15)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${tx}px, ${ty}px) scale(.55)`, opacity: 0.9 },
      ], { duration: 850 + k * 45, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
      anim.onfinish = () => {
        el.remove();
        if (tgt) { tgt.classList.remove('gotit'); void tgt.offsetWidth; tgt.classList.add('gotit'); }
        if (k % 3 === 0) Audio.tick();
      };
    }
  }

  // ------------------------------------------------------------------ gifts (4x3 grid like the original)
  function gifts() {
    modal({
      title: 'Gifts', icon: 'gift', tick: (st) => { if (Date.now() - (st.lastClaim || 0) > 800) st.redraw(); },
      render(b) {
        const el = profile.giftElapsed();
        const g = h('<div class="gifts"></div>');
        GIFTS.forEach((gf, i) => {
          const claimed = profile.session.claimedGifts.has(i);
          const ready = !claimed && el >= gf.at;
          const r = gf.r;
          const isGem = !!r.gems;
          const amount = isGem ? r.gems : profile.xpLv(r.xpLv);
          const cls = claimed ? 'done' : ready ? 'ready' : gf.mega ? 'lock-mega' : isGem ? 'lock-gem' : 'lock-xp';
          const c = h(`<div class="gift ${cls}">${ic(isGem ? 'gem' : 'star', 64)}
            <span class="amt lbl">+${fmtFull(amount)}</span>
            ${!ready && !claimed ? `<span class="lk">${ic('lock', 30)}</span><span class="tm lbl">${timeLeft((gf.at - el) * 1000)}</span>` : ''}
            ${claimed ? `<span class="ck">${ic('check', 30)}</span>` : ''}</div>`);
          c.addEventListener('click', () => {
            if (c.classList.contains('claiming')) return;
            const out = profile.claimGift(i);
            if (out) {
              c.classList.add('claiming');
              current.lastClaim = Date.now();
              flyRewards(c, isGem ? 'gem' : 'star', isGem ? '#gems' : '#xpbar');
              say(out);
              Audio.reward();
            } else if (!claimed) { Audio.error(); G.hud.toast('Keep playing to unlock!', 'red'); c.classList.remove('nope'); void c.offsetWidth; c.classList.add('nope'); }
          });
          g.appendChild(c);
        });
        b.appendChild(g);
      },
    });
  }

  // ------------------------------------------------------------------ Snow Event (milestone track)
  function renderEvent(b, st) {
    const list = QUESTS.event;
    const total = list[list.length - 1].reqs[0].n;
    const have = Math.min(total, profile.questValue('e.shapes'));
    const end = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 1) - n; })();
    const grand = list[list.length - 1];
    const flakes = Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 71) % 100}%;animation-delay:${-(i * 0.7) % 6}s;animation-duration:${5 + (i % 4)}s;font-size:${10 + (i % 3) * 5}px">${ic('snow', 14 + (i % 3) * 6)}</i>`).join('');
    const ownsFrost = profile.ownsSkin('frost');
    const root = h(`<div class="ev">
      <div class="ev-hero">
        <div class="ev-flakes">${flakes}</div>
        <div class="ev-left">
          <div class="ev-tag lbl">${ic('snow', 20)} LIMITED EVENT</div>
          <div class="ev-title lbl">Snow Event</div>
          <div class="ev-sub">Destroy shapes in any battle to climb the track and win the exclusive <b>Frost</b> skin!</div>
          <div class="ev-time">${ic('clock', 18)} Ends in ${Math.floor(end / 864e5)}d ${Math.floor((end % 864e5) / 36e5)}h</div>
        </div>
        <div class="ev-prize ${ownsFrost ? 'owned' : ''}"><div class="ev-glow"></div><img src="${skinPreview('frost', 128)}" alt=""><span class="lbl">${ownsFrost ? 'Owned!' : 'Grand Prize'}</span></div>
      </div>
      <div class="ev-trackwrap"><div class="ev-track"><i style="width:${(have / total) * 100}%"></i></div><div class="ev-count lbl">${fmtFull(have)} / ${fmtFull(total)} shapes</div></div>
      <div class="ev-steps"></div></div>`);
    const steps = root.querySelector('.ev-steps');
    const track = root.querySelector('.ev-trackwrap');
    list.forEach((q) => {
      const need = q.reqs[0].n;
      const state = profile.questState('event', q);
      const r = q.reward;
      const art = r.skin ? `<img src="${skinPreview(r.skin, 64)}" alt="">` : r.gems ? ic('gem', 44) : ic('star', 44);
      const amt = r.skin ? 'Frost Skin' : r.gems ? `+${fmtFull(r.gems)}` : `+${fmtFull(profile.xpLv(r.xpLv))} XP`;
      // milestone marker on the track
      track.appendChild(h(`<div class="ev-mark ${have >= need ? 'hit' : ''}" style="left:${(need / total) * 100}%"><span>${need}</span></div>`));
      const c = h(`<div class="ev-step ${state} ${q === grand ? 'grand' : ''}">
        <div class="es-art">${art}</div>
        <div class="es-name lbl">${q.name}</div>
        <div class="es-amt">${amt}</div>
        <div class="es-need">${fmtFull(need)} shapes</div>
        <button class="btn ${state === 'ready' ? 'green glow' : 'gray'} es-btn">${state === 'claimed' ? ic('check', 22) : state === 'ready' ? 'Claim' : `${Math.min(100, Math.floor((have / need) * 100))}%`}</button></div>`);
      c.querySelector('.es-btn').addEventListener('click', () => {
        const out = profile.claimQuest('event', q);
        if (out) { flyRewards(c, r.gems ? 'gem' : 'star', r.gems ? '#gems' : '#xpbar', 8); say(out); Audio.reward(); if (r.skin) SDK.happytime(); st.redraw(); }
        else if (state !== 'claimed') { Audio.error(); G.hud.toast(`Destroy ${fmtFull(need - have)} more shapes!`, 'red'); }
      });
      steps.appendChild(c);
    });
    b.appendChild(root);
  }

  // ------------------------------------------------------------------ quests
  function quests(tab) {
    modal({
      title: 'Quests', icon: 'clipboard',
      tabs: [{ id: 'daily', label: 'Daily', icon: 'sun' }, { id: 'weekly', label: 'Weekly', icon: 'calendar' }, { id: 'unique', label: 'Unique', icon: 'star' }, { id: 'event', label: 'Event', icon: 'snow' }],
      tab,
      render(b, st) {
        const cat = st.tab;
        if (cat === 'event') { renderEvent(b, st); return; }
        if (cat === 'daily') b.appendChild(h(`<div class="center big" style="margin-bottom:6px">${ic('clock', 20)} ${timeLeft(untilMidnight())}</div>`));
        for (const q of QUESTS[cat]) {
          const state = profile.questState(cat, q);
          const reward = q.reward;
          const rlabel = reward.tank ? `<img src="${tankIcon(reward.tank, 64)}" style="width:54px"><div>${TANKS[reward.tank].name}</div>`
            : reward.skin ? `<img src="${skinPreview(reward.skin, 64)}" style="width:54px"><div>Skin</div>`
              : `${reward.gems ? `<div>+${fmtFull(reward.gems)} ${ic('gem', 20)}</div>` : ''}${reward.xpLv ? `<div>+${fmtFull(profile.xpLv(reward.xpLv))} ${ic('star', 20)}</div>` : ''}`;
          if (state === 'locked') {
            b.appendChild(h(`<div class="box" style="opacity:.6;margin-bottom:8px"><div class="big">${ic('lock', 20)} ${q.name}</div><div class="muted">Locked - finish the previous quest first</div></div>`));
            continue;
          }
          const reqs = q.reqs.map((r) => {
            const v = Math.min(r.n, profile.questValue(r.k));
            const show = r.time ? `${Math.floor(v / 60)}/${Math.floor(r.n / 60)}` : `${fmt(v)}/${fmt(r.n)}`;
            return `<div style="margin:4px 0"><div class="muted">◆ ${r.label}</div><div class="prog"><div style="width:${(v / r.n) * 100}%"></div><span>${show}</span></div></div>`;
          }).join('');
          const el = h(`<div class="box row" style="margin-bottom:8px;align-items:stretch"><div style="flex:1"><div class="big">${q.name}</div>${reqs}</div>
            <div class="task ${state === 'ready' ? 'ready' : state === 'claimed' ? 'done' : ''}" style="width:120px">${rlabel}<div>${state === 'claimed' ? 'Claimed' : state === 'ready' ? 'CLAIM' : ''}</div></div></div>`);
          el.querySelector('.task').addEventListener('click', () => {
            const out = profile.claimQuest(cat, q);
            if (out) { say(out); Audio.reward(); st.redraw(); } else if (state !== 'claimed') { Audio.error(); G.hud.toast("Quest isn't completed yet!", 'red'); }
          });
          b.appendChild(el);
        }
      },
    });
  }

  // ------------------------------------------------------------------ rank
  // tier-coloured rank badge (shield with the rank number)
  function rankBadge(idx, size, col, dim) {
    const id = 'rb' + idx + size + (dim ? 'd' : '');
    return `<svg class="rk-badge ${dim ? 'dim' : ''}" width="${size}" height="${size * 1.1}" viewBox="0 0 64 70">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".18" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity=".75"/></linearGradient></defs>
      <path d="M32 3l26 9v19c0 17-11 29-26 36C17 60 6 48 6 31V12z" fill="#16233f"/>
      <path d="M32 8l21 7.5v15.5c0 14-9 24-21 30C20 55 11 45 11 31V15.5z" fill="url(#${id})"/>
      <path d="M32 8l21 7.5v15.5c0 14-9 24-21 30z" fill="#000" opacity=".12"/>
      <text x="32" y="44" text-anchor="middle" font-size="${idx >= 10 ? 22 : 26}" font-family="inherit" font-weight="900" fill="#fff" stroke="#16233f" stroke-width="4" paint-order="stroke">${idx}</text></svg>`;
  }
  const TASK_ICONS = { tomorrow: 'calendar', play5: 'clock', ad: 'wheel', kill: 'skull' };

  function rank() {
    modal({
      title: 'Rank', icon: 'shield', wide: true,
      render(b, st) {
        const r = profile.d.rank;
        const need = rankNeed(r.idx);
        const tier = rankTier(r.idx);
        const col = RANK_COLORS[RANK_TIERS.indexOf(tier)];
        const maxed = r.idx >= MAX_RANK;
        const nextIdx = Math.min(MAX_RANK, r.idx + 1);
        const nextCol = RANK_COLORS[RANK_TIERS.indexOf(rankTier(nextIdx))];
        const pct = maxed ? 100 : Math.min(100, (r.pts / need) * 100);
        const canUp = !maxed && r.pts >= need;
        const ready = RANK_TASKS.filter((t) => profile.rankTaskAvailable(t) > 0);
        const msLeft = (() => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return m - n; })();
        const hh = Math.floor(msLeft / 3600e3), mm = Math.floor((msLeft % 3600e3) / 60e3);
        const root = h(`<div class="rk">
          <div class="rk-hero" style="--tc:${col};--nc:${nextCol}">
            <div class="rk-rays"></div>
            <div class="rk-cur">${rankBadge(r.idx, 92, col)}<div class="rk-tier lbl">${tier}</div><div class="rk-sub">Rank ${r.idx}</div></div>
            <div class="rk-mid">
              <div class="rk-bar"><i style="width:${pct}%"></i><span class="lbl">${maxed ? 'MAX RANK' : `${r.pts} / ${need}`}</span></div>
              ${maxed ? '' : `<div class="rk-reward">Rank up reward: ${ic('gem', 20)}<b>${fmt(400 * nextIdx)}</b> + ${ic('star', 20)}<b>XP</b></div>`}
              <button class="btn ${canUp ? 'green glow' : 'gray'} rk-up">${canUp ? 'Rank Up!' : maxed ? 'Max Rank' : 'Rank Up'}</button>
            </div>
            <div class="rk-next">${maxed ? rankBadge(r.idx, 70, col) : rankBadge(nextIdx, 70, nextCol, !canUp)}<div class="rk-sub">${maxed ? 'Max' : 'Next: ' + rankTier(nextIdx)}</div></div>
          </div>
          <div class="rk-head"><span class="lbl">Daily Tasks</span><span class="rk-reset">${ic('clock', 18)} Resets in ${hh}h ${mm}m</span>
            ${ready.length ? `<button class="btn green rk-all">Claim All (${ready.length})</button>` : ''}</div>
          <div class="rk-tasks"></div></div>`);
        b.appendChild(root);
        const list = root.querySelector('.rk-tasks');
        for (const t of RANK_TASKS) {
          const avail = profile.rankTaskAvailable(t);
          const doneN = profile.rankTaskClaimed(t.id);
          const fin = doneN >= t.max;
          const prog = Math.min(t.max, doneN + avail);
          const state = avail > 0 ? 'ready' : fin ? 'done' : 'todo';
          const el = h(`<div class="rk-task ${state}">
            <div class="rt-ic">${ic(TASK_ICONS[t.id] || 'star', 38)}</div>
            <div class="rt-mid"><div class="rt-name lbl">${t.label}</div>
              <div class="rt-bar"><i style="width:${(prog / t.max) * 100}%"></i><span>${prog}/${t.max}</span></div></div>
            <div class="rt-pts lbl">+${t.pts * (avail > 0 ? avail : 1)}</div>
            <button class="btn ${state === 'ready' ? 'green' : state === 'done' ? 'gray' : ''} rt-go">${state === 'ready' ? 'Claim' : state === 'done' ? ic('check', 22) : t.id === 'tomorrow' ? 'Soon' : 'Go'}</button></div>`);
          el.querySelector('.rt-go').addEventListener('click', () => {
            if (avail > 0) {
              const pts = profile.claimRankTask(t);
              G.hud.toast(t.id === 'tomorrow' ? 'Claimed Tomorrow task!' : `+${pts} Rank points!`, 'green');
              Audio.reward();
              st.redraw();
            } else if (t.id === 'ad' && !fin) { close(); wheel(); }
            else if (t.id === 'tomorrow' && !fin) { Audio.error(); G.hud.toast('Come back tomorrow to claim this!', 'blue'); }
            else if (!fin) { close(); if (G.state === 'lobby') G.play('ffa'); }
          });
          list.appendChild(el);
        }
        const all = root.querySelector('.rk-all');
        if (all) all.addEventListener('click', () => {
          let pts = 0;
          for (const t of RANK_TASKS) pts += profile.claimRankTask(t);
          G.hud.toast(`+${pts} Rank points!`, 'green');
          Audio.reward();
          st.redraw();
        });
        root.querySelector('.rk-up').addEventListener('click', () => {
          // claims every rank-up you can afford in one go
          let n = 0, gems = 0, xp = 0;
          const num = (l) => +String(l).replace(/[^0-9]/g, '') || 0;
          for (let out; (out = profile.rankUp()); n++) {
            for (const l of out) { if (l.includes('Gems')) gems += num(l); else if (l.includes('XP')) xp += num(l); }
          }
          if (n) {
            G.hud.toast(`Ranked up to Rank ${profile.d.rank.idx}!`, 'gold');
            say([gems && `+${gems.toLocaleString()} Gems`, xp && `+${xp.toLocaleString()} XP`].filter(Boolean));
            Audio.level(); SDK.happytime(); st.redraw();
          }
          else { Audio.error(); G.hud.toast(maxed ? 'You are at max rank!' : 'Not enough Rank points yet!', 'red'); }
        });
      },
    });
  }

  // ------------------------------------------------------------------ index (tree of 3D tank renders)
  function index(sel) {
    let root = sel ? (TANKS[sel] ? sel : 'default') : 'default';
    let search = '';
    let full = false;
    let info = sel || null;
    modal({
      title: 'Index', icon: 'book', wide: true,
      render(b, st) {
        st.el.classList.toggle('full', full);
        const wrap = h(`<div class="ix">
          <div class="ix-left"><input class="ix-search" placeholder="Search" value="${esc(search)}"><div class="ix-list"></div></div>
          <div class="ix-tree"><div class="ix-content"></div></div></div>`);
        b.appendChild(wrap);
        const list = wrap.querySelector('.ix-list');
        const input = wrap.querySelector('.ix-search');
        const pane = wrap.querySelector('.ix-tree');
        const content = wrap.querySelector('.ix-content');
        const lvLayer = h('<div style="position:absolute;inset:0;pointer-events:none"></div>');
        const ex = h(`<div class="rbtn ix-expand" title="Expand">${ic('expand', 34)}</div>`);
        const infoBox = h('<div class="ix-info hidden"></div>');
        const holder = h('<div style="position:relative;flex:1;display:flex;min-width:0;overflow:hidden"></div>');
        pane.replaceWith(holder);
        holder.appendChild(pane);
        holder.append(lvLayer, ex);
        // the info card sits OUTSIDE the menu box (below it, centred) so it never covers the tree
        st.el.querySelectorAll('.ix-info').forEach((x) => x.remove());
        infoBox.classList.add('out');
        st.el.appendChild(infoBox);
        pane.style.flex = '1';
        pane.style.minWidth = '0';
        ex.onclick = () => { full = !full; Audio.click(); st.redraw(); };

        const drawList = () => {
          list.innerHTML = '';
          TANK_LIST.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())).forEach((d) => {
            const it = h(`<div class="ixb ${d.id === root ? 'sel' : ''}"><span class="lbl">${d.name}</span><img src="${tankIcon(d.id)}" alt=""></div>`);
            it.addEventListener('click', () => { root = d.id; info = d.id; Audio.click(); drawList(); drawTree(); });
            list.appendChild(it);
          });
        };
        input.addEventListener('input', () => { search = input.value; drawList(); });
        input.addEventListener('keydown', (e) => e.stopPropagation());

        const NODE = 76, GAP = 18, ROW = 118;
        let rowsY = [];
        const drawTree = () => {
          // tidy layout: leaves get slots, parents sit above the middle of their children
          const nodes = [];
          let slot = 0, maxDepth = 0;
          const place = (id, depth) => {
            const kids = childrenOf(id);
            maxDepth = Math.max(maxDepth, depth);
            const n = { id, depth, kids: [] };
            nodes.push(n);
            if (!kids.length) { n.x = slot++; return n; }
            n.kids = kids.map((k) => place(k.id, depth + 1));
            n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2;
            return n;
          };
          const top = place(root, 0);
          const W = Math.max(pane.clientWidth, slot * (NODE + GAP) + 260);
          const H = Math.max(pane.clientHeight, (maxDepth + 1) * ROW + 70);
          const px = (n) => 30 + n.x * (NODE + GAP) + Math.max(0, (W - 230 - slot * (NODE + GAP)) / 2);
          const py = (n) => H - 30 - NODE - n.depth * ROW;
          content.style.cssText = `position:relative;width:${W}px;height:${H}px`;
          let svg = '';
          for (const n of nodes) {
            if (!n.kids.length) continue;
            const x0 = px(n) + NODE / 2, yTop = py(n);
            const yMid = yTop - (ROW - NODE) / 2;
            const xs = n.kids.map((k) => px(k) + NODE / 2);
            const seg = `M${x0} ${yTop}V${yMid}M${Math.min(...xs)} ${yMid}H${Math.max(...xs)}` + xs.map((x) => `M${x} ${yMid}V${yMid - (ROW - NODE) / 2}`).join('');
            svg += `<path d="${seg}" stroke="#0f2a4d" stroke-width="9" fill="none" stroke-linecap="round"/><path d="${seg}" stroke="#ffffff" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
          }
          content.innerHTML = `<svg class="lines" width="${W}" height="${H}">${svg}</svg>`;
          for (const n of nodes) {
            const d = TANKS[n.id];
            const owned = d.unlock.type === 'level' || profile.ownsTank(d.id);
            const reach = profile.level >= d.level;
            const el = h(`<div class="tnode ${n.id === info ? 'cur' : ''} ${owned && reach ? '' : 'locked'}" style="left:${px(n)}px;top:${py(n)}px" title="${d.name}">
              <img src="${tankIcon(d.id)}" alt=""><span class="nm lbl">${d.name}</span>${owned && reach ? '' : `<span class="lk">${ic('lock', 18)}</span>`}</div>`);
            el.addEventListener('click', () => {
              Audio.click();
              if (info === n.id && n.id !== root) { root = n.id; drawList(); }
              info = n.id;
              drawTree();
            });
            content.appendChild(el);
          }
          const d0 = TANKS[root];
          const tag = h(`<div class="clsTag" style="left:${px(top) - 96}px;top:${py(top) + 22}px"><div>Class<br>${d0.cls}</div><img src="${tankIcon(root)}" style="width:26px;opacity:.6"></div>`);
          content.appendChild(tag);
          // level rows (fixed on the right edge, follow vertical scroll)
          rowsY = [];
          for (let dep = 0; dep <= maxDepth; dep++) {
            const cnt = {};
            for (const n of nodes) if (n.depth === dep) cnt[TANKS[n.id].level] = (cnt[TANKS[n.id].level] || 0) + 1;
            const lv = +Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x] || y - x)[0];
            rowsY.push([py({ depth: dep }) + NODE - 18, lv]);
          }
          drawLevels();
          // info card
          if (info && TANKS[info]) {
            const d = TANKS[info];
            const owned = d.unlock.type === 'level' || profile.ownsTank(d.id);
            infoBox.classList.remove('hidden');
            infoBox.innerHTML = `<b>${d.name}</b> · ${d.cls} · Lv ${d.level}+<br>${d.unlock.type === 'level' ? 'Free' : UNLOCK_TAG(d)} · ${owned ? '<span style="color:#1ea83c">Unlocked</span>' : 'Not owned'}<br><span class="muted">${d.desc || pathTo(d.id).map((id) => TANKS[id].name).join(' &rarr; ')}</span>`;
          } else infoBox.classList.add('hidden');
          // start scrolled to the root (bottom, centred)
          pane.scrollTop = H;
          pane.scrollLeft = px(top) - pane.clientWidth / 2 + NODE / 2;
        };
        const drawLevels = () => {
          lvLayer.innerHTML = rowsY.map(([y, lv]) => `<div class="lvline lbl" style="top:${y - pane.scrollTop - 26}px">Level ${lv}</div>`).join('');
        };
        pane.addEventListener('scroll', drawLevels);
        // drag the tree around (mouse or touch); a real drag swallows the click so tanks aren't selected by accident
        let drag = null;
        pane.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          drag = { x: e.clientX, y: e.clientY, sl: pane.scrollLeft, st: pane.scrollTop, moved: false, id: e.pointerId };
          pane.classList.add('grabbing');
        });
        pane.addEventListener('pointermove', (e) => {
          if (!drag || e.pointerId !== drag.id) return;
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; try { pane.setPointerCapture(e.pointerId); } catch { /* */ } }
          if (drag.moved) { pane.scrollLeft = drag.sl - dx; pane.scrollTop = drag.st - dy; }
        });
        const endDrag = (e) => {
          if (!drag) return;
          if (drag.moved) { const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; pane.addEventListener('click', stop, { capture: true, once: true }); }
          drag = null;
          pane.classList.remove('grabbing');
          try { pane.releasePointerCapture(e.pointerId); } catch { /* */ }
        };
        pane.addEventListener('pointerup', endDrag);
        pane.addEventListener('pointercancel', endDrag);
        drawList();
        requestAnimationFrame(drawTree);
      },
    });
  }

  // ------------------------------------------------------------------ bag
  function bag(tab) {
    modal({
      title: 'Bag', icon: 'box', tabs: [{ id: 'tanks', label: 'Tanks', icon: 'shield' }, { id: 'skins', label: 'Skins', icon: 'palette' }], tab,
      render(b, st) {
        const g = h('<div class="grid"></div>');
        if (st.tab === 'tanks') {
          const owned = profile.d.owned;
          if (!owned.length) { b.appendChild(h(`<div class="empty-state">${ic('box', 72)}<div>No special tanks yet!</div><div class="muted">Get them in the Tanks Shop, Chests, the Wheel and Quests.</div></div>`)); return; }
          for (const id of owned) g.appendChild(h(`<div class="card"><img src="${tankIcon(id, 64)}"><div>${TANKS[id].name}</div><div class="muted">Lv ${TANKS[id].level}+</div></div>`));
        } else {
          for (const s of SKINS.filter((x) => profile.ownsSkin(x.id))) {
            const c = h(`<div class="card ${profile.d.skin === s.id ? 'sel' : ''}"><img src="${skinPreview(s.id, 64)}"><div>${s.name}</div><div class="owned">${profile.d.skin === s.id ? 'Equipped' : 'Equip'}</div></div>`);
            c.addEventListener('click', () => { profile.equipSkin(s.id); G.onSkinChanged(); st.redraw(); });
            g.appendChild(c);
          }
        }
        b.appendChild(g);
      },
    });
  }

  // ------------------------------------------------------------------ prize wheel (original design)
  let wheelRot = 0;
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('');
  };
  const segValue = (sg) => (sg.tank ? TANKS[sg.tank].name : sg.gems ? fmt(sg.gems) : fmt(profile.xpLv(sg.xpLv)));
  function wheelSvg() {
    const C = 165, R = 148, n = WHEEL.length, step = 360 / n;
    const pt = (r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
    let segs = '', deco = '';
    WHEEL.forEach((sg, i) => {
      const a0 = i * step, a1 = (i + 1) * step;
      const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1);
      segs += `<path d="M${C} ${C}L${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}Z" fill="${sg.color}"/>`;
      segs += `<path d="M${C} ${C}L${x0} ${y0}" stroke="${shade(sg.color, 0.55)}" stroke-width="3"/>`;
      const mid = a0 + step / 2;
      const [ix, iy] = pt(R * 0.74, mid);
      const icon = sg.tank
        ? `<image href="${tankIcon(sg.tank)}" x="${ix - 26}" y="${iy - 26}" width="52" height="52" transform="rotate(${mid} ${ix} ${iy})"/>`
        : `<g transform="rotate(${mid} ${ix} ${iy})">${ic(sg.gems ? 'gem' : 'star', 40).replace('<svg ', `<svg x="${ix - 20}" y="${iy - 20}" `)}</g>`;
      // short label along the arc of each slice: the amount, or the tank's name
      const [tx, ty] = pt(R * 0.53, mid);
      const label = sg.tank ? TANKS[sg.tank].name : '+' + segValue(sg);
      const fit = label.length > 6 ? 'textLength="54" lengthAdjust="spacingAndGlyphs"' : ''; // long tank names squeezed to the slice width
      deco += `<text x="${tx}" y="${ty}" transform="rotate(${mid} ${tx} ${ty})" text-anchor="middle" dominant-baseline="middle" ${fit}
        font-family="Fredoka, sans-serif" font-weight="700" font-size="${sg.tank ? 13 : 15}" fill="#fff" stroke="${shade(sg.color, 0.45)}" stroke-width="4" paint-order="stroke">${label}</text>`;
      deco += icon;
    });
    let bulbs = '';
    for (let k = 0; k < 24; k++) { const [bx, by] = pt(R + 8, k * 15); bulbs += `<circle class="bulb ${k % 2 ? 'b2' : ''}" cx="${bx}" cy="${by}" r="4.2"/>`; }
    return `<svg class="wheel" viewBox="0 0 330 330">
      <defs><radialGradient id="hubg" cx="40%" cy="35%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cfe3f5"/></radialGradient>
        <linearGradient id="rimg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84a"/><stop offset="1" stop-color="#e09a00"/></linearGradient></defs>
      <circle cx="${C}" cy="${C}" r="${R + 15}" fill="url(#rimg)" stroke="#a35f00" stroke-width="4"/>
      ${bulbs}
      <g class="pw-rot" style="transform:rotate(${wheelRot}deg)">${segs}${deco}
        <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="#a35f00" stroke-width="4"/></g>
      <circle cx="${C}" cy="${C}" r="36" fill="url(#hubg)" stroke="#7a9bbf" stroke-width="4"/>
      ${ic('star', 44).replace('<svg ', `<svg x="${C - 22}" y="${C - 22}" `)}
    </svg>
    <svg class="pw-flag" viewBox="0 0 46 56"><path d="M23 54L4 18A20 20 0 1 1 42 18z" fill="#ff3b4f" stroke="#94101d" stroke-width="4" stroke-linejoin="round"/><circle cx="23" cy="18" r="7" fill="#fff"/></svg>`;
  }
  function wheel() {
    let fast = false, spinning = false;
    modal({
      title: 'Wheel', icon: 'wheel', wide: true,
      tick: (st) => { const el = st.el.querySelector('#wh-free'); if (el && !spinning) el.textContent = freeTxt(); },
      render(b, st) {
        const spins = profile.wheelSpins();
        const total = WHEEL.reduce((t, sg) => t + sg.odds, 0);
        const odds = WHEEL.map((sg) => `<div><span class="sw" style="background:${sg.color}"></span>${sg.tank ? sg.label + ' tank' : '+' + segValue(sg) + (sg.gems ? ' Gems' : ' XP')}</div><div>${Math.round((sg.odds / total) * 1000) / 10}%</div>`).join('');
        b.appendChild(h(`<div class="pw">
          <div class="pw-stage">${wheelSvg()}</div>
          <div class="pw-side">
            <div class="pw-count lbl">${spins} Spin${spins === 1 ? '' : 's'}</div>
            <button class="btn green" id="wh-spin" style="font-size:28px;padding:10px">${ic('spin', 30)} Spin!</button>
            <button class="btn ${fast ? 'yellow' : ''}" id="wh-fast">${ic('fire', 22)} Fast spin: ${fast ? 'ON' : 'OFF'}</button>
            <div class="muted center" id="wh-free">${freeTxt()}</div>
            <div class="box"><div class="big" style="font-size:17px;margin-bottom:4px">${ic('dice', 20)} Chances</div><div class="pw-odds">${odds}</div></div>
          </div></div>`));
        b.querySelector('#wh-fast').onclick = () => { fast = !fast; st.redraw(); };
        b.querySelector('#wh-spin').onclick = () => {
          if (spinning) return;
          const res = profile.spinWheel();
          if (!res) { Audio.error(); G.hud.toast('No spins left! Free spin every 4 hours.', 'red'); return; }
          spinning = true;
          const n = WHEEL.length;
          const target = 360 - ((res.idx + 0.5) * 360) / n + (Math.random() - 0.5) * (360 / n) * 0.6;
          wheelRot = wheelRot - (wheelRot % 360) + 360 * (fast ? 2 : 6) + target;
          const g = b.querySelector('.pw-rot');
          g.style.transition = `transform ${fast ? 0.8 : 3.4}s cubic-bezier(.12,.75,.15,1)`;
          requestAnimationFrame(() => { g.style.transform = `rotate(${wheelRot}deg)`; });
          let ticks = 0;
          const tk = setInterval(() => { Audio.tick(); if (++ticks > (fast ? 6 : 22)) clearInterval(tk); }, fast ? 110 : 150);
          setTimeout(() => {
            spinning = false;
            say(res.out);
            Audio.reward();
            if (current === st) st.redraw();
          }, fast ? 850 : 3500);
        };
      },
    });
    function freeTxt() {
      const left = profile.d.wheel.nextFree - Date.now();
      return left > 0 ? `Free spin in ${timeLeft(left)}` : 'Free spin ready!';
    }
  }

  // ------------------------------------------------------------------ chests (skins) + casino opening
  function chestArt(c, size = 150) {
    // Angular, faceted chest (low-poly look): straight edges, hard shading planes, mitred metal.
    const frost = c.id === 'frozen';
    const P = frost
      ? { top: '#e9f8ff', front: '#9fd6f2', frontD: '#5aa8d6', side: '#3f86b8', lid: '#c7ecff', lidD: '#86c4e6', metal: '#dfe8f2', metalD: '#8a9bb0', gem: ['#bff6ff', '#5fe3ff', '#1fa8d6', '#0d6e9e'], line: '#1e5f8c', acc: '#ffffff' }
      : { top: '#4a4152', front: '#2c2533', frontD: '#1d1724', side: '#141019', lid: '#3a3142', lidD: '#251e2d', metal: '#c9a24a', metalD: '#7a5a1a', gem: ['#ffd27a', '#ff8a2a', '#e8451c', '#9a1f0a'], line: '#0a070d', acc: '#ff7a1a' };
    const poly = (pts, fill, extra = '') => `<polygon points="${pts}" fill="${fill}" ${extra}/>`;
    const L = `stroke="${P.line}" stroke-width="2" stroke-linejoin="miter"`;
    const deco = frost
      ? // crystal shards rising from the lid and flanks
        [poly('46,30 52,8 58,30', '#e9fbff', L), poly('52,8 58,30 55,30', '#9fe3ff'),
          poly('100,30 108,2 114,30', '#e9fbff', L), poly('108,2 114,30 111,30', '#9fe3ff'),
          poly('76,26 81,12 86,26', '#ffffff', L),
          poly('8,132 16,96 24,132', '#d8f6ff', L), poly('16,96 24,132 20,132', '#8fd8f5'),
          poly('136,132 146,90 152,132', '#d8f6ff', L), poly('146,90 152,132 149,132', '#8fd8f5')].join('')
      : // glowing fissures and ember shards
        `<g filter="url(#lava-${c.id})">
          <polyline points="30,84 42,96 36,108 50,122" fill="none" stroke="#ff8a2a" stroke-width="3" stroke-linejoin="miter"/>
          <polyline points="128,82 116,98 124,110 110,124" fill="none" stroke="#ff8a2a" stroke-width="3" stroke-linejoin="miter"/>
          <polyline points="44,50 56,58 52,66" fill="none" stroke="#ffb347" stroke-width="2.5"/>
          <polyline points="112,48 102,58 108,64" fill="none" stroke="#ffb347" stroke-width="2.5"/></g>
        ${[[26, 34], [58, 18], [96, 14], [132, 30]].map(([x, y], i) => `<polygon class="ember e${i}" points="${x},${y} ${x + 4},${y + 6} ${x},${y + 12} ${x - 4},${y + 6}" fill="#ffb347"/>`).join('')}`;
    return `<svg class="chest-art ${frost ? 'frost' : 'molten'}" width="${size}" height="${size}" viewBox="0 0 160 160">
      <defs><filter id="lava-${c.id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${poly('22,144 138,144 150,152 10,152', 'rgba(0,0,0,.22)')}
      <g class="lid">
        ${poly('34,32 126,32 140,70 20,70', P.lid, L)}
        ${poly('34,32 126,32 116,22 44,22', P.top, L)}
        ${poly('126,32 140,70 146,62 132,26 116,22', P.lidD, L)}
        ${poly('20,70 34,32 40,32 28,70', 'rgba(255,255,255,.35)')}
        ${poly('70,22 90,22 92,32 94,70 66,70 68,32', P.metal, L)}
        ${poly('90,22 92,32 94,70 88,70 86,32', P.metalD)}
      </g>
      ${poly('20,70 140,70 134,140 26,140', P.front, L)}
      ${poly('140,70 146,62 140,134 134,140', P.side, L)}
      ${poly('26,104 134,104 134,140 26,140', P.frontD)}
      ${poly('20,70 140,70 139,78 21,78', P.metal, L)}
      ${poly('26,132 134,132 134,140 26,140', P.metal, L)}
      ${poly('66,70 94,70 92,140 68,140', P.metal, L)}
      ${poly('88,70 94,70 92,140 86,140', P.metalD)}
      ${[[20, 70, 1, 1], [140, 70, -1, 1], [26, 140, 1, -1], [134, 140, -1, -1]].map(([x, y, sx, sy]) => poly(`${x},${y} ${x + 16 * sx},${y} ${x},${y + 16 * sy}`, P.metal, L)).join('')}
      ${poly('80,82 95,94 80,116 65,94', P.gem[1], L)}
      ${poly('80,82 95,94 80,96', P.gem[0])}
      ${poly('65,94 80,96 80,116', P.gem[2])}
      ${poly('95,94 80,96 80,116', P.gem[3])}
      ${poly('24,76 30,76 28,100 22,100', 'rgba(255,255,255,.28)')}
      ${deco}
    </svg>`;
  }
  const rar = (id) => RARITY[SKIN_MAP[id].rarity] || RARITY.common;
  function skinCard(id, cls = '') {
    const R = rar(id);
    return `<div class="rl-item ${cls}" style="--rc:${R.color};--rd:${R.dark}"><img src="${skinPreview(id, 96)}" alt=""><span class="lbl nm">${SKIN_MAP[id].name}</span></div>`;
  }

  function chests() {
    modal({
      title: 'Chests', icon: 'chest', wide: true,
      tick: (st) => { const el = st.el.querySelector('#ch-free'); if (el) el.innerHTML = freeLabel(); },
      render(b, st) {
        const row = h('<div class="chest-row"></div>');
        for (const c of CHESTS) {
          const drops = c.drops.map(([id, p]) => {
            const R = rar(id);
            return `<div class="drop" style="--rc:${R.color};--rd:${R.dark}" title="${SKIN_MAP[id].name} (${R.name})">
              <img src="${skinPreview(id, 64)}" alt="">${profile.ownsSkin(id) ? `<span class="own">${ic('check', 18)}</span>` : ''}<span class="pct">${p}%</span></div>`;
          }).join('');
          const el = h(`<div class="chest-card" style="--cc:${c.color};--cd:${c.dark}">
            <div class="chest-top"><div class="rays"></div>${chestArt(c, 150)}</div>
            <div class="chest-name lbl">${c.name}</div>
            <div class="chest-sub">Contains exclusive skins</div>
            <div class="drops">${drops}</div>
            <div class="chest-btns">
              <button class="btn green" data-open="paid">${ic('gem', 22)} ${fmtFull(c.price)}</button>
              ${c.id === 'frozen' ? '<button class="btn yellow" id="ch-free"></button>' : ''}
            </div></div>`);
          el.querySelector('[data-open]').addEventListener('click', () => start(c, false, st));
          const fb = el.querySelector('#ch-free');
          if (fb) { fb.innerHTML = freeLabel(); fb.addEventListener('click', () => start(c, true, st)); }
          row.appendChild(el);
        }
        b.appendChild(row);
        b.appendChild(h('<div class="muted center" style="margin-top:8px">Duplicates refund 50% of the chest price.</div>'));
      },
    });

    function freeLabel() {
      const left = profile.d.chest.freeAt - Date.now();
      return left > 0 ? `${ic('clock', 20)} Free in ${timeLeft(left)}` : `${ic('gift', 22)} Open FREE`;
    }

    function start(c, free, st) {
      const res = profile.openChest(c, free);
      if (!res) { Audio.error(); G.hud.toast(free ? 'Free chest not ready yet!' : 'Not enough Gems!', 'red'); return; }
      st.busy = true;
      st.el.classList.add('opening'); // stage fills the whole window
      const R = rar(res.skin);
      const body = st.body;
      body.innerHTML = '';
      const stage = h(`<div class="cs-stage" style="--cc:${c.color};--cd:${c.dark};--rc:${R.color};--rd:${R.dark}">
        <div class="cs-bgrays"></div><div class="cs-spot"></div>
        <div class="cs-glow"></div><div class="cs-leak"></div>
        <div class="cs-chest drop">${chestArt(c, 200)}</div>
        <div class="cs-ring"></div><div class="cs-flash"></div>
        <div class="reel hidden"><div class="reel-strip"></div><div class="reel-mark"></div><div class="reel-fade l"></div><div class="reel-fade r"></div></div>
        <div class="cs-reveal hidden"></div>
      </div>`);
      body.appendChild(stage);
      const chestEl = stage.querySelector('.cs-chest');
      // 1) build-up: shake gets stronger, light leaks out, glow pulses in the prize's rarity colour
      const steps = [[350, 'shake1'], [900, 'shake2'], [1350, 'shake3']];
      for (const [ms, cls] of steps) setTimeout(() => { chestEl.classList.remove('drop', 'shake1', 'shake2'); chestEl.classList.add(cls); stage.classList.add('charge-' + cls); }, ms);
      let gap = 170, n = 0;
      const rumble = () => { if (n++ > 16) return; Audio.tick(); gap = Math.max(55, gap * 0.86); setTimeout(rumble, gap); };
      setTimeout(rumble, 350);
      // 2) burst
      setTimeout(() => {
        chestEl.classList.remove('shake3');
        chestEl.classList.add('open');
        stage.classList.add('burst');
        Audio.boom();
        shards(stage, c);
        setTimeout(() => spinReel(stage, c, res, st), 650);
      }, 1750);
    }

    function shards(stage, c) {
      for (let k = 0; k < 14; k++) {
        const sh = document.createElement('i');
        sh.className = 'shard';
        const a = (k / 14) * Math.PI * 2 + Math.random() * 0.4, d = 140 + Math.random() * 160;
        sh.style.setProperty('--dx', Math.cos(a) * d + 'px');
        sh.style.setProperty('--dy', Math.sin(a) * d - 40 + 'px');
        sh.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        sh.style.background = k % 3 === 0 ? '#ffd21f' : k % 3 === 1 ? c.color : c.dark;
        stage.appendChild(sh);
        setTimeout(() => sh.remove(), 1200);
      }
    }

    function spinReel(stage, c, res, st) {
      stage.querySelector('.cs-chest').classList.add('gone');
      stage.classList.add('reeling');
      const reel = stage.querySelector('.reel');
      const strip = stage.querySelector('.reel-strip');
      reel.classList.remove('hidden');
      const roll = () => { let r = Math.random() * 100; for (const [id, p] of c.drops) { r -= p; if (r <= 0) return id; } return c.drops[0][0]; };
      const N = 60, WIN = 52;
      const items = Array.from({ length: N }, (_, i) => (i === WIN ? res.skin : roll()));
      items[WIN + 1] = c.drops[c.drops.length - 1][0]; // near-miss tease
      strip.innerHTML = items.map((id, i) => skinCard(id, i === WIN ? 'win' : '')).join('');
      const ITEM = 128;
      const view = reel.clientWidth;
      const jitter = (Math.random() - 0.5) * (ITEM - 30);
      const target = WIN * ITEM + ITEM / 2 - view / 2 + jitter;
      strip.style.transform = 'translateX(0px)';
      void strip.offsetWidth;
      const dur = 5600;
      strip.style.transition = `transform ${dur}ms cubic-bezier(0.06, 0.82, 0.12, 1)`;
      strip.style.transform = `translateX(${-target}px)`;
      let last = -1, alive = true;
      const mark = stage.querySelector('.reel-mark');
      const loop = () => {
        if (!alive) return;
        const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
        const idx = Math.floor((-m.m41 + view / 2) / ITEM);
        if (idx !== last) {
          last = idx;
          Audio.tick();
          mark.classList.remove('bump'); void mark.offsetWidth; mark.classList.add('bump');
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      setTimeout(() => {
        alive = false;
        strip.querySelectorAll('.rl-item')[WIN].classList.add('landed');
        strip.classList.add('settled');
        setTimeout(() => reveal(stage, c, res, st), 800);
      }, dur + 150);
    }

    function reveal(stage, c, res, st) {
      const sk = SKIN_MAP[res.skin];
      const R = rar(res.skin);
      const big = sk.rarity === 'legendary' || sk.rarity === 'mythic';
      stage.querySelector('.reel').classList.add('dim');
      stage.classList.add('revealing');
      const rv = stage.querySelector('.cs-reveal');
      const sparkles = Array.from({ length: 14 }, (_, k) => `<i class="spk" style="left:${10 + Math.random() * 80}%;top:${8 + Math.random() * 70}%;animation-delay:${(k * 0.17).toFixed(2)}s"></i>`).join('');
      rv.innerHTML = `<div class="rv-rays"></div><div class="rv-wave"></div>${sparkles}
        <div class="rv-ribbon lbl" style="--o:${R.dark}">${R.name}</div>
        <div class="rv-card"><div class="rv-skin"><img src="${skinPreview(res.skin, 160)}" alt=""></div></div>
        <div class="rv-name lbl" style="--o:${R.dark}">${sk.name}</div>
        <div class="rv-msg lbl ${res.dup ? 'dup' : 'new'}">${res.dup ? `Duplicate! +${fmtFull(res.refund)} Gems` : 'NEW SKIN!'}</div>
        <div class="row center rv-btns">
          ${res.dup ? '' : '<button class="btn green" data-a="equip">Equip</button>'}
          <button class="btn" data-a="again">${ic('chest', 22)} Open Again</button>
          <button class="btn gray" data-a="back">Back</button>
        </div>`;
      rv.classList.remove('hidden');
      if (big) { rv.classList.add('big'); Audio.level(); confetti(stage, 110); SDK.happytime(); } else { Audio.reward(); confetti(stage, 36); }
      const done = () => { st.busy = false; st.el.classList.remove('opening'); };
      rv.querySelector('[data-a="back"]').onclick = () => { done(); st.redraw(); };
      rv.querySelector('[data-a="again"]').onclick = () => { done(); st.redraw(); start(c, false, st); };
      const eq = rv.querySelector('[data-a="equip"]');
      if (eq) eq.onclick = () => { profile.equipSkin(res.skin); G.onSkinChanged(); G.hud.toast(`${sk.name} equipped!`, 'gold'); eq.disabled = true; eq.textContent = 'Equipped'; };
    }

    function confetti(stage, n) {
      const cols = ['#ff3b6b', '#ffd21f', '#3aa9ff', '#5be37a', '#b14cf0', '#ff9a2e'];
      for (let i = 0; i < n; i++) {
        const p = document.createElement('i');
        p.className = 'cf';
        p.style.left = Math.random() * 100 + '%';
        p.style.background = cols[i % cols.length];
        p.style.animationDelay = Math.random() * 0.4 + 's';
        p.style.animationDuration = 1.6 + Math.random() * 1.2 + 's';
        p.style.setProperty('--dx', (Math.random() - 0.5) * 160 + 'px');
        p.style.setProperty('--rot', Math.random() * 720 + 'deg');
        stage.appendChild(p);
        setTimeout(() => p.remove(), 3400);
      }
    }
  }

  // ------------------------------------------------------------------ tank shop (spend gems on tanks)
  const CLS_COL = { Shooter: '#2f9dff', Sniper: '#8f5cff', Spammer: '#ff8a1c', Melee: '#f0464f', Flame: '#ff5a1f', Special: '#1fbfa6' };
  // rough 0..1 ratings so tanks can be compared at a glance
  function tankRatings(d) {
    const fire = d.barrels.reduce((a, x) => a + (x.dmg * x.pellets) / x.rel, 0) + (d.body.spikes ? d.body.bodyDmg * 0.9 : 0);
    const range = d.barrels.length ? Math.max(...d.barrels.map((x) => x.spd * x.life)) * d.fov : 0.4;
    return { Firepower: Math.min(1, fire / 4.5), Health: Math.min(1, d.body.hp / 2.2), Speed: Math.min(1, d.body.speed / 1.35), Range: Math.min(1, range / 2.2) };
  }
  function tankShop() {
    const items = TANK_LIST.filter((d) => d.unlock.type === 'gems').sort((a, b) => a.unlock.price - b.unlock.price);
    let sel = items.find((d) => !profile.ownsTank(d.id)) || items[0];
    let filter = 'All';
    const classes = ['All', ...new Set(items.map((d) => d.cls))];
    modal({
      title: 'Tank Shop', icon: 'shield', wide: true,
      render(b, st) {
        const d0 = profile.d;
        const owned = profile.ownsTank(sel.id);
        const afford = d0.gems >= sel.unlock.price;
        const col = CLS_COL[sel.cls] || '#2f9dff';
        const R = tankRatings(sel);
        const wrap = h(`<div class="tsh">
          <div class="tsh-hero" style="--cc:${col}">
            <div class="tsh-rays"></div>
            <div class="tsh-cls lbl">${sel.cls}</div>
            <img class="tsh-img" src="${tankIcon(sel.id, 160)}" alt="">
            <div class="tsh-pod"></div>
            <div class="tsh-name lbl">${sel.name}</div>
            <div class="tsh-lv">Unlocks at Level ${sel.level} · ${pathTo(sel.id).slice(-2, -1).map((x) => 'from ' + TANKS[x].name).join('')}</div>
            <div class="tsh-stats">${Object.entries(R).map(([k, v]) => `<div class="tsr"><span>${k}</span><div><i style="width:${Math.max(6, v * 100)}%"></i></div></div>`).join('')}</div>
            <button class="btn ${owned ? 'gray' : afford ? 'green glow' : 'gray'} tsh-buy" ${owned ? 'disabled' : ''}>${owned ? `${ic('check', 22)} Owned` : `${ic('gem', 22)} ${fmtFull(sel.unlock.price)}`}</button>
            <button class="btn yellow tsh-ix">${ic('search', 18)} View in Index</button>
          </div>
          <div class="tsh-right">
            <div class="tsh-top"><div class="tsh-filters">${classes.map((c) => `<button class="tf ${c === filter ? 'on' : ''}" data-c="${c}" style="--cc:${CLS_COL[c] || '#16335e'}">${c}</button>`).join('')}</div>
              <div class="sto-bal">${ic('gem', 22)}<b class="lbl">${fmtFull(d0.gems)}</b></div></div>
            <div class="tsh-grid"></div></div></div>`);
        const g = wrap.querySelector('.tsh-grid');
        for (const d of items.filter((x) => filter === 'All' || x.cls === filter)) {
          const own = profile.ownsTank(d.id);
          const c = h(`<div class="tcd ${d === sel ? 'sel' : ''} ${own ? 'own' : ''}" style="--cc:${CLS_COL[d.cls] || '#2f9dff'}">
            <span class="tcd-cls">${d.cls}</span>
            <img src="${tankIcon(d.id, 80)}" alt="">
            <div class="tcd-name lbl">${d.name}</div>
            ${own ? `<div class="tcd-own">${ic('check', 16)} Owned</div>` : `<div class="tcd-price ${d0.gems >= d.unlock.price ? '' : 'poor'}">${ic('gem', 16)} ${fmt(d.unlock.price)}</div>`}
            ${profile.level < d.level ? `<span class="tcd-lv">Lv ${d.level}</span>` : ''}</div>`);
          c.addEventListener('click', () => { sel = d; Audio.click(); st.redraw(); });
          g.appendChild(c);
        }
        wrap.querySelectorAll('.tf').forEach((x) => x.addEventListener('click', () => { filter = x.dataset.c; Audio.click(); st.redraw(); }));
        wrap.querySelector('.tsh-ix').onclick = () => index(sel.id);
        wrap.querySelector('.tsh-buy').onclick = () => {
          if (profile.ownsTank(sel.id)) return;
          const d = sel;
          buyTank(d, () => {
            if (!profile.spend(d.unlock.price)) { Audio.error(); G.hud.toast('Not enough Gems!', 'red'); return; }
            profile.giveTank(d.id);
            Audio.reward();
            G.hud.toast(`${d.name} unlocked forever!`, 'gold');
            G.onOwnedChanged();
            tankShop();
          });
        };
        b.appendChild(wrap);
        const s0 = g.querySelector('.tcd.sel');
        if (s0) s0.scrollIntoView({ block: 'nearest' });
      },
    });
  }

  // ------------------------------------------------------------------ skins shop
  function skinShop() {
    modal({
      title: 'Skins Shop', icon: 'palette', wide: true,
      render(b, st) {
        const g = h('<div class="grid"></div>');
        for (const s of SKINS) {
          const owned = profile.ownsSkin(s.id);
          const eq = profile.d.skin === s.id;
          const price = s.price === -2 ? 'From chests' : s.price < 0 ? 'Event quest' : `${ic('gem', 20)} ${fmt(s.price)}`;
          const c = h(`<div class="card ${eq ? 'sel' : ''}"><img src="${skinPreview(s.id, 64)}"><div>${s.name}</div><div class="${owned ? 'owned' : 'price'}">${eq ? 'Equipped' : owned ? 'Equip' : price}</div></div>`);
          c.addEventListener('click', () => {
            if (owned) { profile.equipSkin(s.id); G.onSkinChanged(); Audio.click(); st.redraw(); return; }
            if (s.price === -2) { G.hud.toast('Find this skin in Chests!', 'red'); return; }
            if (s.price < 0) { G.hud.toast('Complete the Event quest to unlock!', 'red'); return; }
            confirm(`Buy <b>${s.name}</b> skin for ${ic('gem', 20)} ${fmtFull(s.price)}?`, () => {
              if (!profile.spend(s.price)) { Audio.error(); G.hud.toast('Not enough Gems!', 'red'); skinShop(); return; }
              profile.giveSkin(s.id);
              profile.equipSkin(s.id);
              G.onSkinChanged();
              Audio.reward();
              G.hud.toast(`${s.name} skin equipped!`, 'gold');
              skinShop();
            }, () => skinShop());
          });
          g.appendChild(c);
        }
        b.appendChild(h('<div class="muted center" style="margin-bottom:6px">Tanks are blue by default - make yours unique!</div>'));
        b.appendChild(g);
      },
    });
  }

  // ------------------------------------------------------------------ upgrades shop
  function upgrades() {
    let flash = null; // which card just got bought (for the pop animation)
    modal({
      title: 'Upgrades Shop', icon: 'statup', wide: true,
      render(b, st) {
        const d = profile.d;
        b.appendChild(h(`<div class="up-head"><div><div class="up-h1 lbl">Permanent upgrades</div><div class="muted">Raise your stat limits, boost every reward and get extra stat points. Applies from your next match.</div></div>
          <div class="up-bal">${ic('gem', 26)}<span class="lbl">${fmtFull(d.gems)}</span></div></div>`));
        b.appendChild(h('<div class="up-sec lbl">Stat caps</div>'));
        const grid = h('<div class="up-grid"></div>');
        STATS.forEach((sDef, i) => {
          const cap = BASE_CAP + d.capUps[i];
          const maxed = cap >= MAX_CAP;
          const price = capPrice(d.capUps[i]);
          const afford = d.gems >= price;
          const pips = Array.from({ length: MAX_CAP }, (_, k) => {
            const cls = k < BASE_CAP ? 'base' : k < cap ? 'got' : k === cap ? 'next' : '';
            return `<i class="${cls} ${flash === 'stat' + i && k === cap - 1 ? 'pop' : ''}"></i>`;
          }).join('');
          const card = h(`<div class="up-card ${flash === 'stat' + i ? 'bought' : ''}" style="--c:${sDef.color}">
            <div class="up-icon">${ic(STAT_ICONS[i], 34)}</div>
            <div class="up-mid"><div class="up-name lbl">${sDef.name}</div>
              <div class="up-pips">${pips}</div>
              <div class="up-sub">${maxed ? 'Fully upgraded' : `Max level <b>${cap}</b> &rarr; <b class="nx">${cap + 1}</b>`}</div></div>
            ${maxed ? '<div class="up-max lbl">MAX</div>' : `<button class="btn ${afford ? 'green' : 'gray'} up-buy">${ic('gem', 20)} ${fmt(price)}</button>`}</div>`);
          const buy = card.querySelector('.up-buy');
          if (buy) buy.onclick = () => {
            if (!profile.spend(price)) { Audio.error(); G.hud.toast('Not enough Gems!', 'red'); card.classList.remove('nope'); void card.offsetWidth; card.classList.add('nope'); return; }
            d.capUps[i]++;
            profile.emit('caps');
            flash = 'stat' + i;
            G.hud.toast(`${sDef.name} max is now ${cap + 1}!`, 'gold');
            Audio.reward();
            st.redraw();
          };
          grid.appendChild(card);
        });
        b.appendChild(grid);
        b.appendChild(h('<div class="up-sec lbl">Boosts</div>'));
        const boosts = h('<div class="up-boosts"></div>');
        const BOOSTS = [
          ['xpBoost', 'XP Boost', 'star', '#ffb31a', (l) => `+${l * 10}%`, 'More XP from everything'],
          ['gemBoost', 'Gem Boost', 'gem', '#25b8f0', (l) => `+${l * 10}%`, 'More gems from shapes and kills'],
          ['ptsBoost', 'Stat Points', 'statup', '#3fd34a', (l) => `+${l * 2}`, 'Extra stat points every match'],
        ];
        for (const [key, label, icon, col, fmtv, desc] of BOOSTS) {
          const lv = d[key] || 0;
          const maxed = lv >= 5;
          const price = boostPrice(lv);
          const afford = d.gems >= price;
          const card = h(`<div class="up-boost ${flash === key ? 'bought' : ''}" style="--c:${col}">
            <div class="ub-icon">${ic(icon, 54)}</div>
            <div class="ub-mid"><div class="up-name lbl">${label}</div>
              <div class="ub-row"><span class="ub-pct lbl">${fmtv(lv)}</span>${maxed ? '' : `<span class="ub-next">Next: ${fmtv(lv + 1)}</span>`}</div>
              <div class="up-pips five">${Array.from({ length: 5 }, (_, k) => `<i class="${k < lv ? 'got' : k === lv ? 'next' : ''} ${flash === key && k === lv - 1 ? 'pop' : ''}"></i>`).join('')}</div>
              <div class="up-sub">${desc}</div></div>
            ${maxed ? '<div class="up-max lbl">MAX</div>' : `<button class="btn ${afford ? 'green' : 'gray'} up-buy">${ic('gem', 20)} ${fmt(price)}</button>`}</div>`);
          const buy = card.querySelector('.up-buy');
          if (buy) buy.onclick = () => {
            if (!profile.spend(price)) { Audio.error(); G.hud.toast('Not enough Gems!', 'red'); card.classList.remove('nope'); void card.offsetWidth; card.classList.add('nope'); return; }
            d[key] = lv + 1;
            profile.emit('boost');
            flash = key;
            G.hud.toast(`${label} is now ${fmtv(lv + 1)}!`, 'gold');
            Audio.reward();
            st.redraw();
          };
          boosts.appendChild(card);
        }
        b.appendChild(boosts);
        flash = null;
      },
    });
  }

  // ------------------------------------------------------------------ settings
  function settings() {
    modal({
      title: 'Settings', icon: 'gear',
      render(b) {
        const s = profile.d.settings;
        const el = h(`<div class="col">
          <div class="row between box"><b>Name</b><span class="st-name">${esc(profile.d.name || 'Guest')}</span></div>
          <label class="row between box"><b>Sound</b><input id="st-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}"></label>
          <label class="row between box"><b>Camera sensitivity</b><input id="st-sens" type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}"></label>
          <label class="row between box"><b>Graphics</b><select id="st-q" style="font-family:inherit;font-size:16px"><option value="high">High</option><option value="low">Low (faster)</option></select></label>
          <label class="row between box"><b>Show names</b><input id="st-names" type="checkbox" ${s.names ? 'checked' : ''}></label>
          <div class="box muted">Controls: WASD move · Mouse aim · Click/Space shoot · Right-drag rotate camera · Scroll zoom · Q tank upgrades · E stats (1-8) · F auto fire · R auto spin · C turn 180° · Shift lock camera · Enter chat · X index · G gifts</div>
          <div class="row center"><button class="btn green" id="st-tut">${ic('play', 22)} Replay Tutorial</button></div>
          <div class="row center"><button class="btn" id="st-pp">Privacy Policy</button><button class="btn" id="st-tos">Terms of Use</button></div></div>`);
        el.querySelector('#st-q').value = s.quality;
        el.querySelector('#st-sfx').addEventListener('input', (e) => { s.sfx = +e.target.value; Audio.setVolume(s.sfx); profile.save(); });
        el.querySelector('#st-sens').addEventListener('input', (e) => { s.sens = +e.target.value; profile.save(); });
        el.querySelector('#st-names').addEventListener('change', (e) => { s.names = e.target.checked; profile.save(); });
        el.querySelector('#st-q').addEventListener('change', (e) => { s.quality = e.target.value; profile.save(); G.hud.toast('Graphics change applies after reload', 'blue'); });
        el.querySelector('#st-tut').onclick = () => { Audio.click(); close(); G.tut.replay(); };
        el.querySelector('#st-pp').onclick = () => legal('privacy');
        el.querySelector('#st-tos').onclick = () => legal('terms');
        b.appendChild(el);
      },
    });
  }

  // ------------------------------------------------------------------ privacy policy / terms (in-game, no external links)
  const LEGAL = {
    privacy: { title: 'Privacy Policy', html: `
      <p class="muted">Last updated: November 2026</p>
      <h4>What we store</h4>
      <p>Your game progress (level, XP, gems, unlocked tanks and skins, quests and settings) is saved on your device and, when you play on CrazyGames, through the CrazyGames data service so it follows your CrazyGames account. We do not ask for your real name, email, location, contacts or payment details.</p>
      <h4>Your name</h4>
      <p>If you are signed in to CrazyGames, your CrazyGames username is shown to other players. Otherwise you appear as "Guest". You cannot type a custom name in the game.</p>
      <h4>Multiplayer</h4>
      <p>While you play online, our game server receives what it needs to run the match: your display name, level, equipped tank and skin, your controls (movement, aiming, shooting) and chat messages you choose to send. Chat is filtered for bad words and links and is not kept after the match. A random play ID may be kept in server memory to keep you in the same server; it is not linked to your identity.</p>
      <h4>Advertising and tracking</h4>
      <p>This version of the game shows no ads and contains no third-party analytics or tracking. The CrazyGames platform you play on has its own privacy policy, which applies to your use of CrazyGames.</p>
      <h4>Children</h4>
      <p>The game is suitable for all ages and does not knowingly collect personal information from children. Chat can be turned off through your CrazyGames settings.</p>
      <h4>Deleting your data</h4>
      <p>Clearing your browser data removes the local save. Data saved through CrazyGames can be removed through your CrazyGames account. Server-side match data is temporary and disappears when the server restarts.</p>
      <h4>Contact</h4>
      <p>For questions about privacy, contact us through the game's page on CrazyGames.</p>` },
    terms: { title: 'Terms of Use', html: `
      <p class="muted">Last updated: November 2026</p>
      <h4>Playing the game</h4>
      <p>The game is free to play. By playing you agree to these terms. If you do not agree, please do not play.</p>
      <h4>Fair play</h4>
      <p>Do not cheat, use hacks, bots or scripts, exploit bugs, or disrupt servers or other players. We may remove players who break these rules from a server.</p>
      <h4>Chat and behaviour</h4>
      <p>Be respectful. No bullying, hate speech, harassment, sharing personal information or links. Messages are filtered and chat may be disabled.</p>
      <h4>Virtual items</h4>
      <p>Gems, XP, tanks, skins and other in-game items have no real-world value, cannot be exchanged for money, and may be changed or rebalanced as the game is updated. Progress can be lost if your browser data is cleared and you are not signed in.</p>
      <h4>Changes and availability</h4>
      <p>We may update, change or stop the game or these terms at any time. Servers may restart, which ends the matches running on them.</p>
      <h4>No warranty</h4>
      <p>The game is provided "as is" without warranties. To the extent allowed by law, we are not liable for any loss arising from playing the game.</p>
      <h4>Contact</h4>
      <p>Questions? Contact us through the game's page on CrazyGames.</p>` },
  };
  function legal(which) {
    const L = LEGAL[which];
    modal({
      title: L.title, icon: 'clipboard', wide: true,
      render(b) {
        b.appendChild(h(`<div class="legal">${L.html}</div>`));
        const back = h('<div class="row center" style="margin-top:8px"><button class="btn">Back to Settings</button></div>');
        back.querySelector('button').onclick = () => settings();
        b.appendChild(back);
      },
    });
  }

  // ------------------------------------------------------------------ player list
  function list() {
    modal({
      title: 'Players', icon: 'target',
      tick: (st) => st.redraw(),
      render(b) {
        const lb = G.arena && G.arena.lastLB;
        if (!lb) { b.appendChild(h('<div class="muted">No data yet.</div>')); return; }
        const rows = lb.list.map((r, i) => `<div class="row between box" style="padding:4px 10px;margin-bottom:4px;${r[5] ? 'border-color:#2fa8ff' : ''}">
          <span>${i + 1}. ${esc(r[0])}</span><span>${ic('sword', 20)} ${r[4]} · Lv <b>${r[1]}</b></span></div>`).join('');
        b.appendChild(h(`<div>${rows}<div class="muted center">${G.netLabel()}</div></div>`));
      },
    });
  }

  // ------------------------------------------------------------------ death / confirm
  const TIPS = [
    'Press E and put points into Max Health and Health Regen to survive longer.',
    'Shapes near the middle of the map give the most XP.',
    'Hide behind walls - bullets cannot pass through them.',
    'Bullets cancel each other out. Use that to block incoming shots!',
    'Press Q as soon as you level up to evolve into a stronger tank.',
    'Leaving while in combat gives your attacker the kill.',
    'Raise your stat caps in the Upgrades Shop in the lobby.',
  ];
  function death(info, onRespawn, onLobby) {
    // red flash + small screen shake as the screen opens
    const fl = document.createElement('div');
    fl.className = 'hurt-flash';
    document.body.appendChild(fl);
    setTimeout(() => fl.remove(), 900);
    const killerTank = Object.values(TANKS).find((t) => t.name === info.byTank);
    modal({
      title: 'Destroyed', icon: 'skull',
      onClose: () => { if (!info.handled) onRespawn(); },
      render(b, st) {
        st.el.classList.add('death-modal');
        const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
        const el = h(`<div class="dth">
          <div class="dth-head"><div class="dth-title lbl">DESTROYED</div><div class="dth-sub">Better luck next time!</div></div>
          <div class="dth-killer">
            ${killerTank ? `<img src="${tankIcon(killerTank.id)}" alt="">` : `<div class="dth-noicon">${ic('skull', 56)}</div>`}
            <div><div class="muted">Destroyed by</div><div class="dth-kname lbl">${esc(info.by)}</div>${info.byTank ? `<span class="dth-chip">${esc(info.byTank)}</span>` : ''}</div>
          </div>
          <div class="dth-stats">
            <div class="dth-stat" style="--c:#ffb31a">${ic('star', 30)}<b class="lbl">${fmt(info.xp)}</b><span>XP earned</span></div>
            <div class="dth-stat" style="--c:#f0323f">${ic('sword', 30)}<b class="lbl">${info.kills}</b><span>Kills</span></div>
            <div class="dth-stat" style="--c:#2b8ef5">${ic('clock', 30)}<b class="lbl">${timeLeft(info.time * 1000)}</b><span>Time alive</span></div>
            <div class="dth-stat" style="--c:#3fd34a">${ic('statup', 30)}<b class="lbl">${profile.level}</b><span>Your level</span></div>
          </div>
          <div class="dth-tip">${ic('book', 20)} <b>Tip:</b> ${tip}</div>
          <div class="dth-btns"><button class="btn green" id="d-re">${ic('spin', 26)} Respawn</button><button class="btn" id="d-lobby">${ic('door', 24)} Lobby</button></div>
        </div>`);
        el.querySelector('#d-re').onclick = () => { info.handled = true; close(); onRespawn(); };
        el.querySelector('#d-lobby').onclick = () => { info.handled = true; close(); onLobby(); };
        b.appendChild(el);
      },
    });
  }

  function confirm(html, yes, no) {
    modal({
      title: 'Confirm', icon: 'clipboard',
      render(b) {
        const el = h(`<div class="col center"><div class="big" style="font-size:18px">${html}</div><div class="row center"><button class="btn green stroke">Yes</button><button class="btn red stroke">No</button></div></div>`);
        el.querySelector('.green').onclick = () => { close(); yes(); };
        el.querySelector('.red').onclick = () => { close(); if (no) no(); };
        b.appendChild(el);
      },
    });
  }

  // ------------------------------------------------------------------ buy-a-tank confirmation
  function buyTank(def, yes) {
    modal({
      title: 'Unlock Tank', icon: 'shield',
      render(b) {
        const col = CLS_COL[def.cls] || '#2f9dff';
        const price = def.unlock.price, have = profile.d.gems, ok = have >= price;
        const R = tankRatings(def);
        const el = h(`<div class="bt" style="--cc:${col}">
          <div class="bt-hero"><div class="tsh-rays"></div>
            <div class="bt-forever lbl">${ic('check', 16)} Yours forever</div>
            <img class="bt-img" src="${tankIcon(def.id, 160)}" alt="">
            <div class="bt-name lbl">${def.name}</div>
            <div class="bt-sub">${def.cls} · Level ${def.level}+</div></div>
          <div class="tsh-stats bt-stats">${Object.entries(R).map(([k, v]) => `<div class="tsr"><span>${k}</span><div><i style="width:${Math.max(6, v * 100)}%"></i></div></div>`).join('')}</div>
          <div class="bt-price">
            <div><span>Price</span><b class="lbl">${ic('gem', 20)} ${fmtFull(price)}</b></div>
            <div><span>Your gems</span><b class="lbl">${ic('gem', 20)} ${fmtFull(have)}</b></div>
            <div class="${ok ? '' : 'bad'}"><span>${ok ? 'After' : 'Missing'}</span><b class="lbl">${ic('gem', 20)} ${fmtFull(Math.abs(have - price))}</b></div>
          </div>
          <div class="bt-btns">
            ${ok ? `<button class="btn green glow bt-yes">${ic('gem', 22)} Buy for ${fmt(price)}</button>` : `<button class="btn yellow bt-get">${ic('basket', 22)} Get Gems</button>`}
            <button class="btn gray bt-no">Cancel</button></div></div>`);
        const yesB = el.querySelector('.bt-yes');
        if (yesB) yesB.onclick = () => { close(); yes(); SDK.happytime(); };
        const getB = el.querySelector('.bt-get');
        if (getB) getB.onclick = () => { Audio.click(); store('gems'); };
        el.querySelector('.bt-no').onclick = () => { Audio.click(); close(); };
        b.appendChild(el);
      },
    });
  }

  const table = {
    store, gifts, quests, rank, index, bag, wheel, chests, settings, list, upgrades,
    tanks: tankShop, skins: skinShop, death, confirm, buyTank,
  };

  return {
    open(name, ...args) { if (table[name]) table[name](...args); },
    close,
    get isOpen() { return !!current; },
    refresh() { if (current && current.redraw && !current.busy && !current.el.querySelector('input:focus')) current.redraw(); },
  };
}
