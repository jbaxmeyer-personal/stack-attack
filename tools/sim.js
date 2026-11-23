import { STARTERS, CARDS } from '../js/data.js?v=9';
import { newGame, endTurn, stacks } from '../js/engine.js?v=9';
import { bestAction, doAction } from '../js/ai.js?v=9';
const N = +process.argv[2] || 300;
const decks = Object.entries(STARTERS);
function playGame(pd, ed){
  const s=newGame({pDeck:pd,eDeck:ed}); const st={heights:[0,0,0,0], opens:0, acts:{}};
  let turns=0;
  while(!s.winner && turns<120){ const o=s.active; let g=0,a;
    while((a=bestAction(s,o)) && g++<30){ if(!doAction(s,o,a)) break; st.acts[a.type]=(st.acts[a.type]||0)+1; if(s.winner)break; }
    for(const x of stacks(s,o)) st.heights[x.st.cards.length]++;
    endTurn(s); turns++; }
  st.opens = +s.players.p.open2 + +s.players.e.open2;
  return {s, st};
}
const H=[0,0,0,0], A={}; let rounds=[], opens=0, stalls=0;
for (const [pn,pd] of decks) for (const [en,ed] of decks) {
  let pw=0;
  for(let i=0;i<N;i++){ const {s,st}=playGame(pd.cards, ed.cards);
    if(!s.winner) stalls++; else if(s.winner==='p') pw++;
    rounds.push(s.round); opens+=st.opens; st.heights.forEach((v,k)=>H[k]+=v); for(const k in st.acts) A[k]=(A[k]||0)+st.acts[k]; }
  console.log(`${pn} (first) vs ${en}: first wins ${(pw/N*100).toFixed(0)}%`);
}
rounds.sort((a,b)=>a-b); const G=rounds.length;
console.log('rounds p10/50/90', rounds[G*.1|0], rounds[G/2|0], rounds[G*.9|0], 'stalls', stalls);
console.log('stack height share (1/2/3):', H.slice(1).map(v=>(v/(H[1]+H[2]+H[3])*100).toFixed(0)+'%').join(' '), ' 2nd slot opened per game', (opens/G).toFixed(2));
console.log('actions/game', Object.fromEntries(Object.entries(A).map(([k,v])=>[k,(v/G).toFixed(1)])));
