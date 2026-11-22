# Stack Attack

Mobile-first card-duel POC. Wizard vs wizard: two active slots, a bench of three, and **stacking** — play a card on top of one of your fighters to level it up. Buried cards' bottom strips peek out and their passives go live.

**Play:** https://jbaxmeyer-personal.github.io/stack-attack/ (enable Pages: Settings → Pages → `main` / root)

> The earlier Stormbound-style lanes prototype lives on branch `lanes-v0`.

## Rules
- **Board:** 2 active slots (2nd costs 2◆ to open; whatever's in it can't attack that turn) + 3 bench slots.
- **Summon / stack:** pay a card's cost to put it in an empty slot, or on top of one of your stacks (max 3). The top card is the fighter (attacks + HP); damage carries over when you level up.
- **Strips:** each buried card's strip is a passive. Most are conditional — `If Wild`, `If Stone`, `If 2 actives`. A 3-stack of one tag gains **Resonance** (Wild +2 ATK · Stone +6 HP · Arcane Specials −1◆ · Shadow +2 Burn).
- **Attacks:** each active uses its Basic or Special once per turn; mana is shared. Cards summoned straight into an active can't attack that turn. Guard must be targeted first unless the attacker is Ranged or the attack ignores Guard.
- **Shards:** KO a stack → gain shards equal to its height. First to **5** wins.
- **Mana:** 2 on turn 1, +1/turn (max 8). Going second: +1 mana on your first turn. Player 1 can't attack on turn 1.
- **Retreat:** swap an active with a bench slot for 1◆, once per turn. If you have no active, your healthiest bench stack steps in for free.
- **Deck:** 12 cards, KO'd stacks return to the bottom. Hand refills to 4.

## Cards
24 cards across 4 tags (Wild, Stone, Arcane, Shadow), rarities Common → Epic. Two starter decks: **Troll & Archer** (Stone Guard tanks + Wild shooters) and **Hexfire** (Arcane casters + Shadow burn).

## Dev
No build step — static files, ES modules.
```
python3 -m http.server     # open localhost:8000
node tools/sim.js 300      # AI-vs-AI sim: win rates by deck/seat, game length, stack heights, actions/game
```
`js/data.js` cards · `js/engine.js` rules (DOM-free) · `js/ai.js` heuristic AI · `js/art.js` procedural SVG art · `js/ui.js` UI
