import { Ride, STEP } from '../src/sim/ride.ts';
import { sodaContains } from '../src/sim/hazards.ts';

const seed = Number(process.argv[2]);
const profile = process.argv[3];
const limit = Number(process.argv[4]) || 40;
const reaction = 0.62;

if (!Number.isInteger(seed) || !['idle', 'casual', 'skilled'].includes(profile)) {
  throw new Error(
    'Usage: node --experimental-transform-types tests/balance-profile.mjs SEED idle|casual|skilled [STOP_LIMIT]',
  );
}

const ride = new Ride(seed);
const rest = { x: 0, z: 0 };
let target = rest;
let openingPeak = 0;
let openingCleared = false;
let readyAt = 0;
let used = 0;
let count = 0;
const trace = [];
let stall = 0;
let last = { x: 0, z: 0 };

const pressure = () => 1 - ride.tolerance;

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function useHeld() {
  if (profile === 'skilled' && ride.score < 5) return;
  const trapped = ride.squeeze > (profile === 'skilled' ? 0.64 : 0.74);
  const danger = ride.guestPressure > 0.35 || ride.sticky;
  const nearRiders = ride.crowd.riders.some((r) => !r.trajectory && distance(r, ride.fluid) < 1.3);
  const priorities = [
    'recovery',
    'cool',
    'shield',
    'fluid',
    'annoy',
    'fart',
    'vomit',
    'crazy',
    'omny',
    'express',
  ];

  const defense = {
    recovery: pressure() >= 0.52,
    cool: pressure() >= 0.33,
    shield: (danger || trapped) && pressure() >= 0.18 && ride.time >= ride.shieldUntil,
    fluid: trapped && ride.time >= ride.fluidUntil,
    express:
      (ride.sticky ||
        stall >= 2 ||
        (distance(target, ride.fluid) > 0.8 && ride.phase === 'doors')) &&
      ride.time >= ride.expressUntil,
  };
  const crowdReady = nearRiders && (trapped || danger || pressure() >= 0.48);

  for (const power of priorities) {
    const slot = ride.inventory.indexOf(power);

    if (slot === -1) continue;
    const use =
      profile === 'casual'
        ? pressure() >= 0.58 && (power === 'cool' || power === 'recovery' || trapped || danger)
        : (defense[power] ?? crowdReady);

    if (!use) continue;
    ride.usePower(slot);
    used++;
    break;
  }
}

function floorOpen(x, z) {
  const { grid, fixtures } = ride.car;
  const id = grid.at(x, 0.26, z);

  return id >= 0 && !fixtures[id];
}

function dangerAt(point) {
  const guest = ride.guestDanger;
  const soda = ride.sodaSpill;
  const guestRisk = guest ? Math.max(0, 1 - distance(point, guest) / (guest.radius + 0.18)) : 0;
  const sodaRisk =
    soda && sodaContains(point.x - soda.x, point.z - soda.z, soda.radius + 0.12) ? 1 : 0;

  return guestRisk + sodaRisk;
}

function predictRisk(point) {
  let sum = 0;

  for (const rider of ride.crowd.riders) {
    const boarding = rider.trajectory && !rider.trajectory.exits && ride.phase === 'doors';
    const loc = boarding ? rider.slot : rider;

    if (loc.z < -1.2) continue;
    const d = distance(point, loc);

    sum += Math.max(0, 1 - d / 0.98) ** 1.2 * (boarding ? 0.66 : 1) * (rider.role ? 1.3 : 1);
    if (d < 0.29) sum += 0.32;
  }

  return (
    sum +
    dangerAt(point) * 4.2 +
    Math.max(0, Math.abs(point.x) - 3.85) * 3 +
    Math.max(0, Math.abs(point.z) - 0.72) * 1.8
  );
}

function choose() {
  const { fluid } = ride;

  if (profile === 'casual') {
    const nearest = ride.pickups
      .filter((p) => distance(p, fluid) < 1.45)
      .sort((a, b) => distance(a, fluid) - distance(b, fluid))[0];

    if (nearest && ride.inventory.includes(null)) return nearest;
    if (ride.squeeze < reaction && ride.guestPressure < 0.65 && !ride.sticky) return fluid;
    const dirs = [
      [-0.83, 0],
      [0.83, 0],
      [0, -0.58],
      [0, 0.58],
    ];

    return (
      dirs
        .map(([x, z]) => ({
          x: Math.max(-3.7, Math.min(3.7, fluid.x + x)),
          z: Math.max(-0.87, Math.min(0.87, fluid.z + z)),
        }))
        .filter((p) => floorOpen(p.x, p.z))
        .sort((a, b) => ride.crowd.congestion(a) - ride.crowd.congestion(b))[0] ?? fluid
    );
  }

  let best = { ...fluid };
  let score = Infinity;
  const pickups = ride.inventory.includes(null) ? ride.pickups : [];
  const options = [best];

  for (let dx = -1.5; dx < 1.6; dx += 0.5) {
    for (const z of [-0.89, -0.51, 0, 0.51, 0.89]) {
      options.push({ x: Math.max(-4.1, Math.min(4.1, fluid.x + dx)), z });
    }
  }

  options.push(...pickups.filter((p) => distance(p, fluid) < 1.8));

  for (const p of options) {
    if (!floorOpen(p.x, p.z)) continue;
    const d = distance(p, fluid);

    if (d > 1.7) continue;
    const halfway = { x: (p.x + fluid.x) / 2, z: (p.z + fluid.z) / 2 };
    const pickup = pickups.some((thing) => distance(thing, p) < 0.23);
    const progress = Math.max(
      0,
      ...pickups.map((thing) =>
        distance(thing, fluid) < 3.3 ? distance(thing, fluid) - distance(thing, p) : 0,
      ),
    );
    const reward = (pickup ? 1.0 : 0) + progress * (ride.squeeze < 0.61 ? 0.82 : 0.28);
    const risk = predictRisk(p) + d * (0.22 + predictRisk(halfway) * 0.1) - reward;
    const adjusted =
      risk +
      (floorOpen(halfway.x, halfway.z) ? 0 : 0.95) +
      (d < 0.24 && (stall >= 2 || ride.squeeze > 0.45) ? 1.2 : 0);

    if (adjusted < score) {
      score = adjusted;
      best = { x: p.x, z: p.z };
    }
  }

  return best;
}

ride.start();

for (let i = 0; ride.phase !== 'popped' && ride.score < limit && i < (limit + 3) * 410; i++) {
  if (profile !== 'idle' && ride.time + 1e-8 >= readyAt) {
    if (distance(last, ride.fluid) < 0.055 && distance(target, ride.fluid) > 0.22) stall++;
    else stall = 0;
    last = { x: ride.fluid.x, z: ride.fluid.z };
    target = choose();
    useHeld();
    readyAt = ride.time + (profile === 'skilled' ? 0.35 : 1.1);
  }

  const dx = target.x - ride.fluid.x;
  const dz = target.z - ride.fluid.z;
  const d = Math.hypot(dx, dz);

  ride.tick(profile === 'idle' || d < 0.095 ? rest : { x: dx / d, z: dz / d });

  if (ride.score < 5 || !openingCleared) {
    openingPeak = Math.max(openingPeak, pressure());
    if (ride.score === 5) openingCleared = true;
  }

  if (ride.score !== count) {
    count = ride.score;
    if (count <= 10 || count % 5 === 0)
      trace.push([
        count,
        Math.round(pressure() * 100),
        ride.crowd.onboard,
        Number(ride.crowd.congestion(ride.fluid).toFixed(2)),
      ]);
  }

  ride.cues.length = 0;
}

console.log(
  JSON.stringify({
    seed,
    profile,
    phase: ride.phase,
    score: ride.score,
    opening: Math.round(openingPeak * 100),
    openingCleared,
    used,
    trace,
  }),
);
