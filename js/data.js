// Card + keyword definitions. Strip = passive printed on the card's bottom edge;
// it is ACTIVE only while the card is buried under another card in a stack.

const VS = '︎'; // force text glyphs (not emoji) on mobile

export const KW = {
  might:    { name: 'Might',   icon: '⚔' + VS, desc: n => `Fighter +${n} ATK` },
  ward:     { name: 'Ward',    icon: '⛨' + VS, desc: n => `Fighter +${n} max HP` },
  siege:    { name: 'Siege',   icon: '♜' + VS, desc: n => `+${n} damage when hitting the base` },
  charge:   { name: 'Charge',  icon: '➶' + VS, desc: n => `+${n} ATK when attacking` },
  rally:    { name: 'Rally',   icon: '⚑' + VS, desc: n => `Your stacks in adjacent lanes (same row) +${n} ATK` },
  regrowth: { name: 'Regrow',  icon: '✚' + VS, desc: n => `Heal fighter ${n} at start of your turn` },
  thorns:   { name: 'Thorns',  icon: '✷' + VS, desc: n => `Anything that hits this stack takes ${n}` },
  spark:    { name: 'Spark',   icon: '✦' + VS, desc: n => `End of your turn: ${n} dmg to the enemy directly ahead` },
  hex:      { name: 'Hex',     icon: '☾' + VS, desc: n => `Enemy directly ahead has -${n} ATK` },
  drain:    { name: 'Drain',   icon: '♥' + VS, desc: n => `When fighter deals damage, heal your base ${n}` },
};

export const FACTIONS = {
  sun:  { id: 'sun',  name: 'Sunforged',   blurb: 'Knights & beasts of the dawn. Hit hard, push lanes, smash the gate.' },
  moon: { id: 'moon', name: 'Hollow Moon', blurb: 'Witches & spirits of the night. Hex, spark and drain them dry.' },
};

const u = (id, faction, name, cost, atk, hp, strip, extra = {}) =>
  ({ id, faction, type: 'unit', name, cost, atk, hp, strip, art: id, ...extra });
const sp = (id, faction, name, cost, target, effect, text) =>
  ({ id, faction, type: 'spell', name, cost, target, effect, text, art: id, strip: [] });

const LIST = [
  // ---------------- SUNFORGED ----------------
  u('squire',      'sun', 'Squire',          1, 1, 2, [{ k: 'might', n: 1 }]),
  u('shieldbearer','sun', 'Shieldbearer',    2, 1, 4, [{ k: 'ward', n: 2 }]),
  u('lancer',      'sun', 'Lancer',          2, 3, 2, [{ k: 'charge', n: 2 }]),
  u('banner',      'sun', 'Banner Knight',   3, 2, 3, [{ k: 'rally', n: 1 }]),
  u('sunlion',     'sun', 'Sun Lion',        3, 4, 3, [{ k: 'might', n: 2 }]),
  u('ram',         'sun', 'Siege Ram',       3, 2, 4, [{ k: 'siege', n: 3 }]),
  u('griffin',     'sun', 'Griffin Rider',   4, 3, 3, [{ k: 'siege', n: 2 }], { swift: true }),
  u('paladin',     'sun', 'Paladin',         5, 4, 6, [{ k: 'regrowth', n: 2 }]),
  u('champion',    'sun', 'Gilded Champion', 6, 6, 6, [{ k: 'might', n: 3 }]),
  u('colossus',    'sun', 'Solar Colossus',  8, 8, 9, [{ k: 'ward', n: 4 }, { k: 'siege', n: 2 }]),
  sp('smite',      'sun', 'Smite',           2, 'enemy',  'smite',    'Deal 4 to an enemy fighter.'),
  sp('blessing',   'sun', 'Dawn Blessing',   3, 'friend', 'blessing', 'Fully heal a friendly fighter. Its stack gets +2 ATK permanently.'),

  // ---------------- HOLLOW MOON ----------------
  u('wisp',        'moon', 'Wisp',           1, 1, 2, [{ k: 'spark', n: 1 }]),
  u('moth',        'moon', 'Grave Moth',     1, 2, 2, [{ k: 'siege', n: 1 }]),
  u('witch',       'moon', 'Hex Witch',      2, 2, 3, [{ k: 'hex', n: 1 }]),
  u('warden',      'moon', 'Bone Warden',    2, 1, 4, [{ k: 'ward', n: 2 }]),
  u('hound',       'moon', 'Moon Hound',     3, 3, 4, [{ k: 'drain', n: 1 }]),
  u('shade',       'moon', 'Shade',          3, 3, 3, [{ k: 'might', n: 1 }], { swift: true }),
  u('raven',       'moon', 'Raven Oracle',   3, 2, 3, [{ k: 'spark', n: 1 }], { onPlay: 'draw1' }),
  u('barrow',      'moon', 'Barrow Knight',  4, 4, 5, [{ k: 'regrowth', n: 1 }, { k: 'ward', n: 1 }]),
  u('banshee',     'moon', 'Mirror Banshee', 4, 3, 5, [{ k: 'thorns', n: 2 }]),
  u('nightmother', 'moon', 'Night Mother',   6, 5, 8, [{ k: 'hex', n: 2 }, { k: 'drain', n: 2 }]),
  sp('moonbolt',   'moon', 'Moonbolt',       2, 'enemy', 'moonbolt', 'Deal 3 to an enemy fighter. If it dies, draw a card.'),
  sp('eclipse',    'moon', 'Eclipse',        4, 'none',  'eclipse',  'Deal 2 to every enemy fighter.'),
];

export const CARDS = Object.fromEntries(LIST.map(c => [c.id, c]));
export const POOL = f => LIST.filter(c => c.faction === f).map(c => c.id);

// Default 10-card decks (pool is 12; you choose 10)
export const DEFAULT_DECKS = {
  sun:  ['squire', 'shieldbearer', 'lancer', 'banner', 'sunlion', 'ram', 'griffin', 'paladin', 'champion', 'smite'],
  moon: ['wisp', 'moth', 'witch', 'warden', 'hound', 'shade', 'raven', 'barrow', 'banshee', 'moonbolt'],
};

export const DECK_SIZE = 10;

export function traitText(c) {
  const t = [];
  if (c.swift) t.push('Swift: advances 2');
  if (c.onPlay === 'draw1') t.push('On play: draw 1');
  return t.join(' · ');
}

export function stripText(strip, long = false) {
  return strip.map(p => long
    ? `${KW[p.k].icon} ${KW[p.k].name} ${p.n} — ${KW[p.k].desc(p.n)}`
    : `${KW[p.k].icon}${KW[p.k].name} ${p.n}`).join(long ? '\n' : ' ');
}
