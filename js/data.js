// Stack Attack — duel version. Cards have a tag (school), rarity, summon cost, HP,
// a Basic and a Special attack, and a STRIP: a passive that is active only while the card
// is BURIED under another card. Most strips are conditional (on the fighter's tag, or on
// having two actives) — that's where the synergy lives.

export const TAGS = {
  wild:   { name: 'Wild',   color: '#5fcf6a', reso: 'Resonance: +2 ATK on all attacks' },
  stone:  { name: 'Stone',  color: '#d9a25b', reso: 'Resonance: +6 max HP' },
  arcane: { name: 'Arcane', color: '#5ab4ff', reso: 'Resonance: Specials cost 1 less' },
  shadow: { name: 'Shadow', color: '#b08cff', reso: 'Resonance: attacks apply +2 Burn' },
};
export const RESONANCE = {
  wild: { atk: 2 }, stone: { hp: 6 }, arcane: { specialDown: 1 }, shadow: { burnAdd: 2 },
};
export const RARITY = {
  C: { name: 'Common', color: '#9a93a6' },
  U: { name: 'Uncommon', color: '#5fcf6a' },
  R: { name: 'Rare', color: '#4da3ff' },
  E: { name: 'Epic', color: '#c86bff' },
};

// attack: name, mana, dmg, fx   fx: {splash, both, burn, heal, shield, draw, pierce}
const A = (name, cost, dmg, fx = {}) => ({ name, cost, dmg, fx });
// strip: { if: 'always' | <tag> | 'pair', mods: {atk,hp,specialDown,basicDown,guard,ranged,thorns,regen,drain,burnAdd} }
const S = (cond, mods) => ({ if: cond, mods });
const card = (id, tag, rarity, name, cost, hp, basic, special, strip, kw = {}) =>
  ({ id, tag, rarity, name, cost, hp, basic, special, strip, kw, art: id });

const LIST = [
  // ---------------- WILD ----------------
  card('fox',     'wild', 'C', 'Fox Kit',         1, 5,  A('Nip', 0, 1),  A('Pounce', 1, 3),              S('wild', { atk: 1 })),
  card('boar',    'wild', 'C', 'Thornback Boar',  2, 8,  A('Gore', 1, 2), A('Trample', 2, 4, { splash: 1 }), S('always', { hp: 2 })),
  card('hound',   'wild', 'U', 'Moon Hound',      2, 7,  A('Bite', 0, 2), A('Maul', 2, 5),                S('wild', { atk: 2 })),
  card('lion',    'wild', 'U', 'Sun Lion',        3, 9,  A('Claw', 1, 3), A('Roar', 3, 6),                S('wild', { specialDown: 1 })),
  card('archer',  'wild', 'R', 'Elf Archer',      2, 6,  A('Quick Shot', 0, 2), A('Volley', 2, 3, { both: true }), S('always', { ranged: true }), { ranged: true }),
  card('griffin', 'wild', 'R', 'Griffin',         3, 9,  A('Swoop', 1, 3, { pierce: true }), A('Skyfall', 3, 6, { pierce: true }), S('pair', { atk: 2 })),

  // ---------------- STONE ----------------
  card('golem',    'stone', 'C', 'Pebble Golem',    1, 7,  A('Thump', 0, 1),  A('Brace', 1, 0, { shield: 4 }), S('always', { hp: 2 })),
  card('troll',    'stone', 'C', 'Cave Troll',      2, 10, A('Club', 1, 2),   A('Smash', 2, 4),               S('stone', { hp: 3 }), { guard: true }),
  card('shield',   'stone', 'U', 'Shieldbearer',    2, 9,  A('Bash', 0, 1),   A('Bulwark', 1, 1, { shield: 5 }), S('always', { guard: true }), { guard: true }),
  card('sentinel', 'stone', 'U', 'Stone Sentinel',  3, 11, A('Slam', 1, 3),   A('Quake', 3, 3, { both: true }), S('stone', { thorns: 2 })),
  card('chief',    'stone', 'R', 'Troll Chieftain', 3, 13, A('Crush', 2, 4),  A('Regenerate', 1, 0, { heal: 6 }), S('always', { regen: 2 }), { guard: true }),
  card('colossus', 'stone', 'E', 'Colossus',        5, 16, A('Stomp', 2, 5),  A('Earthshaker', 4, 8, { splash: 3 }), S('stone', { hp: 4, atk: 2 }), { guard: true }),

  // ---------------- ARCANE ----------------
  card('wisp',      'arcane', 'C', 'Wisp',          1, 4,  A('Flicker', 0, 1), A('Arc', 1, 3),               S('arcane', { atk: 1 })),
  card('apprentice','arcane', 'C', 'Apprentice',    1, 5,  A('Zap', 0, 1),     A('Firebolt', 2, 4, { burn: 1 }), S('always', { atk: 1 })),
  card('raven',     'arcane', 'U', 'Raven Oracle',  2, 6,  A('Peck', 0, 1),    A('Foresight', 1, 0, { draw: 2 }), S('arcane', { specialDown: 1 })),
  card('battlemage','arcane', 'U', 'Battlemage',    3, 9,  A('Staff', 1, 3),   A('Arcane Blast', 3, 6),       S('arcane', { atk: 2 })),
  card('stormwitch','arcane', 'R', 'Storm Witch',   2, 6,  A('Free Bolt', 0, 3), A('Chain Lightning', 3, 4, { both: true }), S('always', { basicDown: 1 })),
  card('archmage',  'arcane', 'E', 'Archmage',      4, 11, A('Missile', 0, 3, { pierce: true }), A('Meteor', 5, 9, { splash: 3 }), S('always', { specialDown: 1, atk: 1 }), { ranged: true }),

  // ---------------- SHADOW ----------------
  card('moth',     'shadow', 'C', 'Grave Moth',     1, 4,  A('Flutter', 0, 1, { burn: 1 }), A('Dust', 1, 2, { burn: 2 }), S('shadow', { atk: 1 })),
  card('shade',    'shadow', 'C', 'Shade',          2, 6,  A('Chill', 0, 2),   A('Haunt', 2, 4, { pierce: true }), S('always', { drain: 1 })),
  card('barrow',   'shadow', 'U', 'Barrow Knight',  3, 10, A('Cleave', 1, 3),  A('Grave Strike', 3, 6),           S('shadow', { atk: 2 })),
  card('banshee',  'shadow', 'U', 'Banshee',        2, 7,  A('Wail', 1, 1, { both: true }), A('Shriek', 2, 2, { burn: 3 }), S('always', { thorns: 2 })),
  card('lich',     'shadow', 'R', 'Eclipse Lich',   3, 9,  A('Siphon', 0, 2, { heal: 2 }), A('Soul Rend', 3, 5, { heal: 5 }), S('shadow', { drain: 2 })),
  card('nightmother','shadow','E','Night Mother',   4, 12, A('Curse', 1, 3, { burn: 2 }), A('Nightfall', 4, 4, { both: true, burn: 2 }), S('always', { burnAdd: 1 })),
];

export const CARDS = Object.fromEntries(LIST.map(c => [c.id, c]));
export const ALL_IDS = LIST.map(c => c.id);
export const DECK_SIZE = 12;

export const STARTERS = {
  'Troll & Archer': { desc: 'Stone tanks with Guard hold the line while Wild shooters pick targets.',
    cards: ['fox', 'hound', 'archer', 'griffin', 'boar', 'golem', 'troll', 'shield', 'chief', 'sentinel', 'lion', 'colossus'] },
  'Hexfire': { desc: 'Arcane casters and Shadow burn. Fragile, cheap specials, lots of damage over time.',
    cards: ['wisp', 'apprentice', 'raven', 'battlemage', 'stormwitch', 'archmage', 'moth', 'shade', 'banshee', 'lich', 'nightmother', 'barrow'] },
};

// ---------- text helpers ----------
const MODTXT = {
  atk: n => `+${n} ATK`, hp: n => `+${n} HP`, specialDown: n => `Special -${n}◆`, basicDown: n => `Basic -${n}◆`,
  guard: () => 'Guard', ranged: () => 'Ranged', thorns: n => `Thorns ${n}`, regen: n => `Regen ${n}`,
  drain: n => `Drain ${n}`, burnAdd: n => `+${n} Burn`,
};
export const modsText = m => Object.entries(m).map(([k, v]) => MODTXT[k](v)).join(', ');
export const condText = c => (c === 'always' ? '' : c === 'pair' ? 'If 2 actives: ' : `If ${TAGS[c].name}: `);
export const stripText = s => condText(s.if) + modsText(s.mods);

export function fxText(fx) {
  const t = [];
  if (fx.both) t.push('hits both actives');
  if (fx.splash) t.push(`${fx.splash} to other active`);
  if (fx.burn) t.push(`Burn ${fx.burn}`);
  if (fx.heal) t.push(`heal ${fx.heal}`);
  if (fx.shield) t.push(`Shield ${fx.shield}`);
  if (fx.draw) t.push(`draw ${fx.draw}`);
  if (fx.pierce) t.push('ignores Guard');
  return t.join(', ');
}

export const KW_HELP = {
  Guard: 'Enemies must target a Guard active (unless Ranged or the attack ignores Guard).',
  Ranged: "This fighter's attacks ignore Guard.",
  Burn: 'At the start of its turn, the stack takes Burn damage, then Burn drops by 1.',
  Shield: 'Absorbs damage before HP. Lasts until used.',
  Thorns: 'Attackers that damage this stack take that much back.',
  Regen: 'Heals at the start of your turn.',
  Drain: 'Fighter heals this much whenever it deals damage.',
  Resonance: '3-high stack, all one tag → bonus: Wild +2 ATK · Stone +6 HP · Arcane Specials -1◆ · Shadow +2 Burn.',
};
