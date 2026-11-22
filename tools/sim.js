import { DEFAULT_DECKS } from '../js/data.js';
import { newGame, play, endTurn, cycle } from '../js/engine.js';
import { bestPlay, cyclePick } from '../js/ai.js';
const N = +process.argv[2] || 400;
function aiTurn(s){ const o=s.active; const cy=cyclePick(s,o); if(cy) cycle(s,o,cy); let g=0; for(let b; (b=bestPlay(s,o)) && g<20; g++) play(s,o,b.id,b.t); endTurn(s); }
const res={}; let rounds=0, maxH=0, stackSizes=[0,0,0,0], plays=0;
for (const [pf,ef] of [['sun','moon'],['moon','sun'],['sun','sun'],['moon','moon']]) {
  let pw=0, stall=0;
  for (let i=0;i<N;i++){
    const s=newGame({pFaction:pf,eFaction:ef,pDeck:DEFAULT_DECKS[pf],eDeck:DEFAULT_DECKS[ef]});
    let t=0; while(!s.winner && t<200){ aiTurn(s); t++;
      for (const row of s.board) for (const st of row) if (st) stackSizes[st.cards.length]++; }
    if(!s.winner) stall++; else if(s.winner==='p') pw++;
    rounds+=s.round;
  }
  res[pf+' vs '+ef]={firstPlayerWin:(pw/N).toFixed(2), stalls:stall};
}
console.log(res, 'avg rounds', (rounds/(4*N)).toFixed(1), 'stack size tile-turns', stackSizes.slice(1));
