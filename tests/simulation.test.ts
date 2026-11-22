import {
  OMNY_FLIGHT,
  OMNY_SECONDS,
  omnyLocation,
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
import {
  brakingLurch,
  trainSpeed,
  travelProgress,
  TRAVEL_SECONDS,
} from '../src/sim/trainMotion.ts';
import { STATIONS, stationIndex, travelDirection } from '../src/sim/route.ts';
import {
  ENCOUNTERS,
  ENCOUNTER_CYCLE,
  encounterSchedule,
  guestProximity,
  hasGuest,
  seededRandom,
  squeezeTolerance,
} from '../src/sim/encounters.ts';
import type { Encounter } from '../src/sim/encounters.ts';
import { guestContent, PRANKS } from '../src/sim/guestContent.ts';
import { Crowd } from '../src/sim/crowd.ts';
import { Fluid } from '../src/sim/fluid.ts';
import {
  GUEST_RADIUS,
  RHINO_PRANK,
  SNEEZE_SECONDS,
  SPREADER_SEATS,
  SPREADER_X,
  SPREADER_Z,
  sprayHits,
} from '../src/sim/hazards.ts';
import { Grid } from '../src/sim/grid.ts';
import { HOT_VOLUME, QUIET_SECONDS, Ride, STANDARD_VOLUME, STEP } from '../src/sim/ride.ts';

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

test('moves, songs, and pranks use every variant before repeating', () => {
  const content = guestContent(seededRandom(22));

  assert.equal(PRANKS.length, 6);

  for (const kind of ['acrobat', 'musician', 'prank'] as const) {
    const length = kind === 'prank' ? PRANKS.length : 5;
    const first = Array.from({ length }, () => content.variant(kind));

    if (kind === 'prank') assert.equal(first[0], RHINO_PRANK);

    assert.equal(new Set(first).size, length);
    assert.notEqual(content.variant(kind), first.at(-1));
  }
});

test('guest proximity drains tolerance, while Cool Pack heals and Quiet Bubble protects', () => {
  const guest = guestProximity(0.4);

  assert.ok(guest > 0.8);
  assert.ok(guestProximity(0.99) > 0);
  assert.equal(guestProximity(GUEST_RADIUS), 0);
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

  assert.ok(Math.abs(ride.shieldUntil - activatedAt - QUIET_SECONDS) < 1e-9);

  for (let i = 0; i < Math.round(QUIET_SECONDS / STEP) - 1; i++) ride.tick({ x: 0, z: 0 });

  assert.ok(ride.time < ride.shieldUntil);
  ride.tick({ x: 0, z: 0 });
  assert.ok(ride.time + 1e-9 >= ride.shieldUntil);
  assert.deepEqual(ride.inventory, [null, null]);
});

test('the opening starts at zero Squished and the extra damage tapers across six stops', () => {
  const ride = new Ride();

  assert.equal(ride.tolerance, 1);
  assert.equal(ride.damageMultiplier, 1.6);
  const firstStop = squeezeTolerance(1, 0.75, 1, false, 0, ride.damageMultiplier);

  ride.score = 3;
  const thirdStop = squeezeTolerance(1, 0.75, 1, false, 0, ride.damageMultiplier);

  ride.score = 6;
  assert.equal(ride.damageMultiplier, 1);
  const sixthStop = squeezeTolerance(1, 0.75, 1, false, 0, ride.damageMultiplier);

  assert.ok(firstStop < thirdStop && thirdStop < sixthStop);
  assert.equal(squeezeTolerance(0.99, 0, 1, false, 0, 1.6), 1);
});

test('the sneezy rider roams and a sneeze damages only while nearby and active', () => {
  const ride = new Ride();
  const rider = ride.crowd.riders[0];

  ride.phase = 'running';
  ride.crowd.riders = [rider];

  Object.assign(rider, {
    x: 0.69,
    z: 0.28,
    role: 'sneezy',
    slot: { ...rider.slot, x: 0.69, z: 0.28 },
  });

  ride.encounter = {
    kind: 'sneezy',
    expires: 1,
    began: 0,
    variant: 0,
    dialogueAt: 0,
    nextSneezeAt: 0.1,
  };

  ride.tick({ x: 0, z: 0 });
  assert.equal(Boolean(ride.guestDanger), false);
  assert.equal(ride.tolerance, 1);

  ride.tick({ x: 0, z: 0 });
  const origin = ride.sneeze;
  const from = ride.tolerance;

  assert.ok(origin);
  assert.equal(ride.guestDanger?.radius, GUEST_RADIUS);
  assert.ok(ride.cues.includes('sneeze'));
  assert.ok(ride.guestPressure > 0);

  for (let step = 0; step < Math.ceil(SNEEZE_SECONDS / STEP); step++) ride.tick({ x: 0, z: 0 });

  assert.ok(ride.tolerance < from);
  assert.ok(Math.abs(rider.x - origin.x) > 0.35);
  assert.equal(Boolean(ride.guestDanger), false);
  assert.equal(ride.guestPressure, 0);

  for (const role of ['acrobat', 'musician', 'shover'] as const) {
    Object.assign(rider, { role, x: 2.6, z: 0.2, slot: { ...rider.slot, x: 2.6, z: 0.2 } });

    for (let step = 0; step < 25; step++) {
      ride.crowd.update(STEP, step * STEP, ride.fluid, ride.car.grid, ride.car.fixtures);
    }

    assert.ok(Math.hypot(rider.x - 2.6, rider.z - 0.2) > 0.17, role);
  }
});

test('a weighted deck favors both gross powers and includes every new pickup', () => {
  const draw = powerDeck(seededRandom(8));
  const total = Object.values(POWERS).reduce((sum, item) => sum + item.weight, 0);
  const all = Array.from({ length: total }, () => draw());

  assert.equal(all.filter((power) => power === 'crazy').length, 1);
  assert.equal(all.filter((power) => power === 'fart').length, 3);
  assert.equal(all.filter((power) => power === 'vomit').length, 3);
  assert.equal(all.filter((power) => power === 'shield').length, 1);
  assert.equal(new Set(all).size, Object.keys(POWERS).length);

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

test('Speed Boost increases steering speed', () => {
  const standard = new Ride();
  const boosted = new Ride();

  standard.start();
  boosted.start();
  boosted.inventory[0] = 'express';
  boosted.usePower(0);
  standard.tick({ x: 1, z: 0 });
  boosted.tick({ x: 1, z: 0 });
  assert.ok(boosted.fluid.x > standard.fluid.x);
});

test('power-up exits wait for open doors and departures update the rider count', () => {
  const ride = new Ride();
  const { crowd } = ride;
  const rider = crowd.riders[0];
  const original = rider.id;

  crowd.react('crazy', rider, 0, false);
  assert.ok(rider.powerExit);
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

test('crowd power-ups move and eject special guests under the regular departure rules', () => {
  const ride = new Ride();
  const { crowd, car, fluid } = ride;
  const singer = crowd.riders[0];

  singer.role = 'musician';
  crowd.prepare(0);
  crowd.react('annoy', singer, 0, true);

  assert.ok(singer.trajectory?.exits);
  assert.equal(crowd.performer, undefined);

  for (let step = 0; step < 60; step++) {
    crowd.update(STEP, step * STEP, fluid, car.grid, car.fixtures);
    crowd.commitDepartures();
  }

  assert.ok(!crowd.riders.includes(singer));
  assert.equal(crowd.exited, 4);

  const seat = SPREADER_SEATS[1];
  const spreader = crowd.riders[0];

  crowd.riders = [spreader];

  Object.assign(spreader, {
    ...seat,
    role: 'spreader',
    trajectory: undefined,
    slot: { ...spreader.slot, ...seat },
  });

  crowd.react('omny', seat, 4, false);
  assert.ok(spreader.away);

  for (let step = 0; step < 15; step++) {
    crowd.update(STEP, 4 + step * STEP, fluid, car.grid, car.fixtures);
  }

  assert.ok(Math.abs(spreader.x - seat.x) > 0.35);
});

test('power-up departures can thin a light stop without reversing crowd growth', () => {
  const { car, fluid } = new Ride();
  const lightStops = new Set<number>();

  for (const seed of [14, 315, 824]) {
    const crowd = new Crowd(seed);
    const counts = [crowd.onboard];
    const lighter: number[] = [];

    const exits = (doors: boolean) => {
      // Use both slots on different parts of the car to reach different riders.
      crowd.react('crazy', { x: -2.7, z: 0 }, 0, doors);
      crowd.react('annoy', { x: 2.7, z: 0 }, 0, doors);
    };

    for (let stop = 0; stop < 16; stop++) {
      if (stop % 2 === 0) exits(false);
      crowd.prepare(stop);
      exits(true);

      for (let step = 0; step < 145; step++) {
        crowd.update(STEP, step * STEP, fluid, car.grid, car.fixtures);
        crowd.commitDepartures();
      }

      crowd.finishDoors();
      const change = crowd.onboard - counts.at(-1)!;

      assert.equal(change, crowd.boarded - crowd.exited);
      assert.notEqual(change, 0);
      counts.push(crowd.onboard);

      if (change < 0) {
        lighter.push(stop);
        lightStops.add(stop);
      }

      if (stop >= 3) assert.ok(counts.at(-1)! > counts[stop - 3]);
    }

    assert.ok(lighter.length >= 2);
    assert.ok(lighter.every((stop, index) => index === 0 || stop - lighter[index - 1] >= 4));
  }

  assert.ok(lightStops.size > 2, 'light boarding waves vary by ride seed');
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

test('an OMNY toss attracts riders and taps on landing while Speed Boost ticks independently', () => {
  const ride = new Ride();

  ride.start();
  const origin = { x: ride.fluid.x, z: ride.fluid.z };
  const location = omnyLocation(origin.x);

  ride.inventory[0] = 'omny';
  ride.inventory[1] = 'express';
  ride.usePower(0);
  ride.usePower(1);
  ride.tick({ x: 1, z: 0 });

  assert.deepEqual(ride.omny, {
    ...location,
    origin,
    began: STEP,
    landsAt: STEP + OMNY_FLIGHT,
    until: STEP + OMNY_FLIGHT + OMNY_SECONDS,
    landed: false,
  });

  assert.equal(ride.expressUntil, ride.time + EXPRESS_SECONDS);
  assert.ok(ride.cues.includes('omny'));
  assert.ok(!ride.cues.includes('omnyLand'));

  for (let i = 0; i < Math.round(OMNY_FLIGHT / STEP) - 1; i++) ride.tick({ x: 0, z: 0 });

  assert.ok(!ride.omny?.landed);
  ride.tick({ x: 0, z: 0 });
  assert.equal(ride.omny?.landed, true);
  assert.equal(ride.omny?.x, location.x);
  assert.equal(ride.cues.filter((cue) => cue === 'omnyLand').length, 1);
  ride.tick({ x: -1, z: 0 });
  assert.equal(ride.cues.filter((cue) => cue === 'omnyLand').length, 1);
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

      if (ride.encounter?.kind === kind && (!hasGuest(kind) || ride.act?.role === kind))
        startedAt ??= ride.time;

      for (const cue of ride.cues.splice(0)) {
        if (cue !== kind) continue;

        assert.equal(ride.encounter?.kind, kind);
        if (hasGuest(kind)) assert.equal(ride.act?.role, kind);
        reactions.push(ride.time);
      }
    }

    assert.notEqual(startedAt, undefined, kind);
    assert.equal(reactions.length, 1, kind);
    assert.ok(Math.abs(reactions[0] - startedAt! - 2) < 1e-8, kind);
  }
});

test('Super Fluid reaches farther through a one-cell passage at the same volume', () => {
  const grid = new Grid(10, 3, 3);
  const fluid = new Fluid(grid, 4, -0.3, 0);
  const line = Array.from({ length: 9 }, (_, x) => grid.index(x, 1, 1));
  const mask = maskWith(grid, line.slice(3));

  assert.ok(fluid.step(maskWith(grid, line.slice(0, 4))));
  assert.equal(fluid.step(mask), false);
  assert.ok(fluid.step(mask, 0, 0, 4, 0, true));
  assertVolume(fluid, mask);

  const ride = new Ride();

  ride.start();
  ride.inventory[0] = 'fluid';
  ride.usePower(0);
  ride.tick({ x: 0, z: 0 });
  assert.equal(ride.fluidUntil - ride.time, 10);
  assert.ok(ride.cues.includes('fluid'));
  assertVolume(ride.fluid, ride.mask);
});

test('Super Fluid lowers the occupied surface without changing volume', () => {
  const { car } = new Ride();
  const fluid = new Fluid(car.grid, STANDARD_VOLUME, 0, 0);
  const mask = new Uint8Array(car.grid.size);

  const top = () => Math.max(...fluid.cells.map((id) => car.grid.centers[id * 3 + 1]));

  assert.ok(fluid.step(mask));
  const standing = top();

  for (let tick = 0; tick < 7; tick++) assert.ok(fluid.step(mask, 0, 0, STANDARD_VOLUME, 0, true));

  assert.ok(top() < standing * 0.55);
  assertVolume(fluid, mask);
});

test('Slime Spray only hits the cone in front of the blob', () => {
  assert.ok(sprayHits(1, 0.2, Math.PI / 2));
  assert.ok(!sprayHits(-1, 0.2, Math.PI / 2));
  assert.ok(!sprayHits(0.2, 1, Math.PI / 2));

  const ride = new Ride();
  const [front, rear] = ride.crowd.riders;

  Object.assign(front, { x: -0.6, z: 0, role: undefined });
  Object.assign(rear, { x: 0.6, z: 0, role: undefined });
  ride.crowd.riders = [front, rear];

  ride.crowd.react('vomit', { x: 0, z: 0 }, 1, false, -Math.PI / 2);
  assert.equal(front.powerExit, true);
  assert.equal(rear.powerExit, undefined);
});

test('sticky soda slows steering and chips away at the Squished meter', () => {
  const normal = new Ride();
  const sticky = new Ride();

  for (const ride of [normal, sticky]) {
    ride.crowd.riders = [];
    ride.start();
  }

  sticky.encounter = {
    kind: 'soda',
    expires: 1,
    began: 0,
    variant: 0,
    dialogueAt: 0,
    location: { x: 0, z: 0 },
  };

  for (let tick = 0; tick < 5; tick++) {
    normal.tick({ x: 1, z: 0 });
    sticky.tick({ x: 1, z: 0 });
  }

  assert.equal(sticky.sticky, true);
  assert.ok(sticky.fluid.x < normal.fluid.x * 0.75);
  assert.ok(sticky.tolerance < normal.tolerance);
  assertVolume(sticky.fluid, sticky.mask);
});

test('a shover pushes the blob away and seated legs occupy the aisle', () => {
  const ride = new Ride();
  const rider = ride.crowd.riders[0];
  const before = ride.fluid.x;

  ride.crowd.riders = [rider];
  ride.start();
  ride.encounter = { kind: 'shover', expires: 1, began: 0, variant: 0, dialogueAt: 0 };
  Object.assign(rider, { x: 0.54, z: 0, role: 'shover', slot: { ...rider.slot, x: 0.54, z: 0 } });
  ride.tick({ x: 0, z: 0 });
  assert.ok(ride.cues.includes('shove'));
  assert.ok(ride.fluid.x < before);
  assertVolume(ride.fluid, ride.mask);

  Object.assign(rider, { x: SPREADER_X, z: SPREADER_Z, role: 'spreader', stride: 0 });
  const mask = ride.car.fixtures.slice();

  ride.crowd.occupy(ride.car.grid, mask, 0);

  for (const side of [-1, 1]) {
    const knee = ride.car.grid.at(SPREADER_X + side * 0.48, 0.49, SPREADER_Z - 0.55);

    assert.equal(ride.car.fixtures[knee], 0);
    assert.equal(mask[knee], 1);
  }
});

test('the spreader can occupy both seats and leaves a gap between angled legs', () => {
  for (const seat of SPREADER_SEATS) {
    const ride = new Ride();
    const rider = ride.crowd.riders[0];
    const grid = ride.car.grid;

    Object.assign(rider, { ...seat, role: 'spreader' });
    ride.crowd.riders = [rider];
    const mask = ride.car.fixtures.slice();
    const sin = Math.sin(seat.heading);
    const cos = Math.cos(seat.heading);

    const point = (x: number, y: number, z: number) =>
      grid.at(seat.x + x * cos + z * sin, y, seat.z - x * sin + z * cos);

    ride.crowd.occupy(grid, mask, 0);
    assert.equal(mask[point(0, 0.49, 0.49)], 0);
    for (const side of [-1, 1]) assert.equal(mask[point(side * 0.44, 0.49, 0.49)], 1);
  }
});

test('braking lurch uses the leg just traveled at both terminal reversals', () => {
  for (const stop of [14, 29]) {
    const ride = new Ride();
    const arriving = travelDirection(stop);

    ride.phase = 'running';
    ride.stop = stop;
    ride.phaseTime = TRAVEL_SECONDS - STEP;
    ride.tick({ x: 0, z: 0 });

    assert.equal(ride.phase, 'arriving');
    assert.equal(ride.direction, -arriving);
    assert.equal(ride.jolt?.braking, true);
    assert.equal(Math.sign(ride.jolt!.strength), -arriving);
  }

  assert.equal(brakingLurch(0), 0);
  assert.ok(brakingLurch(0.12) > 0 && brakingLurch(0.52) > 0);
  assert.equal(brakingLurch(0.56), 0);
});

test('station braking jolts on arrival after 6.5 seconds in motion', () => {
  const ride = new Ride();

  ride.schedule.clear();
  ride.start();
  let departedAt = 0;

  for (let step = 0; step < 410; step++) {
    ride.tick({ x: 0, z: 0 });

    if (ride.phase === 'running' && !departedAt) departedAt = ride.time;
    if (ride.stop !== 1) continue;

    assert.equal(ride.phase, 'arriving');
    assert.ok(Math.abs(ride.time - departedAt - 6.5) <= STEP + 1e-8);
    assert.equal(ride.jolt?.at, ride.time);
    assert.ok(ride.cues.includes('brakeJolt'));

    return;
  }

  assert.fail('Train never reached the second station');
});

test('the train eases into motion and slows before the braking jolt', () => {
  assert.equal(travelProgress(0), 0);
  assert.equal(travelProgress(TRAVEL_SECONDS), 1);
  assert.equal(trainSpeed(0), 0);
  assert.equal(trainSpeed(TRAVEL_SECONDS), 0);
  assert.equal(trainSpeed(3), 1);

  const coast = travelProgress(3.2) - travelProgress(3);
  const approach = travelProgress(TRAVEL_SECONDS - 0.1) - travelProgress(TRAVEL_SECONDS - 0.3);

  assert.ok(approach < coast * 0.15);

  for (let t = STEP; t < TRAVEL_SECONDS; t += STEP)
    assert.ok(travelProgress(t) > travelProgress(t - STEP));
});

test('seeded guest and pickup spawn locations cover multiple zones in the car', () => {
  const guestZones = new Set();
  const pickupZones = new Set();

  for (let seed = 0; seed < 48; seed++) {
    const ride = new Ride(seed);

    ride.schedule.clear();
    ride.schedule.set(0, 'shover');
    ride.inventory[0] = 'cool';
    ride.inventory[1] = 'crazy';
    ride.start();

    for (let t = 0; t < 45; t++) ride.tick({ x: 0, z: 0 });

    assert.ok(ride.encounter?.location);
    assert.ok(ride.pickups[0]);
    guestZones.add(Math.round(ride.encounter.location.x));
    const { x, z } = ride.pickups[0];

    pickupZones.add(Math.floor((x + 4.8) / 1.6) + '/' + Math.sign(z));
  }

  assert.ok(guestZones.size >= 5);
  assert.ok(pickupZones.size >= 7);
});

test('the rhino shunts nearby riders and only sounds on contact', () => {
  const ride = new Ride();
  const [rhino, close, far] = ride.crowd.riders;

  ride.crowd.riders = [rhino, close, far];
  ride.schedule.clear();
  ride.start();
  ride.encounter = { kind: 'prank', expires: 1, began: 0, variant: RHINO_PRANK, dialogueAt: 0 };

  Object.assign(rhino, {
    x: 2.55,
    z: 0.16,
    role: 'prank',
    slot: { ...rhino.slot, x: 2.55, z: 0.16 },
  });

  Object.assign(close, { x: 3.55, z: 0.16, slot: { ...close.slot, x: 3.55, z: 0.16 } });
  Object.assign(far, { x: -3.1, z: 0.62, slot: { ...far.slot, x: -3.1, z: 0.62 } });
  ride.tick({ x: 0, z: 0 });
  assert.ok(!ride.cues.includes('rhino'));

  close.x = 2.9;
  const before = close.x;

  ride.tick({ x: 0, z: 0 });
  assert.ok(close.x > before);
  assert.ok(!far.rhinoRecoilUntil);
  assert.equal(ride.cues.filter((cue) => cue === 'rhino').length, 1);
  for (let i = 0; i < 4; i++) ride.tick({ x: 0, z: 0 });

  assert.equal(ride.cues.filter((cue) => cue === 'rhino').length, 1);
  assertVolume(ride.fluid, ride.mask);
});
