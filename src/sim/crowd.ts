import { CROSS_DEPTH, CROSS_SEATS, CROSS_WIDTH, DOORS, HEIGHT_LIMIT } from './car.ts';
import { Grid } from './grid.ts';
import { seededRandom } from './encounters.ts';
import type { Encounter, Power } from './encounters.ts';

export type Location = { x: number; z: number };

type Slot = Location & { key: number; zone: number; priority: number };

export type Rider = Location & {
  id: number;
  slot: Slot;
  heading: number;
  stride: number;
  trajectory?: { points: Location[]; delay: number; span: number; age: number; exits: boolean };
  role?: Encounter;
  wantsExit?: boolean;
  prop?: Location & { kind: 'suitcase' | 'bike'; pushed?: boolean };
  away?: Location & { until: number };
};

const BOARDING = [10, 5, 5, 6, 6, 7, 8, 8, 9, 10, 11, 11, 11, 12, 13, 18];
const ZONES = 5;

export class Crowd {
  riders: Rider[] = [];
  onboard = 0;
  boarded = 0;
  exited = 0;
  private readonly slots: Slot[] = [];
  private serial = 0;
  private readonly random: () => number;

  constructor(seed: number) {
    this.random = seededRandom(seed);

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

  prepare(stop: number, encounter?: Encounter) {
    const departures = stop < 14 ? 2 : 4;
    const leaving = this.riders.filter((rider) => rider.wantsExit);
    const regular = this.riders
      .filter((rider) => !rider.wantsExit && !rider.role && !rider.trajectory)
      .sort((a, b) => Math.abs(Math.abs(a.x) - 2.7) - Math.abs(Math.abs(b.x) - 2.7))
      .slice(0, departures);

    leaving.push(...regular);
    const leavingIds = new Set(leaving.map(({ id }) => id));
    const staying = this.riders.filter(({ id }) => !leavingIds.has(id)).map(({ slot }) => slot);
    const slots = this.assign(staying, BOARDING[Math.min(stop, BOARDING.length - 1)], stop >= 2);

    this.exited = 0;
    this.boarded = slots.length;

    for (const [index, rider] of leaving.entries()) this.exit(rider, index * 0.08);

    for (const [index, slot] of slots.entries()) {
      const door = this.door(slot.x);
      const start = { x: door + ((index % 3) - 1) * 0.36, z: -2.32 - Math.floor(index / 6) * 0.36 };
      const lane = -0.24 + (index % 3) * 0.24;
      const approach = { x: slot.x + Math.sign(slot.x || 1) * 0.14, z: lane };

      const rider = this.createRider(slot, start, 0);

      rider.trajectory = {
        points: [start, { x: door, z: lane }, approach, slot],
        delay: 1.68 + Math.floor(index / 2) * 0.22,
        span: 2.65,
        age: 0,
        exits: false,
      };

      if (index === 0 && encounter && encounter !== 'ac') {
        const x = encounter === 'acrobat' ? 1.7 : encounter === 'prank' ? -0.38 : 0.03;
        const z = encounter === 'acrobat' ? 0.13 : encounter === 'prank' ? 0.39 : 0.42;

        rider.role = encounter;
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
    return this.riders.find((rider) => rider.role && !rider.wantsExit);
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
    for (const rider of this.riders) {
      if (rider.trajectory?.exits) rider.wantsExit = true;
      if (rider.z >= -1.2) rider.trajectory = undefined;
    }

    this.riders = this.riders.filter(({ z }) => z >= -1.2);
    this.onboard = this.riders.length;
  }

  endEncounter() {
    const performer = this.performer;

    if (performer) performer.wantsExit = true;
  }

  react(power: Extract<Power, 'crazy' | 'gross'>, from: Location, time: number, doors: boolean) {
    const distance = (rider: Rider) => Math.hypot(rider.x - from.x, rider.z - from.z);

    const nearby = this.riders
      .filter(
        (rider) =>
          !rider.role &&
          !rider.trajectory &&
          !rider.wantsExit &&
          distance(rider) < (power === 'gross' ? 1.65 : 2.35),
      )
      .sort((a, b) => distance(a) - distance(b));

    for (const [index, rider] of nearby.entries()) {
      if (index < (power === 'crazy' ? 3 : 2)) {
        rider.wantsExit = true;

        if (doors) this.exit(rider, 0.1 * index);
      }

      if (power === 'gross' || rider.wantsExit) {
        const sign = Math.sign(rider.x - from.x) || 1;

        rider.away = {
          x: rider.x + sign * 0.95,
          z: rider.z + (Math.sign(rider.z - from.z) || 1) * 0.58,
          until: time + 5,
        };
      }
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

  update(dt: number, time: number, blob: Location, grid: Grid, fixtures: Uint8Array) {
    const performer = this.performer;
    const performance =
      performer &&
      performer.z > -1.02 &&
      (performer.role === 'acrobat' || performer.role === 'musician' || performer.role === 'prank');

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
        } else if (prop?.pushed) {
          target = { x: prop.x - (prop.kind === 'bike' ? 0.53 : 0.31), z: prop.z };
        } else if (performance && !rider.role && Math.abs(rider.slot.x - performer.x) < 2.3) {
          target = {
            x: rider.slot.x + Math.sign(rider.slot.x - performer.x) * 0.38,
            z: -0.67 + rider.slot.z * 0.2,
          };
        }

        this.walkToward(rider, target, dt, time, grid, fixtures);

        if (prop?.pushed && Math.hypot(rider.x - target.x, rider.z - target.z) < 0.075) {
          rider.slot = { ...rider.slot, x: rider.x, z: rider.z };
        }
      }

      if (prop && (!prop.pushed || path)) {
        prop.x = rider.x + (prop.kind === 'bike' ? 0.53 : 0.31);
        prop.z = rider.z;
      }
    }
  }

  commitDepartures() {
    this.riders = this.riders.filter((rider) => {
      if (!rider.trajectory?.exits || rider.z > -2.89) return true;

      this.exited++;

      return false;
    });

    this.onboard = this.riders.filter(({ z }) => z >= -1.2).length;
  }

  private createRider(slot: Slot, position: Location, heading: number): Rider {
    const rider: Rider = { id: this.serial++, slot, ...position, heading, stride: 0 };
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
  ) {
    const dx = target.x - rider.x;
    const dz = target.z - rider.z;
    const distance = Math.hypot(dx, dz);

    rider.stride = 0;

    if (distance < 0.015) return;

    const scale = Math.min(1, (dt * 1.05) / distance);
    const x = Math.max(-4.53, Math.min(4.53, rider.x + dx * scale));
    const z = Math.max(-1, Math.min(1, rider.z + dz * scale));

    if (this.clear(grid, fixtures, x, rider.z)) rider.x = x;
    if (this.clear(grid, fixtures, rider.x, z)) rider.z = z;

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

  occupy(grid: Grid, mask: Uint8Array, stop: number) {
    const packed = Math.min(1, Math.max(0, (stop - 2) / 6));
    const shoulderX = 0.16 + 0.09 * packed;
    const shoulderZ = 0.23 + 0.02 * packed;

    for (const { x, z, prop } of this.riders) {
      if (z < -1.46) continue;

      if (prop) {
        const length = prop.kind === 'bike' ? 0.36 : 0.13;

        grid.block(
          mask,
          { x: prop.x - length, y: 0, z: prop.z - 0.105 },
          { x: prop.x + length, y: prop.kind === 'bike' ? 0.52 : 0.48, z: prop.z + 0.105 },
        );
      }

      grid.block(
        mask,
        { x: x - shoulderX, y: 0.64, z: z - shoulderZ },
        { x: x + shoulderX, y: 1.46, z: z + shoulderZ },
      );

      grid.block(
        mask,
        { x: x - 0.13 - 0.1 * packed, y: 1.46, z: z - 0.12 - 0.12 * packed },
        { x: x + 0.13 + 0.1 * packed, y: HEIGHT_LIMIT, z: z + 0.12 + 0.12 * packed },
      );

      for (const leg of [-0.11, 0.11]) {
        grid.block(
          mask,
          { x: x - 0.11 - 0.13 * packed, y: 0, z: z + leg - 0.077 - 0.067 * packed },
          { x: x + 0.11 + 0.13 * packed, y: 0.64, z: z + leg + 0.077 + 0.067 * packed },
        );
      }
    }
  }

  private assign(staying: Slot[], count: number, fillAisle = false) {
    const occupied = new Set(staying.map(({ key }) => key));
    const byZone = new Uint8Array(ZONES);

    for (const { zone } of staying) byZone[zone]++;

    const available = this.slots.filter(({ key }) => !occupied.has(key));

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
