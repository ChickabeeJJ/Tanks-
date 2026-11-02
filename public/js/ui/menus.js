// All popup windows: Store, Gifts, Quests, Rank, Index, Bag, Wheel, Chests, Shops, Settings...
import { profile, QUESTS, GIFTS, WHEEL, CHESTS, STORE_GEMS, RANK_TASKS, RANK_TIERS, RANK_COLORS, rankTier, rankNeed, MAX_RANK, capPrice, boostPrice, dayId } from '../profile.js';
import { TANK_LIST, TANKS, childrenOf, pathTo } from '../../shared/tanks.js';
import { SKINS } from '../../shared/skins.js';
import { STATS, BASE_CAP, MAX_CAP, MODES } from '../../shared/config.js';
import { fmt, fmtFull } from '../../shared/progression.js';
import { tankIcon, skinPreview } from '../render/textures.js';
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
  if (u.type === 'gems') return `💎 ${fmt(u.price)}`;
  if (u.type === 'quest') return '📋 Quest';
  if (u.type === 'chest') return '🧰 Chest';
  if (u.type === 'wheel') return '🎡 Wheel';
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
      <div class="mtitle stroke">${icon} ${title}</div>
      <div class="mclose stroke">✕</div>
      ${tabs ? '<div class="sidetabs"></div>' : ''}
      <div class="mbody"></div></div>`);
    const body = el.querySelector('.mbody');
    const st = { el, body, tab: tab || (tabs && tabs[0].id), onClose };
    el.querySelector('.mclose').addEventListener('click', () => { Audio.click(); close(); });
    const draw = () => { body.innerHTML = ''; render(body, st); };
    st.redraw = draw;
    if (tabs) {
      const tEl = el.querySelector('.sidetabs');
      for (const t of tabs) {
        const b = h(`<div class="rbtn ${t.id === st.tab ? 'sel' : ''}"><span class="ico">${t.icon}</span><span class="stroke-s">${t.label}</span></div>`);
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
  function store(tab) {
    modal({
      title: 'Store', icon: '🧺', tabs: [{ id: 'pack', label: 'Pack', icon: '🎁' }, { id: 'gems', label: 'Gems', icon: '💎' }], tab: tab || 'pack',
      tick: (st) => st.redraw(),
      render(b, st) {
        const d = profile.d;
        if (st.tab === 'pack') {
          const claimed = d.store.starterDay === dayId();
          const xp = profile.xpLv(0.8);
          b.appendChild(h(`<div class="col">
            <div class="box center" style="background:linear-gradient(#7ff58f,#36c95a);color:#fff">
              <div class="big stroke">Starterpack</div>
              <div class="row center" style="gap:40px;margin:8px 0"><div class="stroke"><div class="big">XP</div>+${fmtFull(xp)}</div><div class="stroke"><div class="big">Gems</div>+1,500</div></div>
              <button class="btn yellow stroke" ${claimed ? 'disabled' : ''}>${claimed ? 'Come back tomorrow' : '📺 Watch Ad - FREE'}</button>
            </div>
            <div class="muted center">Free daily pack. Supports the game!</div></div>`));
          b.querySelector('button').addEventListener('click', async () => {
            if (d.store.starterDay === dayId()) return;
            if (await G.rewarded()) {
              d.store.starterDay = dayId();
              say(profile.grant({ xp, gems: 1500 }));
              Audio.reward();
              st.redraw();
            }
          });
        } else {
          const g = h('<div class="col"></div>');
          STORE_GEMS.forEach((p, i) => {
            const left = d.store.gemsAt[i] - Date.now();
            const row = h(`<div class="box row between"><div class="row"><span style="font-size:34px">💎</span><div><div class="big">${p.name}</div><div class="muted">+${fmtFull(p.gems)} Gems</div></div></div>
              <button class="btn green stroke" ${left > 0 ? 'disabled' : ''}>${left > 0 ? timeLeft(left) : '📺 Watch Ad'}</button></div>`);
            row.querySelector('button').addEventListener('click', async () => {
              if (d.store.gemsAt[i] > Date.now()) return;
              if (await G.rewarded()) {
                d.store.gemsAt[i] = Date.now() + p.cd * 1000;
                say(profile.grant({ gems: p.gems }));
                Audio.reward();
                st.redraw();
              }
            });
            g.appendChild(row);
          });
          b.appendChild(g);
        }
      },
    });
  }

  // ------------------------------------------------------------------ gifts
  function gifts() {
    modal({
      title: 'Gifts', icon: '🎁', tick: (st) => st.redraw(),
      render(b) {
        const el = profile.giftElapsed();
        const g = h('<div class="grid"></div>');
        GIFTS.forEach((gf, i) => {
          const claimed = profile.session.claimedGifts.has(i);
          const ready = !claimed && el >= gf.at;
          const r = gf.r;
          const label = r.gems ? `${fmtFull(r.gems)} 💎` : r.spins ? `${r.spins} Spin${r.spins > 1 ? 's' : ''} 🎡` : `${fmtFull(profile.xpLv(r.xpLv))} ⭐`;
          const c = h(`<div class="card ${ready ? 'sel' : ''}" style="${claimed ? 'opacity:.5' : ''}"><div style="font-size:40px">🎁</div><div>${label}</div>
            <div class="${ready ? 'owned' : 'muted'}">${claimed ? 'Claimed' : ready ? 'CLAIM!' : timeLeft((gf.at - el) * 1000)}</div></div>`);
          c.addEventListener('click', () => {
            const out = profile.claimGift(i);
            if (out) { say(out); Audio.reward(); } else if (!claimed) { Audio.error(); G.hud.toast('Keep playing to unlock!', 'red'); }
          });
          g.appendChild(c);
        });
        b.appendChild(h('<div class="muted center" style="margin-bottom:6px">Play to unlock gifts! Timers reset every session.</div>'));
        b.appendChild(g);
      },
    });
  }

  // ------------------------------------------------------------------ quests
  function quests(tab) {
    modal({
      title: 'Quests', icon: '📋',
      tabs: [{ id: 'daily', label: 'Daily', icon: '☀️' }, { id: 'weekly', label: 'Weekly', icon: '📅' }, { id: 'unique', label: 'Unique', icon: '⭐' }, { id: 'event', label: 'Event', icon: '❄️' }],
      tab,
      render(b, st) {
        const cat = st.tab;
        if (cat === 'daily') b.appendChild(h(`<div class="center big" style="margin-bottom:6px">⏰ ${timeLeft(untilMidnight())}</div>`));
        for (const q of QUESTS[cat]) {
          const state = profile.questState(cat, q);
          const reward = q.reward;
          const rlabel = reward.tank ? `<img src="${tankIcon(reward.tank, 64)}" style="width:54px"><div>${TANKS[reward.tank].name}</div>`
            : reward.skin ? `<img src="${skinPreview(reward.skin, 64)}" style="width:54px"><div>Skin</div>`
              : `${reward.gems ? `<div>+${fmtFull(reward.gems)} 💎</div>` : ''}${reward.xpLv ? `<div>+${fmtFull(profile.xpLv(reward.xpLv))} ⭐</div>` : ''}`;
          if (state === 'locked') {
            b.appendChild(h(`<div class="box" style="opacity:.6;margin-bottom:8px"><div class="big">🔒 ${q.name}</div><div class="muted">Locked - finish the previous quest first</div></div>`));
            continue;
          }
          const reqs = q.reqs.map((r) => {
            const v = Math.min(r.n, profile.questValue(r.k));
            const show = r.time ? `${Math.floor(v / 60)}/${Math.floor(r.n / 60)}` : `${fmt(v)}/${fmt(r.n)}`;
            return `<div style="margin:4px 0"><div class="muted">◆ ${r.label}</div><div class="prog"><div style="width:${(v / r.n) * 100}%"></div><span>${show}</span></div></div>`;
          }).join('');
          const el = h(`<div class="box row" style="margin-bottom:8px;align-items:stretch"><div style="flex:1"><div class="big">${q.name}</div>${reqs}</div>
            <div class="task ${state === 'ready' ? 'ready' : state === 'claimed' ? 'done' : ''}" style="width:120px">${rlabel}<div>${state === 'claimed' ? '✔ Claimed' : state === 'ready' ? 'CLAIM' : ''}</div></div></div>`);
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
  function rank() {
    modal({
      title: 'Rank', icon: '🛡️',
      render(b, st) {
        const r = profile.d.rank;
        const need = rankNeed(r.idx);
        const tier = rankTier(r.idx);
        const col = RANK_COLORS[RANK_TIERS.indexOf(tier)];
        const nextTier = rankTier(Math.min(MAX_RANK, r.idx + 1));
        const top = h(`<div class="col">
          <div class="center big" style="color:${col};-webkit-text-stroke:1px #16233f">${tier}</div>
          <div class="row center" style="gap:24px">
            <div class="center"><div class="big">Rank ${r.idx}</div><div style="font-size:54px">🛡️</div></div>
            <div style="font-size:50px;color:#ff3b4f">➜</div>
            <div class="center"><div class="big">${r.idx >= MAX_RANK ? 'MAX' : 'Rank ' + (r.idx + 1)}</div><div style="font-size:54px;filter:hue-rotate(${(RANK_TIERS.indexOf(nextTier)) * 50}deg)">🛡️</div></div>
            <button class="btn green stroke" id="rk-claim">Claim</button>
          </div>
          <div class="prog" style="height:26px"><div style="width:${Math.min(100, (r.pts / need) * 100)}%;background:linear-gradient(#7fd3ff,#2fa8ff)"></div><span style="font-size:16px">${r.pts}/${need}</span></div>
          <div class="row" style="flex-wrap:wrap;justify-content:center" id="rk-tasks"></div>
          <div class="muted center">Tasks refresh daily. Rank up to earn Gems + XP!</div></div>`);
        b.appendChild(top);
        const tasks = top.querySelector('#rk-tasks');
        for (const t of RANK_TASKS) {
          const avail = profile.rankTaskAvailable(t);
          const doneN = profile.rankTaskClaimed(t.id);
          const fin = doneN >= t.max;
          const el = h(`<div class="task ${avail > 0 ? 'ready' : fin ? 'done' : ''}">${t.max > 1 ? `<div class="muted" style="color:#fff">x${t.max - doneN}</div>` : ''}<div>${t.label}</div><div class="pts stroke-s">+${t.pts}</div></div>`);
          el.addEventListener('click', async () => {
            if (avail > 0) {
              const pts = profile.claimRankTask(t);
              G.hud.toast(t.id === 'tomorrow' ? 'Claimed Tomorrow task!' : `+${pts} Rank points!`, 'green');
              Audio.reward();
              st.redraw();
            } else if (t.id === 'ad' && !fin) {
              if (await G.rewarded()) { profile.d.rank.ad = 1; profile.addGems(150); st.redraw(); }
            } else if (t.id === 'invite' && !fin) {
              G.invite();
              profile.d.rank.invite = 1;
              profile.save();
              st.redraw();
            } else {
              Audio.error();
              G.hud.toast("Task isn't completed yet!", 'red');
            }
          });
          tasks.appendChild(el);
        }
        top.querySelector('#rk-claim').addEventListener('click', () => {
          const out = profile.rankUp();
          if (out) { G.hud.toast(`Ranked up to Rank ${profile.d.rank.idx}!`, 'gold'); say(out); Audio.level(); SDK.happytime(); st.redraw(); }
          else { Audio.error(); G.hud.toast('Not enough Rank points yet!', 'red'); }
        });
      },
    });
  }

  // ------------------------------------------------------------------ index
  function index(sel) {
    let selected = sel || 'default';
    let search = '';
    modal({
      title: 'Index', icon: '📘', wide: true,
      render(b, st) {
        const wrap = h(`<div class="row" style="align-items:stretch;gap:12px;min-height:340px">
          <div class="col" style="width:200px"><input placeholder="Search" style="border:3px solid #8cc8ea;border-radius:10px;padding:6px 10px;font-family:inherit;font-size:16px" value="${esc(search)}"><div class="col" id="ix-list" style="max-height:330px;overflow:auto;gap:4px"></div></div>
          <div class="box" style="flex:1" id="ix-detail"></div></div>`);
        b.appendChild(wrap);
        const list = wrap.querySelector('#ix-list');
        const input = wrap.querySelector('input');
        const drawList = () => {
          list.innerHTML = '';
          TANK_LIST.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())).forEach((d) => {
            const it = h(`<div class="btn stroke-s" style="font-size:15px;padding:4px 8px;display:flex;justify-content:space-between;align-items:center;${d.id === selected ? 'background:linear-gradient(#6ff07f,#22b947)' : ''}"><span>${d.name}</span><img src="${tankIcon(d.id, 48)}" style="width:28px"></div>`);
            it.addEventListener('click', () => { selected = d.id; Audio.click(); drawList(); drawDetail(); });
            list.appendChild(it);
          });
        };
        input.addEventListener('input', () => { search = input.value; drawList(); });
        input.addEventListener('keydown', (e) => e.stopPropagation());
        const drawDetail = () => {
          const d = TANKS[selected];
          const det = wrap.querySelector('#ix-detail');
          const path = pathTo(d.id).map((id) => `<span class="row" style="display:inline-flex;gap:2px"><img src="${tankIcon(id, 40)}" style="width:26px">${TANKS[id].name}</span>`).join(' ➜ ');
          const kids = childrenOf(d.id).map((c) => `<div class="card" data-id="${c.id}" style="width:96px"><img src="${tankIcon(c.id, 64)}"><div>${c.name}</div><div class="price">${UNLOCK_TAG(c)}</div></div>`).join('');
          const owned = d.unlock.type === 'level' || profile.ownsTank(d.id);
          det.innerHTML = `<div class="row" style="gap:14px"><img src="${tankIcon(d.id, 128)}" style="width:110px">
            <div><div class="big">${d.name}</div><div class="muted">Class: ${d.cls} · Tier ${d.tier}</div><div>🔓 Level ${d.level} · ${d.unlock.type === 'level' ? 'Free' : UNLOCK_TAG(d)}</div>
            <div class="${owned ? 'owned' : 'muted'}" style="color:${owned ? '#22b947' : ''}">${owned ? '✔ Unlocked' : '✖ Not owned'}</div><div class="muted">${d.desc || ''}</div></div></div>
            <div style="margin:8px 0" class="muted">Path: ${path}</div>
            <div class="big" style="font-size:16px">Upgrades into:</div><div class="row" style="flex-wrap:wrap">${kids || '<span class="muted">Final tank</span>'}</div>`;
          det.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { selected = c.dataset.id; drawList(); drawDetail(); }));
        };
        drawList();
        drawDetail();
      },
    });
  }

  // ------------------------------------------------------------------ bag
  function bag(tab) {
    modal({
      title: 'Bag', icon: '🎒', tabs: [{ id: 'tanks', label: 'Tanks', icon: '🛡️' }, { id: 'skins', label: 'Skins', icon: '🎨' }], tab,
      render(b, st) {
        const g = h('<div class="grid"></div>');
        if (st.tab === 'tanks') {
          const owned = profile.d.owned;
          if (!owned.length) b.appendChild(h('<div class="muted center">No special tanks yet. Get them in the Tanks Shop, Chests, the Wheel and Quests!</div>'));
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

  // ------------------------------------------------------------------ wheel
  let wheelRot = 0;
  function wheelCanvas() {
    const c = document.createElement('canvas');
    c.width = c.height = 600;
    const ctx = c.getContext('2d');
    const n = WHEEL.length;
    WHEEL.forEach((s, i) => {
      const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2, a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.moveTo(300, 300); ctx.arc(300, 300, 296, a0, a1); ctx.fill();
      ctx.strokeStyle = '#16233f'; ctx.lineWidth = 4; ctx.stroke();
      ctx.save();
      ctx.translate(300, 300);
      ctx.rotate((a0 + a1) / 2);
      ctx.textAlign = 'center';
      ctx.font = '700 30px Fredoka, sans-serif';
      ctx.lineWidth = 6; ctx.strokeStyle = '#16233f'; ctx.fillStyle = '#fff';
      const label = s.tank ? s.label : s.gems ? `+${fmtFull(s.gems)} 💎` : `+${fmtFull(profile.xpLv(s.xpLv))} ⭐`;
      ctx.translate(190, 0);
      ctx.rotate(Math.PI / 2);
      if (s.tank) {
        const img = new Image();
        img.src = tankIcon(s.tank, 96);
        ctx.drawImage(img, -40, -60, 80, 80);
      }
      for (const [k, part] of (s.tank ? s.label.split(' ') : [label]).entries()) {
        ctx.strokeText(part, 0, (s.tank ? 40 : 10) + k * 30);
        ctx.fillText(part, 0, (s.tank ? 40 : 10) + k * 30);
      }
      ctx.restore();
    });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(300, 300, 60, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#16233f'; ctx.stroke();
    return c.toDataURL();
  }
  function wheel() {
    let fast = false, spinning = false, showOdds = false;
    modal({
      title: 'Wheel', icon: '🎡', tick: (st) => { if (!spinning) st.el.querySelector('#wh-free') && (st.el.querySelector('#wh-free').textContent = freeTxt()); },
      render(b, st) {
        const spins = profile.wheelSpins();
        const adLeft = profile.adSpinsLeft();
        b.appendChild(h(`<div class="col center" style="align-items:center">
          <div id="wheelwrap"><img id="wheel" src="${wheelCanvas()}" style="transform:rotate(${wheelRot}deg)"><div id="wheelptr"></div></div>
          <div class="row center"><button class="btn yellow stroke" id="wh-spin">🎡 Spin</button><button class="btn stroke" id="wh-odds">🎲 Odds</button><button class="btn ${fast ? 'green' : ''} stroke" id="wh-fast">🔥 Fast</button></div>
          <div class="big">${spins} Spin${spins === 1 ? '' : 's'}</div>
          <div class="muted" id="wh-free">${freeTxt()}</div>
          <button class="btn green stroke" id="wh-ad" ${adLeft ? '' : 'disabled'}>📺 Watch Ad: +1 Spin (${adLeft} left today)</button>
          <div id="wh-oddslist" class="box ${showOdds ? '' : 'hidden'}" style="width:100%"></div></div>`));
        const ol = b.querySelector('#wh-oddslist');
        ol.innerHTML = '<div class="big">Chances</div>' + WHEEL.slice().sort((a, c) => a.odds - c.odds).map((s) => `<div class="row between"><span>${s.tank ? s.label : s.gems ? `+${fmtFull(s.gems)} Gems` : `+${fmtFull(profile.xpLv(s.xpLv))} XP`}</span><b>${s.odds}%</b></div>`).join('');
        b.querySelector('#wh-odds').onclick = () => { showOdds = !showOdds; ol.classList.toggle('hidden', !showOdds); };
        b.querySelector('#wh-fast').onclick = () => { fast = !fast; st.redraw(); };
        b.querySelector('#wh-ad').onclick = async () => {
          if (!profile.adSpinsLeft()) return;
          if (await G.rewarded()) { profile.d.wheel.adSpins++; profile.d.wheel.spins++; profile.emit('wheel'); st.redraw(); }
        };
        b.querySelector('#wh-spin').onclick = () => {
          if (spinning) return;
          const res = profile.spinWheel();
          if (!res) { Audio.error(); G.hud.toast('No spins left!', 'red'); return; }
          spinning = true;
          const n = WHEEL.length;
          const target = 360 - ((res.idx + 0.5) * 360) / n + (Math.random() - 0.5) * (300 / n) * 0.6;
          const base = wheelRot - (wheelRot % 360);
          wheelRot = base + 360 * (fast ? 2 : 6) + target;
          const img = b.querySelector('#wheel');
          img.style.transition = `transform ${fast ? 0.8 : 3.2}s cubic-bezier(.12,.75,.15,1)`;
          img.style.transform = `rotate(${wheelRot}deg)`;
          let ticks = 0;
          const tk = setInterval(() => { Audio.tick(); if (++ticks > (fast ? 6 : 20)) clearInterval(tk); }, fast ? 110 : 150);
          setTimeout(() => {
            spinning = false;
            say(res.out);
            Audio.reward();
            if (current === st) st.redraw();
          }, fast ? 850 : 3300);
        };
      },
    });
    function freeTxt() {
      const left = profile.d.wheel.nextFree - Date.now();
      return left > 0 ? `Free spin in ${timeLeft(left)}` : 'Free spin ready!';
    }
  }

  // ------------------------------------------------------------------ chests
  function chests() {
    modal({
      title: 'Chests', icon: '🧰', wide: true, tick: (st) => { const el = st.el.querySelector('#ch-free'); if (el) el.textContent = freeLabel(); },
      render(b, st) {
        const row = h('<div class="row" style="align-items:stretch;flex-wrap:wrap"></div>');
        for (const c of CHESTS) {
          const drops = c.drops.map(([id, p]) => `<div class="card" style="padding:3px;cursor:default"><img src="${tankIcon(id, 64)}" style="width:48px;height:48px"><div>${id === 'phantom' ? '???' : TANKS[id].name}</div><div class="price">${p}%</div>${profile.ownsTank(id) ? '<div class="owned">Owned</div>' : ''}</div>`).join('');
          const el = h(`<div class="box col" style="flex:1;min-width:280px">
            <div class="row"><div style="font-size:52px;width:70px;height:70px;border-radius:12px;background:${c.color};display:flex;align-items:center;justify-content:center;border:3px solid #16233f">🧰</div><div class="big">${c.name}</div></div>
            <div class="row" style="flex-wrap:wrap;gap:4px">${drops}</div>
            <button class="btn green stroke">💎 ${fmtFull(c.price)} - Open</button>
            ${c.id === 'frozen' ? '<button class="btn yellow stroke" id="ch-free"></button>' : ''}
            <div class="muted">Duplicates refund 50% of the price.</div></div>`);
          el.querySelector('.btn.green').addEventListener('click', () => openChest(c, false, st));
          const fb = el.querySelector('#ch-free');
          if (fb) { fb.textContent = freeLabel(); fb.addEventListener('click', () => openChest(c, true, st)); }
          row.appendChild(el);
        }
        b.appendChild(row);
      },
    });
    function freeLabel() {
      const left = profile.d.chest.freeAt - Date.now();
      return left > 0 ? `Free in ${timeLeft(left)}` : '🎁 Open FREE';
    }
    function openChest(c, free, st) {
      const res = profile.openChest(c, free);
      if (!res) { Audio.error(); G.hud.toast(free ? 'Free chest not ready yet!' : 'Not enough Gems!', 'red'); return; }
      Audio.reward();
      SDK.happytime();
      const name = TANKS[res.tank].name;
      G.hud.toast(res.dup ? `${name} (duplicate) - refunded ${fmtFull(c.price / 2)} 💎` : `You got ${name}!`, res.dup ? 'blue' : 'gold', 3000);
      G.onOwnedChanged();
      st.redraw();
    }
  }

  // ------------------------------------------------------------------ tank shop
  function tankShop() {
    const items = TANK_LIST.filter((d) => d.unlock.type === 'gems').sort((a, b) => a.unlock.price - b.unlock.price);
    let sel = items.find((d) => !profile.ownsTank(d.id)) || items[0];
    modal({
      title: 'Tank Shop', icon: '🛡️', wide: true,
      render(b, st) {
        const owned = profile.ownsTank(sel.id);
        const wrap = h(`<div class="row" style="align-items:stretch;gap:12px">
          <div class="box col center" style="width:200px;align-items:center"><div class="big">${sel.name}</div><img src="${tankIcon(sel.id, 128)}" style="width:130px">
            <div class="muted">Lv ${sel.level}+ · ${sel.cls}</div>
            <button class="btn ${owned ? 'gray' : 'green'} stroke" id="ts-buy" ${owned ? 'disabled' : ''}>${owned ? '✔ Owned' : `💎 ${fmt(sel.unlock.price)}`}</button>
            <button class="btn yellow stroke" id="ts-index">🔍 Index</button></div>
          <div class="grid" style="flex:1;max-height:360px;overflow:auto"></div></div>`);
        const g = wrap.querySelector('.grid');
        for (const d of items) {
          const c = h(`<div class="card ${d === sel ? 'sel' : ''}"><img src="${tankIcon(d.id, 64)}"><div>${d.name}</div>${profile.ownsTank(d.id) ? '<div class="owned">✔ Owned</div>' : `<div class="price">💎 ${fmt(d.unlock.price)}</div>`}</div>`);
          c.addEventListener('click', () => { sel = d; Audio.click(); st.redraw(); });
          g.appendChild(c);
        }
        wrap.querySelector('#ts-index').onclick = () => index(sel.id);
        wrap.querySelector('#ts-buy').onclick = () => {
          if (profile.ownsTank(sel.id)) return;
          if (!profile.spend(sel.unlock.price)) { Audio.error(); G.hud.toast('Not enough Gems!', 'red'); return; }
          profile.giveTank(sel.id);
          Audio.reward();
          G.hud.toast(`Bought ${sel.name}!`, 'gold');
          G.onOwnedChanged();
          st.redraw();
        };
        b.appendChild(wrap);
      },
    });
  }

  // ------------------------------------------------------------------ skins shop
  function skinShop() {
    modal({
      title: 'Skins Shop', icon: '🎨', wide: true,
      render(b, st) {
        const g = h('<div class="grid"></div>');
        for (const s of SKINS) {
          const owned = profile.ownsSkin(s.id);
          const eq = profile.d.skin === s.id;
          const price = s.price < 0 ? 'Event quest' : `💎 ${fmt(s.price)}`;
          const c = h(`<div class="card ${eq ? 'sel' : ''}"><img src="${skinPreview(s.id, 64)}"><div>${s.name}</div><div class="${owned ? 'owned' : 'price'}">${eq ? 'Equipped' : owned ? 'Equip' : price}</div></div>`);
          c.addEventListener('click', () => {
            if (owned) { profile.equipSkin(s.id); G.onSkinChanged(); Audio.click(); st.redraw(); return; }
            if (s.price < 0) { G.hud.toast('Complete the Event quest to unlock!', 'red'); return; }
            confirm(`Buy <b>${s.name}</b> skin for 💎 ${fmtFull(s.price)}?`, () => {
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
    modal({
      title: 'Upgrades Shop', icon: '⏫', wide: true,
      render(b, st) {
        const d = profile.d;
        const col = h('<div class="col"></div>');
        STATS.forEach((s, i) => {
          const cap = BASE_CAP + d.capUps[i];
          const maxed = cap >= MAX_CAP;
          const price = capPrice(d.capUps[i]);
          const row = h(`<div class="box row between" style="padding:6px 10px"><div class="row"><div class="stroke-s" style="background:${s.color};color:#fff;border:2px solid #16233f;border-radius:8px;padding:3px 8px;width:150px">${s.icon} ${s.name}</div>
            <div>Max: <b>${cap}</b>${maxed ? '' : ` ➜ <b style="color:#22b947">${cap + 1}</b>`}</div></div>
            <button class="btn ${maxed ? 'gray' : 'green'} stroke" style="font-size:16px" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : `💎 ${fmt(price)}`}</button></div>`);
          row.querySelector('button').onclick = () => {
            if (maxed) return;
            if (!profile.spend(price)) { Audio.error(); G.hud.toast('Not enough Gems!', 'red'); return; }
            d.capUps[i]++;
            profile.emit('caps');
            G.hud.toast(`${s.name} cap is now ${cap + 1}!`, 'gold');
            Audio.reward();
            st.redraw();
          };
          col.appendChild(row);
        });
        for (const [key, label, icon] of [['xpBoost', 'XP Boost', '⭐'], ['gemBoost', 'Gem Boost', '💎']]) {
          const lv = d[key];
          const maxed = lv >= 5;
          const price = boostPrice(lv);
          const row = h(`<div class="box row between" style="padding:6px 10px"><div class="row"><div class="stroke-s" style="background:#ffb31a;color:#fff;border:2px solid #16233f;border-radius:8px;padding:3px 8px;width:150px">${icon} ${label}</div>
            <div>+${lv * 10}%${maxed ? '' : ` ➜ <b style="color:#22b947">+${(lv + 1) * 10}%</b>`}</div></div>
            <button class="btn ${maxed ? 'gray' : 'green'} stroke" style="font-size:16px" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : `💎 ${fmt(price)}`}</button></div>`);
          row.querySelector('button').onclick = () => {
            if (maxed) return;
            if (!profile.spend(price)) { Audio.error(); G.hud.toast('Not enough Gems!', 'red'); return; }
            d[key]++;
            profile.emit('boost');
            Audio.reward();
            st.redraw();
          };
          col.appendChild(row);
        }
        b.appendChild(h('<div class="muted center" style="margin-bottom:6px">New stat caps and boosts apply from your next match.</div>'));
        b.appendChild(col);
      },
    });
  }

  // ------------------------------------------------------------------ settings
  function settings() {
    modal({
      title: 'Settings', icon: '⚙️',
      render(b) {
        const s = profile.d.settings;
        const el = h(`<div class="col">
          <label class="row between box"><b>Name</b><input id="st-name" maxlength="16" value="${esc(profile.d.name)}" style="font-family:inherit;font-size:16px;border:2px solid #8cc8ea;border-radius:8px;padding:4px 8px"></label>
          <label class="row between box"><b>Sound</b><input id="st-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}"></label>
          <label class="row between box"><b>Camera sensitivity</b><input id="st-sens" type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}"></label>
          <label class="row between box"><b>Graphics</b><select id="st-q" style="font-family:inherit;font-size:16px"><option value="high">High</option><option value="low">Low (faster)</option></select></label>
          <label class="row between box"><b>Show names</b><input id="st-names" type="checkbox" ${s.names ? 'checked' : ''}></label>
          <div class="box muted">Controls: WASD move · Mouse aim · Click/Space shoot · Right-drag rotate camera · Scroll zoom · Q tank upgrades · E stats (1-8) · F auto fire · R auto spin · C turn 180° · Shift lock camera · Enter chat · X index · G gifts</div>
          <div class="muted center">Mode: ${G.netLabel()}</div></div>`);
        el.querySelector('#st-q').value = s.quality;
        const nm = el.querySelector('#st-name');
        nm.addEventListener('keydown', (e) => e.stopPropagation());
        nm.addEventListener('change', () => { profile.d.name = nm.value.replace(/[^\w .-]/g, '').slice(0, 16); profile.save(); });
        el.querySelector('#st-sfx').addEventListener('input', (e) => { s.sfx = +e.target.value; Audio.setVolume(s.sfx); profile.save(); });
        el.querySelector('#st-sens').addEventListener('input', (e) => { s.sens = +e.target.value; profile.save(); });
        el.querySelector('#st-names').addEventListener('change', (e) => { s.names = e.target.checked; profile.save(); });
        el.querySelector('#st-q').addEventListener('change', (e) => { s.quality = e.target.value; profile.save(); G.hud.toast('Graphics change applies after reload', 'blue'); });
        b.appendChild(el);
      },
    });
  }

  // ------------------------------------------------------------------ player list
  function list() {
    modal({
      title: 'Players', icon: '📜',
      tick: (st) => st.redraw(),
      render(b) {
        const lb = G.arena && G.arena.lastLB;
        if (!lb) { b.appendChild(h('<div class="muted">No data yet.</div>')); return; }
        const rows = lb.list.map((r, i) => `<div class="row between box" style="padding:4px 10px;margin-bottom:4px;${r[5] ? 'border-color:#2fa8ff' : ''}">
          <span>${i + 1}. ${esc(r[0])} ${r[2] ? '<span class="muted">[BOT]</span>' : ''}</span><span>⚔️ ${r[4]} · Lv <b>${r[1]}</b></span></div>`).join('');
        b.appendChild(h(`<div>${rows}<div class="muted center">${G.netLabel()}</div></div>`));
      },
    });
  }

  // ------------------------------------------------------------------ server hop
  function serverHop() {
    modal({
      title: 'Server Hop', icon: '🖥️',
      render(b, st) {
        b.appendChild(h(`<div class="muted center" style="margin-bottom:8px">${G.netLabel()}</div>`));
        const g = h('<div class="col"></div>');
        b.appendChild(g);
        const draw = (rooms) => {
          g.innerHTML = '';
          for (const mid of Object.keys(MODES)) {
            const m = MODES[mid];
            const rs = (rooms || []).filter((r) => r.mode === mid);
            const row = h(`<div class="box row between"><div><div class="big">${m.name}</div><div class="muted">${m.desc}${rs.length ? ` · ${rs.length} server(s)` : ''}</div></div><div class="row" style="flex-wrap:wrap;justify-content:flex-end"></div></div>`);
            const btns = row.querySelector('.row');
            for (const r of rs) {
              const bt = h(`<button class="btn stroke" style="font-size:14px">${r.players}/${r.max} 👥</button>`);
              bt.onclick = () => { close(); G.play(mid, r.id); };
              btns.appendChild(bt);
            }
            const nb = h('<button class="btn green stroke" style="font-size:14px">Join</button>');
            nb.onclick = () => { close(); G.play(mid); };
            btns.appendChild(nb);
            g.appendChild(row);
          }
        };
        draw([]);
        G.fetchRooms().then((r) => { if (current === st) draw(r); });
      },
    });
  }

  // ------------------------------------------------------------------ death / confirm
  function death(info, onRespawn, onLobby) {
    modal({
      title: 'Destroyed', icon: '💀',
      onClose: () => { if (!info.handled) onRespawn(); },
      render(b) {
        const el = h(`<div class="death col">
          <h2 class="stroke" style="color:#ff3b4f">You were destroyed!</h2>
          <div class="big">by ${esc(info.by)}${info.byTank ? ` <span class="muted">(${esc(info.byTank)})</span>` : ''}</div>
          <div class="row center" style="gap:20px;margin:8px 0">
            <div class="box"><div class="muted">XP earned</div><div class="big">⭐ ${fmtFull(info.xp)}</div></div>
            <div class="box"><div class="muted">Kills</div><div class="big">⚔️ ${info.kills}</div></div>
            <div class="box"><div class="muted">Time alive</div><div class="big">⏱️ ${timeLeft(info.time * 1000)}</div></div></div>
          <div class="row center"><button class="btn green stroke" id="d-re">Respawn</button><button class="btn yellow stroke" id="d-lobby">Lobby</button></div></div>`);
        el.querySelector('#d-re').onclick = () => { info.handled = true; close(); onRespawn(); };
        el.querySelector('#d-lobby').onclick = () => { info.handled = true; close(); onLobby(); };
        b.appendChild(el);
      },
    });
  }

  function confirm(html, yes, no) {
    modal({
      title: 'Confirm', icon: '❓',
      render(b) {
        const el = h(`<div class="col center"><div class="big" style="font-size:18px">${html}</div><div class="row center"><button class="btn green stroke">Yes</button><button class="btn red stroke">No</button></div></div>`);
        el.querySelector('.green').onclick = () => { close(); yes(); };
        el.querySelector('.red').onclick = () => { close(); if (no) no(); };
        b.appendChild(el);
      },
    });
  }

  const table = {
    store, gifts, quests, rank, index, bag, wheel, chests, settings, list, upgrades,
    serverhop: serverHop, tanks: tankShop, skins: skinShop, death, confirm,
  };

  return {
    open(name, ...args) { if (table[name]) table[name](...args); },
    close,
    get isOpen() { return !!current; },
    refresh() { if (current && current.redraw && !current.el.querySelector('input:focus')) current.redraw(); },
  };
}
