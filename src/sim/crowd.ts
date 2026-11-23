import { CROSS_DEPTH, CROSS_SEATS, CROSS_WIDTH, DOORS, HEIGHT_LIMIT } from './car.ts';
import { Grid } from './grid.ts';
import {
  RHINO_PRANK,
  SPREADER_X,
  SPREADER_Z,
  SPREADER_LEG,
  spreaderHeading,
  spreaderSitting,
  sprayHits,
} from './hazards.ts';
import { hasGuest, seededRandom, shuffle } from './encounters.ts';
import type { Encounter } from './encounters.ts';
import { omnyLocation, OMNY_SECONDS } from './powers.ts';
import type { Power } from './powers.ts';

export type Location = { x: number; z: number };

type Slot = Location & { key: number; zone: number; priority: number };

// Local X side of the hand that holds the phone.
type PhoneHand = -1 | 1;

export type Rider = Location & {
  id: number;
  skinTone: number;
  phone: PhoneHand | null;
  slot: Slot;
  heading: number;
  stride: number;
  trajectory?: { points: Location[]; delay: number; span: number; age: number; exits: boolean };
  role?: Encounter;
  wantsExit?: boolean;
  powerExit?: boolean;
  rhinoRecoilUntil?: number;
  prop?: Location & { kind: 'suitcase' | 'bike'; pushed?: boolean };
  away?: Location & { until: number };
};

const BOARDING = [12, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 10, 10];
const ZONES = 5;
const PASSAGE_START = 12;

export type CrowdPassage = { from: number; to: number; z: number };

const PASSAGES: CrowdPassage[] = [
  { from: -4.24, to: -3.05, z: -0.66 },
  { from: -4.24, to: -3.05, z: 0.66 },
  { from: -2.8, to: -1.68, z: 0.55 },
  { from: -0.85, to: 0.36, z: -0.64 },
  { from: -0.85, to: 0.32, z: 0.44 },
  { from: 1.84, to: 2.96, z: 0.62 },
  { from: 1.85, to: 2.96, z: -0.62 },
  { from: 3.07, to: 4.27, z: 0.66 },
  { from: 3.07, to: 4.27, z: -0.66 },
];

function inPassage({ x, z }: Location, passage: CrowdPassage) {
  return x >= passage.from - 0.22 && x <= passage.to + 0.22 && Math.abs(z - passage.z) < 0.49;
}

const POWER_EXITS = 2;
const LIGHT_STOP_POWER_EXITS = 4;

export const SKIN_TONES = [0xdfa982, 0x8e5040, 0xb87752, 0x58362b, 0xe8ba98, 0xa66b52];

function skinDeck(seed: number, guest = false) {
  const random = seededRandom(seed);
  let bag: number[] = [];

  return () => {
    if (bag.length === 0) {
      const tones = guest
        ? SKIN_TONES.flatMap((tone, index) => Array<number>(index % 2 === 0 ? 4 : 2).fill(tone))
        : [...SKIN_TONES];

      if (guest) {
        tones.push(SKIN_TONES[2 * Math.floor(random() * 3)]);
        tones.push(SKIN_TONES[2 * Math.floor(random() * 3) + 1]);
      }

      bag = shuffle(tones, random);
    }

    return bag.pop()!;
  };
}

export class Crowd {
  riders: Rider[] = [];
  onboard = 0;
  boarded = 0;
  exited = 0;
  passages: readonly CrowdPassage[] = [];
  private readonly slots: Slot[] = [];
  private serial = 0;
  private readonly random: () => number;
  private readonly passengerSkin: () => number;
  private readonly guestSkin: () => number;
  private readonly phoneRandom: () => number;
  private nextPhone?: boolean;
  private nextPhoneHand: PhoneHand;
  private readonly passageRandom: () => number;
  private readonly boardingRandom: () => number;
  private nextLightStop: number;
  private powerExitsLeft = 0;

  constructor(seed: number) {
    this.random = seededRandom(seed);
    this.phoneRandom = seededRandom(Math.imul(seed ^ 0x12a4f087, 0x85ebca6b));
    this.nextPhoneHand = seededRandom(seed ^ 0x1ac974f3)() < 0.5 ? -1 : 1;
    this.passengerSkin = skinDeck(Math.imul(seed ^ 0xc6217ee9, 0x9e3779b1));
    this.guestSkin = skinDeck(Math.imul(seed ^ 0xa0e128b3, 0x85ebca6b), true);
    this.passageRandom = seededRandom(Math.imul(seed ^ 0x447c07af, 0x9e3779b1));
    this.boardingRandom = seededRandom(Math.imul(seed ^ 0xad9f381d, 0x9e3779b1));
    this.nextLightStop = 4 + Math.floor(this.boardingRandom() * 3);

    for (let column = 0; column < 20; column++) {
      for (let row = 0; row < 5; row++) {
        const x = (column - 9.5) * 0.47;
        const z = (row - 2) * 0.46;

        if (
          CROSS_SEATS.some(
            (seat) =>
              Math.abs(x - seat.x) < CROSS_DEPTH / 2 + 0.1 &&
              Math.abs(z - seat.z) < CROSS_WIDTH / 2 + 0.1,
          )
        )
          continue;

        // Keep the aisle and boarding thresholds looser during the first few stops.
        const priority =
          this.random() +
          Number(row === 2) * 0.38 +
          Number(Math.abs(Math.abs(x) - 2.7) < 0.5) * 0.32;

        this.slots.push({ x, z, key: column * 5 + row, zone: Math.floor(column / 4), priority });
      }
    }

    this.slots.sort((a, b) => a.priority - b.priority);

    for (const slot of this.assign([], 12)) {
      this.riders.push(this.createRider(slot, slot, Math.PI));
    }

    this.onboard = this.riders.length;
  }

  prepare(stop: number, encounter?: Encounter, guest?: Location) {
    const light = stop === this.nextLightStop;

    if (light) this.nextLightStop += 4 + Math.floor(this.boardingRandom() * 3);

    const departures = stop < 14 ? 2 : 4;
    const planned = this.riders.filter((rider) => rider.wantsExit);
    const waiting = this.riders.filter((rider) => rider.powerExit && !rider.wantsExit);
    const allowance = light ? LIGHT_STOP_POWER_EXITS : POWER_EXITS;
    const queued = waiting.slice(0, allowance);

    for (const rider of waiting.slice(allowance)) rider.powerExit = false;

    const regular = this.riders
      .filter((rider) => !rider.wantsExit && !rider.powerExit && !rider.role && !rider.trajectory)
      .sort((a, b) => Math.abs(Math.abs(a.x) - 2.7) - Math.abs(Math.abs(b.x) - 2.7))
      .slice(0, departures);

    const leaving = [...planned, ...regular, ...queued];
    const leavingIds = new Set(leaving.map(({ id }) => id));
    const remainingRiders = this.riders.filter(({ id }) => !leavingIds.has(id));

    if (stop >= PASSAGE_START) this.clearPassages(remainingRiders);

    const staying = remainingRiders.map(({ slot }) => slot);
    const wave = BOARDING[Math.min(stop, BOARDING.length - 1)];
    // Keep the original crowd ramp across the lighter boarding waves.
    const boarding = light ? planned.length + regular.length + 1 : wave + Number(stop >= 4);
    const room = this.passages.length
      ? Math.max(1, this.slots.length - 16 - staying.length)
      : boarding;
    const slots = this.assign(staying, Math.min(boarding, room), stop >= 2);
    const remaining = allowance - queued.length;

    this.powerExitsLeft = light
      ? remaining
      : Math.min(remaining, Math.max(0, slots.length - leaving.length - 1));

    this.exited = 0;
    this.boarded = slots.length;

    for (const [index, rider] of leaving.entries()) this.exit(rider, index * 0.08);

    for (const [index, slot] of slots.entries()) {
      const door = this.door(slot.x);
      const start = { x: door + ((index % 3) - 1) * 0.36, z: -2.32 - Math.floor(index / 6) * 0.36 };
      const lane = -0.24 + (index % 3) * 0.24;
      const approach = { x: slot.x + Math.sign(slot.x || 1) * 0.14, z: lane };

      const role = index === 0 && encounter && hasGuest(encounter) ? encounter : undefined;
      const rider = this.createRider(slot, start, 0, role);

      rider.trajectory = {
        points: [start, { x: door, z: lane }, approach, slot],
        delay: 1.68 + Math.floor(index / 2) * 0.22,
        span: 2.65,
        age: 0,
        exits: false,
      };

      if (role) {
        const { x, z } = guest ?? (role === 'spreader' ? { x: SPREADER_X, z: SPREADER_Z } : slot);
        const entry = this.door(x);

        rider.x = entry;
        rider.trajectory.points[0] = { x: entry, z: start.z };
        rider.trajectory.points[1] = { x: entry, z: lane };
        rider.prop = undefined;
        rider.slot = { ...slot, x, z };
        rider.trajectory.points.splice(-2, 2, { x, z: lane }, rider.slot);
        rider.trajectory.delay = 0.58;
        rider.trajectory.span = 1.85;
      }

      this.riders.push(rider);
    }
  }

  get performer() {
    return this.riders.find((rider) => rider.role && !rider.wantsExit && !rider.trajectory?.exits);
  }

  get hasTraffic() {
    return this.riders.some((rider) => rider.trajectory);
  }

  snapshot() {
    return this.riders.map((rider) => ({
      ...rider,
      trajectory: rider.trajectory && { ...rider.trajectory },
      prop: rider.prop && { ...rider.prop },
    }));
  }

  yieldNear(saved: Rider[], blob: Location) {
    for (const [index, rider] of this.riders.entries()) {
      const close = Math.hypot(rider.x - blob.x, rider.z - blob.z) < 1.04;
      const propClose =
        rider.prop && Math.hypot(rider.prop.x - blob.x, rider.prop.z - blob.z) < 1.04;

      if (close || propClose) this.riders[index] = saved[index];
    }
  }

  finishDoors() {
    this.riders = this.riders.filter((rider) => {
      if (rider.z < -1.2) {
        if (rider.trajectory?.exits) this.exited++;
        else if (rider.trajectory) this.boarded--;

        return false;
      }

      if (rider.trajectory?.exits && !rider.powerExit) rider.wantsExit = true;
      rider.trajectory = undefined;

      return true;
    });

    this.onboard = this.riders.length;
  }

  endEncounter() {
    const performer = this.performer;

    if (!performer) return;

    performer.wantsExit = true;
    performer.powerExit = false;
  }

  react(
    power: Exclude<Power, 'cool' | 'recovery' | 'shield' | 'express' | 'fluid'>,
    from: Location,
    time: number,
    doors: boolean,
    facing = 0,
  ) {
    const radius = { crazy: 2.35, fart: 2, vomit: 1.95, annoy: 2.6, omny: 2.65 }[power];
    const exits = { crazy: 3, fart: 2, vomit: 3, annoy: 2, omny: 0 }[power];
    const duration = { crazy: 5, fart: 6, vomit: 8, annoy: 9, omny: OMNY_SECONDS }[power];

    const distance = (rider: Rider) => Math.hypot(rider.x - from.x, rider.z - from.z);

    const nearby = this.riders
      .filter(
        (rider) =>
          !rider.trajectory &&
          !rider.wantsExit &&
          !rider.powerExit &&
          distance(rider) < radius &&
          (power !== 'vomit' || sprayHits(rider.x - from.x, rider.z - from.z, facing)),
      )
      .sort((a, b) => distance(a) - distance(b));
    const available = doors
      ? this.powerExitsLeft
      : POWER_EXITS - this.riders.filter((rider) => rider.powerExit).length;
    const leaving = Math.max(0, Math.min(exits, available, nearby.length));
    const omny = omnyLocation(from.x);
    const omnyEnd = from.x < 0 ? 1 : -1;

    if (doors) this.powerExitsLeft -= leaving;

    for (const [index, rider] of nearby.entries()) {
      if (index < leaving) {
        rider.powerExit = true;

        if (doors) this.exit(rider, 0.1 * index);
      }

      if (power === 'crazy' && index >= exits) break;

      rider.away =
        power === 'omny'
          ? {
              x: omny.x + omnyEnd * ((index % 4) - 1.5) * 0.26,
              z: omny.z + ((index % 3) - 1) * 0.39,
              until: time + duration,
            }
          : {
              x: rider.x + (Math.sign(rider.x - from.x) || 1) * 0.95,
              z: rider.z + (Math.sign(rider.z - from.z) || 1) * 0.58,
              until: time + duration,
            };
    }
  }

  tryPush(from: Location, dx: number, dz: number, grid: Grid, fixtures: Uint8Array) {
    if (Math.hypot(dx, dz) < 0.001) return;

    const rider = this.riders.find(({ prop, trajectory }) => {
      if (!prop || trajectory) return false;

      const sx = prop.x - from.x;
      const sz = prop.z - from.z;

      return Math.hypot(sx, sz) < (prop.kind === 'bike' ? 0.72 : 0.56) && sx * dx + sz * dz > 0;
    });
    const prop = rider?.prop;

    if (!prop || !rider) return;

    const x = prop.x + dx * 0.87;
    const z = prop.z + dz * 0.87;
    const halfX = prop.kind === 'bike' ? 0.34 : 0.12;

    if (
      ![-halfX, halfX].every((offset) =>
        [-0.13, 0.13].every((edge) => this.clear(grid, fixtures, x + offset, z + edge)),
      )
    )
      return;

    if (
      this.riders.some(
        (other) =>
          other !== rider && Math.abs(other.x - x) < halfX + 0.14 && Math.abs(other.z - z) < 0.22,
      )
    )
      return;

    const ownerX = x - halfX - 0.19;

    if (!this.clear(grid, fixtures, ownerX, z)) return;

    prop.x = x;
    prop.z = z;
    prop.pushed = true;
  }

  update(
    dt: number,
    time: number,
    blob: Location,
    grid: Grid,
    fixtures: Uint8Array,
    prankVariant?: number,
  ) {
    const performer = this.performer;
    const performance =
      performer &&
      performer.z > -1.02 &&
      (performer.role === 'acrobat' || performer.role === 'musician' || performer.role === 'prank');

    const charging =
      performance &&
      performer.role === 'prank' &&
      prankVariant === RHINO_PRANK &&
      !performer.trajectory;
    const bumped: number[] = [];

    if (charging) {
      for (const rider of this.riders) {
        const dx = rider.x - performer.x;
        const dz = rider.z - performer.z;
        const distance = Math.hypot(dx, dz);

        if (
          rider.role ||
          rider.trajectory ||
          rider.wantsExit ||
          distance > 0.64 ||
          (rider.rhinoRecoilUntil ?? 0) > time
        )
          continue;

        const x = distance > 0.05 ? dx / distance : Math.sin(performer.heading);
        const z = distance > 0.05 ? dz / distance : -0.55;

        rider.rhinoRecoilUntil = time + 0.78;
        rider.away = { x: rider.x + x * 0.97, z: rider.z + z * 0.67, until: time + 0.62 };
        bumped.push(rider.id);
      }
    }

    for (const rider of this.riders) {
      const { trajectory: path, prop } = rider;

      if (path) {
        this.walkPath(rider, path, dt, time);
      } else {
        let target: Location = rider.slot;

        if (rider.away && rider.away.until > time) {
          target = rider.away;
        } else if (rider.role === 'weird' && !rider.wantsExit) {
          const distance = Math.hypot(blob.x - rider.x, blob.z - rider.z);

          if (distance > 0.72)
            target = {
              x: blob.x + ((rider.x - blob.x) / distance) * 0.7,
              z: blob.z + ((rider.z - blob.z) / distance) * 0.7,
            };
          else target = rider;
        } else if (rider === performer && rider.role === 'prank' && prankVariant === RHINO_PRANK) {
          target = {
            x: rider.slot.x + Math.sin(time * 2.8) * 1.55,
            z: rider.slot.z + Math.sin(time * 4.3) * 0.22,
          };
        } else if (rider.role === 'acrobat') {
          const change = Math.cos(time * 1.65);
          const step = Math.sign(change) * Math.min(1, Math.abs(change) * 2.5);

          target = {
            x: rider.slot.x + step * 0.32,
            z: 0.21 + (step + 1) * 0.16,
          };
        } else if (rider.role === 'musician' || rider.role === 'sneezy') {
          const roaming = rider.role === 'sneezy';

          target = {
            x: rider.slot.x + Math.sin(time * (roaming ? 0.95 : 0.66)) * (roaming ? 1.85 : 1.2),
            z: 0.18 + Math.sin(time * 1.32) * 0.31,
          };
        } else if (rider.role === 'shover') {
          const near = Math.hypot(blob.x - rider.x, blob.z - rider.z) < 1.6;
          const shift = near ? (blob.x - rider.slot.x) * 0.72 : Math.sin(time * 1.2);

          target = {
            x: rider.slot.x + Math.max(-0.95, Math.min(0.95, shift)),
            z: near ? Math.max(-0.52, Math.min(0.52, blob.z)) : Math.sin(time * 1.5) * 0.35,
          };
        } else if (prop?.pushed) {
          target = { x: prop.x - (prop.kind === 'bike' ? 0.53 : 0.31), z: prop.z };
        } else if (performance && !rider.role && Math.abs(rider.slot.x - performer.x) < 2.3) {
          target = {
            x:
              rider.slot.x +
              Math.sign(rider.slot.x - performer.x) * (prankVariant === RHINO_PRANK ? 0.75 : 0.38),
            z: -0.67 + rider.slot.z * 0.2,
          };
        }

        const recoiling = (rider.rhinoRecoilUntil ?? 0) > time;
        const speed =
          charging && rider === performer
            ? 2.05
            : recoiling
              ? 1.82
              : rider.role === 'shover'
                ? 1.4
                : 1.05;

        this.walkToward(rider, target, dt, time, grid, fixtures, speed);

        if (prop?.pushed && Math.hypot(rider.x - target.x, rider.z - target.z) < 0.075) {
          rider.slot = { ...rider.slot, x: rider.x, z: rider.z };
        }
      }

      if (prop && (!prop.pushed || path)) {
        prop.x = rider.x + (prop.kind === 'bike' ? 0.53 : 0.31);
        prop.z = rider.z;
      }
    }

    return bumped;
  }

  commitDepartures() {
    this.riders = this.riders.filter((rider) => {
      if (!rider.trajectory?.exits || rider.z > -2.89) return true;

      this.exited++;

      return false;
    });

    this.onboard = this.riders.filter(({ z }) => z >= -1.2).length;
  }

  private createRider(slot: Slot, position: Location, heading: number, role?: Encounter): Rider {
    const skinTone = role ? this.guestSkin() : this.passengerSkin();
    const readsPhone = !role && (this.nextPhone ?? this.phoneRandom() < 0.5);
    const phone = readsPhone ? this.nextPhoneHand : null;

    if (!role) this.nextPhone = this.nextPhone === undefined ? !readsPhone : undefined;
    if (readsPhone) this.nextPhoneHand = this.nextPhoneHand === 1 ? -1 : 1;
    const rider: Rider = {
      id: this.serial++,
      skinTone,
      phone,
      slot,
      ...position,
      heading,
      stride: 0,
      role,
    };
    const draw = this.random();

    if (draw < 0.18 && slot.x < 3.75 && Math.abs(slot.z) < 0.75) {
      const kind = draw < 0.055 ? 'bike' : 'suitcase';
      const offset = kind === 'bike' ? 0.53 : 0.31;
      const footprint = kind === 'bike' ? 0.36 : 0.13;
      const obstructed = CROSS_SEATS.some(
        (seat) =>
          Math.abs(slot.x + offset - seat.x) < CROSS_DEPTH / 2 + footprint &&
          Math.abs(slot.z - seat.z) < CROSS_WIDTH / 2 + 0.13,
      );

      if (!obstructed) rider.prop = { kind, x: position.x + offset, z: position.z };
    }

    return rider;
  }

  private exit(rider: Rider, delay: number) {
    const door = this.door(rider.x);

    rider.trajectory = {
      points: [
        { x: rider.x, z: rider.z },
        { x: rider.x, z: 0 },
        { x: door, z: 0 },
        { x: door, z: -2.9 },
      ],
      delay,
      span: 1.8,
      age: 0,
      exits: true,
    };
  }

  private walkPath(rider: Rider, path: NonNullable<Rider['trajectory']>, dt: number, time: number) {
    path.age += dt;
    const progress = Math.max(0, Math.min(1, (path.age - path.delay) / path.span));
    const cursor = progress * (path.points.length - 1);
    const leg = Math.min(path.points.length - 2, Math.floor(cursor));
    const from = path.points[leg];
    const to = path.points[leg + 1];
    const t = cursor - leg;
    const eased = t * t * (3 - 2 * t);

    rider.x = from.x + (to.x - from.x) * eased;
    rider.z = from.z + (to.z - from.z) * eased;

    rider.heading =
      progress === 1 && !path.exits ? Math.PI : Math.atan2(to.x - from.x, to.z - from.z);

    rider.stride = progress > 0 && progress < 1 ? time * 15 + rider.id : 0;

    if (progress === 1 && !path.exits) rider.trajectory = undefined;
  }

  private clear(grid: Grid, fixtures: Uint8Array, x: number, z: number) {
    const id = grid.at(x, 0.37, z);

    return id >= 0 && !fixtures[id];
  }

  private walkToward(
    rider: Rider,
    target: Location,
    dt: number,
    time: number,
    grid: Grid,
    fixtures: Uint8Array,
    speed: number,
  ) {
    const dx = target.x - rider.x;
    const dz = target.z - rider.z;
    const distance = Math.hypot(dx, dz);

    rider.stride = 0;

    if (distance < 0.015) return;

    const scale = Math.min(1, (dt * speed) / distance);
    const x = Math.max(-4.53, Math.min(4.53, rider.x + dx * scale));
    const z = Math.max(-1, Math.min(1, rider.z + dz * scale));

    const steppingBySeat =
      rider.role === 'spreader' &&
      rider.slot.x < 2 &&
      Math.abs(rider.x - rider.slot.x) < 0.31 &&
      Math.abs(rider.z - rider.slot.z) < 0.23;

    if (steppingBySeat || this.clear(grid, fixtures, x, rider.z)) rider.x = x;
    if (steppingBySeat || this.clear(grid, fixtures, rider.x, z)) rider.z = z;

    rider.heading = Math.atan2(dx, dz);
    rider.stride = time * 12 + rider.id;
  }

  congestion(blob: Location) {
    let exposure = 0;

    for (const rider of this.riders) {
      if (rider.z < -1.2) continue;

      const distance = Math.hypot(rider.x - blob.x, (rider.z - blob.z) * 0.92);

      exposure += Math.max(0, 1 - distance / 1.1) ** 1.35;
    }

    return Math.min(1, exposure / 2.7);
  }

  occupy(grid: Grid, mask: Uint8Array, stop: number, bodies = mask) {
    // Leave usable gaps between collision shapes when the slots fill.
    const packed = Math.min(0.72, Math.max(0, (stop - 2) / 11));
    const shoulderX = 0.16 + 0.09 * packed;
    const shoulderZ = 0.23 + 0.02 * packed;

    for (const { x, z, prop, role, stride, trajectory } of this.riders) {
      if (z < -1.46) continue;

      if (role === 'spreader' && !trajectory && !stride && spreaderSitting(x, z)) {
        grid.block(
          bodies,
          { x: x - 0.23, y: 0.47, z: z - 0.22 },
          { x: x + 0.23, y: 1.38, z: z + 0.13 },
        );

        const heading = spreaderHeading(x);
        const sin = Math.sin(heading);
        const cos = Math.cos(heading);
        const { hip, knee, ankle } = SPREADER_LEG;

        for (const side of [-1, 1]) {
          for (const [from, to] of [
            [hip, knee],
            [knee, ankle],
          ]) {
            for (let i = 0; i <= 6; i++) {
              const t = i / 6;
              const localX = side * (from.x + (to.x - from.x) * t);
              const localZ = from.z + (to.z - from.z) * t;
              const py = from.y + (to.y - from.y) * t;
              const px = x + localX * cos + localZ * sin;
              const pz = z - localX * sin + localZ * cos;

              grid.block(
                bodies,
                { x: px - 0.106, y: py - 0.105, z: pz - 0.106 },
                { x: px + 0.106, y: py + 0.105, z: pz + 0.106 },
              );
            }
          }
        }

        continue;
      }

      if (prop) {
        const length = prop.kind === 'bike' ? 0.36 : 0.13;

        grid.block(
          mask,
          { x: prop.x - length, y: 0, z: prop.z - 0.105 },
          { x: prop.x + length, y: prop.kind === 'bike' ? 0.52 : 0.48, z: prop.z + 0.105 },
        );
      }

      grid.block(
        bodies,
        { x: x - shoulderX, y: 0.64, z: z - shoulderZ },
        { x: x + shoulderX, y: 1.46, z: z + shoulderZ },
      );

      grid.block(
        bodies,
        { x: x - 0.13 - 0.1 * packed, y: 1.46, z: z - 0.12 - 0.12 * packed },
        { x: x + 0.13 + 0.1 * packed, y: HEIGHT_LIMIT, z: z + 0.12 + 0.12 * packed },
      );

      for (const leg of [-0.11, 0.11]) {
        grid.block(
          bodies,
          { x: x - 0.11 - 0.13 * packed, y: 0, z: z + leg - 0.077 - 0.067 * packed },
          { x: x + 0.11 + 0.13 * packed, y: 0.64, z: z + leg + 0.077 + 0.067 * packed },
        );
      }
    }
  }

  private clearPassages(staying: Rider[]) {
    const previous = this.passages;
    const choices = shuffle([...PASSAGES], this.passageRandom);
    const wanted = this.passageRandom() < 0.5 ? 1 : 2;

    const sameLayout = (passages: CrowdPassage[]) =>
      passages.length === previous.length && passages.every((item) => previous.includes(item));

    const fits = (passages: CrowdPassage[]) =>
      this.slots.filter((slot) => !passages.some((passage) => inPassage(slot, passage))).length >
      staying.length;

    const singles = choices.map((passage) => [passage]);
    const pairs =
      wanted === 2
        ? choices.flatMap((first, index) =>
            choices
              .slice(index + 1)
              .filter((second) => first.to + 0.18 <= second.from || second.to + 0.18 <= first.from)
              .map((second) => [first, second]),
          )
        : [];
    const selected =
      [...pairs, ...singles].find((layout) => !sameLayout(layout) && fits(layout)) ??
      singles.find(fits) ??
      [];

    this.passages = selected;

    const keep = (slot: Slot) => !selected.some((passage) => inPassage(slot, passage));

    const moving = staying.filter((rider) => !rider.role && !keep(rider.slot));
    const occupied = new Set(
      staying.filter((rider) => !moving.includes(rider)).map((rider) => rider.slot.key),
    );
    const available = this.slots.filter((slot) => keep(slot) && !occupied.has(slot.key));

    for (const rider of moving) {
      let closest = -1;
      let distance = Infinity;

      for (const [index, slot] of available.entries()) {
        const gap = Math.hypot(slot.x - rider.x, slot.z - rider.z);

        if (gap < distance) {
          closest = index;
          distance = gap;
        }
      }

      if (closest === -1) break;
      rider.slot = available.splice(closest, 1)[0];
      if (rider.prop) rider.prop.pushed = false;
    }
  }

  private assign(staying: Slot[], count: number, fillAisle = false) {
    const occupied = new Set(staying.map(({ key }) => key));
    const byZone = new Uint8Array(ZONES);

    for (const { zone } of staying) byZone[zone]++;

    const available = this.slots.filter(
      (slot) =>
        !occupied.has(slot.key) && !this.passages.some((passage) => inPassage(slot, passage)),
    );

    if (fillAisle) {
      const rank = (slot: Slot) => slot.priority + Math.abs(slot.z) * 1.2;

      available.sort((a, b) => rank(a) - rank(b));
    }

    const slots: Slot[] = [];

    while (slots.length < count && available.length > 0) {
      let best = 0;

      for (let index = 1; index < available.length; index++) {
        if (byZone[available[index].zone] < byZone[available[best].zone]) best = index;
      }

      const [slot] = available.splice(best, 1);

      byZone[slot.zone]++;
      slots.push(slot);
    }

    return slots;
  }

  private door(x: number) {
    return x < 0 ? DOORS[0] : DOORS[1];
  }
}
