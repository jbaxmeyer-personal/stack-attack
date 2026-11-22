import { CARDS, KW, FACTIONS, POOL, DEFAULT_DECKS, DECK_SIZE, traitText, stripText } from './data.js';
import {
  ROWS, COLS, MAX_STACK, newGame, targets, playableTargets, canPlay, play, canCycle, cycle, costAt,
  advanceOrder, advanceStack, sparkPhase, startTurn, other, topCard, buried, kw, hp, maxHp, atk, deployRows, STACK_DISCOUNT,
} from './engine.js';
import { bestPlay, cyclePick } from './ai.js';
import { artSVG } from './art.js';

const app = document.getElementById('app');
const fxLayer = document.getElementById('fx');
const STRIP = 15;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ---------- persistence ----------
function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
let faction = load('sa_faction', 'sun');
let decks = load('sa_decks', DEFAULT_DECKS);
for (const f of Object.keys(DEFAULT_DECKS)) {
  if (!Array.isArray(decks[f]) || decks[f].length !== DECK_SIZE || decks[f].some(id => !CARDS[id] || CARDS[id].faction !== f)) decks[f] = [...DEFAULT_DECKS[f]];
}

// ---------- card rendering ----------
function cardHTML(c, o = {}) {
  const cost = o.cost ?? c.cost;
  const cls = ['card', c.faction, c.type === 'spell' ? 'spell' : '', o.sel ? 'sel' : '', o.dis ? 'dis' : '', o.out ? 'out' : ''].join(' ');
  const data = o.data ? ` ${o.data}` : '';
  let bottom;
  if (c.type === 'unit') bottom = `<div class="cstrip">${esc(stripText(c.strip))}</div>`;
  else bottom = `<div class="ctext">${esc(c.text)}</div>`;
  return `<button class="${cls}"${data}>
    <div class="cart">${artSVG(c)}
      <div class="cost${cost < c.cost ? ' disc' : ''}">${cost}</div>
      <div class="cname">${esc(c.name)}</div>
      ${c.type === 'spell' ? '<div class="stag">SPELL</div>' : ''}
      ${c.type === 'unit' && traitText(c) ? `<div class="ctrait">${esc(traitText(c))}</div>` : ''}
      ${c.type === 'unit' ? `<div class="cbadges"><span class="badge atk">${c.atk}</span><span class="badge hp">${c.hp}</span></div>` : ''}
    </div>${bottom}</button>`;
}

function cardLong(c) {
  if (c.type === 'spell') return `<b>${esc(c.name)}</b> · ${c.cost} mana · Spell\n${esc(c.text)}`;
  const tr = traitText(c);
  return `<b>${esc(c.name)}</b> · ${c.cost} mana · ${c.atk}/${c.hp}${tr ? ' · ' + esc(tr) : ''}\n` +
    `Strip (active when buried): ${esc(stripText(c.strip, true))}`;
}

// ================= MENU =================
function menu() {
  G = null;
  const pick = f => {
    const sample = CARDS[{ sun: 'sunlion', moon: 'nightmother' }[f]];
    return `<button class="fpick ${f} ${faction === f ? 'on' : ''}" data-f="${f}"><div class="fart">${artSVG(sample)}</div>
      <div class="ft"><b>${FACTIONS[f].name}</b><span>${FACTIONS[f].blurb}</span></div></button>`;
  };
  app.innerHTML = `<div class="menu">
    <div class="logo">STACK<br>ATTACK</div>
    <div class="tag">10-card decks · stack units · break the gate</div>
    <div class="factions">${pick('sun')}${pick('moon')}</div>
    <div class="row"><button class="btn" data-act="deck">Edit deck</button><button class="btn primary" data-act="play">Play vs AI</button></div>
    <div class="rules"><b>How it works</b><ul>
      <li>Deploy units in your <b>back 2 rows</b>, or <b>stack</b> a unit on top of any of your stacks (max ${MAX_STACK}) for <b>${STACK_DISCOUNT} less mana</b>.</li>
      <li>The top card fights. Each buried card's <b>bottom strip</b> peeks out — those passives are <b>active</b>.</li>
      <li>Kill the top card and the <b>whole stack</b> dies. Its cards return to the bottom of the deck.</li>
      <li>End turn: your stacks advance 1. Attackers strike first. Reaching the far edge hits the base for ATK + Siege + 1 per card in the stack.</li>
      <li>Mana starts at 3, +1 per turn. Hand refills to 4. Cycle 1 card per turn. Base has 12 HP.</li>
    </ul></div></div>`;
  app.onclick = e => {
    const f = e.target.closest('[data-f]');
    if (f) { faction = f.dataset.f; save('sa_faction', faction); return menu(); }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'play') startGame();
    if (a === 'deck') deckEdit();
  };
}

function deckEdit() {
  let picked = new Set(decks[faction]);
  const draw = () => {
    app.innerHTML = `<div class="menu">
      <div class="dhead"><h2>${FACTIONS[faction].name} deck</h2><b style="color:${picked.size === DECK_SIZE ? '#7dffb0' : '#ff9c6b'}">${picked.size}/${DECK_SIZE}</b></div>
      <div class="tag" style="margin:0;text-align:left">Tap to include/exclude. Pick exactly ${DECK_SIZE} of 12.</div>
      <div class="deckgrid">${POOL(faction).map(id => cardHTML(CARDS[id], { out: !picked.has(id), data: `data-id="${id}"` })).join('')}</div>
      <div class="row"><button class="btn" data-act="reset">Reset</button><button class="btn primary" data-act="done" ${picked.size === DECK_SIZE ? '' : 'disabled'}>Save</button></div>
      <div class="rules" id="dinfo">Tap a card to toggle it — its details show here.</div></div>`;
  };
  draw();
  app.onclick = e => {
    const c = e.target.closest('[data-id]');
    if (c) {
      const id = c.dataset.id;
      picked.has(id) ? picked.delete(id) : picked.add(id);
      draw();
      document.getElementById('dinfo').innerHTML = cardLong(CARDS[id]).replace(/\n/g, '<br>');
      return;
    }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'reset') { picked = new Set(DEFAULT_DECKS[faction]); draw(); }
    if (a === 'done' && picked.size === DECK_SIZE) { decks[faction] = POOL(faction).filter(id => picked.has(id)); save('sa_decks', decks); menu(); }
  };
}

// ================= GAME =================
let G = null;
let sel = null;          // selected hand card id
let busy = false;
let note = '';

function startGame() {
  const ef = faction === 'sun' ? 'moon' : 'sun';
  G = newGame({ pFaction: faction, eFaction: ef, pDeck: decks[faction], eDeck: DEFAULT_DECKS[ef] });
  sel = null; busy = false; note = 'Your turn. Select a card.';
  app.onclick = onGameClick;
  render();
  banner('Your turn', 'var(--p)');
}

function stackHTML(st, r, c) {
  const n = st.cards.length - 1, top = topCard(st);
  const strips = buried(st).map((bc, i) =>
    `<div class="strip ${bc.faction}" style="bottom:${i * STRIP}px;z-index:${i + 1}">${esc(stripText(bc.strip))}</div>`).join('');
  const a = atk(G, r, c), base = top.atk;
  const h = hp(st), mh = maxHp(st);
  return `<div class="stack own-${st.owner}">${strips}
    <div class="fighter" style="bottom:${n * STRIP}px;z-index:10">${artSVG(top)}
      <div class="dir">${st.owner === 'p' ? '▲' : '▼'}</div>
      <span class="badge atk${a > base ? ' up' : ''}">${a}</span>
      <span class="badge hp${h < mh ? ' hurt' : ''}${mh > top.hp ? ' up' : ''}">${h}</span>
      <div class="fs">${esc(top.name)}</div>
    </div></div>`;
}

function hudHTML(o) {
  const P = G.players[o], f = FACTIONS[P.faction];
  const pct = Math.max(0, (P.base / P.maxBase) * 100);
  const on = G.active === o && !G.winner;
  const right = o === 'p'
    ? `<button class="btn" data-act="cycle" ${!busy && sel && canCycle(G, 'p', sel) ? '' : 'disabled'}>Cycle</button>
       <button class="btn primary" data-act="end" ${!busy && on ? '' : 'disabled'}>End turn</button>`
    : `<span class="cnt">✋${P.hand.length} · 🂠${P.deck.length}</span>`;
  return `<div class="hud ${o}" data-hud="${o}">
    <span class="turnflag ${on ? 'on' : ''}">${o === 'p' ? 'YOU' : 'AI'}</span>
    <span class="who">${f.name}</span>
    <div class="basebar"><i style="width:${pct}%"></i><span>♜ ${Math.max(0, P.base)}/${P.maxBase}</span></div>
    <span class="mana"><span class="gem"></span>${P.mana}/${P.maxMana}</span>${right}</div>`;
}

function render() {
  if (!G) return;
  const P = G.players.p;
  const tmap = new Map();
  if (sel && !busy) for (const t of playableTargets(G, 'p', sel)) if (t.kind !== 'none') tmap.set(`${t.r},${t.c}`, t);
  let tiles = '';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const st = G.board[r][c], t = tmap.get(`${r},${c}`);
    const zone = deployRows('p').includes(r) ? 'zone-p' : deployRows('e').includes(r) ? 'zone-e' : '';
    const hl = t ? `hl ${t.kind === 'stack' ? 'stackable' : t.kind === 'spell' ? 'spell' : ''}` : '';
    const disc = t && t.kind === 'stack' ? `<span class="disc">-${STACK_DISCOUNT}◆</span>` : '';
    tiles += `<div class="tile ${zone} ${hl}" data-r="${r}" data-c="${c}">${disc}${st ? stackHTML(st, r, c) : ''}</div>`;
  }
  let detail = esc(note);
  let detailBtn = '';
  if (sel) {
    const c = CARDS[sel];
    detail = cardLong(c);
    const pt = playableTargets(G, 'p', sel);
    if (!pt.length) detail += `\n<span style="color:#ff9c6b">Not enough mana or no target.</span>`;
    else if (c.type === 'spell' && c.target === 'none') detailBtn = `<button class="btn primary" data-act="cast">Cast</button>`;
  }
  const hand = P.hand.map((id, i) => {
    const c = CARDS[id];
    const cheapest = Math.min(c.cost, ...playableTargets(G, 'p', id).map(t => costAt(G, 'p', id, t)));
    return cardHTML(c, { sel: sel === id, dis: !canPlay(G, 'p', id) || busy, cost: Number.isFinite(cheapest) ? cheapest : c.cost, data: `data-hand="${id}"` });
  }).join('');
  app.innerHTML = `<div class="game">${hudHTML('e')}<div class="board">${tiles}</div>${hudHTML('p')}
    <div class="detail"><div class="dt">${detail}</div>${detailBtn}</div><div class="hand">${hand}</div></div>`;
}

function tileEl(r, c) { return app.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`); }
function floatAt(el, text, cls) {
  if (!el) return;
  const b = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = `float ${cls}`; d.textContent = text;
  d.style.left = `${b.left + b.width / 2}px`; d.style.top = `${b.top + b.height / 2}px`;
  fxLayer.appendChild(d); setTimeout(() => d.remove(), 950);
}
function fx() {
  for (const e of G.events) {
    if (e.t === 'dmg') { floatAt(tileEl(e.r, e.c), `-${e.n}`, 'dmg'); tileEl(e.r, e.c)?.classList.add('flash'); }
    else if (e.t === 'heal' && e.n) floatAt(tileEl(e.r, e.c), `+${e.n}`, 'heal');
    else if (e.t === 'base') floatAt(app.querySelector(`[data-hud="${e.o}"] .basebar`), `-${e.n}`, 'base');
    else if (e.t === 'baseHeal') floatAt(app.querySelector(`[data-hud="${e.o}"] .basebar`), `+${e.n}`, 'heal');
    else if (e.t === 'die' || e.t === 'play') tileEl(e.r, e.c)?.classList.add('flash');
  }
  G.events = [];
}
function banner(text, color) {
  const b = document.createElement('div');
  b.className = 'banner'; b.textContent = text; b.style.color = color || '#fff';
  document.body.appendChild(b); setTimeout(() => b.remove(), 1000);
}

function inspect(r, c) {
  const st = G.board[r][c]; if (!st) return;
  const layers = [...st.cards].reverse().map((id, i) => {
    const cd = CARDS[id], isTop = i === 0;
    const role = isTop ? '<span class="role fight">FIGHTER</span>' : '<span class="role on">BURIED · STRIP ACTIVE</span>';
    const extra = isTop && cd.type === 'unit' ? `\n<span class="role off">Its own strip is inactive until something is stacked on it.</span>` : '';
    return `<div class="layer">${cardHTML(cd)}<div class="lt">${role}\n${cardLong(cd)}${extra}</div></div>`;
  }).join('');
  const kws = Object.keys(KW).filter(k => kw(st, k)).map(k => `${KW[k].icon} ${KW[k].name} ${kw(st, k)}`).join(' · ');
  const s = document.createElement('div');
  s.className = 'sheet';
  s.innerHTML = `<div class="box"><h3>${st.owner === 'p' ? 'Your' : 'Enemy'} stack · ${st.cards.length}/${MAX_STACK}</h3>
    <div class="sub">ATK ${atk(G, r, c)} · HP ${hp(G.board[r][c])}/${maxHp(st)}${st.buffAtk ? ` · Blessed +${st.buffAtk} ATK` : ''}${kws ? ' · ' + kws : ''}</div>
    <div class="layers">${layers}</div><div style="text-align:center;margin-top:12px;color:#8a7f99;font-size:12px">Tap anywhere to close</div></div>`;
  s.onclick = () => s.remove();
  document.body.appendChild(s);
}

function onGameClick(e) {
  if (!G || G.winner) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'end') return endPlayerTurn();
  if (act === 'cycle' && sel && !busy) {
    const name = CARDS[sel].name;
    if (cycle(G, 'p', sel)) { note = `Cycled ${name} to the bottom of your deck.`; sel = null; render(); }
    return;
  }
  if (act === 'cast' && sel && !busy) { doPlay(sel, { kind: 'none' }); return; }

  const h = e.target.closest('[data-hand]');
  if (h) { if (busy) return; sel = sel === h.dataset.hand ? null : h.dataset.hand; render(); return; }

  const tile = e.target.closest('.tile');
  if (tile) {
    const r = +tile.dataset.r, c = +tile.dataset.c;
    if (sel && !busy) {
      const t = playableTargets(G, 'p', sel).find(x => x.r === r && x.c === c);
      if (t) return doPlay(sel, t);
    }
    if (G.board[r][c]) inspect(r, c);
    else if (sel) { sel = null; render(); }
  }
}

function doPlay(id, t) {
  const c = CARDS[id];
  if (play(G, 'p', id, t)) {
    sel = null; note = G.log[G.log.length - 1] || `Played ${c.name}`;
    render(); fx();
    if (G.winner) showEnd();
  }
}

async function runEndTurn() {
  const o = G.active;
  for (const id of advanceOrder(G, o)) {
    G.events = [];
    advanceStack(G, id);
    if (G.events.length) { render(); fx(); await wait(280); }
    if (G.winner) return;
  }
  G.events = []; sparkPhase(G, o);
  if (G.events.length) { render(); fx(); await wait(320); }
  if (G.winner) return;
  G.events = []; startTurn(G, other(o));
  render(); fx();
}

async function endPlayerTurn() {
  if (busy || G.active !== 'p') return;
  busy = true; sel = null; note = 'Advancing…';
  render();
  await runEndTurn();
  if (G.winner) return showEnd();
  await aiTurn();
  if (G.winner) return showEnd();
  busy = false;
  note = `Your turn — ${G.players.p.mana} mana.`;
  render();
  banner('Your turn', 'var(--p)');
}

async function aiTurn() {
  banner('Enemy turn', 'var(--e)');
  await wait(800);
  const cy = cyclePick(G, 'e'); if (cy) cycle(G, 'e', cy);
  for (let guard = 0; guard < 20; guard++) {
    const b = bestPlay(G, 'e'); if (!b) break;
    G.events = [];
    play(G, 'e', b.id, b.t);
    note = G.log[G.log.length - 1];
    render(); fx();
    await wait(750);
    if (G.winner) return;
  }
  note = 'Enemy advances…'; render();
  await wait(250);
  await runEndTurn();
}

function showEnd() {
  render();
  const won = G.winner === 'p';
  const d = document.createElement('div');
  d.className = 'center';
  d.innerHTML = `<h1 class="${won ? 'win' : 'lose'}">${won ? 'VICTORY' : 'DEFEAT'}</h1>
    <div style="color:#b5aac6">Round ${G.round}</div>
    <div class="row" style="width:260px"><button class="btn" data-x="menu">Menu</button><button class="btn primary" data-x="again">Rematch</button></div>`;
  d.onclick = e => {
    const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return;
    d.remove(); x === 'again' ? startGame() : menu();
  };
  document.body.appendChild(d);
}

menu();
