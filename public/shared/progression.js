// Persistent level curve. Tuned so that Lv 400 needs ~90K XP like the original.
export const MAX_LEVEL = 999;

export function xpForLevel(L) {
  return Math.round(600 + 125 * L + 0.25 * L * L);
}

// Total stat points available for a level (Lv 401 -> 58 like the original).
export function statPointsForLevel(L) {
  return Math.min(L - 1, 27) + Math.floor(Math.max(0, L - 28) / 12);
}

// Adds XP and returns {level, xp, gained} (gained = number of level ups).
export function addXp(level, xp, amount) {
  let gained = 0;
  xp += amount;
  while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    gained++;
  }
  if (level >= MAX_LEVEL) xp = Math.min(xp, xpForLevel(level));
  return { level, xp, gained };
}

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const units = ['K', 'M', 'B', 'T'];
  let u = -1;
  let v = n;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  const s = v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '');
  return s + units[u];
}

export function fmtFull(n) {
  return Math.floor(n).toLocaleString('en-US');
}
