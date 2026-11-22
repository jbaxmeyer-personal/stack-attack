// Pure rules engine for the duel (no DOM).
// Each side: 2 active slots (2nd must be opened), 3 bench slots. Stacks up to 3 cards.
// Top card = fighter (its attacks + HP). Buried cards = strips (passives) if their condition holds.
// KO a stack → you gain shards equal to its height. First to WIN_SHARDS wins.
import { CARDS, RESONANCE } from './data.js';

export const WIN_SHARDS = 5, MAX_STACK = 3, HAND_SIZE = 4, HAND_MAX = 6, START_HAND = 5;
export const MAX_MANA = 8, OPEN_COST = 2, RETREAT_COST = 1;
export const other = o => (o === 'p' ? 'e' : 'p');

let rng = Math.random;
export const setRng = f => { rng = f; };
let SID = 1;
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- access ----------
export const zoneArr = (s, o, z) => (z === 'a' ? s.players[o].active : s.players[o].bench);
export const get = (s, o, pos) => zoneArr(s, o, pos.zone)[pos.i];
export function stacks(s, o) {
  const out = [];
  s.players[o].active.forEach((st, i) => st && out.push({ pos: { zone: 'a', i }, st }));
  s.players[o].bench.forEach((st, i) => st && out.push({ pos: { zone: 'b', i }, st }));
  return out;
}
export function posOf(s, st) {
  for (const z of ['a', 'b']) { const i = zoneArr(s, st.owner, z).indexOf(st); if (i >= 0) return { zone: z, i }; }
  return null;
}
export const topCard = st => CARDS[st.cards[st.cards.length - 1]];
export const buried = st => st.cards.slice(0, -1).map(id => CARDS[id]);
export const actives = (s, o) => s.players[o].active.filter(Boolean);

// ---------- strips / mods ----------
export function condMet(s, st, cond) {
  if (cond === 'always') return true;
  if (cond === 'pair') return s.players[st.owner].active.every(Boolean);
  return topCard(st).tag === cond;
}
export function resonant(st) {
  return st.cards.length === MAX_STACK && st.cards.every(id => CARDS[id].tag === CARDS[st.cards[0]].tag);
}
export function mods(s, st) {
  const top = topCard(st);
  const m = { atk: 0, hp: 0, specialDown: 0, basicDown: 0, guard: !!top.kw.guard, ranged: !!top.kw.ranged,
    thorns: 0, regen: 0, drain: 0, burnAdd: 0 };
  const add = mm => { for (const [k, v] of Object.entries(mm)) { if (typeof v === 'boolean') m[k] = m[k] || v; else m[k] += v; } };
  for (const c of buried(st)) if (condMet(s, st, c.strip.if)) add(c.strip.mods);
  if (resonant(st)) add(RESONANCE[top.tag]);
  return m;
}
export const maxHp = (s, st) => topCard(st).hp + mods(s, st).hp;
export const hp = (s, st) => maxHp(s, st) - st.dmg;
export function atkCost(s, st, which) {
  const m = mods(s, st), a = topCard(st)[which];
  return Math.max(0, a.cost - (which === 'special' ? m.specialDown : m.basicDown));
}
export function atkDmg(s, st, which) {
  const a = topCard(st)[which];
  return a.dmg > 0 ? a.dmg + mods(s, st).atk : 0;
}

// ---------- setup / turns ----------
export function newGame({ pDeck, eDeck, firstNoAttack = true }) {
  const mk = deck => ({ deck: shuffle([...deck]), hand: [], mana: 0, maxMana: 0, turns: 0, shards: 0,
    active: [null, null], bench: [null, null, null], open2: false, openedTurn: -1, retreated: false });
  const s = { players: { p: mk(pDeck), e: mk(eDeck) }, active: 'p', winner: null, round: 0, events: [], log: [], firstNoAttack };
  draw(s, 'p', START_HAND); draw(s, 'e', START_HAND);
  startTurn(s, 'p');
  return s;
}
const ev = (s, e) => s.events.push(e);
const log = (s, m) => { s.log.push(m); if (s.log.length > 50) s.log.shift(); };
const who = o => (o === 'p' ? 'You' : 'Enemy');

export function draw(s, o, n) {
  const P = s.players[o];
  while (n-- > 0 && P.deck.length && P.hand.length < HAND_MAX) P.hand.push(P.deck.shift());
}

export function startTurn(s, o) {
  s.active = o;
  if (o === 'p') s.round++;
  const P = s.players[o];
  P.turns++;
  P.maxMana = Math.min(MAX_MANA, P.turns + 1);
  P.mana = P.maxMana + (o === 'e' && P.turns === 1 ? 1 : 0); // going second: +1 mana on your first turn
  P.retreated = false;
  for (const { st } of stacks(s, o)) { st.attacked = false; st.fresh = false; }
  // burn ticks (ignores shield), then regen
  for (const { pos, st } of stacks(s, o)) {
    if (st.burn > 0) {
      st.dmg += st.burn; ev(s, { t: 'dmg', o, pos, n: st.burn, burn: true }); st.burn--;
      if (hp(s, st) <= 0) { ko(s, st, other(o)); if (s.winner) return; continue; }
    }
    const r = mods(s, st).regen;
    if (r && st.dmg) { const h = Math.min(r, st.dmg); st.dmg -= h; ev(s, { t: 'heal', o, pos, n: h }); }
  }
  autoFill(s, o);
  draw(s, o, Math.max(0, HAND_SIZE - P.hand.length));
}

// if you have no active fighter, your healthiest bench stack steps up for free
export function autoFill(s, o) {
  const P = s.players[o];
  if (P.active.some(Boolean)) return;
  let best = -1, bi = -1;
  P.bench.forEach((st, i) => { if (st && hp(s, st) > best) { best = hp(s, st); bi = i; } });
  if (bi >= 0) { P.active[0] = P.bench[bi]; P.bench[bi] = null; ev(s, { t: 'move', o }); }
}

export function endTurn(s) { if (!s.winner) startTurn(s, other(s.active)); }

function checkWin(s) {
  if (s.winner) return;
  if (s.players.p.shards >= WIN_SHARDS) s.winner = 'p';
  else if (s.players.e.shards >= WIN_SHARDS) s.winner = 'e';
}

function ko(s, st, killer) {
  const pos = posOf(s, st); if (!pos) return;
  zoneArr(s, st.owner, pos.zone)[pos.i] = null;
  s.players[st.owner].deck.push(...[...st.cards].reverse());
  s.players[killer].shards += st.cards.length;
  ev(s, { t: 'ko', o: st.owner, pos, n: st.cards.length, killer });
  log(s, `${topCard(st).name} (${st.cards.length}-stack) KO'd! ${who(killer)} +${st.cards.length} shard${st.cards.length > 1 ? 's' : ''}`);
  checkWin(s);
}

// ---------- placing cards ----------
export function placeTargets(s, o, id) {
  const P = s.players[o], c = CARDS[id], out = [];
  if (!P.hand.includes(id) || c.cost > P.mana || s.active !== o || s.winner) return out;
  P.active.forEach((st, i) => {
    if (i === 1 && !P.open2) return;
    if (!st) out.push({ zone: 'a', i, kind: 'new' });
    else if (st.cards.length < MAX_STACK) out.push({ zone: 'a', i, kind: 'stack' });
  });
  P.bench.forEach((st, i) => {
    if (!st) out.push({ zone: 'b', i, kind: 'new' });
    else if (st.cards.length < MAX_STACK) out.push({ zone: 'b', i, kind: 'stack' });
  });
  return out;
}

export function place(s, o, id, t) {
  const legal = placeTargets(s, o, id).find(x => x.zone === t.zone && x.i === t.i);
  if (!legal) return false;
  const P = s.players[o], c = CARDS[id];
  P.mana -= c.cost;
  P.hand.splice(P.hand.indexOf(id), 1);
  const arr = zoneArr(s, o, t.zone);
  if (legal.kind === 'new') {
    arr[t.i] = { id: SID++, owner: o, cards: [id], dmg: 0, shield: 0, burn: 0, attacked: false, fresh: t.zone === 'a' };
    log(s, `${who(o)} summoned ${c.name}${t.zone === 'b' ? ' to the bench' : ''}`);
  } else {
    const st = arr[t.i], under = topCard(st);
    st.cards.push(id);
    log(s, `${who(o)} stacked ${c.name} on ${under.name} → ${st.cards.length}-high${resonant(st) ? ' · RESONANCE!' : ''}`);
  }
  ev(s, { t: 'place', o, pos: { zone: t.zone, i: t.i } });
  return true;
}

// ---------- slot / bench management ----------
export const canOpen = (s, o) => s.active === o && !s.winner && !s.players[o].open2 && s.players[o].mana >= OPEN_COST;
export function openSlot(s, o) {
  if (!canOpen(s, o)) return false;
  const P = s.players[o]; P.mana -= OPEN_COST; P.open2 = true; P.openedTurn = P.turns;
  log(s, `${who(o)} opened a second active slot`);
  return true;
}

// move bench → EMPTY active slot (free)
export function canFill(s, o, bi, ai) {
  const P = s.players[o];
  return s.active === o && !s.winner && !!P.bench[bi] && !P.active[ai] && (ai === 0 || P.open2);
}
export function fill(s, o, bi, ai) {
  if (!canFill(s, o, bi, ai)) return false;
  const P = s.players[o]; P.active[ai] = P.bench[bi]; P.bench[bi] = null;
  log(s, `${who(o)} sent ${topCard(P.active[ai]).name} in`);
  return true;
}

// swap an active with a bench slot (occupied or empty): costs RETREAT_COST, once per turn
export function canSwap(s, o, ai, bi) {
  const P = s.players[o];
  return s.active === o && !s.winner && !P.retreated && P.mana >= RETREAT_COST && !!P.active[ai] && bi >= 0 && bi < 3
    && !P.active[ai].attacked;
}
export function swap(s, o, ai, bi) {
  if (!canSwap(s, o, ai, bi)) return false;
  const P = s.players[o];
  [P.active[ai], P.bench[bi]] = [P.bench[bi], P.active[ai]];
  P.mana -= RETREAT_COST; P.retreated = true;
  log(s, `${who(o)} retreated ${topCard(P.bench[bi]).name}`);
  return true;
}

// ---------- attacks ----------
export function canAttackerAct(s, o, ai) {
  const P = s.players[o], st = P.active[ai];
  if (!st || s.active !== o || s.winner || st.attacked || st.fresh) return false;
  if (ai === 1 && P.openedTurn === P.turns) return false;
  if (s.firstNoAttack && o === 'p' && P.turns === 1) return false;
  return true;
}
export function attackTargets(s, o, ai, which) {
  if (!canAttackerAct(s, o, ai)) return [];
  const st = s.players[o].active[ai];
  if (atkCost(s, st, which) > s.players[o].mana) return [];
  const a = topCard(st)[which], m = mods(s, st);
  const E = s.players[other(o)];
  if (a.dmg === 0 && !a.fx.burn) return [{ self: true }]; // pure self-buff move
  let idx = E.active.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
  if (!idx.length) return [];
  if (a.fx.both) return [{ i: idx[0], both: true }];
  if (!m.ranged && !a.fx.pierce) {
    const guards = idx.filter(i => mods(s, E.active[i]).guard);
    if (guards.length) idx = guards;
  }
  return idx.map(i => ({ i }));
}

function hit(s, attacker, target, n) {
  if (n <= 0 || !target) return 0;
  const absorb = Math.min(target.shield, n); target.shield -= absorb;
  const dealt = n - absorb; target.dmg += dealt;
  ev(s, { t: 'dmg', o: target.owner, pos: posOf(s, target), n: dealt, shield: absorb });
  if (dealt > 0) {
    const th = mods(s, target).thorns;
    if (th) { attacker.dmg += th; ev(s, { t: 'dmg', o: attacker.owner, pos: posOf(s, attacker), n: th }); }
  }
  return dealt;
}

export function attack(s, o, ai, which, tgt = {}) {
  const legal = attackTargets(s, o, ai, which);
  const t = legal.find(x => x.self || x.both || x.i === tgt.i);
  if (!t) return false;
  const P = s.players[o], st = P.active[ai], card = topCard(st), a = card[which], m = mods(s, st);
  P.mana -= atkCost(s, st, which);
  st.attacked = true;
  const E = s.players[other(o)];
  const dmg = atkDmg(s, st, which);
  log(s, `${who(o)}: ${card.name} used ${a.name}${dmg ? ` (${dmg})` : ''}`);
  ev(s, { t: 'attack', o, pos: { zone: 'a', i: ai } });
  let dealt = 0;
  if (!t.self) {
    const primaries = t.both ? E.active.filter(Boolean) : [E.active[t.i]];
    for (const tg of primaries) {
      dealt += hit(s, st, tg, dmg);
      const burn = (a.fx.burn || 0) + (dmg > 0 ? m.burnAdd : 0);
      if (burn) { tg.burn += burn; ev(s, { t: 'burn', o: tg.owner, pos: posOf(s, tg), n: burn }); }
    }
    if (a.fx.splash) for (const x of E.active.filter(x => x && !primaries.includes(x))) dealt += hit(s, st, x, a.fx.splash);
  }
  if (a.fx.heal) { const h = Math.min(a.fx.heal, st.dmg); st.dmg -= h; if (h) ev(s, { t: 'heal', o, pos: { zone: 'a', i: ai }, n: h }); }
  if (a.fx.shield) { st.shield += a.fx.shield; ev(s, { t: 'shield', o, pos: { zone: 'a', i: ai }, n: a.fx.shield }); }
  if (a.fx.draw) draw(s, o, a.fx.draw);
  if (dealt > 0 && m.drain) { const h = Math.min(m.drain, st.dmg); st.dmg -= h; if (h) ev(s, { t: 'heal', o, pos: { zone: 'a', i: ai }, n: h }); }
  for (const x of [...E.active, ...E.bench]) if (x && hp(s, x) <= 0) ko(s, x, o);
  if (posOf(s, st) && hp(s, st) <= 0) ko(s, st, other(o));
  return true;
}
