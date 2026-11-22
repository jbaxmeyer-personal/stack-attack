import { DEFAULT_DECKS } from '../js/data.js';
import { newGame, play, endTurn, cycle } from '../js/engine.js';
import { bestPlay, cyclePick } from '../js/ai.js';
let hits=0,dmg=0,games=200,deaths=0,rounds=[];
for(let i=0;i<games;i++){const s=newGame({pFaction:'sun',eFaction:'sun',pDeck:DEFAULT_DECKS.sun,eDeck:DEFAULT_DECKS.sun});
 while(!s.winner){const o=s.active;const cy=cyclePick(s,o);if(cy)cycle(s,o,cy);let b;while((b=bestPlay(s,o)))play(s,o,b.id,b.t);s.events=[];endTurn(s);
  for(const e of s.events){if(e.t==='base'){hits++;dmg+=e.n}if(e.t==='die')deaths++}}
 rounds.push(s.round)}
rounds.sort((a,b)=>a-b);
console.log('hits/game',hits/games,'avg dmg',(dmg/hits).toFixed(1),'deaths/game',deaths/games,'rounds p10/50/90',rounds[20],rounds[100],rounds[180]);
