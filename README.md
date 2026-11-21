# Subway Blob

Steer a shape-changing blob through a northbound NYC 1 train, from South Ferry to 59 St–Columbus Circle. Use WASD, the arrow keys, or the on-screen movement pad. You score a stop when the doors close with your blob intact. Each stop takes on more riders than it lets off. The same boarding pattern repeats on every retry, and your best score is stored in the browser.

## Run locally

Use Node.js 24 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The Vite server listens on loopback. Open the local URL printed by the server in a browser with WebGL2.

## Simulation

The blob occupies 245 face-connected cells on a 10 cm grid, for a fixed simulated volume of 0.245 m³. The grid stops at 1.7 m above the floor and ends at the sides of the car. At each 20 Hz step the solver searches the previous occupied cells and up to two layers of adjacent open cells. It picks a connected group that fits the full volume and favors an upright silhouette near the steering position. The exposed cell faces form the rendered body. Its vertices are rounded for display while the solver keeps the full cell volume. The opening car holds 12 riders spread along its length, growing to 20 at South Ferry.

Passengers follow scripted boarding paths. Layered collision proxies approximate legs, torsos, and heads, and reserve more room around riders as the crowd packs in. The Squeeze gauge shows how much of the blob's upright shape is blocked or beyond reach. A pop means the blob cannot fit its full volume into the connected space it can reach on that step.

Station names and order follow the [MTA subway map](https://www.mta.info/map/5256). Travel and boarding times are compressed for gameplay.

## Verify

```sh
pnpm test
pnpm run format
pnpm run format:check
pnpm run typecheck
pnpm run build
```
