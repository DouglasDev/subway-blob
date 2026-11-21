import assert from 'node:assert/strict';
import test from 'node:test';
import { STATIONS, stationIndex, travelDirection } from '../src/sim/route.ts';
import { ENCOUNTERS, squeezeTolerance } from '../src/sim/encounters.ts';
import { Fluid } from '../src/sim/fluid.ts';
import { Grid } from '../src/sim/grid.ts';
import { HOT_VOLUME, Ride, STANDARD_VOLUME, STEP } from '../src/sim/ride.ts';

function assertVolume(fluid: Fluid, mask: Uint8Array) {
  const occupied = new Set(fluid.cells);

  assert.equal(occupied.size, fluid.volume);
  const remaining = new Set(occupied);
  const queue = [fluid.cells[0]];

  remaining.delete(queue[0]);

  for (const id of queue) {
    assert.equal(mask[id], 0);
    const { y } = fluid.grid.point(id);

    assert.ok(y > 0 && y < fluid.grid.height * fluid.grid.cell);

    for (const neighbor of fluid.grid.neighbors.subarray(id * 6, id * 6 + 6)) {
      if (remaining.delete(neighbor)) queue.push(neighbor);
    }
  }

  assert.equal(remaining.size, 0, 'every occupied cell belongs to the same face-connected shape');
}

function maskWith(grid: Grid, cells: number[]) {
  const mask = new Uint8Array(grid.size).fill(1);

  for (const id of cells) mask[id] = 0;

  return mask;
}

test('the opening car forms a connected upright shape with fixed volume', () => {
  const { fluid, mask } = new Ride();

  assertVolume(fluid, mask);
  const heights = fluid.cells.map((id) => fluid.grid.point(id).y);

  assert.ok(Math.max(...heights) > 1.4);
  assert.ok(Math.min(...heights) < 0.2);
  assert.equal(fluid.pressure, 0);
});

test('fluid escapes through a one-cell aperture and respects its travel budget', () => {
  const grid = new Grid(8, 3, 3);
  const fluid = new Fluid(grid, 3, -0.3, 0, 2);
  const line = Array.from({ length: 8 }, (_, x) => grid.index(x, 1, 1));
  const start = [line[0], line[1], line[2]];
  const narrow = maskWith(grid, [...line.slice(2), grid.index(6, 0, 1)]);

  assert.ok(fluid.step(maskWith(grid, start)));
  assert.ok(fluid.step(narrow, 0.1));

  assert.deepEqual(
    [...fluid.cells].sort((a, b) => a - b),
    line.slice(2, 5),
  );

  assertVolume(fluid, narrow);
});

test('diagonal and distant air cannot rescue a trapped blob', () => {
  const grid = new Grid(8, 3, 3);
  const fluid = new Fluid(grid, 2, -0.3, 0);
  const pocket = [grid.index(0, 2, 1), grid.index(1, 2, 1)];

  assert.ok(fluid.step(maskWith(grid, pocket)));
  const diagonal = grid.index(2, 2, 2);
  const distant = grid.index(7, 2, 1);
  const blocked = maskWith(grid, [pocket[0], diagonal, distant, grid.index(6, 2, 1)]);

  assert.equal(fluid.step(blocked), false);

  assert.deepEqual(
    new Set(fluid.cells),
    new Set(pocket),
    'failure retains the last legal full-volume shape',
  );
});

test('the lid permits exactly enough cells and one cell less cannot fit', () => {
  const grid = new Grid(5, 2, 3);
  const fluid = new Fluid(grid, 3, 0, 0);
  const ceiling = [1, 2, 3].map((x) => grid.index(x, grid.height - 1, 1));
  const exactlyEnough = maskWith(grid, ceiling);

  assert.equal(grid.index(1, grid.height, 1), -1);
  assert.ok(fluid.step(exactlyEnough));
  assertVolume(fluid, exactlyEnough);
  assert.equal(fluid.step(maskWith(grid, ceiling.slice(1))), false);
});

function play(steer: number, frame: number, checkVolume = false) {
  const ride = new Ride(12071);

  ride.start();

  for (let wall = 0; wall < 270; wall += frame) {
    const previousScore = ride.score;

    ride.advance(frame, { x: steer, z: 0 });

    if (ride.phase === 'popped') assert.equal(ride.score, previousScore);

    if (checkVolume && Math.floor(ride.time * 20) % 4 === 0) assertVolume(ride.fluid, ride.mask);
    if (ride.phase === 'popped') break;
  }

  return ride;
}

test('a full 4 train ride preserves the legal volume and awards no point for a pop', () => {
  const idle = play(0, STEP, true);

  assert.equal(idle.phase, 'popped');
  assert.ok(idle.score === idle.stop || idle.score === idle.stop + 1);
  assert.ok(idle.score > 3 && idle.score < STATIONS.length);
  assert.equal(idle.tolerance, 0);
});

test('the opening crowd is distributed and the first 4 train stop stays gentle', () => {
  const ride = new Ride();

  const counts = () =>
    Array.from(
      { length: 5 },
      (_, index) =>
        ride.crowd.riders.filter(
          (rider) => Math.min(4, Math.floor((rider.x + 4.8) / 1.92)) === index,
        ).length,
    );

  assert.equal(ride.crowd.onboard, 12);
  assert.ok(Math.min(...counts()) >= 2);
  ride.start();
  let peak = 0;

  for (let tick = 0; tick < 250 && ride.score === 0 && ride.phase !== 'popped'; tick++) {
    ride.tick({ x: 0, z: 0 });
    peak = Math.max(peak, ride.fluid.pressure);
  }

  assert.equal(ride.score, 1);
  assert.equal(ride.crowd.onboard, 20);
  assert.ok(Math.min(...counts()) >= 3);
  assert.ok(peak < 0.35);
});

test('different render rates produce the same ride outcome', () => {
  const slow = play(0, 1 / 30);
  const fast = play(0, 1 / 120);

  assert.equal(slow.phase, 'popped');
  assert.equal(slow.phase, fast.phase);
  assert.equal(slow.time, fast.time);
  assert.equal(slow.score, fast.score);
  assert.deepEqual(slow.fluid.cells, fast.fluid.cells);
});

test('sustained squeeze drains in 30 seconds, moderate pressure drains slowly, and low squeeze heals', () => {
  let tolerance = 1;

  for (let tick = 0; tick < 599; tick++) tolerance = squeezeTolerance(tolerance, 0.75, STEP);

  assert.ok(tolerance > 0);
  assert.ok(squeezeTolerance(tolerance, 0.75, STEP) < 1e-10);
  const moderate = squeezeTolerance(0.5, 0.65, STEP);

  assert.ok(moderate < 0.5);
  assert.ok(moderate > squeezeTolerance(0.5, 0.75, STEP));
  assert.ok(squeezeTolerance(0.5, 0.65, STEP, true) < moderate);

  for (let tick = 0; tick < 300; tick++) tolerance = squeezeTolerance(tolerance, 0, STEP);

  assert.equal(tolerance, 1);
});

test('a no-fit tick keeps full volume and allows steering before the crowd retries', () => {
  const ride = new Ride();

  ride.start();
  const rasterize = ride.crowd.occupy.bind(ride.crowd);

  ride.crowd.occupy = (_grid, mask) => {
    mask.fill(1);
  };

  const before = ride.fluid.x;

  ride.tick({ x: 1, z: 0 });
  assert.equal(ride.phase, 'arriving');
  assert.ok(ride.squeeze > 0 && ride.squeeze < 1);
  assert.ok(ride.tolerance < 1);
  assert.ok(ride.fluid.x > before);
  assertVolume(ride.fluid, ride.mask);

  ride.crowd.occupy = rasterize;
  ride.tick({ x: 1, z: 0 });
  assert.ok(ride.squeeze < 1);
});

test('AC grows the blob and the next door opening restores the standard volume', () => {
  const ride = new Ride();

  ride.schedule.clear();
  ride.schedule.set(0, 'ac');
  ride.start();

  while (ride.time < 4) ride.tick({ x: 0, z: 0 });

  assert.equal(ride.fluid.volume, HOT_VOLUME);
  assertVolume(ride.fluid, ride.mask);

  while (ride.stop === 0 || ride.phase === 'arriving') ride.tick({ x: 0, z: 0 });

  assert.equal(ride.fluid.volume, STANDARD_VOLUME);
  assert.equal(ride.encounter, null);
  assertVolume(ride.fluid, ride.mask);
});

test('seeded encounters replay and the three acts appear early', () => {
  const a = new Ride(22);
  const b = new Ride(22);

  assert.deepEqual([...a.schedule], [...b.schedule]);
  assert.notDeepEqual([...a.schedule], [...new Ride(12071).schedule]);
  assert.equal(a.schedule.size, Object.keys(ENCOUNTERS).length);
  assert.ok(!a.schedule.has(0));

  assert.deepEqual(
    new Set([a.schedule.get(1), a.schedule.get(2), a.schedule.get(4)]),
    new Set(['acrobat', 'musician', 'prank']),
  );

  assert.equal(a.schedule.get(5), 'takes');
  assert.ok(!a.schedule.has(6));
});

test('the train reverses at both terminals and keeps counting stops', () => {
  const length = STATIONS.length;

  assert.equal(stationIndex(length - 1), length - 1);
  assert.equal(stationIndex(length), length - 2);
  assert.equal(travelDirection(length - 1), -1);
  assert.equal(stationIndex((length - 1) * 2), 0);
  assert.equal(travelDirection((length - 1) * 2), 1);
  const ride = new Ride();

  ride.stop = length - 1;
  ride.score = length - 1;
  ride.start();

  for (let tick = 0; tick < 600 && ride.stop < length; tick++) ride.tick({ x: 0, z: 0 });

  assert.equal(ride.stop, length);
  assert.equal(ride.station, length - 2);
  assert.equal(ride.score, length);
  assert.equal(ride.phase, 'arriving');
});

test('the opening ride shows all three acts and a series of different SubwayTakes', () => {
  const ride = new Ride(12071);
  const acts = new Set();
  const takes = new Set();

  ride.start();

  for (let tick = 0; tick < 3000 && ride.stop < 7; tick++) {
    ride.tick({ x: 0, z: 0 });
    if (ride.act) acts.add(ride.act.role);
    if (ride.encounter?.kind === 'takes' && ride.speech?.startsWith('Rider:'))
      takes.add(ride.speech);
  }

  for (const kind of ['acrobat', 'musician', 'prank']) assert.ok(acts.has(kind));
  assert.ok(takes.size >= 7);
  assert.ok(ride.tolerance < 0.9);
});

test('one pickup is spawned per stop, full slots leave it in place, and use frees a slot', () => {
  const ride = new Ride();

  ride.start();

  while (!ride.pickup && ride.time < 3) ride.tick({ x: 0, z: 0 });

  assert.ok(ride.pickup);
  const location = ride.car.grid.point(ride.fluid.cells[0]);

  ride.pickup = { ...location, power: 'gross' };
  ride.inventory[0] = 'crazy';
  ride.inventory[1] = 'crazy';
  ride.tick({ x: 0, z: 0 });
  assert.ok(ride.pickup);
  ride.usePower(1);
  ride.tick({ x: 0, z: 0 });
  assert.equal(ride.inventory[1], 'gross');
  assert.equal(ride.pickup, null);
  ride.tick({ x: 0, z: 0 });
  assert.equal(ride.pickup, null);
});

test('power-up exits wait for open doors and departures update the rider count', () => {
  const ride = new Ride();
  const { crowd } = ride;
  const rider = crowd.riders[0];
  const original = rider.id;

  crowd.react('crazy', rider, 0, false);
  assert.ok(rider.wantsExit);
  assert.equal(rider.trajectory, undefined);
  crowd.prepare(0);
  assert.ok(crowd.riders.find(({ id }) => id === original)?.trajectory?.exits);

  for (let step = 0; step < 60; step++) {
    crowd.update(STEP, step * STEP, ride.fluid, ride.car.grid, ride.car.fixtures);
    crowd.commitDepartures();
  }

  assert.ok(!crowd.riders.some(({ id }) => id === original));
  assert.ok(crowd.exited >= 1);
});

test('a moved suitcase pulls its owner to a new standing position', () => {
  const ride = new Ride();
  const { crowd, car } = ride;
  const rider = crowd.riders[0];

  crowd.riders = [rider];
  rider.x = -1;
  rider.z = 0.32;
  rider.prop = { kind: 'suitcase', x: -0.69, z: 0.32 };
  const origin = { x: -1.13, z: 0.32 };

  crowd.tryPush(origin, 0.1, 0, car.grid, car.fixtures);
  assert.ok(rider.prop.x > -0.69);
  const before = rider.x;

  for (let step = 0; step < 8; step++)
    crowd.update(STEP, step * STEP, ride.fluid, car.grid, car.fixtures);

  assert.ok(rider.x > before);
});

test('performers shift the nearby crowd and queue to exit when the encounter expires', () => {
  const ride = new Ride();
  const { crowd, car } = ride;
  const [actor, neighbor] = crowd.riders;

  crowd.riders = [actor, neighbor];
  actor.role = 'acrobat';
  actor.x = -1.6;
  actor.z = -0.24;
  actor.slot = { ...actor.slot, x: actor.x, z: actor.z };
  neighbor.x = -1.0;
  neighbor.z = -0.3;
  neighbor.slot = { ...neighbor.slot, x: neighbor.x, z: neighbor.z };

  for (let step = 0; step < 40; step++)
    crowd.update(STEP, step * STEP, ride.fluid, car.grid, car.fixtures);

  assert.ok(neighbor.z < -0.45);
  crowd.endEncounter();
  assert.equal(crowd.performer, undefined);
  assert.ok(actor.wantsExit);
});
