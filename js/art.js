// Procedural card art: faction gradient + sigil + bold silhouette. viewBox 0 0 100 100.
const PAL = {
  sun:  { a: '#ffe7a0', b: '#e0782a', c: '#5a1d07', s: '#2a1005', h: '#fff4cf' },
  moon: { a: '#d6c9ff', b: '#4a3592', c: '#110a2c', s: '#0a0517', h: '#efe9ff' },
};
let UID = 0;

const star = (cx, cy, R, r, n, rot = 0) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (Math.PI * i) / n, d = i % 2 ? r : R;
    pts.push(`${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
};
const mirror = inner => `<g transform="matrix(-1 0 0 1 100 0)">${inner}</g>`;
const hl = (p, d, w = 2, o = 0.45) => `<path d="${d}" fill="none" stroke="${p.h}" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const glow = (p, cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.h}"/>`;
const shadow = `<ellipse cx="50" cy="95" rx="34" ry="5" opacity=".45"/>`;
const helm = (cx, cy) => `<path d="M${cx - 9} ${cy + 9} L${cx - 9} ${cy - 2} Q${cx} ${cy - 15} ${cx + 9} ${cy - 2} L${cx + 9} ${cy + 9} Z"/>`;
const visor = (p, cx, cy) => hl(p, `M${cx - 6} ${cy + 1} H${cx + 6}`, 2, 0.6);
const body = `<path d="M33 94 L37 48 Q50 40 63 48 L67 94 Z"/>`;

function sigil(card, p) {
  const ticks = [];
  for (let i = 0; i < card.cost; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(card.cost, 1);
    ticks.push(`<circle cx="${(50 + Math.cos(a) * 40).toFixed(1)}" cy="${(46 + Math.sin(a) * 40).toFixed(1)}" r="1.6"/>`);
  }
  if (card.faction === 'sun') {
    const rays = [];
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      rays.push(`M${(50 + Math.cos(a) * 30).toFixed(1)} ${(46 + Math.sin(a) * 30).toFixed(1)} L${(50 + Math.cos(a) * (i % 2 ? 36 : 44)).toFixed(1)} ${(46 + Math.sin(a) * (i % 2 ? 36 : 44)).toFixed(1)}`);
    }
    return `<g fill="${p.h}" stroke="${p.h}" opacity=".32"><circle cx="50" cy="46" r="27" fill="none" stroke-width="1.5"/><path d="${rays.join(' ')}" stroke-width="2"/>${ticks.join('')}</g>`;
  }
  return `<g fill="${p.h}" stroke="${p.h}" opacity=".3"><circle cx="50" cy="46" r="33" fill="none" stroke-width="1" stroke-dasharray="2 3"/><path d="M62 18 A26 26 0 1 0 62 74 A20 20 0 1 1 62 18 Z" stroke="none"/>${star(80, 20, 3, 1.2, 4)}${star(18, 70, 2.5, 1, 4)}${star(84, 66, 2, .8, 4)}${ticks.join('')}</g>`;
}

const SIL = {
  // ---------- SUN ----------
  squire: p => `${shadow}<circle cx="50" cy="31" r="9"/>${body}<circle cx="34" cy="63" r="12"/>
    <path d="M62 60 L82 30 L85 33 L66 62 Z"/><path d="M60 55 L70 63 L68 65 L58 57 Z"/>
    ${hl(p, 'M34 55 V71 M26 63 H42')}`,
  shieldbearer: p => `${shadow}${helm(50, 26)}${visor(p, 50, 26)}<path d="M33 94 L36 40 L64 40 L67 94 Z"/>
    <path d="M26 42 L74 42 L74 70 Q74 90 50 97 Q26 90 26 70 Z"/>${hl(p, 'M50 48 V88 M33 62 H67', 3, 0.35)}`,
  lancer: p => `${shadow}${helm(40, 30)}${visor(p, 40, 30)}<path d="M24 94 L28 50 Q40 42 52 50 L56 94 Z"/>
    <path d="M26 74 L92 10 L95 13 L30 78 Z"/><path d="M86 15 L72 9 L76 24 Z"/>${hl(p, 'M38 60 L48 70')}`,
  banner: p => `${shadow}${helm(42, 28)}${visor(p, 42, 28)}<path d="M26 94 L30 48 Q42 40 54 48 L58 94 Z"/>
    <rect x="66" y="8" width="3.5" height="88"/><path d="M69 10 L96 10 L88 21 L96 32 L69 32 Z"/>${hl(p, 'M78 21 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0')}`,
  sunlion: p => `${star(50, 48, 38, 27, 14)}<circle cx="50" cy="52" r="20"/>
    ${hl(p, 'M40 46 L45 48 M60 46 L55 48', 2.5, 0.75)}${hl(p, 'M46 58 L50 62 L54 58 M50 62 V66 M44 70 Q50 74 56 70', 2, 0.5)}`,
  ram: p => `<circle cx="28" cy="40" r="15"/><circle cx="72" cy="40" r="15"/><path d="M38 34 L62 34 L60 76 Q50 90 40 76 Z"/>
    ${hl(p, 'M28 40 m-9 0 a9 9 0 1 1 9 9 a5 5 0 1 1 -1 -6')}${mirror(hl(p, 'M28 40 m-9 0 a9 9 0 1 1 9 9 a5 5 0 1 1 -1 -6'))}
    ${hl(p, 'M43 50 L47 52 M57 50 L53 52', 2.5, 0.75)}${hl(p, 'M45 76 Q50 80 55 76', 2, 0.5)}`,
  griffin: p => {
    const w = `<path d="M50 58 Q24 20 4 26 Q16 36 10 46 Q24 46 20 58 Q34 56 34 68 Q44 64 50 72 Z"/>`;
    return `${shadow}${w}${mirror(w)}<ellipse cx="50" cy="70" rx="12" ry="20"/><circle cx="50" cy="40" r="11"/>
      <path d="M58 37 L72 44 L58 48 Z"/>${glow(p, 53, 37, 1.8)}${hl(p, 'M18 34 Q30 38 34 50 M82 34 Q70 38 66 50', 1.5, 0.35)}`;
  },
  paladin: p => `${shadow}${hl(p, 'M50 26 m-14 0 a14 6 0 1 0 28 0 a14 6 0 1 0 -28 0', 2.5, 0.7)}${helm(50, 32)}${visor(p, 50, 32)}
    <path d="M26 94 L32 50 Q50 40 68 50 L74 94 Z"/><path d="M48 2 L52 2 L54 44 L46 44 Z"/><rect x="40" y="42" width="20" height="4"/>`,
  champion: p => `${shadow}<path d="M38 20 L42 9 L46 18 L50 5 L54 18 L58 9 L62 20 Z"/>${helm(50, 30)}${visor(p, 50, 30)}
    <path d="M22 56 Q28 40 50 42 Q72 40 78 56 L70 62 L30 62 Z"/><path d="M32 94 L34 58 L66 58 L68 94 Z"/>
    <path d="M78 40 L81 40 L82 92 L77 92 Z"/><rect x="72" y="58" width="15" height="3"/>${hl(p, 'M50 64 L50 86 M42 72 H58', 2, 0.4)}`,
  colossus: p => `${star(50, 28, 24, 15, 12)}<circle cx="50" cy="28" r="14"/>${glow(p, 50, 28, 5)}
    <path d="M16 98 L22 52 Q50 36 78 52 L84 98 Z"/><path d="M14 54 L4 84 L12 86 L24 60 Z"/>${mirror('<path d="M14 54 L4 84 L12 86 L24 60 Z"/>')}
    ${hl(p, 'M50 58 L50 90 M36 66 L64 66 M40 78 L60 78', 2.5, 0.35)}`,
  smite: p => `${hl(p, 'M50 76 L20 96 M50 76 L80 96 M50 76 L50 98 M50 76 L32 98 M50 76 L68 98', 2, 0.6)}
    <path d="M45 2 L55 2 L55 58 L50 74 L45 58 Z"/><rect x="34" y="14" width="32" height="5"/><circle cx="50" cy="8" r="5"/>${glow(p, 50, 76, 3)}`,
  blessing: p => `<path d="M0 72 L100 72 L100 100 L0 100 Z"/><path d="M22 72 A28 28 0 0 1 78 72 Z" fill="${p.h}" opacity=".85"/>
    ${hl(p, 'M50 38 V28 M30 46 L23 39 M70 46 L77 39 M18 62 L8 60 M82 62 L92 60', 2.5, 0.8)}
    <path d="M30 100 Q34 82 44 78 L48 86 Q40 88 38 100 Z"/>${mirror('<path d="M30 100 Q34 82 44 78 L48 86 Q40 88 38 100 Z"/>')}`,

  // ---------- MOON ----------
  wisp: p => `<path d="M50 10 Q68 38 66 58 Q64 82 50 84 Q36 82 34 58 Q32 38 50 10 Z"/>
    <ellipse cx="43" cy="58" rx="3" ry="4.5" fill="${p.h}"/><ellipse cx="57" cy="58" rx="3" ry="4.5" fill="${p.h}"/>
    <circle cx="24" cy="80" r="3"/><circle cx="78" cy="30" r="2.5"/><circle cx="76" cy="86" r="2"/>`,
  moth: p => {
    const w = `<path d="M50 48 Q18 14 6 34 Q8 56 50 58 Z"/><path d="M50 58 Q22 62 24 84 Q40 86 50 64 Z"/>`;
    return `${w}${mirror(w)}<ellipse cx="50" cy="56" rx="5" ry="20"/>${hl(p, 'M48 38 Q42 24 36 20 M52 38 Q58 24 64 20', 1.5, 0.6)}
      <circle cx="26" cy="40" r="5" fill="${p.h}" opacity=".45"/><circle cx="74" cy="40" r="5" fill="${p.h}" opacity=".45"/>`;
  },
  witch: p => `${shadow}<path d="M54 4 L64 34 L78 36 Q50 44 22 36 L36 34 Z"/><path d="M34 38 L66 38 L76 94 L24 94 Z"/>
    <ellipse cx="44" cy="44" rx="2" ry="1.5" fill="${p.h}"/><ellipse cx="56" cy="44" rx="2" ry="1.5" fill="${p.h}"/>
    <path d="M77 30 L80 30 L82 94 L79 94 Z"/>${glow(p, 78, 26, 4.5)}${hl(p, 'M78 26 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', 1, 0.4)}`,
  warden: p => `${shadow}<circle cx="52" cy="28" r="14"/><rect x="45" y="38" width="14" height="8" rx="2"/>
    <circle cx="46" cy="27" r="3.8" fill="${p.a}"/><circle cx="58" cy="27" r="3.8" fill="${p.a}"/>
    <path d="M36 94 L40 50 L64 50 L68 94 Z"/>${hl(p, 'M44 58 H60 M43 66 H61 M44 74 H60', 2, 0.4)}
    <circle cx="30" cy="66" r="16"/>${hl(p, 'M30 66 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', 1.5, 0.4)}`,
  hound: p => `<path d="M80 12 A14 14 0 1 0 92 30 A11 11 0 1 1 80 12 Z" fill="${p.h}" opacity=".8"/>
    <path d="M24 96 L30 62 Q30 46 42 38 L48 16 L56 32 Q64 26 76 16 L72 34 Q70 46 60 52 L68 96 Z"/>
    ${glow(p, 60, 36, 1.8)}${hl(p, 'M34 70 Q40 78 38 92', 1.5, 0.3)}`,
  shade: p => `<path d="M28 94 Q26 60 32 40 Q38 14 50 12 Q62 14 68 40 Q74 60 72 94 L64 84 L57 94 L50 84 L43 94 L36 84 Z"/>
    <path d="M38 34 Q50 24 62 34 L62 46 Q50 52 38 46 Z" fill="${p.c}"/>
    <ellipse cx="45" cy="39" rx="2.5" ry="2" fill="${p.h}"/><ellipse cx="55" cy="39" rx="2.5" ry="2" fill="${p.h}"/>`,
  raven: p => `${hl(p, 'M6 86 Q50 80 96 88', 3, 0.5)}<path d="M26 74 Q26 46 48 40 Q56 28 66 32 L84 34 L70 42 Q74 62 60 74 L76 92 L56 80 L38 82 Z"/>
    ${glow(p, 62, 36, 2)}${hl(p, 'M36 60 Q46 54 56 60', 1.5, 0.35)}<path d="M44 82 L42 88 M52 82 L52 88" stroke="${p.s}" stroke-width="2"/>`,
  barrow: p => {
    const horn = `<path d="M40 22 Q24 18 20 2 Q32 14 44 16 Z"/>`;
    return `${shadow}${horn}${mirror(horn)}${helm(50, 28)}${hl(p, 'M43 28 H48 M52 28 H57', 2.5, 0.75)}
      <path d="M24 94 L30 52 Q50 40 70 52 L76 94 L68 88 L62 94 L56 88 L50 94 L44 88 L38 94 L32 88 Z"/>
      <path d="M78 44 L81 44 L82 90 L77 90 Z"/><rect x="72" y="60" width="15" height="3"/>`;
  },
  banshee: p => `<path d="M50 12 Q68 12 70 34 Q74 62 88 94 L12 94 Q26 62 30 34 Q32 12 50 12 Z"/>
    <ellipse cx="50" cy="34" rx="9" ry="12" fill="${p.c}"/><ellipse cx="46" cy="31" rx="1.8" ry="2.4" fill="${p.h}"/><ellipse cx="54" cy="31" rx="1.8" ry="2.4" fill="${p.h}"/>
    <ellipse cx="50" cy="40" rx="2.5" ry="3.5" fill="${p.s}"/>
    <ellipse cx="20" cy="52" rx="9" ry="13" fill="${p.h}" opacity=".55"/>${hl(p, 'M20 52 m-9 0 a9 13 0 1 0 18 0 a9 13 0 1 0 -18 0', 2, 0.8)}`,
  nightmother: p => `<path d="M40 14 A12 12 0 0 0 60 14 A9 9 0 0 1 40 14 Z" fill="${p.h}" opacity=".9"/><circle cx="50" cy="24" r="8"/>
    <path d="M50 32 Q20 40 2 82 L18 78 L20 96 L80 96 L82 78 L98 82 Q80 40 50 32 Z"/>
    ${glow(p, 47, 24, 1.3)}${glow(p, 53, 24, 1.3)}${hl(p, 'M50 40 V90 M30 58 Q40 50 50 52 Q60 50 70 58', 1.5, 0.35)}`,
  moonbolt: p => `<path d="M70 12 A34 34 0 1 0 70 88 A26 26 0 1 1 70 12 Z" fill="${p.h}" opacity=".55"/>
    <path d="M60 4 L36 50 L50 50 L38 96 L68 40 L53 40 L66 4 Z"/>${hl(p, 'M60 4 L36 50 L50 50 L38 96', 1.5, 0.6)}`,
  eclipse: p => `${star(50, 50, 44, 28, 18)}<circle cx="50" cy="50" r="30" fill="${p.h}" opacity=".9"/><circle cx="50" cy="50" r="27"/>
    ${hl(p, 'M50 50 m-27 0 a27 27 0 1 0 54 0', 1.5, 0.7)}`,
};

export function artSVG(card) {
  const p = PAL[card.faction], g = `g${++UID}`;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    `<defs><radialGradient id="${g}" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${p.a}"/><stop offset=".5" stop-color="${p.b}"/><stop offset="1" stop-color="${p.c}"/></radialGradient></defs>` +
    `<rect width="100" height="100" fill="url(#${g})"/>${sigil(card, p)}<g fill="${p.s}">${(SIL[card.art] || (() => ''))(p)}</g></svg>`;
}
