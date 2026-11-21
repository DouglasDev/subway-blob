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

| Platform          | Steer             | Start or retry        | Use the two held pickups | Toggle sound     |
| ----------------- | ----------------- | --------------------- | ------------------------ | ---------------- |
| Desktop           | WASD or arrows    | Enter or Start ride   | Z and X                  | M or Sound       |
| Standalone mobile | Directional pad   | Start ride            | Labeled slot buttons     | Sound            |
| RCade             | Player 1 joystick | A or one-player start | A and B                  | Two-player start |

RCade’s web player maps the virtual controls to WASD, F, G, 1, and 2 by default. Add `?cabinet` locally to preview the 336 × 262 layout. The 4 train has its own best score. On the cabinet the score lasts for the current game session.

## Simulation

The standard blob occupies 245 face-connected 10 cm cells. During an AC outage it can grow to 306 cells. Rider movement that cannot fit the blob is deferred while the player can still steer. Nearby crowds and blocked space raise squeeze. Moderate squeeze drains tolerance gradually, sustained high squeeze takes 30 seconds to pop a full blob, and finding room restores it. The blob shows its pressure immediately in its color. Crowding gets tougher on subsequent stops and the encounter lineup cycles throughout the ride. Rider departures, props, pickup collisions, and timed encounters update in the 20 Hz simulation.

[The MTA 4 train schedule](https://www.mta.info/schedules/subway/4-train) supplies the route. See [audio credits](AUDIO.md) for field recordings and edits.

## Verify and publish

```sh
pnpm run format
pnpm run format:check
pnpm run typecheck
pnpm test
pnpm run build
```

Every push to `main` runs one GitHub Actions workflow that builds and tests the game, then deploys the same build to [GitHub Pages](https://douglasdev.github.io/subway-blob/) and [RCade](https://rcade.dev/games/subway-blob). You can also run **Publish Subway Blob** manually from Actions.

Guest locations are randomized throughout each twelve-stop stretch, including terminal visits. Dialogue draws from a shuffled list without repeats during a ride. Staying close to a guest slowly drains tolerance. Each station offers one pickup, increasing to two from stop eight. The pickup deck favors Stink Bomb and Slime Spray over Crazy Mode. Annoying Alarm makes riders back off and can send some toward the doors, while Sell Candy draws them away to a cluster. Cool Pack restores up to 25 squeeze tolerance points and keeps blob volume unchanged. Quiet Bubble blocks guest drain and cuts squeeze pressure by 80% for half a normal stop cycle, about 7.5 seconds. Speed Boost speeds up movement for 10 seconds, and Pocket Fan suppresses smoke and heat penalties for 14 seconds.
