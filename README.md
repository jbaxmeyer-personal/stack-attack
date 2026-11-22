# Stack Attack

Mobile-first web card game POC. 10-card decks, a 4×5 board, and **stacking**: play units on top of your own units — buried cards' bottom strips peek out and their passives go live.

**Play:** https://jbaxmeyer-personal.github.io/stack-attack/

## Rules
- **Deck:** 10 unique cards (pick 10 of a faction's 12). No copies. Spells and dead stacks return to the bottom of your deck.
- **Board:** 4 lanes × 5 rows. Deploy new units in your back 2 rows. Stack onto any of your stacks anywhere (max 3) for 1 less mana.
- **Stacks:** top card is the fighter (its ATK/HP). Buried cards add their **strip** passive. Stacking gives a fresh fighter (damage resets).
- **Death:** kill the fighter → the whole stack dies.
- **Turn:** mana = 3 on turn 1, +1/turn (max 10). Hand refills to 4. Cycle one card per turn. End turn → your stacks advance 1 (Swift: 2).
- **Combat:** attacker strikes first; if it kills the defender it takes no return damage and moves in. Otherwise both trade.
- **Base:** 12 HP. A stack walking off the far edge hits for ATK + Siege + 1 per card in the stack, then returns to the deck.
- Going second: +1 mana on your first turn.

## Keywords (strip passives)
Might (+ATK) · Ward (+max HP) · Siege (+base dmg) · Charge (+ATK when attacking) · Rally (adjacent lanes +ATK) · Regrow (heal each turn) · Thorns (attackers take dmg) · Spark (end of turn ping ahead) · Hex (enemy ahead −ATK) · Drain (heal base on damage)

## Dev
No build step. Static files, ES modules.
```
python3 -m http.server   # then open localhost:8000
node tools/sim.js 400    # AI-vs-AI balance sim (win rates, game length, stack usage)
```
- `js/data.js` cards & keywords · `js/engine.js` rules (DOM-free) · `js/ai.js` heuristic AI · `js/art.js` procedural SVG art · `js/ui.js` rendering/input
