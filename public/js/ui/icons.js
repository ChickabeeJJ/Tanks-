// Inline SVG icon set (no emojis). Chunky navy outlines like the original's UI.
const O = '#13294b';
const S = `stroke="${O}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

const P = {
  basket: `<path d="M18 26 C18 8 46 8 46 26" fill="none" ${S} stroke-width="5"/><path d="M18 26 C18 8 46 8 46 26" fill="none" stroke="#ff5a5a" stroke-width="2.5"/>
    <path d="M6 24h52l-6 32H12z" fill="#ff3b3b" ${S}/><path d="M6 24h52v7H6z" fill="#ff6b6b" ${S}/>
    <path d="M20 35v15M32 35v15M44 35v15" stroke="#c4161c" stroke-width="3.5" stroke-linecap="round"/>`,
  target: `<circle cx="32" cy="32" r="25" fill="#ff3b4f" ${S}/><circle cx="32" cy="32" r="15" fill="#fff" ${S}/><circle cx="32" cy="32" r="6" fill="#ff3b4f"/>`,
  book: `<path d="M12 10h34a6 6 0 0 1 6 6v38H18a6 6 0 0 1-6-6z" fill="#3aa9ff" ${S}/><path d="M18 46h34v8H18a4 4 0 0 1 0-8z" fill="#e8f6ff" ${S}/>
    <path d="M22 18h22M22 26h16" stroke="#bfe6ff" stroke-width="4" stroke-linecap="round"/>`,
  gear: `<path d="M32 6l5 6 7-3 2 8 8 2-3 7 6 5-6 5 3 7-8 2-2 8-7-3-5 6-5-6-7 3-2-8-8-2 3-7-6-5 6-5-3-7 8-2 2-8 7 3z" fill="#e9eef5" ${S}/><circle cx="32" cy="32" r="8" fill="#8fa3bd" ${S}/>`,
  box: `<path d="M32 8l22 10v26L32 56 10 44V18z" fill="#ff9a2e" ${S}/><path d="M10 18l22 10 22-10M32 28v28" fill="none" ${S}/><path d="M32 8l22 10-22 10-22-10z" fill="#ffc06a" ${S}/>`,
  gift: `<rect x="8" y="26" width="48" height="30" rx="3" fill="#ff4d4d" ${S}/><rect x="5" y="18" width="54" height="12" rx="3" fill="#ff6b6b" ${S}/>
    <path d="M28 18h8v38h-8z" fill="#ffd21f" ${S}/><path d="M32 18c-8-12-20-8-14 0zM32 18c8-12 20-8 14 0z" fill="#ffd21f" ${S}/>`,
  clipboard: `<rect x="12" y="10" width="40" height="48" rx="5" fill="#ffffff" ${S}/><rect x="22" y="5" width="20" height="10" rx="3" fill="#b9c7d8" ${S}/>
    <path d="M20 26h24M20 35h24M20 44h16" stroke="#8fa3bd" stroke-width="4" stroke-linecap="round"/>`,
  shield: `<path d="M32 5l22 8v16c0 14-9 24-22 30C19 53 10 43 10 29V13z" fill="#cfd9e6" ${S}/><path d="M32 13l14 5v11c0 9-6 16-14 20z" fill="#e8eef6"/><path d="M26 28l6 10 8-14" fill="none" stroke="#7f93ad" stroke-width="4" stroke-linecap="round"/>`,
  star: `<path d="M32 4l8.5 17.5L60 24l-14 13.5L49.5 57 32 47.5 14.5 57 18 37.5 4 24l19.5-2.5z" fill="#ffd21f" ${S}/><path d="M32 13l5 10 10 1.5" fill="none" stroke="#fff6b0" stroke-width="3.5" stroke-linecap="round"/>`,
  gem: `<path d="M16 8h32l12 16-28 34L4 24z" fill="#3fd0ff" ${S}/><path d="M4 24h56M24 8l-6 16 14 34 14-34-6-16" fill="none" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M18 24l6-16h16l6 16z" fill="#a8ecff"/>`,
  plus: `<path d="M26 8h12v18h18v12H38v18H26V38H8V26h18z" fill="#ffffff" ${S}/>`,
  lock: `<path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" ${S} stroke-width="5"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#c9d3df" stroke-width="2.5"/>
    <rect x="12" y="28" width="40" height="28" rx="5" fill="#ffc21a" ${S}/><circle cx="32" cy="40" r="4" fill="${O}"/><path d="M32 42v7" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  unlock: `<path d="M20 28v-8a12 12 0 0 1 23-4" fill="none" ${S} stroke-width="5"/><rect x="12" y="28" width="40" height="28" rx="5" fill="#ffc21a" ${S}/><circle cx="32" cy="40" r="4" fill="${O}"/><path d="M32 42v7" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  spin: `<path d="M50 26A19 19 0 0 0 16 20" fill="none" ${S} stroke-width="9"/><path d="M50 26A19 19 0 0 0 16 20" fill="none" stroke="#5be37a" stroke-width="4"/>
    <path d="M14 38a19 19 0 0 0 34 6" fill="none" ${S} stroke-width="9"/><path d="M14 38a19 19 0 0 0 34 6" fill="none" stroke="#5be37a" stroke-width="4"/>
    <path d="M54 12v16H38z" fill="#5be37a" ${S}/><path d="M10 52V36h16z" fill="#5be37a" ${S}/>`,
  burst: `<path d="M32 4l6 14 14-6-6 14 14 6-14 6 6 14-14-6-6 14-6-14-14 6 6-14-14-6 14-6-6-14 14 6z" fill="#ff4d2e" ${S}/><path d="M32 18l4 9 9-3-3 8 8 0-8 4 3 9-9-4-4 8-4-8-9 4 3-9-8-4 8 0-3-8 9 3z" fill="#ffd21f"/>`,
  door: `<rect x="14" y="6" width="36" height="52" rx="3" fill="#ffa24a" ${S}/><rect x="20" y="12" width="24" height="40" rx="2" fill="#c96a1e"/><circle cx="38" cy="33" r="3.5" fill="#ffe08a" stroke="${O}" stroke-width="2"/>`,
  people: `<circle cx="22" cy="22" r="9" fill="#fff" ${S}/><path d="M6 52c0-12 7-18 16-18s16 6 16 18z" fill="#fff" ${S}/><circle cx="43" cy="20" r="8" fill="#d9f7e2" ${S}/><path d="M36 33c10-3 22 2 22 17H40" fill="#d9f7e2" ${S}/>`,
  x: `<path d="M14 14l36 36M50 14L14 50" stroke="${O}" stroke-width="16" stroke-linecap="round"/><path d="M14 14l36 36M50 14L14 50" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  check: `<path d="M10 34l14 14 30-32" fill="none" stroke="${O}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 34l14 14 30-32" fill="none" stroke="#5be37a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  clock: `<circle cx="32" cy="33" r="24" fill="#fff" ${S}/><path d="M32 18v15l10 7" fill="none" ${S}/>`,
  chest: `<path d="M8 28h48v26H8z" fill="#9fe6ff" ${S}/><path d="M8 28c0-14 8-20 24-20s24 6 24 20z" fill="#d6f6ff" ${S}/><rect x="27" y="26" width="10" height="12" rx="2" fill="#6fa7c4" ${S}/>`,
  wheel: `<circle cx="32" cy="32" r="26" fill="#fff" ${S}/><path d="M32 32V6A26 26 0 0 1 54.5 19z" fill="#ff9f1c"/><path d="M32 32l22.5-13A26 26 0 0 1 54.5 45z" fill="#2ec4f1"/><path d="M32 32l22.5 13A26 26 0 0 1 32 58z" fill="#3bd16f"/><path d="M32 32v26A26 26 0 0 1 9.5 45z" fill="#ff3d6e"/><path d="M32 32L9.5 45A26 26 0 0 1 9.5 19z" fill="#b14cf0"/><path d="M32 32L9.5 19A26 26 0 0 1 32 6z" fill="#ffd23f"/><circle cx="32" cy="32" r="26" fill="none" ${S}/><circle cx="32" cy="32" r="6" fill="#fff" ${S}/>`,
  tv: `<rect x="6" y="14" width="52" height="36" rx="5" fill="#3a4a63" ${S}/><path d="M27 24v16l13-8z" fill="#fff"/><path d="M22 4l10 10 10-10" fill="none" ${S}/>`,
  skull: `<path d="M32 6c14 0 24 9 24 22 0 8-4 12-8 14v10H16V42c-4-2-8-6-8-14C8 15 18 6 32 6z" fill="#fff" ${S}/><circle cx="23" cy="30" r="6" fill="${O}"/><circle cx="41" cy="30" r="6" fill="${O}"/><path d="M26 46v6M32 46v6M38 46v6" stroke="${O}" stroke-width="3"/>`,
  sword: `<path d="M44 6h14v14L30 48l-14-14z" fill="#e6eef7" ${S}/><path d="M12 36l16 16-6 4-14-14z" fill="#ffc21a" ${S}/><path d="M6 52l6 6" stroke="${O}" stroke-width="8" stroke-linecap="round"/>`,
  heart: `<path d="M32 56S6 40 6 22A13 13 0 0 1 32 14a13 13 0 0 1 26 8c0 18-26 34-26 34z" fill="#ff3b6b" ${S}/><path d="M16 20a6 6 0 0 1 8-4" fill="none" stroke="#ffb0c4" stroke-width="4" stroke-linecap="round"/>`,
  regen: `<path d="M32 56S6 40 6 22A13 13 0 0 1 32 14a13 13 0 0 1 26 8c0 18-26 34-26 34z" fill="#ff6fc0" ${S}/><path d="M32 24v20M22 34h20" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  bullet: `<path d="M10 22h28c10 0 16 5 16 10s-6 10-16 10H10z" fill="#ffd21f" ${S}/><path d="M10 22h10v20H10z" fill="#d9a40a" ${S}/>`,
  rocket: `<path d="M54 10c-16 0-28 10-34 24l10 10c14-6 24-18 24-34z" fill="#e8f3ff" ${S}/><circle cx="40" cy="24" r="5" fill="#3aa9ff" ${S}/><path d="M20 34l-10 2 6-10h8zM30 44l-2 10 10-6v-8z" fill="#ff5a3a" ${S}/><path d="M18 46l-8 8" stroke="#ff9f1c" stroke-width="6" stroke-linecap="round"/>`,
  reload: `<path d="M50 30A18 18 0 1 1 40 16" fill="none" ${S} stroke-width="10"/><path d="M50 30A18 18 0 1 1 40 16" fill="none" stroke="#fff" stroke-width="4"/><path d="M34 6l16 8-12 12z" fill="#fff" ${S}/>`,
  boot: `<path d="M14 8h18v26l20 8v12H10z" fill="#fff" ${S}/><path d="M10 48h42" stroke="${O}" stroke-width="4"/><path d="M34 14l10-4M34 22l14-4" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  spikes: `<path d="M32 4l6 12 12-6-2 13 13 3-10 9 10 9-13 3 2 13-12-6-6 12-6-12-12 6 2-13-13-3 10-9-10-9 13-3-2-13 12 6z" fill="#e6eef7" ${S}/><circle cx="32" cy="32" r="10" fill="#8fa3bd" ${S}/>`,
  chevrons: `<path d="M8 34l24-18 24 18v12L32 28 8 46z" fill="#ffffff" ${S}/><path d="M8 52l24-18 24 18" fill="none" ${S}/>`,
  play: `<path d="M18 8l38 24-38 24z" fill="#fff" ${S}/>`,
  search: `<circle cx="27" cy="27" r="16" fill="#e8f6ff" ${S} stroke-width="6"/><path d="M39 39l15 15" stroke="${O}" stroke-width="10" stroke-linecap="round"/>`,
  expand: `<path d="M8 8h18L8 26zM56 8v18L38 8zM8 56V38l18 18zM56 56H38l18-18z" fill="#fff" ${S}/><path d="M18 18l28 28M46 18L18 46" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
  chat: `<path d="M8 12h48v30H26l-12 10V42H8z" fill="#fff" ${S}/>`,
  dice: `<rect x="8" y="8" width="48" height="48" rx="10" fill="#fff" ${S}/><circle cx="21" cy="21" r="5" fill="${O}"/><circle cx="43" cy="43" r="5" fill="${O}"/><circle cx="32" cy="32" r="5" fill="${O}"/>`,
  fire: `<path d="M32 4c4 12 18 18 18 34a18 18 0 0 1-36 0c0-10 6-14 8-22 4 6 4 10 8 12 2-8 0-16 2-24z" fill="#ff6a1a" ${S}/><path d="M32 30c2 6 8 8 8 16a8 8 0 0 1-16 0c0-6 6-8 8-16z" fill="#ffd21f"/>`,
  cart: `<path d="M4 10h10l8 32h28l6-22H18" fill="none" ${S}/><circle cx="26" cy="52" r="5" fill="#fff" ${S}/><circle cx="46" cy="52" r="5" fill="#fff" ${S}/>`,
  sun: `<circle cx="32" cy="32" r="12" fill="#ffd21f" ${S}/><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M52 12l-6 6M18 46l-6 6" stroke="${O}" stroke-width="5" stroke-linecap="round"/>`,
  calendar: `<rect x="8" y="12" width="48" height="44" rx="5" fill="#fff" ${S}/><path d="M8 12h48v12H8z" fill="#ff4d5e" ${S}/><path d="M20 6v10M44 6v10" ${S}/>`,
  snow: `<path d="M32 4v56M8 18l48 28M56 18L8 46" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M32 4v56M8 18l48 28M56 18L8 46" stroke="#bfefff" stroke-width="4" stroke-linecap="round"/>`,
  palette: `<path d="M32 6C16 6 6 18 6 32s10 26 24 26c6 0 6-6 2-9-3-3-1-7 4-7h8c10 0 14-6 14-12C58 16 46 6 32 6z" fill="#fff" ${S}/><circle cx="20" cy="26" r="5" fill="#ff3b4f"/><circle cx="32" cy="18" r="5" fill="#ffd21f"/><circle cx="44" cy="24" r="5" fill="#3aa9ff"/>`,
  tank: `<rect x="34" y="24" width="24" height="12" rx="3" fill="#7fd0ff" ${S}/><circle cx="26" cy="32" r="18" fill="#ff3b4f" ${S}/>`,
  upArrows: `<path d="M8 30L32 8l24 22H42v10H22V30z" fill="#ff8a1c" ${S}/><path d="M18 48l14-12 14 12z" fill="#ff8a1c" ${S}/>`,
};

export function ic(name, size = 24, extra = '') {
  const body = P[name] || P.star;
  return `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}

export const STAT_ICONS = ['sword', 'bullet', 'rocket', 'reload', 'heart', 'regen', 'boot', 'spikes'];
