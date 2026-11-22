import { createCar } from './car.ts';
import { Crowd } from './crowd.ts';
import type { Location } from './crowd.ts';
import {
  ENCOUNTERS,
  ENCOUNTER_CYCLE,
  encounterSchedule,
  guestProximity,
  hasGuest,
  seededRandom,
  squeezeTolerance,
} from './encounters.ts';
import type { Cue, Encounter } from './encounters.ts';
import {
  RHINO_PRANK,
  SHOVE_DURATION,
  SHOVE_RANGE,
  SODA_DRAIN,
  SODA_RADIUS,
  SODA_SPEED,
  SPREADER_X,
  SPREADER_Z,
} from './hazards.ts';
import { Fluid } from './fluid.ts';
import { guestContent } from './guestContent.ts';
import {
  candyLocation,
  CANDY_SECONDS,
  COOL_POINTS,
  crowdPressure,
  DOUBLE_PICKUP_STOP,
  EXPRESS_SECONDS,
  powerDeck,
  SUPER_FLUID_SECONDS,
} from './powers.ts';
import type { Power } from './powers.ts';
import { stationIndex, travelDirection } from './route.ts';
import { trainSpeed, travelProgress, TRAVEL_SECONDS } from './trainMotion.ts';

export const STEP = 1 / 20;

export const STANDARD_VOLUME = 245;

export const HOT_VOLUME = 306;

const ARRIVAL = 0.48;
const DWELL = 5.3;
const CLOSING = 3.6;

export const QUIET_SECONDS = 6.2;

const TURN_RATE = 11;
const REACTION_DELAY = 2;

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
  candy: (Location & { until: number }) | null = null;
  encounter: {
    kind: Encounter;
    expires: number;
    began: number;
    variant: number;
    dialogueAt: number;
    reactionAt?: number | null;
    location?: Location;
    line?: string;
    exchange?: { take: string; verdict: string; beat: 'question' | 'take' | 'verdict' };
  } | null = null;
  animation: { cue: Power; began: number; until: number; facing: number; origin: Location } | null =
    null;
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
  facing = 0;
  private steeringHeading = 0;
  fluidUntil = 0;
  sticky = false;
  jolt: { at: number; strength: number } | null = null;
  shove: { x: number; z: number; at: number } | null = null;
  private nextTrackJolt = Infinity;
  private nextMurmur = 5;
  private nextRhinoBump = 0;
  private readonly ambience: () => number;
  private rawSqueeze = 0;
  private readonly random: () => number;
  private readonly guestRandom: () => number;
  private readonly verdictRandom: () => number;
  private readonly guests: ReturnType<typeof guestContent>;
  private readonly pickPower: ReturnType<typeof powerDeck>;
  private readonly actions = new Set<0 | 1>();
  private waitingEncounter?: Encounter;
  private waitingLocation?: Location;
  private lastEncounterX?: number;
  private lastPickupZones: number[] = [];
  private readonly placements: () => number;
  private spawned = false;
  private accumulator = 0;

  constructor(readonly seed = 12071) {
    this.placements = seededRandom(Math.imul(seed ^ 0x08c12b77, 0x9e3779b1));
    this.ambience = seededRandom(seed ^ 0x26618293);
    this.random = seededRandom(Math.imul(seed ^ 0x6c8e9cf5, 0x9e3779b1));
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

    if (!encounter || (!act && hasGuest(encounter.kind))) return;

    if (encounter.reactionAt === undefined) encounter.reactionAt = this.time + REACTION_DELAY;

    if (encounter.reactionAt !== null && this.time + 1e-9 >= encounter.reactionAt) {
      encounter.reactionAt = null;
      this.cues.push(encounter.kind);
    }

    if (!act) {
      if (encounter.kind === 'speaker' && encounter.location && this.time >= this.shieldUntil) {
        const age = this.time - encounter.began - REACTION_DELAY;
        const distance = Math.abs(this.fluid.x - encounter.location.x);

        if (age >= 0 && age < 3.2)
          this.guestPressure = 0.27 + Math.max(0, 1 - distance / 3.4) * 0.44;
      }

      return;
    }

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
      ? travelProgress(this.phaseTime + this.accumulator)
      : this.travel;
  }

  get renderSpeed() {
    return this.phase === 'running' ? trainSpeed(this.phaseTime + this.accumulator) : 0;
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
    const encounter = this.encounter;
    const soda = encounter?.kind === 'soda' ? encounter.location : undefined;

    this.sticky = !!soda && Math.hypot(this.fluid.x - soda.x, this.fluid.z - soda.z) < SODA_RADIUS;
    this.updateShove();
    const impulse = this.shove ? Math.max(0, 1 - (this.time - this.shove.at) / SHOVE_DURATION) : 0;
    const speed =
      (STEP * (this.time < this.expressUntil ? 2.28 : 1.48) * (this.sticky ? SODA_SPEED : 1)) /
      Math.max(1, Math.hypot(input.x, input.z));
    const dx = Math.max(-4.62, Math.min(4.62, this.fluid.x + input.x * speed)) - this.fluid.x;
    const dz = Math.max(-1.04, Math.min(1.04, this.fluid.z + input.z * speed)) - this.fluid.z;

    if (dx * input.x + dz * input.z > 0.001) this.steeringHeading = Math.atan2(dx, dz);

    const turn = this.steeringHeading - this.facing;
    const shortestTurn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const maxTurn = TURN_RATE * STEP;

    this.facing =
      Math.abs(shortestTurn) <= maxTurn
        ? this.steeringHeading
        : this.facing + Math.sign(shortestTurn) * maxTurn;

    this.solveCrowd(
      dx + (this.shove?.x ?? 0) * impulse * STEP * 3.4,
      dz + (this.shove?.z ?? 0) * impulse * STEP * 3.4,
    );

    const quiet = this.time < this.shieldUntil;
    const pressure = crowdPressure(this.stop, this.rawSqueeze, this.crowd.congestion(this.fluid));
    const load = quiet ? pressure * 0.2 : pressure;

    this.squeeze += (load - this.squeeze) * (1 - Math.exp(-STEP * 4));

    this.updateGuest();

    const nextTolerance = squeezeTolerance(
      this.tolerance,
      quiet ? Math.min(this.squeeze, load) : this.rawSqueeze === 1 ? pressure : this.squeeze,
      STEP,
      !quiet && this.encounter?.kind === 'smoker',
      this.guestPressure,
    );

    this.tolerance = this.sticky
      ? Math.max(0, Math.min(nextTolerance, this.tolerance) - SODA_DRAIN * STEP)
      : nextTolerance;

    if (this.tolerance <= 1e-9) {
      this.tolerance = 0;
      this.cues.push('pop');
      this.setPhase('popped');

      return;
    }

    this.updatePickup();

    if (this.time >= this.nextMurmur) {
      this.nextMurmur = this.time + 4.5 + this.ambience() * 8;

      if (this.crowd.onboard > 15) this.cues.push('murmur');
    }

    if (
      encounter?.kind === 'prank' &&
      encounter.variant === RHINO_PRANK &&
      this.act &&
      this.time >= this.nextRhinoBump
    ) {
      this.nextRhinoBump = this.time + 2.3;
      this.cues.push('rhino');
    }

    if (
      this.phase === 'doors' &&
      this.phaseTime >= DWELL &&
      (!this.crowd.hasTraffic || this.phaseTime >= DWELL + 2.65)
    ) {
      this.crowd.finishDoors();
      this.cues.push('announcement');
      this.setPhase('closing');
    }

    if (this.phase === 'closing' && this.phaseTime >= CLOSING) {
      this.score++;
      this.setPhase('running');
    }
  }

  private updateShove() {
    const shover = this.act;

    if (shover?.role !== 'shover' || (this.shove && this.time - this.shove.at < 2.8)) return;

    const x = this.fluid.x - shover.x;
    const z = this.fluid.z - shover.z;
    const distance = Math.hypot(x, z);

    if (distance >= SHOVE_RANGE) return;

    this.shove = {
      x: distance > 0.001 ? x / distance : 1,
      z: distance > 0.001 ? z / distance : 0,
      at: this.time,
    };

    this.cues.push('shove');
  }

  private solveCrowd(dx: number, dz: number) {
    const { grid, fixtures } = this.car;
    const saved = this.crowd.snapshot();
    const target = this.encounter?.kind === 'ac' ? HOT_VOLUME : STANDARD_VOLUME;

    this.crowd.tryPush(this.fluid, dx, dz, grid, fixtures);

    this.crowd.update(
      STEP,
      this.time,
      this.fluid,
      grid,
      fixtures,
      this.encounter?.kind === 'prank' ? this.encounter.variant : undefined,
    );

    const superFluid = this.time < this.fluidUntil;

    this.proposedMask.set(fixtures);
    this.crowd.occupy(grid, this.proposedMask, this.stop);

    if (this.fluid.step(this.proposedMask, dx, dz, target, this.facing, superFluid)) {
      this.mask.set(this.proposedMask);
      this.rawSqueeze = this.fluid.pressure;
    } else {
      if (
        target === this.fluid.volume ||
        !this.fluid.step(this.proposedMask, dx, dz, this.fluid.volume, this.facing, superFluid)
      ) {
        this.crowd.yieldNear(saved, this.fluid);
        this.proposedMask.set(fixtures);
        this.crowd.occupy(grid, this.proposedMask, this.stop);

        if (
          !this.fluid.step(
            this.proposedMask,
            dx,
            dz,
            Math.min(target, this.fluid.volume),
            this.facing,
            superFluid,
          )
        ) {
          // The last mask and poses are valid even when a dense wave has to wait.
          this.crowd.riders = saved;
          this.proposedMask.set(this.mask);

          this.fluid.step(
            this.mask,
            dx,
            dz,
            Math.min(target, this.fluid.volume),
            this.facing,
            superFluid,
          );
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

      this.animation = {
        cue: power,
        began: this.time,
        until: this.time + 2.5,
        facing: this.facing,
        origin: { x: this.fluid.x, z: this.fluid.z },
      };

      this.cues.push(power);

      if (power === 'cool') this.tolerance = Math.min(1, this.tolerance + COOL_POINTS / 100);
      else if (power === 'shield') this.shieldUntil = this.time + QUIET_SECONDS;
      else if (power === 'fluid') this.fluidUntil = this.time + SUPER_FLUID_SECONDS;
      else if (power === 'express') this.expressUntil = this.time + EXPRESS_SECONDS;
      else {
        if (power === 'candy')
          this.candy = { ...candyLocation(this.fluid.x), until: this.time + CANDY_SECONDS };

        this.crowd.react(power, this.fluid, this.time, this.phase === 'doors', this.facing);
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
    const zones = new Map<number, ReturnType<typeof grid.point>[]>();
    const columns = new Set<number>();
    const reach = this.stop === 0 ? 2.35 : 3.45;

    for (const id of queue) seen[id] = 1;

    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      const point = grid.point(id);
      const distance = Math.hypot(point.x - this.fluid.x, point.z - this.fluid.z);

      if (distance > reach) continue;

      if (point.y > 0.32 && point.y < 0.55 && distance > 0.64 && Math.abs(point.z) < 1.0) {
        const column = Math.floor(id / (grid.height * grid.width)) * grid.width + (id % grid.width);

        if (!columns.has(column)) {
          const zone = Math.floor((point.x + 4.8) / 1.6) * 2 + Number(point.z >= 0);

          columns.add(column);
          if (!zones.has(zone)) zones.set(zone, []);
          zones.get(zone)!.push(point);
        }
      }

      for (const neighbor of grid.neighbors.subarray(id * 6, id * 6 + 6)) {
        if (neighbor < 0 || seen[neighbor] || this.mask[neighbor]) continue;

        seen[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    const pickups: Pickup[] = [];
    const selectedZones: number[] = [];

    for (let index = 0; index < count; index++) {
      const first = pickups[0];
      const candidates = [...zones]
        .map(([zone, spots]) => ({
          zone,
          spots: spots.filter(
            (point) => !first || Math.hypot(point.x - first.x, point.z - first.z) >= 0.82,
          ),
        }))
        .filter(({ spots }) => spots.length > 0);
      const fresh = candidates.filter(
        ({ zone }) => !this.lastPickupZones.includes(zone) && !selectedZones.includes(zone),
      );
      const choices = fresh.length ? fresh : candidates;
      const choice = choices[Math.floor(this.random() * choices.length)];

      if (choice) {
        const spot = choice.spots[Math.floor(this.random() * choice.spots.length)];

        selectedZones.push(choice.zone);
        pickups.push({ ...spot, power: this.pickPower(first?.power) });
        continue;
      }

      const fallback = this.fluid.cells
        .map((id) => grid.point(id))
        .find(
          (point) =>
            Math.abs(point.y - 0.45) < 0.18 &&
            (!first || Math.hypot(point.x - first.x, point.z - first.z) > 0.2),
        );

      if (!fallback) break;

      pickups.push({ ...fallback, power: this.pickPower(first?.power) });
    }

    this.lastPickupZones = [...selectedZones, ...this.lastPickupZones].slice(0, 3);

    return pickups;
  }

  private encounterLocation(kind: Encounter): Location | undefined {
    if (kind === 'ac') return;

    if (kind === 'spreader') {
      this.lastEncounterX = SPREADER_X;

      return { x: SPREADER_X, z: SPREADER_Z };
    }

    const zones = kind === 'acrobat' ? [-1.66, 1.66] : [-3.32, -2.15, -0.69, 0.74, 2.13, 3.32];
    const spaced = zones.filter(
      (x) => this.lastEncounterX === undefined || Math.abs(x - this.lastEncounterX) > 1.12,
    );
    const choices = spaced.length ? spaced : zones;
    const x =
      choices[Math.floor(this.placements() * choices.length)] + (this.placements() - 0.5) * 0.3;
    const z =
      kind === 'speaker'
        ? -0.99
        : kind === 'soda'
          ? 0.47
          : kind === 'acrobat'
            ? 0.14
            : this.placements() < 0.43
              ? -0.23
              : 0.43;

    this.lastEncounterX = x;

    return { x, z };
  }

  private moveTrain() {
    if (this.phase === 'running') {
      this.travel = travelProgress(this.phaseTime);

      if (this.phaseTime >= this.nextTrackJolt && this.phaseTime < TRAVEL_SECONDS - 1.5) {
        this.nextTrackJolt = Infinity;
        this.jolt = { at: this.time, strength: (this.ambience() < 0.5 ? -1 : 1) * 0.48 };
        this.cues.push('trackJolt');
      }

      if (this.phaseTime + 1e-9 >= TRAVEL_SECONDS) {
        this.jolt = { at: this.time, strength: 0.69 };
        this.cues.push('brakeJolt');
        this.stop++;
        this.arrive();
      }
    } else if (this.phase === 'arriving' && this.phaseTime >= ARRIVAL) {
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

      this.waitingLocation = this.waitingEncounter
        ? this.encounterLocation(this.waitingEncounter)
        : undefined;

      this.crowd.prepare(this.stop, this.waitingEncounter, this.waitingLocation);
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
          location: this.waitingLocation,
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

    if (phase === 'running')
      this.nextTrackJolt = this.ambience() < 0.57 ? 1.1 + this.ambience() * 3.6 : Infinity;
  }
}
