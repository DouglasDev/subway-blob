import { createCar } from './car.ts';
import { Crowd } from './crowd.ts';
import type { Location } from './crowd.ts';
import {
  ENCOUNTERS,
  ENCOUNTER_CYCLE,
  encounterSchedule,
  guestProximity,
  seededRandom,
  squeezeTolerance,
} from './encounters.ts';
import type { Cue, Encounter } from './encounters.ts';
import { Fluid } from './fluid.ts';
import { guestContent } from './guestContent.ts';
import { crowdPressure, DOUBLE_PICKUP_STOP, powerDeck, QUIET_SECONDS } from './powers.ts';
import type { Power } from './powers.ts';
import { stationIndex, travelDirection } from './route.ts';

export const STEP = 1 / 20;

export const STANDARD_VOLUME = 245;

export const HOT_VOLUME = 306;

const TRAVEL = 4.5;
const DWELL = 6.3;

export type Input = { x: number; z: number };

export type Pickup = Location & { power: Power; y: number };

export type Phase = 'ready' | 'running' | 'arriving' | 'doors' | 'closing' | 'popped';

export class Ride {
  readonly car = createCar();
  readonly fluid = new Fluid(this.car.grid, STANDARD_VOLUME, 0, 0);
  readonly mask = this.car.fixtures.slice();
  private readonly proposedMask = this.mask.slice();
  readonly crowd: Crowd;
  readonly inventory: [Power | null, Power | null] = [null, null];
  readonly schedule: Map<number, Encounter>;
  readonly cues: Cue[] = [];
  pickups: Pickup[] = [];
  encounter: {
    kind: Encounter;
    expires: number;
    began: number;
    variant: number;
    dialogueAt: number;
    line?: string;
    exchange?: { take: string; verdict: string; beat: 'question' | 'take' | 'verdict' };
  } | null = null;
  animation: { cue: Power; began: number; until: number } | null = null;
  phase: Phase = 'ready';
  stop = 0;
  score = 0;
  time = 0;
  phaseTime = 0;
  door = 0;
  travel = 0;
  tolerance = 1;
  squeeze = 0;
  guestPressure = 0;
  shieldUntil = 0;
  expressUntil = 0;
  fanUntil = 0;
  private rawSqueeze = 0;
  private readonly random: () => number;
  private readonly guestRandom: () => number;
  private readonly verdictRandom: () => number;
  private readonly guests: ReturnType<typeof guestContent>;
  private readonly pickPower: ReturnType<typeof powerDeck>;
  private readonly actions = new Set<0 | 1>();
  private waitingEncounter?: Encounter;
  private spawned = false;
  private accumulator = 0;

  constructor(readonly seed = 12071) {
    this.random = seededRandom(seed ^ 0x6c8e9cf5);
    this.guestRandom = seededRandom(seed ^ 0x32c47ae1);
    this.verdictRandom = seededRandom(seed ^ 0xe96da48f);
    this.schedule = encounterSchedule(0, this.guestRandom);
    this.guests = guestContent(seededRandom(seed ^ 0x42dd4ed9));
    this.pickPower = powerDeck(seededRandom(seed ^ 0x7394ca32));
    this.crowd = new Crowd(seed);
    this.crowd.occupy(this.car.grid, this.mask, 0);
    this.fluid.step(this.mask);
  }

  get station() {
    return stationIndex(this.stop);
  }

  get nextStation() {
    return stationIndex(this.stop + 1);
  }

  get direction() {
    return travelDirection(this.stop);
  }

  get act() {
    const actor = this.crowd.performer;
    const kind = this.encounter?.kind;

    return actor && actor.z > -1.02 && kind === actor.role ? actor : undefined;
  }

  get speech() {
    return this.act && this.phase !== 'popped' ? this.encounter?.line : undefined;
  }

  private updateGuest() {
    const { encounter, act } = this;

    this.guestPressure = 0;

    if (!encounter || !act) return;

    const { centers } = this.car.grid;
    let closest = Infinity;

    for (const id of this.fluid.cells) {
      const offset = id * 3;
      const distance = (centers[offset] - act.x) ** 2 + (centers[offset + 2] - act.z) ** 2;

      closest = Math.min(closest, distance);
    }

    if (this.time >= this.shieldUntil) this.guestPressure = guestProximity(Math.sqrt(closest));

    if (this.time < encounter.dialogueAt) return;

    encounter.dialogueAt = this.time + 5.35;

    if (encounter.kind === 'takes') {
      const exchange = encounter.exchange;

      if (exchange?.beat === 'question') {
        exchange.beat = 'take';
        encounter.line = 'Rider: ' + exchange.take;
        encounter.dialogueAt = this.time + 3.8;
      } else if (exchange?.beat === 'take') {
        exchange.beat = 'verdict';
        encounter.line = 'Kareem: ' + exchange.verdict;
        encounter.dialogueAt = this.time + 2.9;
      } else if (this.phase === 'doors' && this.phaseTime < 4.4) {
        const take = this.guests.takes.pop();

        encounter.line = take ? "Kareem: What's your take?" : undefined;

        encounter.exchange = take
          ? {
              take,
              verdict: this.verdictRandom() < 0.5 ? '100% agree' : '100% disagree',
              beat: 'question',
            }
          : undefined;

        encounter.dialogueAt = this.time + 2.35;
      } else {
        encounter.line = undefined;
        encounter.dialogueAt = this.time + 0.2;
      }
    } else if (encounter.kind === 'prank') {
      encounter.line = this.guests.pranks[encounter.variant].pop();
    } else if (encounter.kind === 'weird') {
      encounter.line = this.guests.weird.pop();
    }
  }

  get renderTravel() {
    return this.phase === 'running'
      ? Math.max(0, Math.min(1, (this.phaseTime + this.accumulator) / TRAVEL))
      : this.travel;
  }

  start() {
    if (this.phase !== 'ready') return;

    this.arrive();
  }

  usePower(slot: 0 | 1) {
    if (this.phase === 'ready' || this.phase === 'popped') return;

    this.actions.add(slot);
  }

  advance(elapsed: number, input: Input) {
    this.accumulator += Math.min(elapsed, 0.25);

    while (this.accumulator + 1e-9 >= STEP) {
      this.accumulator -= STEP;
      this.tick(input);
    }
  }

  tick(input: Input) {
    if (this.phase === 'ready' || this.phase === 'popped') return;

    this.time += STEP;
    this.phaseTime += STEP;
    this.moveTrain();
    this.activatePowers();
    const speed =
      (STEP * (this.time < this.expressUntil ? 2.28 : 1.48)) /
      Math.max(1, Math.hypot(input.x, input.z));
    const dx = Math.max(-4.62, Math.min(4.62, this.fluid.x + input.x * speed)) - this.fluid.x;
    const dz = Math.max(-1.04, Math.min(1.04, this.fluid.z + input.z * speed)) - this.fluid.z;

    this.solveCrowd(dx, dz);
    const quiet = this.time < this.shieldUntil;
    const fanned = this.time < this.fanUntil;
    const pressure = crowdPressure(this.stop, this.rawSqueeze, this.crowd.congestion(this.fluid));
    const load = quiet ? pressure * 0.2 : pressure;

    this.squeeze += (load - this.squeeze) * (1 - Math.exp(-STEP * 4));

    this.updateGuest();

    this.tolerance = squeezeTolerance(
      this.tolerance,
      quiet ? Math.min(this.squeeze, load) : this.rawSqueeze === 1 ? pressure : this.squeeze,
      STEP,
      !quiet && !fanned && this.encounter?.kind === 'smoker',
      this.guestPressure,
    );

    if (this.tolerance <= 1e-9) {
      this.tolerance = 0;
      this.cues.push('pop');
      this.setPhase('popped');

      return;
    }

    this.updatePickup();

    if (
      this.phase === 'doors' &&
      this.phaseTime >= DWELL &&
      (!this.crowd.hasTraffic || this.phaseTime >= DWELL + 2.65)
    ) {
      this.crowd.finishDoors();
      this.cues.push('announcement');
      this.setPhase('closing');
    }

    if (this.phase === 'closing' && this.phaseTime >= 3.6) {
      this.score++;
      this.setPhase('running');
    }
  }

  private solveCrowd(dx: number, dz: number) {
    const { grid, fixtures } = this.car;
    const saved = this.crowd.snapshot();
    const target =
      this.encounter?.kind === 'ac' && this.time >= this.fanUntil ? HOT_VOLUME : STANDARD_VOLUME;

    this.crowd.tryPush(this.fluid, dx, dz, grid, fixtures);
    this.crowd.update(STEP, this.time, this.fluid, grid, fixtures);
    this.proposedMask.set(fixtures);
    this.crowd.occupy(grid, this.proposedMask, this.stop);

    if (this.fluid.step(this.proposedMask, dx, dz, target)) {
      this.mask.set(this.proposedMask);
      this.rawSqueeze = this.fluid.pressure;
    } else {
      if (target === this.fluid.volume || !this.fluid.step(this.proposedMask, dx, dz)) {
        this.crowd.yieldNear(saved, this.fluid);
        this.proposedMask.set(fixtures);
        this.crowd.occupy(grid, this.proposedMask, this.stop);

        if (!this.fluid.step(this.proposedMask, dx, dz, Math.min(target, this.fluid.volume))) {
          // The last mask and poses are valid even when a dense wave has to wait.
          this.crowd.riders = saved;
          this.proposedMask.set(this.mask);
          this.fluid.step(this.mask, dx, dz, Math.min(target, this.fluid.volume));
        }
      }

      this.mask.set(this.proposedMask);
      this.rawSqueeze = 1;
    }

    this.crowd.commitDepartures();
  }

  private activatePowers() {
    for (const slot of this.actions) {
      const power = this.inventory[slot];

      if (!power) continue;

      this.inventory[slot] = null;
      this.animation = { cue: power, began: this.time, until: this.time + 2.5 };
      this.cues.push(power);

      if (power === 'cool') this.tolerance = Math.min(1, this.tolerance + 0.25);
      else if (power === 'shield') this.shieldUntil = this.time + QUIET_SECONDS;
      else if (power === 'express') this.expressUntil = this.time + 10;
      else {
        if (power === 'fan') this.fanUntil = this.time + 14;

        this.crowd.react(power, this.fluid, this.time, this.phase === 'doors');
      }
    }

    this.actions.clear();
  }

  private updatePickup() {
    if (this.phase === 'doors' && this.door === 1 && !this.spawned) {
      this.pickups = this.placePickups(this.stop >= DOUBLE_PICKUP_STOP ? 2 : 1);
      this.spawned = this.pickups.length > 0;
    }

    if (this.pickups.length === 0 || this.inventory.every(Boolean)) return;

    this.pickups = this.pickups.filter((pickup) => {
      const slot = this.inventory[0] === null ? 0 : this.inventory[1] === null ? 1 : -1;

      if (
        slot === -1 ||
        !this.fluid.cells.some((id) => {
          const point = this.car.grid.point(id);

          return Math.hypot(point.x - pickup.x, point.y - pickup.y, point.z - pickup.z) < 0.21;
        })
      )
        return true;

      this.inventory[slot] = pickup.power;
      this.cues.push('pickup');

      return false;
    });
  }

  private placePickups(count: number): Pickup[] {
    const { grid } = this.car;
    const seen = new Uint8Array(grid.size);
    const queue = [...this.fluid.cells];
    const choices: number[] = [];

    for (const id of queue) seen[id] = 1;

    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      const point = grid.point(id);
      const distance = Math.hypot(point.x - this.fluid.x, point.z - this.fluid.z);

      if (distance > 2.05) continue;
      if (point.y > 0.28 && point.y < 0.58 && distance > 0.56 && Math.abs(point.z) < 0.95)
        choices.push(id);

      for (const neighbor of grid.neighbors.subarray(id * 6, id * 6 + 6)) {
        if (neighbor < 0 || seen[neighbor] || this.mask[neighbor]) continue;

        seen[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    const pickups: Pickup[] = [];
    const used = new Set<number>();

    for (let index = 0; index < count; index++) {
      const first = pickups[0];
      const pool = choices.filter((id) => {
        if (!first) return true;
        const candidate = grid.point(id);

        return Math.hypot(candidate.x - first.x, candidate.z - first.z) >= 0.8;
      });
      const available = pool.length ? pool : choices.filter((id) => !used.has(id));
      const id =
        available[Math.floor(this.random() * available.length)] ??
        this.fluid.cells.find(
          (cell) => !used.has(cell) && Math.abs(grid.point(cell).y - 0.45) < 0.18,
        ) ??
        this.fluid.cells.find((cell) => !used.has(cell));

      if (id === undefined) break;

      used.add(id);
      pickups.push({ ...grid.point(id), power: this.pickPower(first?.power) });
    }

    return pickups;
  }

  private moveTrain() {
    if (this.phase === 'running') {
      this.travel = Math.min(1, this.phaseTime / TRAVEL);

      if (this.travel === 1) {
        this.stop++;
        this.arrive();
      }
    } else if (this.phase === 'arriving' && this.phaseTime >= 0.48) {
      if (this.encounter && this.stop >= this.encounter.expires) {
        this.crowd.endEncounter();
        this.encounter = null;
      }

      if (this.stop > 0 && this.stop % ENCOUNTER_CYCLE === 0) {
        this.schedule.clear();

        for (const [stop, kind] of encounterSchedule(this.stop, this.guestRandom))
          this.schedule.set(stop, kind);
      }

      this.waitingEncounter = this.schedule.get(this.stop);
      this.crowd.prepare(this.stop, this.waitingEncounter);
      this.setPhase('doors');
    } else if (this.phase === 'doors') {
      this.door = Math.min(1, this.phaseTime / 0.48);

      if (this.waitingEncounter && this.phaseTime >= 1.05) {
        const kind = this.waitingEncounter;

        this.encounter = {
          kind,
          expires: this.stop + ENCOUNTERS[kind].stops,
          began: this.time,
          variant:
            kind === 'acrobat' || kind === 'musician' || kind === 'prank'
              ? this.guests.variant(kind)
              : 0,
          dialogueAt: this.time,
        };

        this.waitingEncounter = undefined;
      }
    } else if (this.phase === 'closing') {
      if (this.phaseTime >= 2.3 && this.phaseTime - STEP < 2.3) this.cues.push('chime');

      this.door = Math.max(0, 1 - Math.max(0, this.phaseTime - 2.9) / 0.55);
    }
  }

  private arrive() {
    this.travel = 0;
    this.spawned = false;
    this.pickups = [];
    this.setPhase('arriving');
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }
}
