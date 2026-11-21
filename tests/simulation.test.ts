import {
  CANDY_SECONDS,
  candyLocation,
  EXPRESS_SECONDS,
  crowdPressure,
  DOUBLE_PICKUP_STOP,
  powerDeck,
  POWERS,
} from '../src/sim/powers.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene } from 'three';
import { buildBlob } from '../src/render/blobMesh.ts';
import { STATIONS, stationIndex, travelDirection } from '../src/sim/route.ts';
import {
  ENCOUNTERS,
  ENCOUNTER_CYCLE,
  encounterSchedule,
  guestProximity,
  seededRandom,
  squeezeTolerance,
} from '../src/sim/encounters.ts';
import type { Encounter } from '../src/sim/encounters.ts';
import { guestContent, PRANKS } from '../src/sim/guestContent.ts';
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
  assert.ok(idle.score > 3);
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
  ride.schedule.clear();
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

test('every encounter can move across the schedule and two-stop acts reserve their next stop', () => {
  const create = (seed: number) => encounterSchedule(0, seededRandom(seed));

  assert.deepEqual([...create(22)], [...create(22)]);
  const positions = new Map<string, Set<number>>();
  const occupiedStarts = new Set<number>();

  for (let seed = 1; seed <= 128; seed++) {
    const schedule = create(seed);

    assert.equal(schedule.size, Object.keys(ENCOUNTERS).length);

    for (const [stop, kind] of schedule) {
      const starts = positions.get(kind) ?? new Set<number>();

      starts.add(stop);
      occupiedStarts.add(stop);
      positions.set(kind, starts);
      assert.ok(stop + ENCOUNTERS[kind].stops <= ENCOUNTER_CYCLE);
      if (kind === 'takes') assert.ok(!schedule.has(stop + 1));
    }
  }

  assert.equal(occupiedStarts.size, ENCOUNTER_CYCLE);
  for (const starts of positions.values()) assert.ok(starts.size > 6);
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

test('dialogue plays slowly and does not repeat over thirty stops', () => {
  const ride = new Ride(12071);
  const spoken = new Set<string>();
  let previous: string | undefined;
  let when = 0;
  let stage: 'question' | 'take' | 'verdict' | undefined;
  let conversations = 0;
  const actors = new Set();

  ride.start();

  for (let tick = 0; tick < 14000 && ride.stop < 30; tick++) {
    ride.tolerance = 1;
    ride.tick({ x: 0, z: 0 });
    if (ride.act) actors.add(ride.act.role);

    if (!ride.speech) {
      previous = undefined;

      continue;
    }

    if (ride.speech === previous) continue;

    if (ride.encounter?.kind === 'takes') {
      if (ride.speech === "Kareem: What's your take?") {
        assert.ok(stage === undefined || stage === 'verdict');
        stage = 'question';
      } else if (ride.speech.startsWith('Rider: ')) {
        assert.equal(stage, 'question');
        stage = 'take';
        assert.ok(!spoken.has(ride.speech));
        spoken.add(ride.speech);
      } else {
        assert.equal(stage, 'take');
        assert.match(ride.speech, /^Kareem: 100% (agree|disagree)$/);
        stage = 'verdict';
        conversations++;
      }
    } else {
      if (previous && !previous.startsWith('Kareem: ')) assert.ok(ride.time - when >= 5.35 - STEP);
      assert.ok(!spoken.has(ride.speech), ride.speech);
      spoken.add(ride.speech);
    }

    previous = ride.speech;
    when = ride.time;
  }

  assert.equal(ride.stop, 30);
  for (const kind of ['acrobat', 'musician', 'prank', 'takes', 'weird'])
    assert.ok(actors.has(kind));
  assert.ok(spoken.size >= 12);
  assert.ok(conversations >= 4);
});

test('the moves, songs, and pranks rotate through all five choices before repeating', () => {
  const content = guestContent(seededRandom(22));

  assert.equal(PRANKS.length, 5);

  for (const kind of ['acrobat', 'musician', 'prank'] as const) {
    const first = Array.from({ length: 5 }, () => content.variant(kind));

    assert.equal(new Set(first).size, 5);
    assert.notEqual(content.variant(kind), first[4]);
  }
});

test('guest proximity drains tolerance, while Cool Pack heals and Quiet Bubble protects', () => {
  const guest = guestProximity(0.4);

  assert.ok(guest > 0.8);
  assert.equal(guestProximity(0.85), 0);
  assert.ok(squeezeTolerance(0.6, 0, 1, false, guest) < 0.6);
  assert.ok(squeezeTolerance(0.6, 0, 1) > 0.6);

  const ride = new Ride();

  ride.schedule.clear();
  ride.start();
  ride.tolerance = 0.5;
  ride.inventory[0] = 'cool';
  ride.usePower(0);
  ride.tick({ x: 0, z: 0 });
  assert.ok(ride.tolerance >= 0.75);
  assert.equal(ride.fluid.volume, STANDARD_VOLUME);

  ride.tolerance = 0.9;
  ride.inventory[0] = 'cool';
  ride.usePower(0);
  ride.tick({ x: 0, z: 0 });
  assert.equal(ride.tolerance, 1);
  ride.inventory[1] = 'shield';
  ride.usePower(1);
  ride.tick({ x: 0, z: 0 });
  const activatedAt = ride.time;

  assert.ok(Math.abs(ride.shieldUntil - activatedAt - 7.44) < 1e-9);

  for (let i = 0; i < 148; i++) ride.tick({ x: 0, z: 0 });

  assert.ok(ride.time < ride.shieldUntil);
  ride.tick({ x: 0, z: 0 });
  assert.ok(ride.time >= ride.shieldUntil);
  assert.deepEqual(ride.inventory, [null, null]);
});

test('a weighted deck favors both gross powers and includes every new pickup', () => {
  const draw = powerDeck(seededRandom(8));
  const total = Object.values(POWERS).reduce((sum, item) => sum + item.weight, 0);
  const all = Array.from({ length: total }, () => draw());

  assert.equal(all.filter((power) => power === 'crazy').length, 1);
  assert.equal(all.filter((power) => power === 'fart').length, 3);
  assert.equal(all.filter((power) => power === 'vomit').length, 3);
  assert.equal(new Set(all).size, 9);

  for (let index = 0; index < 120; index++) {
    const first = draw();

    assert.notEqual(draw(first), first);
  }
});

test('higher stops have two distinct pickups, and full slots leave them available', () => {
  for (const stop of [0, DOUBLE_PICKUP_STOP]) {
    const ride = new Ride();

    ride.stop = stop;
    ride.schedule.clear();
    ride.inventory[0] = 'cool';
    ride.inventory[1] = 'shield';
    ride.start();

    while (ride.pickups.length === 0 && ride.time < 3) ride.tick({ x: 0, z: 0 });

    assert.equal(ride.pickups.length, stop === 0 ? 1 : 2);
    assert.equal(new Set(ride.pickups.map(({ power }) => power)).size, ride.pickups.length);
    const location = ride.car.grid.point(ride.fluid.cells[0]);

    ride.pickups[0] = { ...location, power: 'fart' };
    ride.tick({ x: 0, z: 0 });
    assert.equal(ride.pickups[0].power, 'fart');
    ride.usePower(1);
    ride.tick({ x: 0, z: 0 });
    assert.equal(ride.inventory[1], 'fart');
    assert.equal(ride.pickups.length, stop === 0 ? 0 : 1);
  }
});

test('late crowd pressure is capped and Quiet Bubble helps even during a jam', () => {
  assert.ok(crowdPressure(25, 1, 1) < 0.78);
  assert.ok(crowdPressure(8, 1, 1) < crowdPressure(0, 1, 1));
  const ride = new Ride();

  ride.start();

  ride.crowd.occupy = (_grid, mask) => {
    mask.fill(1);
  };

  ride.tolerance = 0.63;
  ride.inventory[0] = 'shield';
  ride.usePower(0);

  for (let index = 0; index < 20; index++) ride.tick({ x: 0, z: 0 });

  assert.ok(ride.tolerance > 0.67);
  assertVolume(ride.fluid, ride.mask);
});

test('Speed Boost moves faster and Pocket Fan clears AC expansion while active', () => {
  const standard = new Ride();
  const boosted = new Ride();

  standard.start();
  boosted.start();
  boosted.inventory[0] = 'express';
  boosted.usePower(0);
  standard.tick({ x: 1, z: 0 });
  boosted.tick({ x: 1, z: 0 });
  assert.ok(boosted.fluid.x > standard.fluid.x);

  const cooled = new Ride();

  cooled.schedule.clear();
  cooled.schedule.set(0, 'ac');
  cooled.start();
  while (cooled.time < 3) cooled.tick({ x: 0, z: 0 });
  assert.equal(cooled.fluid.volume, HOT_VOLUME);
  cooled.inventory[0] = 'fan';
  cooled.usePower(0);
  cooled.tick({ x: 0, z: 0 });
  assert.equal(cooled.fluid.volume, STANDARD_VOLUME);
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

test('the fluid solver turns the shoulders and legs while preserving connected volume', () => {
  const grid = new Grid(28, 20, 28);
  const mask = new Uint8Array(grid.size);
  const fluid = new Fluid(grid, STANDARD_VOLUME, 0, 0);

  function width(fromY: number, toY: number, axis: 'x' | 'z') {
    const coordinates = fluid.cells
      .map((cell) => grid.point(cell))
      .filter(({ y }) => y >= fromY && y <= toY)
      .map((point) => point[axis]);

    return Math.max(...coordinates) - Math.min(...coordinates);
  }

  assert.ok(fluid.step(mask));
  assert.ok(width(0.65, 1.05, 'x') > width(0.65, 1.05, 'z'));
  assert.ok(width(0.2, 0.5, 'x') > width(0.2, 0.5, 'z'));

  for (let step = 1; step <= 8; step++) {
    assert.ok(fluid.step(mask, 0, 0, STANDARD_VOLUME, (Math.PI * step) / 16));
    assertVolume(fluid, mask);
  }

  assert.ok(width(0.65, 1.05, 'z') > width(0.65, 1.05, 'x'));
  assert.ok(width(0.2, 0.5, 'z') > width(0.2, 0.5, 'x'));
});

test('blob body and eyes finish a turn and keep facing the last direction at rest', () => {
  const ride = new Ride();
  const scene = new Scene();
  const update = buildBlob(scene, ride.fluid, ride.mask);
  const [, leftEye, rightEye] = scene.children[0].children;

  ride.start();
  ride.tick({ x: 1, z: 0 });
  assert.ok(ride.facing > 0 && ride.facing < Math.PI / 2);

  for (let step = 0; step < 4; step++) ride.tick({ x: 0, z: 0 });

  assert.ok(Math.abs(ride.facing - Math.PI / 2) < 1e-9);
  update(false, 0, 0, ride.facing);
  assert.ok(leftEye.visible && rightEye.visible);
  assert.ok(leftEye.position.x > ride.fluid.x && rightEye.position.x > ride.fluid.x);

  for (let step = 0; step < 7; step++) {
    ride.tick({ x: -1, z: 0 });
    assertVolume(ride.fluid, ride.mask);
  }

  assert.ok(Math.abs(Math.sin(ride.facing) + 1) < 1e-9);
  update(false, 0, 0, ride.facing);
  assert.ok(leftEye.visible && rightEye.visible);
  assert.ok(leftEye.position.x < ride.fluid.x && rightEye.position.x < ride.fluid.x);

  const facing = ride.facing;

  ride.tick({ x: 0, z: 0 });
  assert.equal(ride.facing, facing);
});

test('candy stays at the attraction point and Speed Boost expires after ten seconds', () => {
  const ride = new Ride();

  ride.start();
  const location = candyLocation(ride.fluid.x);

  ride.inventory[0] = 'candy';
  ride.inventory[1] = 'express';
  ride.usePower(0);
  ride.usePower(1);
  ride.tick({ x: 1, z: 0 });

  assert.deepEqual(ride.candy, { ...location, until: ride.time + CANDY_SECONDS });
  assert.equal(ride.expressUntil, ride.time + EXPRESS_SECONDS);
  ride.tick({ x: -1, z: 0 });
  assert.deepEqual(ride.candy, { ...location, until: STEP + CANDY_SECONDS });
});

test('each encounter cues one rider reaction two seconds after it starts in the car', () => {
  for (const kind of Object.keys(ENCOUNTERS) as Encounter[]) {
    const ride = new Ride();

    ride.schedule.clear();
    ride.schedule.set(0, kind);
    ride.start();
    let startedAt: number | undefined;
    const reactions: number[] = [];

    for (let tick = 0; tick < 155; tick++) {
      ride.tick({ x: 0, z: 0 });

      if (ride.encounter?.kind === kind && (kind === 'ac' || ride.act?.role === kind))
        startedAt ??= ride.time;

      for (const cue of ride.cues.splice(0)) {
        if (cue !== kind) continue;

        assert.equal(ride.encounter?.kind, kind);
        if (kind !== 'ac') assert.equal(ride.act?.role, kind);
        reactions.push(ride.time);
      }
    }

    assert.notEqual(startedAt, undefined, kind);
    assert.equal(reactions.length, 1, kind);
    assert.ok(Math.abs(reactions[0] - startedAt! - 2) < 1e-8, kind);
  }
});
