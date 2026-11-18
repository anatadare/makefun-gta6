# Solmara

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/anatadare/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/anatadare/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in a sun-soaked coastal city, built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

You play Mars Delgado, a getaway driver back in Solmara. Take jobs from Lena the fixer and Otis the garage owner across seven story missions, then keep earning with repeatable fares. Explore the city on foot and by car, steal any car you see, outrun the Solmara PD as your wanted level climbs, and stay out of jail.

What is in the game:

- A city to explore: streets, blocks, a park, a plaza, a market, the docks, and a beach with umbrellas, sunbathers and open water
- Traffic that drives the streets and pulls over for sirens; pedestrians who walk the sidewalks, pause to look around, and run when shots ring out
- Cars to steal and drive: sedans, coupes, vans, pickups and a sports car, each with its own handling; off-road ground slows you down
- A wanted level (1-5 stars) with police cars that chase, cut you off and swing for your rear quarter, and foot cops who arrest or shoot; lose them at the Palm Heights hideout or pay Otis to clean your ride
- Seven story missions with objectives, timed drops, a getaway, a five-stop sprint race and a payback job where you wreck two police Interceptors, plus a free-roam fare mode after the story
- Eight hidden cash stashes to find around the city, and a garage that repairs your car
- Combat on foot: aim with the mouse, shoot, or punch
- A HUD with a live minimap, wanted stars, health, car condition, money, speed, the current objective with a timer bar, and a flash when the heat rises
- Effects: skid marks, tire smoke, dust, explosions with shockwave rings, burnt wrecks, screen shake, drifting cloud shadows, and a camera that pulls back at speed
- A start screen, pause with your stats, wasted and busted screens, and a save (money, mission progress, stashes, cars stolen) in localStorage
- Sound synthesized live with WebAudio: engine hum, sirens, shots, skids, explosions, paydays, a wanted sting, and a bass groove with a lead line

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests: the game is plain static files under `game/`.

Controls: WASD or arrows to move and drive, mouse to aim, click to shoot, F to punch, E to steal/enter/exit a car, Space for the handbrake, Shift to sprint, P to pause, M to mute.

---

<sub>Entered on [make.fun](https://make.fun/?ref=x5qvvfcq&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
