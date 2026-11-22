import { CARDS, TAGS, RARITY, STARTERS, KW_HELP, stripText, fxText } from './data.js';
import {
  WIN_SHARDS, MAX_STACK, OPEN_COST, RETREAT_COST, newGame, endTurn, topCard, buried, mods, hp, maxHp,
  atkCost, atkDmg, condMet, resonant, placeTargets, place, canOpen, openSlot, canFill, fill, canSwap, swap,
  canAttackerAct, attackTargets, attack,
} from './engine.js';
import { bestAction, doAction } from './ai.js';
import { artSVG } from './art.js';

const app = document.getElementById('app');
const fxLayer = document.getElementById('fx');
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const STRIP = { a: 15, b: 11 };

function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
let deckName = load('sa2_deck', 'Troll & Archer');
if (!STARTERS[deckName]) deckName = Object.keys(STARTERS)[0];

// ---------- small card (hand / deck grid) ----------
function cardHTML(c, o = {}) {
  const cls = ['card', c.tag, o.sel ? 'sel' : '', o.dis ? 'dis' : ''].join(' ');
  const kws = [c.kw.guard && '<span class="chip guard">G</span>', c.kw.ranged && '<span class="chip ranged">R</span>'].filter(Boolean).join('');
  return `<button class="${cls}" ${o.data || ''}>
    <div class="cart">${artSVG(c)}<div class="cost">${c.cost}</div><div class="rar" style="background:${RARITY[c.rarity].color}"></div>
      <div class="cname">${esc(c.name)}</div><div class="kw">${kws}</div><span class="hpb">${c.hp}</span></div>
    <div class="cstrip">${esc(stripText(c.strip))}</div></button>`;
}

// ---------- BIG card (popup) ----------
// st: the stack this card is the fighter of (live numbers), or null for the printed card.
// atkAi: if set, attack rows are buttons for player's active slot atkAi.
function bigCardHTML(c, st = null, atkAi = null) {
  const live = st && topCard(st) === c;
  const m = live ? mods(G, st) : null;
  const H = live ? hp(G, st) : c.hp, MH = live ? maxHp(G, st) : c.hp;
  const guard = live ? m.guard : c.kw.guard, ranged = live ? m.ranged : c.kw.ranged;
  const chips = [guard && '<span class="chip guard">Guard</span>', ranged && '<span class="chip ranged">Ranged</span>',
    live && st.shield && `<span class="chip shield">Shield ${st.shield}</span>`, live && st.burn && `<span class="chip burn">Burn ${st.burn}</span>`,
    live && resonant(st) && '<span class="chip reso">RESONANCE</span>'].filter(Boolean).join('');
  const row = w => {
    const a = c[w];
    const cost = live ? atkCost(G, st, w) : a.cost, dmg = live ? atkDmg(G, st, w) : a.dmg;
    const costTxt = cost !== a.cost ? `<s>${a.cost}</s> ${cost}` : `${cost}`;
    const dmgTxt = dmg ? (dmg !== a.dmg ? `<b class="dmg up">${dmg}</b>` : `<b class="dmg">${dmg}</b>`) : '<b class="dmg zero">—</b>';
    const inner = `<span class="rk">${w === 'basic' ? 'BASIC' : 'SPECIAL'}</span><span class="rname">${esc(a.name)}</span>
      <span class="rfx">${esc(fxText(a.fx))}</span>${dmgTxt}<span class="rcost">${costTxt}◆</span>`;
    if (atkAi === null) return `<div class="brow ${w}">${inner}</div>`;
    const en = attackTargets(G, 'p', atkAi, w).length > 0;
    return `<button class="brow ${w} live" data-batk="${w}" ${en ? '' : 'disabled'}>${inner}</button>`;
  };
  return `<div class="big ${c.tag}">
    <div class="bhead"><span class="bcost">${c.cost}</span><div class="btitle"><b>${esc(c.name)}</b>
      <span><i style="background:${RARITY[c.rarity].color}"></i>${RARITY[c.rarity].name} · <em style="color:${TAGS[c.tag].color}">${TAGS[c.tag].name}</em></span></div></div>
    <div class="bart">${artSVG(c)}<div class="bchips">${chips}</div>
      <span class="bhp ${H < MH ? 'hurt' : ''}">${H}${MH !== c.hp || H < MH ? `<small>/${MH}</small>` : ''}<small> HP</small></span></div>
    <div class="brows">${row('basic')}${row('special')}</div>
    <div class="bstrip"><span>STRIP · active while buried under another card</span>${esc(stripText(c.strip))}</div>
  </div>`;
}

function kwHelpFor(cards, st) {
  const keys = new Set();
  for (const c of cards) {
    if (c.kw.guard || c.strip.mods.guard) keys.add('Guard');
    if (c.kw.ranged || c.strip.mods.ranged) keys.add('Ranged');
    for (const a of [c.basic, c.special]) {
      if (a.fx.burn) keys.add('Burn'); if (a.fx.shield) keys.add('Shield');
    }
    for (const k of ['thorns', 'regen', 'drain', 'burnAdd']) if (c.strip.mods[k]) keys.add({ thorns: 'Thorns', regen: 'Regen', drain: 'Drain', burnAdd: 'Burn' }[k]);
  }
  if (st && (st.burn)) keys.add('Burn');
  if (st && st.shield) keys.add('Shield');
  keys.add('Resonance');
  return [...keys].map(k => `<b>${k}</b> — ${KW_HELP[k]}`).join('<br>');
}

// popup: { card } or { o, zone, i }
let pop = null;
function closePop() { pop?.el.remove(); pop = null; }
function openPop(spec) {
  closePop();
  const el = document.createElement('div');
  el.className = 'pop';
  pop = { el, spec };
  drawPop();
  el.addEventListener('click', onPopClick);
  document.body.appendChild(el);
}
function drawPop() {
  const { spec, el } = pop;
  let body = '', actions = '';
  if (spec.card) {
    const c = CARDS[spec.card];
    body = bigCardHTML(c) + `<div class="pkw">${kwHelpFor([c])}</div>`;
    if (spec.k !== undefined && G && !busy && G.active === 'p' && placeTargets(G, 'p', c.id).length)
      actions = `<button class="btn primary" data-pa="play">Play</button>`;
    if (spec.back) actions = `<button class="btn" data-pa="back">Back to stack</button>` + actions;
  } else {
    const st = getSt(spec.o, spec.zone, spec.i);
    if (!st) return closePop();
    const top = topCard(st);
    const mine = spec.o === 'p' && G.active === 'p' && !busy;
    const atkAi = mine && spec.zone === 'a' ? spec.i : null;
    const under = buried(st).map((c, k) => ({ c, k })).reverse()
      .map(({ c, k }) => {
        const on = condMet(G, st, c.strip.if);
        return `<button class="bur ${c.tag} ${on ? 'on' : 'off'}" data-bur="${k}"><span class="bt">${esc(c.name)}<em>${on ? 'LIVE' : 'OFF'}</em></span>${esc(stripText(c.strip))}</button>`;
      }).join('');
    const why = atkAi !== null && !canAttackerAct(G, 'p', atkAi)
      ? (st.attacked ? 'Already acted this turn.' : st.fresh ? 'Just summoned — can attack next turn.'
        : G.players.p.turns === 1 ? 'No attacks on the very first turn.' : 'Slot opened this turn — attacks next turn.') : '';
    body = `<div class="phead">${spec.o === 'p' ? 'YOUR' : 'RIVAL'} ${spec.zone === 'a' ? 'ACTIVE' : 'BENCH'} · Lv${st.cards.length} · KO worth ${st.cards.length}◆</div>
      ${bigCardHTML(top, st, atkAi)}${under ? `<div class="burs">${under}</div>` : ''}
      ${why ? `<div class="pwhy">${why}</div>` : ''}<div class="pkw">${kwHelpFor(st.cards.map(id => CARDS[id]), st)}</div>`;
    if (mine && spec.zone === 'a' && [0, 1, 2].some(b => canSwap(G, 'p', spec.i, b))) actions += `<button class="btn" data-pa="retreat">Retreat · ${RETREAT_COST}◆</button>`;
    if (mine && spec.zone === 'b') {
      const ai = [0, 1].find(a => canFill(G, 'p', spec.i, a));
      if (ai !== undefined) actions += `<button class="btn primary" data-pa="sendin" data-ai="${ai}">Send in (free)</button>`;
    }
  }
  el.innerHTML = `<div class="pbox">${body}<div class="pact">${actions}<button class="btn" data-pa="close">Close</button></div></div>`;
}
function onPopClick(e) {
  if (e.target === pop.el) return closePop();
  const spec = pop.spec;
  const bur = e.target.closest('[data-bur]');
  if (bur) { const st = getSt(spec.o, spec.zone, spec.i); pop.spec = { card: st.cards[+bur.dataset.bur], back: spec }; return drawPop(); }
  const ba = e.target.closest('[data-batk]');
  if (ba && !ba.disabled) {
    const which = ba.dataset.batk, ai = spec.i, ts = attackTargets(G, 'p', ai, which);
    closePop();
    if (ts.length === 1) { attack(G, 'p', ai, which, ts[0]); return after(); }
    sel = { kind: 'attack', ai, which }; return render();
  }
  const a = e.target.closest('[data-pa]')?.dataset.pa;
  if (a === 'close') return closePop();
  if (a === 'back') { pop.spec = spec.back; return drawPop(); }
  if (a === 'play') { closePop(); sel = { kind: 'hand', id: spec.card, k: spec.k }; note = 'Tap a highlighted slot (or drag cards next time).'; return render(); }
  if (a === 'retreat') { closePop(); sel = { kind: 'retreat', ai: spec.i }; return render(); }
  if (a === 'sendin') { closePop(); fill(G, 'p', spec.i, +e.target.closest('[data-ai]').dataset.ai); return after(); }
}

// ================= MENU =================
function menu() {
  G = null; closePop();
  const picks = Object.entries(STARTERS).map(([n, d]) => {
    const show = CARDS[d.cards[d.cards.length - 1]];
    return `<button class="dpick ${n === deckName ? 'on' : ''}" data-deck="${esc(n)}"><div class="dart">${artSVG(show)}</div>
      <div><b>${esc(n)}</b><span>${esc(d.desc)}</span></div></button>`;
  }).join('');
  app.innerHTML = `<div class="menu">
    <div class="logo">STACK<br>ATTACK</div>
    <div class="tag">wizard duels · stack to level up · first to ${WIN_SHARDS} shards</div>
    <div class="decks">${picks}</div>
    <div class="row"><button class="btn" data-act="view">View deck</button><button class="btn primary" data-act="play">Duel</button></div>
    <div class="rules"><b>How it works</b><ul>
      <li><b>Drag</b> a card onto a slot to summon it, or onto one of your fighters to <b>stack</b> it (max ${MAX_STACK}). <b>Tap</b> anything to see the full card.</li>
      <li>You have <b>2 active slots</b> (the 2nd costs ${OPEN_COST}◆ to open, and can't attack the turn you open it) and a <b>bench of 3</b>. No active? Your summon goes straight in.</li>
      <li>The top card fights with its attacks and HP; damage carries over when you stack. Buried cards' <b>strips</b> peek out — those passives are live. Most are conditional. A 3-stack of one tag gains <b>Resonance</b>.</li>
      <li>Each active uses its <b>Basic</b> or <b>Special</b> once a turn (tap it). Mana is shared. Cards summoned straight into an active can't attack that turn.</li>
      <li>KO a stack → you gain <b>shards = its height</b>. First to <b>${WIN_SHARDS}</b> wins.</li>
      <li>Retreat costs ${RETREAT_COST}◆, once per turn. Mana: 2 on turn 1, +1 per turn.</li>
    </ul></div></div>`;
  app.onclick = e => {
    const d = e.target.closest('[data-deck]');
    if (d) { deckName = d.dataset.deck; save('sa2_deck', deckName); return menu(); }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'play') startGame();
    if (a === 'view') viewDeck();
  };
}

function viewDeck() {
  app.innerHTML = `<div class="menu"><div class="row" style="align-items:center"><h2 style="margin:0;flex:1;font-size:18px">${esc(deckName)}</h2><button class="btn" data-act="back" style="flex:none">Back</button></div>
    <div class="tag" style="margin:0">Tap a card to see it full size.</div>
    <div class="deckgrid">${STARTERS[deckName].cards.map(id => cardHTML(CARDS[id], { data: `data-id="${id}"` })).join('')}</div></div>`;
  app.onclick = e => {
    const c = e.target.closest('[data-id]');
    if (c) return openPop({ card: c.dataset.id });
    if (e.target.closest('[data-act=back]')) menu();
  };
}

// ================= GAME =================
let G = null;
let sel = null;   // {kind:'hand', id, k} | {kind:'attack', ai, which} | {kind:'retreat', ai}
let busy = false, note = '';
const getSt = (o, zone, i) => (zone === 'a' ? G.players[o].active[i] : G.players[o].bench[i]);

function startGame() {
  const enemy = Object.keys(STARTERS).find(n => n !== deckName) || deckName;
  G = newGame({ pDeck: STARTERS[deckName].cards, eDeck: STARTERS[enemy].cards });
  sel = null; busy = false; note = 'Drag a card up to summon your first fighter.';
  app.onclick = onClick;
  render(); banner('Your turn', 'var(--p)');
}

function stackHTML(st, zone) {
  const n = st.cards.length - 1, top = topCard(st), m = mods(G, st), h = STRIP[zone];
  const strips = buried(st).map((c, i) =>
    `<div class="strip ${c.tag} ${condMet(G, st, c.strip.if) ? '' : 'off'}" style="bottom:${i * h}px;z-index:${i + 1}">${esc(stripText(c.strip))}</div>`).join('');
  const H = hp(G, st), MH = maxHp(G, st);
  const chips = [
    m.guard && '<span class="chip guard">Guard</span>', m.ranged && '<span class="chip ranged">Ranged</span>',
    st.shield && `<span class="chip shield">⛨${st.shield}</span>`, st.burn && `<span class="chip burn">🔥︎${st.burn}</span>`,
    resonant(st) && '<span class="chip reso">RESO</span>',
  ].filter(Boolean).join('');
  return `<div class="stack">${strips}<div class="fighter ${top.tag} ${resonant(st) ? 'reso' : ''}" style="bottom:${n * h}px">${artSVG(top)}
    <div class="fn">${esc(top.name)}</div><div class="chips">${chips}</div>
    <span class="hpb ${H < MH ? (H <= MH / 3 ? 'low' : 'hurt') : ''}">${H}</span></div></div>`;
}

function hlFor(o, zone, i) {
  if (!sel || busy || G.active !== 'p') return '';
  if (sel.kind === 'hand' && o === 'p') {
    const t = placeTargets(G, 'p', sel.id).find(x => x.zone === zone && x.i === i);
    return t ? (t.kind === 'stack' ? 'hl stackable' : 'hl') : '';
  }
  if (sel.kind === 'attack') {
    if (o === 'e' && zone === 'a') return attackTargets(G, 'p', sel.ai, sel.which).some(t => t.i === i || t.both) ? 'hl target' : '';
    if (o === 'p' && zone === 'a' && sel.ai === i) return 'selected';
  }
  if (sel.kind === 'retreat') {
    if (o === 'p' && zone === 'b') return canSwap(G, 'p', sel.ai, i) ? 'hl' : '';
    if (o === 'p' && zone === 'a' && sel.ai === i) return 'selected';
  }
  return '';
}

function slotHTML(o, zone, i) {
  const P = G.players[o];
  const st = getSt(o, zone, i);
  if (zone === 'a' && i === 1 && !P.open2) {
    const btn = o === 'p' ? `<button class="btn" data-act="open" ${!busy && canOpen(G, 'p') ? '' : 'disabled'}>Open · ${OPEN_COST}◆</button>` : '';
    return `<div class="slot locked" data-o="${o}" data-z="a" data-i="1">🔒︎ 2nd active${btn}</div>`;
  }
  let extra = '';
  if (st && o === 'p' && zone === 'a' && G.active === 'p' && !busy) {
    const any = canAttackerAct(G, 'p', i) && ['basic', 'special'].some(w => attackTargets(G, 'p', i, w).length);
    if (any) extra = '<span class="ready">TAP TO ATTACK</span>';
    else if (st.attacked) extra = '<div class="done"></div>';
  }
  const lv = st && st.cards.length > 1 ? `<span class="lv">Lv${st.cards.length}</span>` : '';
  return `<div class="slot ${hlFor(o, zone, i)}" data-o="${o}" data-z="${zone}" data-i="${i}">${st ? stackHTML(st, zone) + lv + extra : ''}</div>`;
}

function hudHTML(o) {
  const P = G.players[o], on = G.active === o && !G.winner;
  const sh = Array.from({ length: WIN_SHARDS }, (_, k) => `<i class="${k < P.shards ? 'on' : ''}"></i>`).join('');
  const right = o === 'p'
    ? `<button class="btn primary" data-act="end" ${!busy && on ? '' : 'disabled'}>End turn</button>`
    : `<span class="cnt">✋︎${P.hand.length} · deck ${P.deck.length}</span>`;
  return `<div class="hud ${o}" data-hud="${o}"><span class="turnflag ${on ? 'on' : ''}">${o === 'p' ? 'YOU' : 'RIVAL'}</span>
    <div class="shards">${sh}</div><span class="mana"><span class="gem"></span>${P.mana}/${P.maxMana}</span>${right}</div>`;
}

function promptHTML() {
  if (!busy && G.active === 'p' && sel) {
    let t = '';
    if (sel.kind === 'attack') t = `Choose a target for <b>${esc(topCard(G.players.p.active[sel.ai])[sel.which].name)}</b>`;
    else if (sel.kind === 'retreat') t = `Choose a bench slot to swap into (${RETREAT_COST}◆)`;
    else if (sel.kind === 'hand') t = `${drag ? 'Drop' : 'Tap a highlighted slot'} for <b>${esc(CARDS[sel.id].name)}</b>${G.players.p.active.some(Boolean) ? '' : ' — it goes to your active'}`;
    return `<div class="prompt">${t}<button class="btn" data-act="cancel">Cancel</button></div>`;
  }
  return `<div class="prompt">${esc(note)}</div>`;
}

function render() {
  if (!G) return;
  const P = G.players.p;
  const z = (o, zone, n) => Array.from({ length: n }, (_, i) => slotHTML(o, zone, i)).join('');
  const hand = P.hand.map((id, k) => cardHTML(CARDS[id], {
    sel: sel?.kind === 'hand' && sel.k === k,
    dis: busy || G.active !== 'p' || !placeTargets(G, 'p', id).length, data: `data-hand="${id}" data-k="${k}"`,
  })).join('');
  app.innerHTML = `<div class="game">${hudHTML('e')}
    <div class="zone bench">${z('e', 'b', 3)}</div>
    <div class="zone act">${z('e', 'a', 2)}</div>
    <div class="mid">${esc(G.log[G.log.length - 1] || '—')}</div>
    <div class="zone act">${z('p', 'a', 2)}</div>
    <div class="zone bench">${z('p', 'b', 3)}</div>
    ${hudHTML('p')}${promptHTML()}<div class="hand">${hand}</div></div>`;
}

// ---------- fx ----------
const slotEl = (o, pos) => pos && app.querySelector(`.slot[data-o="${o}"][data-z="${pos.zone}"][data-i="${pos.i}"]`);
function floatAt(el, text, cls) {
  if (!el) return;
  const b = el.getBoundingClientRect(), d = document.createElement('div');
  d.className = `float ${cls}`; d.textContent = text;
  d.style.left = `${b.left + b.width / 2}px`; d.style.top = `${b.top + b.height / 2}px`;
  fxLayer.appendChild(d); setTimeout(() => d.remove(), 950);
}
function fx() {
  for (const e of G.events) {
    const el = slotEl(e.o, e.pos);
    if (e.t === 'dmg') { if (e.n) floatAt(el, `-${e.n}`, e.burn ? 'burn' : 'dmg'); else if (e.shield) floatAt(el, `⛨-${e.shield}`, 'shield'); el?.classList.add('shake'); }
    else if (e.t === 'heal') floatAt(el, `+${e.n}`, 'heal');
    else if (e.t === 'shield') floatAt(el, `⛨+${e.n}`, 'shield');
    else if (e.t === 'burn') floatAt(el, `🔥︎${e.n}`, 'burn');
    else if (e.t === 'ko') { floatAt(el, `KO! +${e.n}◆`, 'ko'); el?.classList.add('flash'); }
    else if (e.t === 'place' || e.t === 'attack') el?.classList.add('flash');
  }
  G.events = [];
}
function banner(text, color) {
  const b = document.createElement('div');
  b.className = 'banner'; b.textContent = text; b.style.color = color || '#fff';
  document.body.appendChild(b); setTimeout(() => b.remove(), 1000);
}

// ---------- drag from hand ----------
let drag = null, suppressClick = false;
app.addEventListener('pointerdown', e => {
  const h = e.target.closest('[data-hand]');
  if (!h || !G || busy || G.active !== 'p' || G.winner) return;
  drag = { id: h.dataset.hand, k: +h.dataset.k, x0: e.clientX, y0: e.clientY, started: false, html: h.outerHTML, w: h.offsetWidth, hh: h.offsetHeight };
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    drag.started = true;
    sel = { kind: 'hand', id: drag.id, k: drag.k };
    render();
    const g = document.createElement('div');
    g.className = 'ghost'; g.innerHTML = drag.html;
    g.style.width = `${drag.w}px`; g.style.height = `${drag.hh}px`;
    document.body.appendChild(g); drag.ghost = g;
  }
  drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot.hl');
  if (over !== drag.over) { drag.over?.classList.remove('drop'); over?.classList.add('drop'); drag.over = over; }
  e.preventDefault();
}, { passive: false });
function endDrag(e) {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.started) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 50);
  d.ghost?.remove();
  const sl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');
  if (sl && sl.dataset.o === 'p' && place(G, 'p', d.id, { zone: sl.dataset.z, i: +sl.dataset.i })) return after();
  sel = null; render();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ---------- taps ----------
function after(msg) { sel = null; if (msg) note = msg; render(); fx(); if (G.winner) showEnd(); }

function onClick(e) {
  if (suppressClick || !G || G.winner) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'end') return endPlayerTurn();
  if (act === 'cancel') { sel = null; return render(); }
  if (act === 'open' && !busy) { if (openSlot(G, 'p')) after('Second active slot open. Anything there attacks next turn.'); return; }

  const h = e.target.closest('[data-hand]');
  if (h) { sel = null; render(); return openPop({ card: h.dataset.hand, k: +h.dataset.k }); }

  const sl = e.target.closest('.slot');
  if (!sl || sl.classList.contains('locked')) { if (sel) { sel = null; render(); } return; }
  const o = sl.dataset.o, zone = sl.dataset.z, i = +sl.dataset.i;
  const st = getSt(o, zone, i);
  if (!busy && G.active === 'p' && sel) {
    if (sel.kind === 'hand' && o === 'p' && place(G, 'p', sel.id, { zone, i })) return after();
    if (sel.kind === 'attack' && o === 'e' && zone === 'a') {
      const t = attackTargets(G, 'p', sel.ai, sel.which).find(x => x.i === i || x.both);
      if (t) { attack(G, 'p', sel.ai, sel.which, t.both ? t : { i }); return after(); }
    }
    if (sel.kind === 'retreat' && o === 'p' && zone === 'b' && swap(G, 'p', sel.ai, i)) return after();
    sel = null; render();
  }
  if (st) openPop({ o, zone, i });
}

// ---------- turns ----------
async function endPlayerTurn() {
  if (busy || G.active !== 'p') return;
  busy = true; sel = null; closePop();
  endTurn(G); render(); fx();
  if (G.winner) return showEnd();
  banner('Rival turn', 'var(--e)');
  await wait(800);
  for (let g = 0; g < 30; g++) {
    const a = bestAction(G, 'e'); if (!a) break;
    if (!doAction(G, 'e', a)) break;
    render(); fx();
    await wait(a.type === 'attack' ? 850 : 600);
    if (G.winner) return showEnd();
  }
  endTurn(G);
  busy = false; note = `Your turn — ${G.players.p.mana} mana.`;
  render(); fx();
  if (G.winner) return showEnd();
  if (pop && !pop.spec.card) drawPop();
  banner('Your turn', 'var(--p)');
}

function showEnd() {
  busy = true; closePop(); render();
  const won = G.winner === 'p';
  const d = document.createElement('div'); d.className = 'center';
  d.innerHTML = `<h1 class="${won ? 'win' : 'lose'}">${won ? 'VICTORY' : 'DEFEAT'}</h1>
    <div style="color:#b5aac6">Shards ${G.players.p.shards} – ${G.players.e.shards} · Round ${G.round}</div>
    <div class="row" style="width:260px"><button class="btn" data-x="menu">Menu</button><button class="btn primary" data-x="again">Rematch</button></div>`;
  d.onclick = e => { const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return; d.remove(); x === 'again' ? startGame() : menu(); };
  document.body.appendChild(d);
}

menu();
