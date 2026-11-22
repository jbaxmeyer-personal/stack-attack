// Pure rules engine (no DOM). Player 'p' is at the bottom and moves up (row -1).
// Enemy 'e' is at the top and moves down (row +1).
import { CARDS } from './data.js';

export const ROWS = 5, COLS = 4, MAX_STACK = 3, HAND_SIZE = 4, HAND_MAX = 5, BASE_HP = 12, MAX_MANA = 10;
export const fwd = o => (o === 'p' ? -1 : 1);
export const other = o => (o === 'p' ? 'e' : 'p');
export const deployRows = o => (o === 'p' ? [3, 4] : [0, 1]);

let rng = Math.random;
export const setRng = f => { rng = f; };
let SID = 1;

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- stack helpers ----------
export const topCard = st => CARDS[st.cards[st.cards.length - 1]];
export const buried = st => st.cards.slice(0, -1).map(id => CARDS[id]);
export function kw(st, k) {
  let n = 0;
  for (const c of buried(st)) for (const p of c.strip) if (p.k === k) n += p.n;
  return n;
}
export const maxHp = st => topCard(st).hp + kw(st, 'ward') + (st.buffHp || 0);
export const hp = st => maxHp(st) - st.dmg;
export const at = (s, r, c) => (r >= 0 && r < ROWS && c >= 0 && c < COLS ? s.board[r][c] : null);

export function find(s, id) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const st = s.board[r][c]; if (st && st.id === id) return { r, c, st };
  }
  return null;
}
export function stacksOf(s, o) {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const st = s.board[r][c]; if (st && st.owner === o) out.push({ r, c, st });
  }
  return out;
}

export function atk(s, r, c, attacking = false) {
  const st = s.board[r][c];
  let a = topCard(st).atk + kw(st, 'might') + (st.buffAtk || 0);
  if (attacking) a += kw(st, 'charge');
  for (const dc of [-1, 1]) { const n = at(s, r, c + dc); if (n && n.owner === st.owner) a += kw(n, 'rally'); }
  const ahead = at(s, r + fwd(st.owner), c);
  if (ahead && ahead.owner !== st.owner) a -= kw(ahead, 'hex');
  return Math.max(0, a);
}

// ---------- game setup ----------
export function newGame({ pFaction, eFaction, pDeck, eDeck }) {
  const mk = (faction, deck) => ({ faction, deck: shuffle([...deck]), hand: [], base: BASE_HP, maxBase: BASE_HP,
    mana: 0, maxMana: 0, cycled: false, turns: 0 });
  const s = {
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    players: { p: mk(pFaction, pDeck), e: mk(eFaction, eDeck) },
    active: 'p', winner: null, round: 0, events: [], log: [],
  };
  draw(s, 'p', HAND_SIZE); draw(s, 'e', HAND_SIZE);
  startTurn(s, 'p');
  return s;
}

const ev = (s, e) => s.events.push(e);
const log = (s, m) => { s.log.push(m); if (s.log.length > 40) s.log.shift(); };

export function draw(s, o, n) {
  const P = s.players[o];
  while (n-- > 0 && P.deck.length && P.hand.length < HAND_MAX) P.hand.push(P.deck.shift());
}

export function startTurn(s, o) {
  s.active = o;
  if (o === 'p') s.round++;
  const P = s.players[o];
  P.turns++;
  P.maxMana = Math.min(MAX_MANA, P.turns + 2);
  P.mana = P.maxMana + (o === 'e' && P.turns === 1 ? 1 : 0); // going second: +1 mana on first turn
  P.cycled = false;
  for (const { r, c, st } of stacksOf(s, o)) {
    const g = kw(st, 'regrowth');
    if (g && st.dmg) { const h = Math.min(g, st.dmg); st.dmg -= h; ev(s, { t: 'heal', r, c, n: h }); }
  }
  draw(s, o, Math.max(0, HAND_SIZE - P.hand.length));
}

function checkWin(s) {
  if (s.winner) return;
  if (s.players.e.base <= 0) s.winner = 'p';
  else if (s.players.p.base <= 0) s.winner = 'e';
}

function healBase(s, o, n) {
  if (n <= 0) return;
  const P = s.players[o]; const h = Math.min(n, P.maxBase - P.base);
  if (h > 0) { P.base += h; ev(s, { t: 'baseHeal', o, n: h }); }
}

function kill(s, r, c) {
  const st = s.board[r][c];
  s.board[r][c] = null;
  // whole stack dies; cards return to the bottom of the owner's deck (fighter first)
  s.players[st.owner].deck.push(...[...st.cards].reverse());
  ev(s, { t: 'die', r, c, o: st.owner });
}

export function damage(s, r, c, n) {
  const st = s.board[r][c]; if (!st || n <= 0) return false;
  st.dmg += n; ev(s, { t: 'dmg', r, c, n });
  if (hp(st) <= 0) { kill(s, r, c); return true; }
  return false;
}

// ---------- playing cards ----------
export function targets(s, o, id) {
  const c = CARDS[id]; const out = [];
  if (c.type === 'unit') {
    for (const r of deployRows(o)) for (let col = 0; col < COLS; col++) if (!s.board[r][col]) out.push({ r, c: col, kind: 'deploy' });
    for (const x of stacksOf(s, o)) if (x.st.cards.length < MAX_STACK) out.push({ r: x.r, c: x.c, kind: 'stack' });
  } else if (c.target === 'enemy') {
    for (const x of stacksOf(s, other(o))) out.push({ r: x.r, c: x.c, kind: 'spell' });
  } else if (c.target === 'friend') {
    for (const x of stacksOf(s, o)) out.push({ r: x.r, c: x.c, kind: 'spell' });
  } else out.push({ kind: 'none' });
  return out;
}

// Stacking onto one of your stacks costs 1 less (the reinforcement discount).
export const STACK_DISCOUNT = 1;
export function costAt(s, o, id, t) {
  const c = CARDS[id];
  const st = t && t.kind !== 'none' && t.r !== undefined ? s.board[t.r][t.c] : null;
  return c.type === 'unit' && st && st.owner === o ? Math.max(0, c.cost - STACK_DISCOUNT) : c.cost;
}
export function canAfford(s, o, id, t) { return costAt(s, o, id, t) <= s.players[o].mana; }
export function playableTargets(s, o, id) { return targets(s, o, id).filter(t => canAfford(s, o, id, t)); }
export function canPlay(s, o, id) {
  const P = s.players[o];
  return !s.winner && s.active === o && P.hand.includes(id) && playableTargets(s, o, id).length > 0;
}

export function play(s, o, id, t) {
  if (!canPlay(s, o, id)) return false;
  const c = CARDS[id], P = s.players[o];
  const legal = playableTargets(s, o, id).find(x => x.kind === 'none' ? t.kind === 'none' : x.r === t.r && x.c === t.c);
  if (!legal) return false;
  P.mana -= costAt(s, o, id, legal);
  P.hand.splice(P.hand.indexOf(id), 1);
  const who = o === 'p' ? 'You' : 'Enemy';

  if (c.type === 'unit') {
    const st = s.board[t.r][t.c];
    if (st) { st.cards.push(id); st.dmg = 0; log(s, `${who} stacked ${c.name} (${st.cards.length}-high)`); }
    else { s.board[t.r][t.c] = { id: SID++, owner: o, cards: [id], dmg: 0, buffAtk: 0, buffHp: 0 }; log(s, `${who} deployed ${c.name}`); }
    ev(s, { t: 'play', r: t.r, c: t.c, o });
    if (c.onPlay === 'draw1') draw(s, o, 1);
  } else {
    log(s, `${who} cast ${c.name}`);
    if (c.effect === 'smite') damage(s, t.r, t.c, 4);
    else if (c.effect === 'moonbolt') { if (damage(s, t.r, t.c, 3)) draw(s, o, 1); }
    else if (c.effect === 'eclipse') { for (const x of stacksOf(s, other(o))) damage(s, x.r, x.c, 2); }
    else if (c.effect === 'blessing') {
      const st = s.board[t.r][t.c]; const h = st.dmg; st.dmg = 0; st.buffAtk += 2;
      ev(s, { t: 'heal', r: t.r, c: t.c, n: h });
    }
    P.deck.push(id);
  }
  checkWin(s);
  return true;
}

export function canCycle(s, o, id) {
  const P = s.players[o];
  return !s.winner && s.active === o && !P.cycled && P.hand.includes(id) && P.deck.length > 0;
}
export function cycle(s, o, id) {
  if (!canCycle(s, o, id)) return false;
  const P = s.players[o];
  P.hand.splice(P.hand.indexOf(id), 1);
  draw(s, o, 1);
  P.deck.push(id);
  P.cycled = true;
  return true;
}

// ---------- end of turn: advance + combat ----------
export function advanceOrder(s, o) {
  const xs = stacksOf(s, o);
  xs.sort((a, b) => (o === 'p' ? a.r - b.r : b.r - a.r));
  return xs.map(x => x.st.id);
}

export function advanceStack(s, id) {
  const f0 = find(s, id); if (!f0 || s.winner) return;
  const st = f0.st, o = st.owner, steps = topCard(st).swift ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    const f = find(s, id); if (!f) return;
    const { r, c } = f, nr = r + fwd(o);
    if (nr < 0 || nr >= ROWS) {
      const dmg = atk(s, r, c, true) + kw(st, 'siege') + st.cards.length; // every card in the stack adds 1
      const E = s.players[other(o)];
      E.base -= dmg; ev(s, { t: 'base', o: other(o), n: dmg, r, c });
      log(s, `${o === 'p' ? 'Your' : 'Enemy'} ${topCard(st).name} hit the base for ${dmg}`);
      if (dmg > 0) healBase(s, o, kw(st, 'drain'));
      kill(s, r, c);
      checkWin(s);
      return;
    }
    const t = s.board[nr][c];
    if (!t) { s.board[nr][c] = st; s.board[r][c] = null; ev(s, { t: 'move', r: nr, c }); continue; }
    if (t.owner === o) return; // blocked by own stack
    // combat: simultaneous
    const a = atk(s, r, c, true), b = atk(s, nr, c, false);
    let dA = b, dB = a;
    if (a > 0) dA += kw(t, 'thorns');
    if (b > 0) dB += kw(st, 'thorns');
    if (a > 0) healBase(s, o, kw(st, 'drain'));
    if (b > 0) healBase(s, t.owner, kw(t, 'drain'));
    // attacker strikes first: if it kills the defender, it takes no return damage
    if (hp(t) - dB <= 0) dA = 0;
    st.dmg += dA; t.dmg += dB;
    if (dB) ev(s, { t: 'dmg', r: nr, c, n: dB });
    if (dA) ev(s, { t: 'dmg', r, c, n: dA });
    const deadB = hp(t) <= 0, deadA = hp(st) <= 0;
    if (deadB) kill(s, nr, c);
    if (deadA) { kill(s, r, c); return; }
    if (deadB) { s.board[nr][c] = st; s.board[r][c] = null; ev(s, { t: 'move', r: nr, c }); continue; }
    return;
  }
}

export function sparkPhase(s, o) {
  for (const { r, c, st } of stacksOf(s, o)) {
    const n = kw(st, 'spark'); if (!n) continue;
    const ahead = at(s, r + fwd(o), c);
    if (ahead && ahead.owner !== o) damage(s, r + fwd(o), c, n);
  }
}

// synchronous full end-turn (used by sims/AI); UI runs the same steps with delays
export function endTurn(s) {
  const o = s.active;
  for (const id of advanceOrder(s, o)) { advanceStack(s, id); if (s.winner) return; }
  sparkPhase(s, o); if (s.winner) return;
  startTurn(s, other(o));
}
