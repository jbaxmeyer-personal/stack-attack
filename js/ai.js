// Heuristic AI: repeatedly scores every legal action and takes the best one until nothing is worth doing.
import { CARDS } from './data.js?v=8';
import {
  placeTargets, place, canOpen, openSlot, canFill, fill, canSwap, swap, attackTargets, attack,
  topCard, mods, hp, maxHp, atkCost, atkDmg, other, resonant, MAX_STACK, zoneArr,
} from './engine.js?v=8';

// rough "how good is this stack right now"
function power(s, st) {
  const m = mods(s, st), c = topCard(st);
  const b = atkDmg(s, st, 'basic'), sp = atkDmg(s, st, 'special');
  const cheap = Math.max(b - atkCost(s, st, 'basic') * 0.8, sp - atkCost(s, st, 'special') * 0.8);
  return hp(s, st) * 0.45 + Math.max(b, sp * 0.85) * 1.2 + cheap * 0.6
    + (m.guard ? 1.5 : 0) + (m.ranged ? 1.5 : 0) + m.thorns * 0.8 + m.regen * 1.1 + m.drain * 0.9 + m.burnAdd * 1.4
    + (c.special.fx.both ? 1 : 0);
}

function enemyThreat(s, o) {
  let t = 0;
  for (const st of s.players[other(o)].active) if (st) t = Math.max(t, atkDmg(s, st, 'special'), atkDmg(s, st, 'basic'));
  return t;
}

function scorePlace(s, o, id, t) {
  const c = CARDS[id], P = s.players[o];
  const arr = zoneArr(s, o, t.zone);
  if (t.kind === 'new') {
    const base = c.hp * 0.35 + Math.max(c.basic.dmg, c.special.dmg) * 0.9;
    if (t.zone === 'a') return 4 + base;           // filling an empty active is big
    const benchCount = P.bench.filter(Boolean).length;
    return 1.2 + base * 0.5 - benchCount * 0.6;      // build a bench, but don't overfill
  }
  const st = arr[t.i];
  const before = power(s, st);
  st.cards.push(id); const after = power(s, st); const reso = resonant(st); st.cards.pop();
  let v = (after - before) * 1.1 + (reso ? 3 : 0);
  // tall stacks are shard liabilities; more so if they're hurt and up front
  const hurt = st.dmg / Math.max(1, maxHp(s, st));
  v -= st.cards.length * 0.9 + (t.zone === 'a' ? hurt * 3 : 0);
  if (t.zone === 'a') v += 0.8;                     // immediate impact
  return v;
}

function scoreAttack(s, o, ai, which, t) {
  const st = s.players[o].active[ai], a = topCard(st)[which];
  const cost = atkCost(s, st, which);
  const E = s.players[other(o)];
  let v = -cost * 0.35;
  if (t.self) {
    v += (a.fx.heal ? Math.min(a.fx.heal, st.dmg) * 0.8 : 0) + (a.fx.shield ? Math.min(a.fx.shield, enemyThreat(s, o)) * 0.7 : 0)
      + (a.fx.draw ? a.fx.draw * 1.3 : 0);
    return v;
  }
  const dmg = atkDmg(s, st, which), m = mods(s, st);
  const tgts = t.both ? E.active.filter(Boolean) : [E.active[t.i]];
  for (const tg of tgts) {
    const eff = Math.max(0, dmg - tg.shield), h = hp(s, tg);
    v += Math.min(eff, h) * 1.0;
    v += Math.min(dmg, tg.shield) * 0.8;   // stripping a shield is real progress (it never expires)
    if (eff >= h) v += 4 + tg.cards.length * 4;
    const burn = (a.fx.burn || 0) + (dmg > 0 ? m.burnAdd : 0);
    if (burn && eff < h) v += burn * 0.8;
    const th = mods(s, tg).thorns; if (th && eff > 0) v -= th * 0.7;
  }
  if (a.fx.splash) for (const x of E.active) if (x && !tgts.includes(x)) {
    const h = hp(s, x), eff = Math.max(0, a.fx.splash - x.shield);
    v += Math.min(eff, h) + Math.min(a.fx.splash, x.shield) * 0.8 + (eff >= h ? 4 + x.cards.length * 4 : 0);
  }
  if (a.fx.heal) v += Math.min(a.fx.heal, st.dmg) * 0.5;
  return v;
}

// cheapest attack the active in slot ai could make after a placement (null = none possible)
function cheapestAttack(s, o, ai, newTopId) {
  const st = s.players[o].active[ai]; if (!st) return null;
  if (newTopId) st.cards.push(newTopId);
  const c = Math.min(atkCost(s, st, 'basic'), atkCost(s, st, 'special'));
  if (newTopId) st.cards.pop();
  return c;
}

export function candidates(s, o) {
  const P = s.players[o], out = [];
  // best attack available right now, so placements that eat the attack mana pay for it
  let bestAtk = 0;
  for (let ai = 0; ai < 2; ai++) for (const which of ['basic', 'special']) for (const t of attackTargets(s, o, ai, which))
    bestAtk = Math.max(bestAtk, scoreAttack(s, o, ai, which, t));
  for (const id of new Set(P.hand)) for (const t of placeTargets(s, o, id)) {
    let score = scorePlace(s, o, id, t);
    if (bestAtk > 0) {
      const left = P.mana - CARDS[id].cost;
      let canStill = false;
      for (let ai = 0; ai < 2; ai++) {
        const st = P.active[ai];
        if (!st || st.attacked || st.fresh) continue;
        const c = cheapestAttack(s, o, ai, t.zone === 'a' && t.i === ai && t.kind === 'stack' ? id : null);
        if (c !== null && c <= left) canStill = true;
      }
      if (!canStill) score -= bestAtk * 0.8;
    }
    out.push({ type: 'place', id, t, score });
  }
  if (canOpen(s, o)) {
    const ready = P.bench.some(Boolean) || P.hand.some(id => CARDS[id].cost <= P.mana - 2);
    out.push({ type: 'open', score: ready && P.turns >= 2 ? 3.5 : -1 });
  }
  for (let bi = 0; bi < 3; bi++) for (let ai = 0; ai < 2; ai++) if (canFill(s, o, bi, ai)) out.push({ type: 'fill', bi, ai, score: 6 + power(s, P.bench[bi]) * 0.3 });
  for (let ai = 0; ai < 2; ai++) {
    const st = P.active[ai]; if (!st) continue;
    for (const which of ['basic', 'special']) for (const t of attackTargets(s, o, ai, which)) out.push({ type: 'attack', ai, which, t, score: scoreAttack(s, o, ai, which, t) });
    // retreat a nearly-dead tall stack to protect shards
    const h = hp(s, st);
    if (h <= enemyThreat(s, o) && st.cards.length >= 2) {
      for (let bi = 0; bi < 3; bi++) if (canSwap(s, o, ai, bi)) {
        const inc = P.bench[bi];
        if (!inc || hp(s, inc) > h) out.push({ type: 'swap', ai, bi, score: st.cards.length * 2 + (inc ? 1 : -1) });
      }
    }
  }
  return out;
}

export function bestAction(s, o) {
  let best = null;
  for (const c of candidates(s, o)) if (!best || c.score > best.score) best = c;
  return best && best.score > 0.3 ? best : null;
}

export function doAction(s, o, a) {
  switch (a.type) {
    case 'place': return place(s, o, a.id, a.t);
    case 'open': return openSlot(s, o);
    case 'fill': return fill(s, o, a.bi, a.ai);
    case 'swap': return swap(s, o, a.ai, a.bi);
    case 'attack': return attack(s, o, a.ai, a.which, a.t);
  }
  return false;
}
