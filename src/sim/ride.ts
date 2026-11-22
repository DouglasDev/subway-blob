import { createCar } from './car.ts';
import { Crowd } from './crowd.ts';
import type { Location } from './crowd.ts';
import {
  ENCOUNTERS,
  ENCOUNTER_CYCLE,
  encounterSchedule,
  guestProximity,
  hasGuest,
  lowSqueeze,
  seededRandom,
  squeezeTolerance,
} from './encounters.ts';
import type { Cue, Encounter } from './encounters.ts';
import {
  PA_FEEDBACK_SECONDS,
  SHOVE_DURATION,
  SHOVE_RANGE,
  SODA_DRAIN,
  sodaContains,
  sodaRadius,
  SODA_SPEED,
  GUEST_RADIUS,
  SPEAKER_RADIUS,
  SNEEZE_SECONDS,
  SPREADER_SEATS,
} from './hazards.ts';
import { Fluid } from './fluid.ts';
import { guestContent } from './guestContent.ts';
import {
  omnyLocation,
  OMNY_FLIGHT,
  OMNY_SECONDS,
  COOL_POINTS,
  RECOVERY_POINTS,
  pickupWave,
  crowdPressure,
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
const EARLY_DAMAGE_MULTIPLIER = 1.6;
const DAMAGE_TAPER_STOPS = 6;
const RECOVERY_DELAY = 1.25;

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
  omny:
    | (Location & {
        origin: Location;
        began: number;
        landsAt: number;
        until: number;
        landed: boolean;
      })
    | null = null;
  encounter: {
    kind: Encounter;
    expires: number;
    began: number;
    variant: number;
    dialogueAt: number;
    reactionAt?: number | null;
    nextSneezeAt?: number;
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
  jolt: { at: number; strength: number; braking?: boolean } | null = null;
  sneeze: (Location & { at: number }) | null = null;
  shove: { x: number; z: number; at: number } | null = null;
  private nextTrackJolt = Infinity;
  private nextMurmur = 5;
  rhinoImpactAt = -Infinity;
  private readonly ambience: () => number;
  private readonly riderMask = new Uint8Array(this.car.grid.size);
  private readonly solidMask = this.car.fixtures.slice();
  private riderSqueeze = 0;
  private rawSqueeze = 0;
  private safeTime = 0;
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

  get damageMultiplier() {
    const progress = Math.min(1, this.score / DAMAGE_TAPER_STOPS);

    return 1 + (EARLY_DAMAGE_MULTIPLIER - 1) * (1 - progress);
  }

  get guestDamageMultiplier() {
    return 1 + 0.35 * Math.max(0, 1 - this.score / 5);
  }

  get sodaSpill() {
    const event = this.encounter;

    if (event?.kind === 'soda' && event.location)
      return { ...event.location, radius: sodaRadius(this.time - event.began) };
  }

  get guestDanger() {
    const { encounter, act, sneeze, time } = this;

    if (!encounter) return;

    if (encounter.kind === 'speaker') {
      const age = time - encounter.began - REACTION_DELAY;

      if (encounter.location && age >= 0 && age < PA_FEEDBACK_SECONDS)
        return { ...encounter.location, radius: SPEAKER_RADIUS };

      return;
    }

    if (encounter.kind === 'sneezy') {
      if (act && sneeze && time - sneeze.at < SNEEZE_SECONDS)
        return { ...sneeze, radius: GUEST_RADIUS };

      return;
    }

    if (act) return { x: act.x, z: act.z, radius: GUEST_RADIUS };
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

    if (act && encounter.kind === 'sneezy') {
      encounter.nextSneezeAt ??= this.time + 1.25;

      if (this.time >= encounter.nextSneezeAt) {
        this.sneeze = { x: act.x, z: act.z, at: this.time };
        encounter.nextSneezeAt = this.time + 3.45;
        this.cues.push('sneeze');
      }
    }

    const danger = this.guestDanger;

    if (danger && this.time >= this.shieldUntil) {
      const distance = Math.hypot(this.fluid.x - danger.x, this.fluid.z - danger.z);

      this.guestPressure =
        encounter.kind === 'speaker'
          ? Math.max(0, 1 - distance / danger.radius) * 0.71
          : guestProximity(distance) * (encounter.kind === 'sneezy' ? 2.2 : 1);
    }

    if (!act) return;

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
    this.landOmny();
    const encounter = this.encounter;
    const soda = this.sodaSpill;

    this.sticky = !!soda && sodaContains(this.fluid.x - soda.x, this.fluid.z - soda.z, soda.radius);
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

    this.sticky = !!soda && sodaContains(this.fluid.x - soda.x, this.fluid.z - soda.z, soda.radius);
    const compression = this.riderSqueeze > 0 ? crowdPressure(this.stop, this.riderSqueeze, 0) : 0;
    const densityFactor =
      this.stop < 13 ? 1.27 : 1 + 0.7 * Math.min(1, Math.max(0, this.stop - 17) / 7);
    const strain = Math.min(1, compression * densityFactor) * (quiet ? 0.2 : 1);
    const smoker = !quiet && encounter?.kind === 'smoker';
    const riderDamage = encounter && hasGuest(encounter.kind) ? this.guestDamageMultiplier : 1;

    this.safeTime =
      strain < lowSqueeze(smoker) && this.guestPressure === 0 && !this.sticky
        ? this.safeTime + STEP
        : 0;

    const nextTolerance = squeezeTolerance(
      this.tolerance,
      strain,
      STEP,
      smoker,
      this.guestPressure * riderDamage,
      this.damageMultiplier,
      this.safeTime + 1e-9 >= RECOVERY_DELAY,
    );

    this.tolerance = this.sticky
      ? Math.max(
          0,
          Math.min(nextTolerance, this.tolerance) - SODA_DRAIN * this.damageMultiplier * STEP,
        )
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

    const bumped = this.crowd.update(
      STEP,
      this.time,
      this.fluid,
      grid,
      fixtures,
      this.encounter?.kind === 'prank' ? this.encounter.variant : undefined,
    );

    const superFluid = this.time < this.fluidUntil;

    const x = this.fluid.x + dx;
    const z = this.fluid.z + dz;
    const currentVolume = this.fluid.volume;

    this.rasterizeCrowd(fixtures);
    this.riderSqueeze = 0;

    if (this.fluid.step(this.proposedMask, dx, dz, target, this.facing, superFluid)) {
      this.mask.set(this.proposedMask);
      this.rawSqueeze = this.fluid.pressure;
    } else {
      const fitsAtCurrentVolume =
        target !== currentVolume &&
        this.fluid.step(this.proposedMask, dx, dz, currentVolume, this.facing, superFluid);

      if (!fitsAtCurrentVolume) {
        const blocksBody = this.fluid.cells.some((id) => {
          if (this.riderMask[id] && !this.solidMask[id]) return true;

          for (let face = 0; face < 6; face++) {
            const next = grid.neighbors[id * 6 + face];

            if (next >= 0 && this.riderMask[next] && !this.solidMask[next]) return true;
          }

          return false;
        });

        if (
          blocksBody &&
          this.fluid.step(this.solidMask, dx, dz, currentVolume, this.facing, superFluid, true)
        )
          this.riderSqueeze = 1;

        this.crowd.yieldNear(saved, this.fluid);
        this.rasterizeCrowd(fixtures);

        if (
          !this.fluid.step(
            this.proposedMask,
            dx,
            dz,
            Math.min(target, currentVolume),
            this.facing,
            superFluid,
          )
        ) {
          // Keep the previous legal body when the crowd or the fixtures block every placement.
          this.crowd.riders = saved;
          this.rasterizeCrowd(fixtures);
          this.proposedMask.set(this.mask);

          this.fluid.step(
            this.mask,
            dx,
            dz,
            Math.min(target, currentVolume),
            this.facing,
            superFluid,
          );
        }
      }

      this.mask.set(this.proposedMask);
      this.rawSqueeze = 1;
    }

    if (this.riderSqueeze < 1) {
      const displaced = this.fluid.riderCompression(
        this.riderMask,
        this.solidMask,
        x,
        z,
        this.facing,
        superFluid,
      );
      const pressureGain = this.stop < 5 ? 15 : this.stop < 13 ? 10 : 6;

      this.riderSqueeze = Math.min(1, displaced * pressureGain);
    }

    if (
      this.time - this.rhinoImpactAt >= 0.38 &&
      bumped.length &&
      this.crowd.riders.some(
        (rider) => bumped.includes(rider.id) && (rider.rhinoRecoilUntil ?? 0) > this.time,
      )
    ) {
      this.rhinoImpactAt = this.time;
      this.cues.push('rhino');
    }

    this.crowd.commitDepartures();
  }

  private rasterizeCrowd(fixtures: Uint8Array) {
    this.solidMask.set(fixtures);
    this.riderMask.fill(0);
    this.crowd.occupy(this.car.grid, this.solidMask, this.stop, this.riderMask);
    this.proposedMask.set(this.solidMask);

    for (let id = 0; id < this.riderMask.length; id++) {
      if (this.riderMask[id]) this.proposedMask[id] = 1;
    }
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

      if (power === 'cool' || power === 'recovery')
        this.tolerance = Math.min(
          1,
          this.tolerance + (power === 'cool' ? COOL_POINTS : RECOVERY_POINTS) / 100,
        );
      else if (power === 'shield') this.shieldUntil = this.time + QUIET_SECONDS;
      else if (power === 'fluid') this.fluidUntil = this.time + SUPER_FLUID_SECONDS;
      else if (power === 'express') this.expressUntil = this.time + EXPRESS_SECONDS;
      else if (power === 'omny') {
        const landsAt = this.time + OMNY_FLIGHT;

        this.omny = {
          ...omnyLocation(this.fluid.x),
          origin: { x: this.fluid.x, z: this.fluid.z },
          began: this.time,
          landsAt,
          until: landsAt + OMNY_SECONDS,
          landed: false,
        };
      } else this.crowd.react(power, this.fluid, this.time, this.phase === 'doors', this.facing);
    }

    this.actions.clear();
  }

  private landOmny() {
    const toss = this.omny;

    if (!toss || toss.landed || this.time + 1e-9 < toss.landsAt) return;

    toss.landed = true;
    this.crowd.react('omny', toss.origin, this.time, this.phase === 'doors');
    this.cues.push('omnyLand');
  }

  private updatePickup() {
    if (this.phase === 'doors' && this.door === 1 && !this.spawned) {
      const wave = pickupWave(this.stop, this.seed);

      this.pickups = this.placePickups(wave.count, wave.recovery);
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

  private placePickups(count: number, recovery: boolean): Pickup[] {
    const { grid } = this.car;
    const seen = new Uint8Array(grid.size);
    const queue = [...this.fluid.cells];
    const scatter =
      count > 1 && seededRandom(Math.imul(this.seed ^ this.stop ^ 0x345a9e51, 0x85ebca6b))() < 0.48;
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

    const distant = new Map<number, ReturnType<typeof grid.point>[]>();

    if (scatter) {
      for (let ix = 1; ix < grid.length - 1; ix += 2) {
        for (let iz = 3; iz < grid.width - 3; iz += 2) {
          const id = grid.index(ix, 4, iz);

          if (this.mask[id] || seen[id]) continue;
          const point = grid.point(id);
          const zone = Math.floor((point.x + 4.8) / 1.6) * 2 + Number(point.z >= 0);

          if (!distant.has(zone)) distant.set(zone, []);
          distant.get(zone)!.push(point);
        }
      }
    }

    const pickups: Pickup[] = [];
    const selectedZones: number[] = [];

    for (let index = 0; index < count; index++) {
      const first = pickups[0];
      const isRecovery = recovery && index === count - 1;
      const pool = index > 0 && distant.size ? distant : zones;
      const candidates = [...pool]
        .map(([zone, spots]) => ({
          zone,
          spots: spots.filter((point) =>
            pickups.every(({ x, z }) => Math.hypot(point.x - x, point.z - z) >= 0.82),
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
        pickups.push({ ...spot, power: isRecovery ? 'recovery' : this.pickPower(first?.power) });
        continue;
      }

      if (index >= 2) break;

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

    if (recovery && pickups.length && !pickups.some(({ power }) => power === 'recovery'))
      pickups[pickups.length - 1].power = 'recovery';

    this.lastPickupZones = [...selectedZones, ...this.lastPickupZones].slice(0, 3);

    return pickups;
  }

  private encounterLocation(kind: Encounter): Location | undefined {
    if (kind === 'ac') return;

    if (kind === 'spreader') {
      const seat = SPREADER_SEATS[Number(this.placements() < 0.46)];

      this.lastEncounterX = seat.x;

      return seat;
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
        this.jolt = { at: this.time, strength: -this.direction * 0.69, braking: true };
        this.cues.push('brakeJolt');
        this.stop++;
        this.arrive();
      }
    } else if (this.phase === 'arriving' && this.phaseTime >= ARRIVAL) {
      if (this.encounter && this.stop >= this.encounter.expires) {
        this.crowd.endEncounter();
        this.encounter = null;
        this.sneeze = null;
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
