import { CARDS, TAGS, RARITY, STARTERS, KW_HELP, stripText, fxText } from './data.js';
import {
  WIN_SHARDS, MAX_STACK, OPEN_COST, RETREAT_COST, newGame, endTurn, other, topCard, buried, mods, hp, maxHp,
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

// ---------- card text ----------
const atkLine = (a, cost = a.cost, dmg = a.dmg) => `<b>${esc(a.name)}</b> ${cost}◆${dmg ? ` · ${dmg} dmg` : ''}${fxText(a.fx) ? ` · ${esc(fxText(a.fx))}` : ''}`;
function cardFull(c) {
  const kws = [c.kw.guard && 'Guard', c.kw.ranged && 'Ranged'].filter(Boolean).join(', ');
  return `<b>${esc(c.name)}</b> · <span style="color:${RARITY[c.rarity].color}">${RARITY[c.rarity].name}</span> · <span style="color:${TAGS[c.tag].color}">${TAGS[c.tag].name}</span> · ${c.cost}◆ · ${c.hp} HP${kws ? ' · ' + kws : ''}<br>` +
    `Basic: ${atkLine(c.basic)}<br>Special: ${atkLine(c.special)}<br>` +
    `<span style="color:${TAGS[c.tag].color}">Strip</span> (when buried): ${esc(stripText(c.strip))}`;
}
function cardHTML(c, o = {}) {
  const cls = ['card', c.tag, o.sel ? 'sel' : '', o.dis ? 'dis' : ''].join(' ');
  const kws = [c.kw.guard && '<span class="chip guard">G</span>', c.kw.ranged && '<span class="chip ranged">R</span>'].filter(Boolean).join('');
  return `<button class="${cls}" ${o.data || ''}>
    <div class="cart">${artSVG(c)}<div class="cost">${c.cost}</div><div class="rar" style="background:${RARITY[c.rarity].color}"></div>
      <div class="cname">${esc(c.name)}</div><div class="kw">${kws}</div><span class="hpb">${c.hp}</span></div>
    <div class="cstrip">${esc(stripText(c.strip))}</div></button>`;
}

// ================= MENU =================
function menu() {
  G = null;
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
      <li>You have <b>2 active slots</b> (the 2nd costs ${OPEN_COST}◆ to open, and can't attack the turn you open it) and a <b>bench of 3</b>.</li>
      <li>Summon a card to an empty slot, or <b>stack</b> it on top of one of yours (max ${MAX_STACK}). The top card fights with its attacks and HP; damage carries over.</li>
      <li>Buried cards' <b>strips</b> peek out underneath — those passives are live. Most are conditional (e.g. "If Wild"). A 3-stack of one tag gains <b>Resonance</b>.</li>
      <li>Each active can use its <b>Basic</b> or <b>Special</b> once a turn. Mana is shared. Cards summoned straight into an active slot can't attack that turn.</li>
      <li>KO a stack → you gain <b>shards = its height</b>. Tall stacks hit hard but are worth more. First to <b>${WIN_SHARDS}</b> wins.</li>
      <li>Retreat (swap an active with the bench) costs ${RETREAT_COST}◆, once per turn. Mana: 2 on turn 1, +1 per turn.</li>
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
    <div class="deckgrid">${STARTERS[deckName].cards.map(id => cardHTML(CARDS[id], { data: `data-id="${id}"` })).join('')}</div>
    <div class="rules" id="dinfo">Tap a card for details.</div></div>`;
  app.onclick = e => {
    const c = e.target.closest('[data-id]');
    if (c) { document.getElementById('dinfo').innerHTML = cardFull(CARDS[c.dataset.id]); return; }
    if (e.target.closest('[data-act=back]')) menu();
  };
}

// ================= GAME =================
let G = null;
let sel = null;   // {kind:'hand', id} | {kind:'attacker', ai} | {kind:'attack', ai, which} | {kind:'retreat', ai}
let busy = false, note = '';

function startGame() {
  const enemy = Object.keys(STARTERS).find(n => n !== deckName) || deckName;
  G = newGame({ pDeck: STARTERS[deckName].cards, eDeck: STARTERS[enemy].cards });
  sel = null; busy = false; note = 'Summon your first fighter into the active slot.';
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
  if (sel.kind === 'attack' && o === 'e' && zone === 'a') {
    const ts = attackTargets(G, 'p', sel.ai, sel.which);
    return ts.some(t => t.i === i || t.both) ? 'hl target' : '';
  }
  if (sel.kind === 'retreat' && o === 'p' && zone === 'b') return canSwap(G, 'p', sel.ai, i) ? 'hl' : '';
  if ((sel.kind === 'attacker' || sel.kind === 'attack' || sel.kind === 'retreat') && o === 'p' && zone === 'a' && sel.ai === i) return 'selected';
  return '';
}

function slotHTML(o, zone, i) {
  const P = G.players[o];
  const st = zone === 'a' ? P.active[i] : P.bench[i];
  if (zone === 'a' && i === 1 && !P.open2) {
    const btn = o === 'p' ? `<button class="btn" data-act="open" ${!busy && canOpen(G, 'p') ? '' : 'disabled'}>Open · ${OPEN_COST}◆</button>` : '';
    return `<div class="slot locked" data-o="${o}" data-z="a" data-i="1">🔒︎ 2nd active${btn}</div>`;
  }
  let extra = '';
  if (st && o === 'p' && zone === 'a' && G.active === 'p' && !busy) {
    const can = canAttackerAct(G, 'p', i);
    const any = can && ['basic', 'special'].some(w => attackTargets(G, 'p', i, w).length);
    if (any) extra = '<span class="ready">READY</span>';
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
    <div class="shards" title="shards">${sh}</div><span class="mana"><span class="gem"></span>${P.mana}/${P.maxMana}</span>${right}</div>`;
}

function panelHTML() {
  if (busy || G.active !== 'p') return `<div class="pt">${esc(note)}</div>`;
  if (!sel) return `<div class="pt">${esc(note)}<br><span style="color:#8a7f99">Tap a card to summon/stack · tap your active to attack · tap any stack for details</span></div>`;
  if (sel.kind === 'hand') {
    const c = CARDS[sel.id];
    const ok = placeTargets(G, 'p', sel.id).length;
    return `<div class="pt">${cardFull(c)}${ok ? '' : '<br><span style="color:#ff9c6b">Not enough mana or no open slot.</span>'}</div>`;
  }
  const st = G.players.p.active[sel.ai]; if (!st) return '';
  const top = topCard(st);
  if (sel.kind === 'attack') return `<div class="pt">Choose a target for <b>${esc(top[sel.which].name)}</b>. Tap your fighter to cancel.</div>`;
  if (sel.kind === 'retreat') return `<div class="pt">Choose a bench slot to swap <b>${esc(top.name)}</b> into (${RETREAT_COST}◆). Tap your fighter to cancel.</div>`;
  const btn = w => {
    const a = top[w], cost = atkCost(G, st, w), dmg = atkDmg(G, st, w), en = attackTargets(G, 'p', sel.ai, w).length > 0;
    return `<button class="atkbtn ${w}" data-atk="${w}" ${en ? '' : 'disabled'}><span class="ac">${cost}◆</span><b>${esc(a.name)}</b><br>${dmg ? dmg + ' dmg' : ''}${dmg && fxText(a.fx) ? ' · ' : ''}${esc(fxText(a.fx))}</button>`;
  };
  const why = !canAttackerAct(G, 'p', sel.ai)
    ? (st.attacked ? 'Already acted this turn.' : st.fresh ? 'Just summoned — can attack next turn.' : G.players.p.turns === 1 ? 'No attacks on the very first turn.' : 'Slot opened this turn — attacks next turn.') : '';
  return `${why ? `<div class="pt" style="color:#ff9c6b">${why}</div>` : ''}<div class="attacks">${btn('basic')}${btn('special')}
    <button class="atkbtn small" data-act="retreat" ${[0, 1, 2].some(b => canSwap(G, 'p', sel.ai, b)) ? '' : 'disabled'}>Retreat<br>${RETREAT_COST}◆</button>
    <button class="atkbtn small" data-act="info">Info</button></div>`;
}

function render() {
  if (!G) return;
  const P = G.players.p;
  const z = (o, zone, n) => Array.from({ length: n }, (_, i) => slotHTML(o, zone, i)).join('');
  const hand = P.hand.map((id, k) => cardHTML(CARDS[id], {
    sel: sel?.kind === 'hand' && sel.id === id && sel.k === k,
    dis: busy || G.active !== 'p' || !placeTargets(G, 'p', id).length, data: `data-hand="${id}" data-k="${k}"`,
  })).join('');
  app.innerHTML = `<div class="game">${hudHTML('e')}
    <div class="zone bench">${z('e', 'b', 3)}</div>
    <div class="zone act">${z('e', 'a', 2)}</div>
    <div class="mid">${esc(G.log[G.log.length - 1] || '—')}</div>
    <div class="zone act">${z('p', 'a', 2)}</div>
    <div class="zone bench">${z('p', 'b', 3)}</div>
    ${hudHTML('p')}<div class="panel">${panelHTML()}</div><div class="hand">${hand}</div></div>`;
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

function inspect(o, zone, i) {
  const st = zone === 'a' ? G.players[o].active[i] : G.players[o].bench[i]; if (!st) return;
  const top = topCard(st), m = mods(G, st);
  const layers = [...st.cards].reverse().map((id, k) => {
    const c = CARDS[id];
    let role;
    if (k === 0) role = '<span class="role fight">FIGHTER · its strip is inactive</span>';
    else role = condMet(G, st, c.strip.if) ? '<span class="role on">BURIED · STRIP ACTIVE</span>' : '<span class="role off">BURIED · STRIP CONDITION NOT MET</span>';
    return `<div class="layer">${cardHTML(c)}<div class="lt">${role}${cardFull(c)}</div></div>`;
  }).join('');
  const live = [m.atk && `+${m.atk} ATK`, m.hp && `+${m.hp} HP`, m.specialDown && `Special -${m.specialDown}◆`, m.basicDown && `Basic -${m.basicDown}◆`,
    m.guard && 'Guard', m.ranged && 'Ranged', m.thorns && `Thorns ${m.thorns}`, m.regen && `Regen ${m.regen}`, m.drain && `Drain ${m.drain}`, m.burnAdd && `+${m.burnAdd} Burn`]
    .filter(Boolean).join(' · ');
  const s = document.createElement('div'); s.className = 'sheet';
  s.innerHTML = `<div class="box"><h3>${o === 'p' ? 'Your' : 'Rival'} ${top.name} · Lv${st.cards.length}${resonant(st) ? ' · RESONANCE' : ''}</h3>
    <div class="sub">HP ${hp(G, st)}/${maxHp(G, st)} · Basic ${atkDmg(G, st, 'basic')} dmg for ${atkCost(G, st, 'basic')}◆ · Special ${atkDmg(G, st, 'special')} dmg for ${atkCost(G, st, 'special')}◆
    ${st.shield ? ` · Shield ${st.shield}` : ''}${st.burn ? ` · Burn ${st.burn}` : ''}<br>${live ? 'Live bonuses: ' + live : 'No live bonuses.'}<br>KO value: <b>${st.cards.length} shard${st.cards.length > 1 ? 's' : ''}</b></div>
    <div class="layers">${layers}</div>
    <div class="sub" style="margin-top:12px">${Object.entries(KW_HELP).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>')}</div>
    <div style="text-align:center;margin-top:8px;color:#8a7f99;font-size:12px">Tap anywhere to close</div></div>`;
  s.onclick = () => s.remove();
  document.body.appendChild(s);
}

// ---------- input ----------
function after(msg) { sel = null; if (msg) note = msg; render(); fx(); if (G.winner) showEnd(); }

function onClick(e) {
  if (!G || G.winner) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'end') return endPlayerTurn();
  if (busy || G.active !== 'p') {
    const sl = e.target.closest('.slot');
    if (sl && !sl.classList.contains('locked')) inspect(sl.dataset.o, sl.dataset.z, +sl.dataset.i);
    return;
  }
  if (act === 'open') { if (openSlot(G, 'p')) after('Second active slot open. Anything there attacks next turn.'); return; }
  if (act === 'info' && sel?.ai !== undefined) return inspect('p', 'a', sel.ai);
  if (act === 'retreat' && sel?.ai !== undefined) { sel = { kind: 'retreat', ai: sel.ai }; return render(); }
  const ab = e.target.closest('[data-atk]');
  if (ab && sel?.ai !== undefined) {
    const which = ab.dataset.atk, ts = attackTargets(G, 'p', sel.ai, which);
    if (ts.length === 1) { attack(G, 'p', sel.ai, which, ts[0]); return after(); }
    sel = { kind: 'attack', ai: sel.ai, which }; return render();
  }
  const h = e.target.closest('[data-hand]');
  if (h) {
    const k = +h.dataset.k;
    sel = sel?.kind === 'hand' && sel.k === k ? null : { kind: 'hand', id: h.dataset.hand, k };
    return render();
  }
  const sl = e.target.closest('.slot');
  if (!sl || sl.classList.contains('locked')) { if (sel) { sel = null; render(); } return; }
  const o = sl.dataset.o, zone = sl.dataset.z, i = +sl.dataset.i;
  const P = G.players.p;
  const st = o === 'p' ? (zone === 'a' ? P.active[i] : P.bench[i]) : (zone === 'a' ? G.players.e.active[i] : G.players.e.bench[i]);

  if (sel?.kind === 'hand' && o === 'p') {
    if (place(G, 'p', sel.id, { zone, i })) return after();
  }
  if (sel?.kind === 'attack' && o === 'e' && zone === 'a') {
    const t = attackTargets(G, 'p', sel.ai, sel.which).find(x => x.i === i || x.both);
    if (t) { attack(G, 'p', sel.ai, sel.which, t.both ? t : { i }); return after(); }
  }
  if (sel?.kind === 'retreat' && o === 'p' && zone === 'b') {
    if (swap(G, 'p', sel.ai, i)) return after();
  }
  if (o === 'p' && zone === 'a' && st) {
    sel = (sel && sel.ai === i && sel.kind !== 'hand') ? null : { kind: 'attacker', ai: i };
    return render();
  }
  if (o === 'p' && zone === 'b' && st && !sel) {
    const ai = [0, 1].find(a => canFill(G, 'p', i, a));
    if (ai !== undefined) { fill(G, 'p', i, ai); return after(); }
  }
  if (st) return inspect(o, zone, i);
  if (sel) { sel = null; render(); }
}

// ---------- turns ----------
async function endPlayerTurn() {
  if (busy || G.active !== 'p') return;
  busy = true; sel = null;
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
  banner('Your turn', 'var(--p)');
}

function showEnd() {
  busy = true; render();
  const won = G.winner === 'p';
  const d = document.createElement('div'); d.className = 'center';
  d.innerHTML = `<h1 class="${won ? 'win' : 'lose'}">${won ? 'VICTORY' : 'DEFEAT'}</h1>
    <div style="color:#b5aac6">Shards ${G.players.p.shards} – ${G.players.e.shards} · Round ${G.round}</div>
    <div class="row" style="width:260px"><button class="btn" data-x="menu">Menu</button><button class="btn primary" data-x="again">Rematch</button></div>`;
  d.onclick = e => { const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return; d.remove(); x === 'again' ? startGame() : menu(); };
  document.body.appendChild(d);
}

menu();
