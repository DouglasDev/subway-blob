import assert from 'node:assert/strict';
import test from 'node:test';
import { STATIONS } from '../src/sim/crowd.ts';
import { Fluid } from '../src/sim/fluid.ts';
import { Grid } from '../src/sim/grid.ts';
import { Ride, STEP } from '../src/sim/ride.ts';

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

test('the empty car forms a connected upright shape with fixed volume', () => {
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
    'failure leaves the last full volume available for the pop effect',
  );
});

test('the lid permits exactly enough cells and one cell less pops', () => {
  const grid = new Grid(5, 2, 3);
  const fluid = new Fluid(grid, 3, 0, 0);
  const ceiling = [1, 2, 3].map((x) => grid.index(x, grid.height - 1, 1));
  const exactlyEnough = maskWith(grid, ceiling);

  assert.equal(grid.index(1, grid.height, 1), -1);
  assert.ok(fluid.step(exactlyEnough));
  assertVolume(fluid, exactlyEnough);
  assert.equal(fluid.step(maskWith(grid, ceiling.slice(1))), false);
});

function play(x: number, frame: number, checkVolume = false) {
  const ride = new Ride();

  ride.start();
  let previousScore = 0;
  let previousRiders = ride.crowd.onboard;
  let previousTime = 0;

  for (let wall = 0; wall < 240; wall += frame) {
    ride.advance(frame, { x, z: 0 });

    if (ride.phase === 'popped' || ride.phase === 'complete') break;

    if (checkVolume && ride.time !== previousTime) assertVolume(ride.fluid, ride.mask);

    if (ride.score !== previousScore) {
      assert.equal(ride.score, previousScore + 1);
      assert.ok(ride.crowd.boarded > ride.crowd.exited);
      assert.equal(ride.crowd.onboard - previousRiders, ride.crowd.boarded - ride.crowd.exited);
      assert.equal(ride.door, 0);
      previousScore = ride.score;
      previousRiders = ride.crowd.onboard;
    }

    previousTime = ride.time;
  }

  return ride;
}

test('steering survives more of the same route and the pop station awards no point', () => {
  const idle = play(0, STEP, true);
  const steered = play(1, STEP, true);

  assert.equal(idle.phase, 'popped');
  assert.equal(steered.phase, 'popped');
  assert.ok(idle.score >= 3 && idle.score < steered.score);
  assert.equal(idle.stop, idle.score);
  assert.equal(steered.stop, steered.score);
  assert.equal(steered.stop, STATIONS.length - 1);
  assert.ok(steered.crowd.boarded > steered.crowd.exited);
  const restart = new Ride();

  assert.equal(restart.score, 0);
  assert.equal(restart.stop, 0);
  assert.equal(restart.phase, 'ready');
});

test('different render rates produce the same ride outcome', () => {
  const slow = play(1, 1 / 30);
  const fast = play(1, 1 / 120);

  assert.equal(slow.phase, 'popped');
  assert.equal(slow.phase, fast.phase);
  assert.equal(slow.time, fast.time);
  assert.equal(slow.score, fast.score);
  assert.deepEqual(slow.fluid.cells, fast.fluid.cells);
});
