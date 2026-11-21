import { createCar } from './car.ts';
import { Crowd, STATIONS } from './crowd.ts';
import { Fluid } from './fluid.ts';

export const STEP = 1 / 20;

const TRAVEL = 4.5;
const DWELL = 6.3;

export type Input = { x: number; z: number };

export type Phase = 'ready' | 'running' | 'arriving' | 'doors' | 'closing' | 'popped' | 'complete';

export class Ride {
  readonly car = createCar();
  readonly fluid = new Fluid(this.car.grid, 245, 0, 0);
  readonly mask = this.car.fixtures.slice();
  readonly crowd: Crowd;
  phase: Phase = 'ready';
  stop = 0;
  score = 0;
  time = 0;
  phaseTime = 0;
  door = 0;
  travel = 0;
  private accumulator = 0;

  constructor(seed = 12071) {
    this.crowd = new Crowd(seed);
    this.crowd.occupy(this.car.grid, this.mask, 0);
    this.fluid.step(this.mask);
  }

  start() {
    if (this.phase !== 'ready') return;

    this.arrive();
  }

  advance(elapsed: number, input: Input) {
    this.accumulator += Math.min(elapsed, 0.25);

    while (this.accumulator + 1e-9 >= STEP) {
      this.accumulator -= STEP;
      this.tick(input);
    }
  }

  tick(input: Input) {
    if (this.phase === 'ready' || this.phase === 'popped' || this.phase === 'complete') return;

    this.time += STEP;
    this.phaseTime += STEP;
    this.moveTrain();
    this.mask.set(this.car.fixtures);
    this.crowd.occupy(this.car.grid, this.mask, this.stop);
    const speed = (STEP * 1.4) / Math.max(1, Math.hypot(input.x, input.z));
    const dx = Math.max(-4.62, Math.min(4.62, this.fluid.x + input.x * speed)) - this.fluid.x;
    const dz = Math.max(-1.04, Math.min(1.04, this.fluid.z + input.z * speed)) - this.fluid.z;

    if (!this.fluid.step(this.mask, dx, dz)) {
      this.phase = 'popped';

      return;
    }

    if (this.phase === 'closing' && this.phaseTime >= 0.65) {
      this.score++;
      this.setPhase(this.stop + 1 === STATIONS.length ? 'complete' : 'running');
    }
  }

  private moveTrain() {
    if (this.phase === 'running') {
      this.travel = Math.min(1, this.phaseTime / TRAVEL);

      if (this.travel === 1) {
        this.stop++;
        this.arrive();
      }
    } else if (this.phase === 'arriving') {
      if (this.phaseTime >= 0.48) {
        this.crowd.prepare(this.stop);
        this.setPhase('doors');
      }
    } else if (this.phase === 'doors') {
      this.door = Math.min(1, this.phaseTime / 0.48);
      this.crowd.update(this.phaseTime);

      if (this.phaseTime >= DWELL) this.setPhase('closing');
    } else if (this.phase === 'closing') {
      this.door = Math.max(0, 1 - this.phaseTime / 0.55);
    }
  }

  private arrive() {
    this.travel = 0;
    this.setPhase('arriving');
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }
}
