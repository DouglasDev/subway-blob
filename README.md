# Subway Blob

Ride the 4 between 149 St–Grand Concourse and Crown Hts–Utica Av. The train turns around at either end and keeps going until you pop. Steer a fixed-volume blob through a car that gets more crowded at each stop. You score when the doors close with your blob intact. A fresh ride randomizes pickups and encounters. Add `?seed=12071` to the standalone URL to replay a known layout and event schedule.

## Run locally

Use Node.js 24 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the loopback URL printed by Vite in a browser with WebGL2.

## Controls

| Platform     | Steer                | Start or retry        | Use the two held pickups | Toggle sound    |
| ------------ | -------------------- | --------------------- | ------------------------ | --------------- |
| Desktop      | WASD or arrows       | Enter or Start ride   | Z and X                  | M or Sound      |
| Touchscreens | Bottom-left joystick | Start ride            | Bottom-right A and B     | Sound in header |
| RCade        | Player 1 joystick    | A or one-player start | A and B                  | —               |

RCade’s web player maps the virtual controls to WASD, F, G, and 1 by default. Add `?cabinet` locally to preview the 336 × 262 layout. The 4 train has its own best score. On the cabinet the score lasts for the current game session.

## Simulation

The standard blob occupies 245 face-connected 10 cm cells. During an AC outage it can grow to 306 cells. Rider movement that cannot fit the blob is deferred while the player can still steer. Nearby crowds and blocked space raise squeeze. Moderate squeeze drains tolerance gradually, sustained high squeeze takes 30 seconds to pop a full blob, and finding room restores it. The blob’s color pulses faster as Squished rises. Crowding gets tougher on subsequent stops and the encounter lineup cycles throughout the ride. Crowd-affecting power-ups work on passengers and special guests, who share a departure limit at each stop. Every four to six stops, a lighter boarding wave gives well-timed power-ups a chance to reduce the rider count. Rider departures, props, pickup collisions, and timed encounters update in the 20 Hz simulation.

[The MTA 4 train schedule](https://www.mta.info/schedules/subway/4-train) supplies the route. See [audio credits](AUDIO.md) for field recordings and edits.

## Verify and publish

```sh
pnpm run format
pnpm run format:check
pnpm run typecheck
pnpm test
pnpm run build
```

Run a scripted balance profile with `node --experimental-transform-types tests/balance-profile.mjs 14 skilled`. The profiles are `idle`, `casual`, and `skilled`. The nine calibration seeds are 14, 42, 315, 824, 2026, 4096, 7219, 12071, and 24680.

Every push to `main` runs one GitHub Actions workflow that builds and tests the game, then deploys the same build to [GitHub Pages](https://douglasdev.github.io/subway-blob/) and [RCade](https://rcade.dev/games/subway-blob). You can also run **Publish Subway Blob** manually from Actions.

Guest locations are randomized throughout each sixteen-stop stretch, including terminal visits. Dialogue draws from a shuffled list without repeats during a ride. Guest rings and the red soda edge show where those hazards drain tolerance. An ordinary rider only drains tolerance by physically squeezing the blob. The wandering sneezy rider bends forward and sprays droplets with each sneeze. Each station offers one pickup, increasing to two from stop eight. Every other stop from stop thirteen offers a bonus pickup, and some tokens can be out of reach. Late crowds also leave two or three shifting passages. The pickup deck favors Stink Bomb and Slime Spray over Crazy Mode. Annoying Alarm makes riders back off and can send some toward the doors, while OMNY Card Toss draws nearby riders toward the card after it lands. Squished starts at 0% and the blob pops at 100%. Squeeze and hazard damage are 60% higher at the opening stop and taper to their normal rate after six completed stops. Early guest damage carries a further bonus that tapers over five stops. The sticky soda spill spreads over six seconds. Recovery from ordinary squeeze starts after 1.25 seconds in a clear gap. Cool Pack lowers Squished by up to 25 points. Prebiotic Soda restores up to 50 points. Some standing riders look at their phones. Quiet Bubble blocks guest drain and cuts squeeze pressure by 80% for 6.2 seconds. Speed Boost speeds up movement for 10 seconds. Super Fluid narrows the upright blob across its shoulders and stretches it front-to-back, keeping its volume while helping it through tighter gaps for 10 seconds. Slime Spray hits riders in the direction the blob is facing.

Travel between stations takes about 6.5 seconds. The base dwell is 5.3 seconds, with extra time when the doors are still busy. Watch for a loudspeaker, sticky soda, a shoving rider, and a seated rider with oversized legs. Pickup and guest locations are spread across the car.
