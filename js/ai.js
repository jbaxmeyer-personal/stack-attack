// Heuristic AI: greedily picks the best-scoring play until nothing is worth it.
import { CARDS } from './data.js';
import { playableTargets, costAt, canPlay, canCycle, stacksOf, topCard, hp, atk, kw, other, fwd, ROWS, COLS, MAX_STACK } from './engine.js';

// rows until a stack at row r (owned by o) reaches the enemy base
const distToBase = (o, r) => (o === 'p' ? r + 1 : ROWS - r);

function stripVal(s, o, strip, r, c) {
  let v = 0;
  for (const p of strip) {
    const n = p.n;
    switch (p.k) {
      case 'might': v += n * 1.6; break;
      case 'ward': v += n * 1.0; break;
      case 'siege': v += n * (0.6 + 1.2 / distToBase(o, r)); break;
      case 'charge': v += n * 1.2; break;
      case 'rally': {
        let adj = 0;
        for (const dc of [-1, 1]) { const x = s.board[r]?.[c + dc]; if (x && x.owner === o) adj++; }
        v += n * (0.5 + adj * 1.2); break;
      }
      case 'regrowth': v += n * 1.3; break;
      case 'thorns': v += n * 1.1; break;
      case 'spark': v += n * 1.7; break;
      case 'hex': v += n * 1.3; break;
      case 'drain': v += n * 0.9; break;
    }
  }
  return v;
}

const stackValue = st => st.cards.reduce((a, id) => a + CARDS[id].cost * 1.5 + 1, 0);

// first enemy stack in lane c, scanning from (r) forward
function laneEnemy(s, o, r, c) {
  for (let rr = r + fwd(o); rr >= 0 && rr < ROWS; rr += fwd(o)) {
    const x = s.board[rr][c]; if (x && x.owner !== o) return { r: rr, st: x };
  }
  return null;
}

// threat: enemy stacks close to our base in this lane
function laneThreat(s, o, c) {
  let t = 0;
  for (let r = 0; r < ROWS; r++) {
    const x = s.board[r][c];
    if (x && x.owner !== o) t += (atk(s, r, c) + 1) / distToBase(x.owner, r);
  }
  return t;
}

function scorePlay(s, o, id, t) {
  const card = CARDS[id];
  if (card.type === 'unit') {
    let v = 0;
    if (t.kind === 'deploy') {
      v = card.atk * 1.2 + card.hp * 0.9 + (card.swift ? 1.5 : 0);
      const foe = laneEnemy(s, o, t.r, t.c);
      if (foe) {
        const fh = hp(foe.st), fa = atk(s, foe.r, t.c);
        if (card.atk >= fh) v += 2 + stackValue(foe.st) * 0.3;
        if (fa >= card.hp) v -= 1.5;
      } else v += 1.5; // open lane → pressure
      v += laneThreat(s, o, t.c) * 1.5;
      const front = o === 'e' ? 1 : 3;
      if (t.r === front) v += 1;
    } else {
      const st = s.board[t.r][t.c], old = topCard(st);
      v = stripVal(s, o, old.strip, t.r, t.c)
        + card.atk * 1.1 + card.hp * 0.8
        + st.dmg * 0.8                       // fresh fighter replaces a hurt one
        - (old.atk + old.hp) * 0.35
        - st.cards.length * 1.0              // eggs in one basket
        + (ROWS - distToBase(o, t.r)) * 0.9  // reinforcing up front skips the walk
        + 1.0                                // discount
        + (st.buffAtk ? 1 : 0);
      if (st.cards.length === MAX_STACK - 1) v -= 0.5;
    }
    if (card.onPlay === 'draw1') v += 1.5;
    return v;
  }
  // spells
  if (card.effect === 'smite' || card.effect === 'moonbolt') {
    const n = card.effect === 'smite' ? 4 : 3, st = s.board[t.r][t.c];
    if (hp(st) <= n) return 3 + stackValue(st) * 1.1 + (card.effect === 'moonbolt' ? 1.5 : 0);
    return n * 0.4 - 1;
  }
  if (card.effect === 'eclipse') {
    let v = -2;
    for (const x of stacksOf(s, other(o))) v += hp(x.st) <= 2 ? 2 + stackValue(x.st) : 0.8;
    return v;
  }
  if (card.effect === 'blessing') {
    const st = s.board[t.r][t.c];
    return st.dmg * 0.9 + 2.5 + st.cards.length * 0.8 - 2;
  }
  return 0;
}

export function bestPlay(s, o) {
  const P = s.players[o]; let best = null;
  for (const id of P.hand) {
    if (!canPlay(s, o, id)) continue;
    for (const t of playableTargets(s, o, id)) {
      const score = scorePlay(s, o, id, t) + costAt(s, o, id, t) * 0.4; // slight preference for spending mana
      if (!best || score > best.score) best = { id, t, score };
    }
  }
  return best && best.score > 0.5 ? best : null;
}

// cycle a card that is far too expensive for now, once per turn
export function cyclePick(s, o) {
  const P = s.players[o];
  const bad = P.hand.filter(id => CARDS[id].cost > P.maxMana + 2 && canCycle(s, o, id));
  if (!bad.length) return null;
  bad.sort((a, b) => CARDS[b].cost - CARDS[a].cost);
  return bad[0];
}
