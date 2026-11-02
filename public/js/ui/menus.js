// All popup windows: Store, Gifts, Quests, Rank, Index, Bag, Wheel, Chests, Shops, Settings...
import { profile, QUESTS, GIFTS, WHEEL, CHESTS, STORE_GEMS, RANK_TASKS, RANK_TIERS, RANK_COLORS, rankTier, rankNeed, MAX_RANK, capPrice, boostPrice, dayId } from '../profile.js';
import { TANK_LIST, TANKS, childrenOf, pathTo } from '../../shared/tanks.js';
import { SKINS, SKIN_MAP, RARITY } from '../../shared/skins.js';
import { STATS, BASE_CAP, MAX_CAP, MODES } from '../../shared/config.js';
import { fmt, fmtFull } from '../../shared/progression.js';
import { skinPreview } from '../render/textures.js';
import { tankIcon } from '../render/thumbs.js';
import { ic } from './icons.js';
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
    el.querySelector('.mclose').addEventListener('click', () => { Audio.click(); close(); });
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
  function store(tab) {
    modal({
      title: 'Store', icon: 'basket', tabs: [{ id: 'pack', label: 'Pack', icon: 'gift' }, { id: 'gems', label: 'Gems', icon: 'gem' }], tab: tab || 'pack',
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
              <button class="btn yellow stroke" ${claimed ? 'disabled' : ''}>${claimed ? 'Come back tomorrow' : 'Claim FREE'}</button>
            </div>
            <div class="muted center">Free daily pack. Come back every day!</div></div>`));
          b.querySelector('button').addEventListener('click', async () => {
            if (d.store.starterDay === dayId()) return;
            {
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
            const row = h(`<div class="box row between"><div class="row">${ic('gem', 40)}<div><div class="big">${p.name}</div><div class="muted">+${fmtFull(p.gems)} Gems</div></div></div>
              <button class="btn green stroke" ${left > 0 ? 'disabled' : ''}>${left > 0 ? timeLeft(left) : 'Claim FREE'}</button></div>`);
            row.querySelector('button').addEventListener('click', async () => {
              if (d.store.gemsAt[i] > Date.now()) return;
              {
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

  // ------------------------------------------------------------------ gifts (4x3 grid like the original)
  function gifts() {
    modal({
      title: 'Gifts', icon: 'gift', tick: (st) => st.redraw(),
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
            const out = profile.claimGift(i);
            if (out) { say(out); Audio.reward(); } else if (!claimed) { Audio.error(); G.hud.toast('Keep playing to unlock!', 'red'); }
          });
          g.appendChild(c);
        });
        b.appendChild(g);
      },
    });
  }

  // ------------------------------------------------------------------ quests
  function quests(tab) {
    modal({
      title: 'Quests', icon: 'clipboard',
      tabs: [{ id: 'daily', label: 'Daily', icon: 'sun' }, { id: 'weekly', label: 'Weekly', icon: 'calendar' }, { id: 'unique', label: 'Unique', icon: 'star' }, { id: 'event', label: 'Event', icon: 'snow' }],
      tab,
      render(b, st) {
        const cat = st.tab;
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
  function rank() {
    modal({
      title: 'Rank', icon: 'shield',
      render(b, st) {
        const r = profile.d.rank;
        const need = rankNeed(r.idx);
        const tier = rankTier(r.idx);
        const col = RANK_COLORS[RANK_TIERS.indexOf(tier)];
        const nextTier = rankTier(Math.min(MAX_RANK, r.idx + 1));
        const top = h(`<div class="col">
          <div class="center big" style="color:${col};-webkit-text-stroke:1px #16233f">${tier}</div>
          <div class="row center" style="gap:24px">
            <div class="center"><div class="big">Rank ${r.idx}</div>${ic('shield', 64)}</div>
            <div style="font-size:60px;color:#f23545;font-weight:800;-webkit-text-stroke:3px #0f2a4d">&rarr;</div>
            <div class="center"><div class="big">${r.idx >= MAX_RANK ? 'MAX' : 'Rank ' + (r.idx + 1)}</div><div style="filter:hue-rotate(${(RANK_TIERS.indexOf(nextTier)) * 50}deg)">${ic('shield', 64)}</div></div>
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
              close();
              wheel();
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
        holder.append(lvLayer, infoBox, ex);
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
      const [u0, v0] = pt(R * 0.62, a0), [u1, v1] = pt(R * 0.62, a1);
      segs += `<path d="M${C} ${C}L${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}Z" fill="${sg.color}"/>`;
      segs += `<path d="M${u0} ${v0}A${R * 0.62} ${R * 0.62} 0 0 1 ${u1} ${v1}L${x1} ${y1}A${R} ${R} 0 0 0 ${x0} ${y0}Z" fill="${shade(sg.color, 1.12)}"/>`;
      segs += `<path d="M${C} ${C}L${x0} ${y0}" stroke="${shade(sg.color, 0.55)}" stroke-width="3"/>`;
      const mid = a0 + step / 2;
      const [ix, iy] = pt(R * 0.74, mid);
      const icon = sg.tank
        ? `<image href="${tankIcon(sg.tank)}" x="${ix - 26}" y="${iy - 26}" width="52" height="52" transform="rotate(${mid} ${ix} ${iy})"/>`
        : `<g transform="rotate(${mid} ${ix} ${iy})">${ic(sg.gems ? 'gem' : 'star', 40).replace('<svg ', `<svg x="${ix - 20}" y="${iy - 20}" `)}</g>`;
      const [tx, ty] = pt(R * 0.43, mid);
      deco += icon + `<text x="${tx}" y="${ty}" transform="rotate(${mid} ${tx} ${ty})" text-anchor="middle" dominant-baseline="middle"
        font-family="Fredoka, sans-serif" font-weight="700" font-size="${sg.tank ? 15 : 18}" fill="#fff" stroke="${shade(sg.color, 0.45)}" stroke-width="4" paint-order="stroke">${sg.tank ? '' : '+'}${segValue(sg)}</text>`;
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
    // original chest illustration, tinted per chest
    const dk = c.dark, lt = c.color;
    return `<svg class="chest-art" width="${size}" height="${size}" viewBox="0 0 160 160">
      <defs><linearGradient id="cb-${c.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset="1" stop-color="${dk}"/></linearGradient></defs>
      <ellipse cx="80" cy="142" rx="58" ry="9" fill="rgba(0,0,0,.18)"/>
      <g class="lid"><path d="M22 70c0-30 22-44 58-44s58 14 58 44z" fill="url(#cb-${c.id})" stroke="${dk}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M70 27h20v43H70z" fill="#ffd21f" stroke="#a35f00" stroke-width="4"/></g>
      <rect x="22" y="70" width="116" height="66" rx="8" fill="url(#cb-${c.id})" stroke="${dk}" stroke-width="5"/>
      <path d="M70 70h20v66H70z" fill="#ffd21f" stroke="#a35f00" stroke-width="4"/>
      <rect x="66" y="78" width="28" height="30" rx="6" fill="#fff3b0" stroke="#a35f00" stroke-width="4"/>
      <circle cx="80" cy="90" r="5" fill="#a35f00"/><path d="M80 92v9" stroke="#a35f00" stroke-width="4" stroke-linecap="round"/>
      <path d="M32 80h30M32 92h22" stroke="rgba(255,255,255,.45)" stroke-width="5" stroke-linecap="round"/>
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
      const body = st.body;
      body.innerHTML = '';
      const stage = h(`<div class="cs-stage" style="--cc:${c.color};--cd:${c.dark}">
        <div class="cs-spot"></div>
        <div class="cs-chest">${chestArt(c, 190)}</div>
        <div class="cs-flash"></div>
        <div class="reel hidden"><div class="reel-strip"></div><div class="reel-mark"></div><div class="reel-fade l"></div><div class="reel-fade r"></div></div>
        <div class="cs-reveal hidden"></div>
      </div>`);
      body.appendChild(stage);
      const chestEl = stage.querySelector('.cs-chest');
      // 1) shake + rumble ticks
      chestEl.classList.add('shake');
      let n = 0;
      const rumble = setInterval(() => { Audio.tick(); if (++n > 8) clearInterval(rumble); }, 95);
      setTimeout(() => {
        // 2) burst open
        chestEl.classList.remove('shake');
        chestEl.classList.add('open');
        stage.querySelector('.cs-flash').classList.add('go');
        Audio.boom();
        setTimeout(() => spinReel(stage, c, res, st), 450);
      }, 950);
    }

    function spinReel(stage, c, res, st) {
      stage.querySelector('.cs-chest').classList.add('gone');
      const reel = stage.querySelector('.reel');
      const strip = stage.querySelector('.reel-strip');
      reel.classList.remove('hidden');
      // weighted filler items, winner placed near the end
      const roll = () => { let r = Math.random() * 100; for (const [id, p] of c.drops) { r -= p; if (r <= 0) return id; } return c.drops[0][0]; };
      const N = 60, WIN = 52;
      const items = Array.from({ length: N }, (_, i) => (i === WIN ? res.skin : roll()));
      // tease: put a rare-looking item right after the winner
      items[WIN + 1] = c.drops[c.drops.length - 1][0];
      strip.innerHTML = items.map((id, i) => skinCard(id, i === WIN ? 'win' : '')).join('');
      const ITEM = 128; // card width + gap (matches CSS)
      const view = reel.clientWidth;
      const jitter = (Math.random() - 0.5) * (ITEM - 30);
      const target = WIN * ITEM + ITEM / 2 - view / 2 + jitter;
      strip.style.transform = 'translateX(0px)';
      void strip.offsetWidth;
      const dur = 5600;
      strip.style.transition = `transform ${dur}ms cubic-bezier(0.06, 0.82, 0.12, 1)`;
      strip.style.transform = `translateX(${-target}px)`;
      // tick each time a card passes the marker
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
        setTimeout(() => reveal(stage, c, res, st), 700);
      }, dur + 150);
    }

    function reveal(stage, c, res, st) {
      const sk = SKIN_MAP[res.skin];
      const R = rar(res.skin);
      const big = sk.rarity === 'legendary' || sk.rarity === 'mythic';
      stage.querySelector('.reel').classList.add('dim');
      const rv = stage.querySelector('.cs-reveal');
      rv.style.setProperty('--rc', R.color);
      rv.style.setProperty('--rd', R.dark);
      rv.innerHTML = `<div class="rv-rays"></div>
        <div class="rv-rarity lbl" style="--o:${R.dark}">${R.name}</div>
        <div class="rv-skin"><img src="${skinPreview(res.skin, 160)}" alt=""></div>
        <div class="rv-name lbl" style="--o:${R.dark}">${sk.name}</div>
        <div class="rv-msg lbl ${res.dup ? 'dup' : 'new'}">${res.dup ? `Duplicate! +${fmtFull(res.refund)} Gems` : 'NEW SKIN!'}</div>
        <div class="row center rv-btns">
          ${res.dup ? '' : '<button class="btn green" data-a="equip">Equip</button>'}
          <button class="btn" data-a="again">${ic('chest', 22)} Open Again</button>
          <button class="btn gray" data-a="back">Back</button>
        </div>`;
      rv.classList.remove('hidden');
      if (big) { Audio.level(); confetti(stage, 90); SDK.happytime(); } else { Audio.reward(); confetti(stage, 30); }
      G.onSkinChanged && profile.d.skin;
      rv.querySelector('[data-a="back"]').onclick = () => { st.busy = false; st.redraw(); };
      rv.querySelector('[data-a="again"]').onclick = () => { st.busy = false; st.redraw(); start(c, false, st); };
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

  // ------------------------------------------------------------------ tank shop
  function tankShop() {
    const items = TANK_LIST.filter((d) => d.unlock.type === 'gems').sort((a, b) => a.unlock.price - b.unlock.price);
    let sel = items.find((d) => !profile.ownsTank(d.id)) || items[0];
    modal({
      title: 'Tank Shop', icon: 'shield', wide: true,
      render(b, st) {
        const owned = profile.ownsTank(sel.id);
        const wrap = h(`<div class="row" style="align-items:stretch;gap:12px">
          <div class="box col center" style="width:200px;align-items:center"><div class="big">${sel.name}</div><img src="${tankIcon(sel.id, 128)}" style="width:130px">
            <div class="muted">Lv ${sel.level}+ · ${sel.cls}</div>
            <button class="btn ${owned ? 'gray' : 'green'} stroke" id="ts-buy" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : `${ic('gem', 20)} ${fmt(sel.unlock.price)}`}</button>
            <button class="btn yellow stroke" id="ts-index">${ic('search', 20)} Index</button></div>
          <div class="grid" style="flex:1;max-height:360px;overflow:auto"></div></div>`);
        const g = wrap.querySelector('.grid');
        for (const d of items) {
          const c = h(`<div class="card ${d === sel ? 'sel' : ''}"><img src="${tankIcon(d.id, 64)}"><div>${d.name}</div>${profile.ownsTank(d.id) ? '<div class="owned">Owned</div>' : `<div class="price">${ic('gem', 20)} ${fmt(d.unlock.price)}</div>`}</div>`);
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
            <div>Max: <b>${cap}</b>${maxed ? '' : ` &rarr; <b style="color:#22b947">${cap + 1}</b>`}</div></div>
            <button class="btn ${maxed ? 'gray' : 'green'} stroke" style="font-size:16px" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : `${ic('gem', 20)} ${fmt(price)}`}</button></div>`);
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
        for (const [key, label, icon] of [['xpBoost', 'XP Boost', 'star'], ['gemBoost', 'Gem Boost', 'gem']]) {
          const lv = d[key];
          const maxed = lv >= 5;
          const price = boostPrice(lv);
          const row = h(`<div class="box row between" style="padding:6px 10px"><div class="row"><div class="stroke-s" style="background:#ffb31a;color:#fff;border:2px solid #16233f;border-radius:8px;padding:3px 8px;width:150px">${ic(icon, 20)} ${label}</div>
            <div>+${lv * 10}%${maxed ? '' : ` &rarr; <b style="color:#22b947">+${(lv + 1) * 10}%</b>`}</div></div>
            <button class="btn ${maxed ? 'gray' : 'green'} stroke" style="font-size:16px" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : `${ic('gem', 20)} ${fmt(price)}`}</button></div>`);
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
      title: 'Settings', icon: 'gear',
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
      title: 'Players', icon: 'target',
      tick: (st) => st.redraw(),
      render(b) {
        const lb = G.arena && G.arena.lastLB;
        if (!lb) { b.appendChild(h('<div class="muted">No data yet.</div>')); return; }
        const rows = lb.list.map((r, i) => `<div class="row between box" style="padding:4px 10px;margin-bottom:4px;${r[5] ? 'border-color:#2fa8ff' : ''}">
          <span>${i + 1}. ${esc(r[0])} ${r[2] ? '<span class="muted">[BOT]</span>' : ''}</span><span>${ic('sword', 20)} ${r[4]} · Lv <b>${r[1]}</b></span></div>`).join('');
        b.appendChild(h(`<div>${rows}<div class="muted center">${G.netLabel()}</div></div>`));
      },
    });
  }

  // ------------------------------------------------------------------ death / confirm
  function death(info, onRespawn, onLobby) {
    modal({
      title: 'Destroyed', icon: 'skull',
      onClose: () => { if (!info.handled) onRespawn(); },
      render(b) {
        const el = h(`<div class="death col">
          <h2 class="stroke" style="color:#ff3b4f">You were destroyed!</h2>
          <div class="big">by ${esc(info.by)}${info.byTank ? ` <span class="muted">(${esc(info.byTank)})</span>` : ''}</div>
          <div class="row center" style="gap:20px;margin:8px 0">
            <div class="box"><div class="muted">XP earned</div><div class="big">${ic('star', 20)} ${fmtFull(info.xp)}</div></div>
            <div class="box"><div class="muted">Kills</div><div class="big">${ic('sword', 20)} ${info.kills}</div></div>
            <div class="box"><div class="muted">Time alive</div><div class="big">${ic('clock', 20)} ${timeLeft(info.time * 1000)}</div></div></div>
          <div class="row center"><button class="btn green stroke" id="d-re">Respawn</button><button class="btn yellow stroke" id="d-lobby">Lobby</button></div></div>`);
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

  const table = {
    store, gifts, quests, rank, index, bag, wheel, chests, settings, list, upgrades,
    tanks: tankShop, skins: skinShop, death, confirm,
  };

  return {
    open(name, ...args) { if (table[name]) table[name](...args); },
    close,
    get isOpen() { return !!current; },
    refresh() { if (current && current.redraw && !current.busy && !current.el.querySelector('input:focus')) current.redraw(); },
  };
}
