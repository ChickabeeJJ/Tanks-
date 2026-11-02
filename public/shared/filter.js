// Very small chat / name filter (CrazyGames audiences are young — keep it clean).
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'retard', 'whore', 'slut', 'dick', 'pussy', 'rape', 'nazi', 'porn', 'sex', 'kys'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function normal(s) {
  return s.toLowerCase().replace(/[013457@$]/g, (c) => LEET[c]).replace(/[^a-z]/g, '');
}

export function isBad(s) {
  const n = normal(s);
  return BAD.some((w) => n.includes(w));
}

export function cleanChat(s) {
  if (typeof s !== 'string') return '';
  s = s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);
  if (!s) return '';
  // strip links
  s = s.replace(/https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|gg|io|xyz)\S*/gi, '***');
  return s.split(/(\s+)/).map((w) => (isBad(w) ? '#'.repeat(w.length) : w)).join('');
}

export function cleanName(s) {
  if (typeof s !== 'string') return 'Player';
  s = s.replace(/[^\w .-]/g, '').trim().slice(0, 16);
  if (!s || isBad(s)) return 'Player' + Math.floor(Math.random() * 9999);
  return s;
}
