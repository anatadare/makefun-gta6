# Solmara — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/anatadare/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/anatadare/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01)

Solmara is a 2D top-down open-world crime game built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). You are Riko Vale,
new in the sun-soaked city of Solmara. Sal Ferraro has work for you, Dario
Venn has other plans, and the Solmara PD has opinions about both.

## What is in the game

- A full city to explore on foot and by car: downtown towers, the stadium
  district, the harbor, the marina, Old Town and Southside, with traffic,
  pedestrians, street vendors and joggers.
- 8 story missions with step-through dialogue, ending in the finale heist
  **The Big One** ($2,000 payout).
- A wanted system: 5 stars, cop cars that chase and ram, foot cops that
  arrest, and black veteran interceptors at 4 stars and up.
- Combat: fists and a scattergun (Q swaps), plus health, ammo and cash
  pickups.
- A taxi side job with rush fares, a day/night cycle with headlights and a
  HUD clock, a time-skip key (N), save/load, synthesized WebAudio sound
  (engine, sirens, shots), and end screens with run stats.

## How to play

Serve the game and open it in desktop Chrome:

```
node serve.ts
```

Then open http://localhost:8080. Controls are listed on the title screen:
WASD to move/drive, E to enter cars and interact, Space to punch, Q to swap
weapons, click or F to shoot, N to skip 2 hours, M to mute, P/Esc to pause.

## Layout

- `game/` — the game itself, static files, no build step. `game/index.html`
  is the entry point; `game/src/` holds one module per system.
- `screenshots/` — four screenshots of the game, taken from the game itself.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.
- `serve.ts` — a tiny static server for local play.
- `shots.json` — the screenshot list (scene, wait time, output file).

## License

MIT. Every name, character, place and line of code in Solmara is original.
