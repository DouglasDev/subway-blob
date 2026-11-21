import { CROSS_DEPTH, CROSS_SEATS, CROSS_WIDTH, DOORS, HEIGHT_LIMIT } from './car.ts';
import { Grid } from './grid.ts';

type Location = { x: number; z: number };

type Slot = Location & { key: number; zone: number; priority: number };

export type Rider = Location & {
  id: number;
  slot: Slot;
  heading: number;
  stride: number;
  trajectory?: { points: Location[]; delay: number; span: number; exits: boolean };
};

export const STATIONS = [
  'South Ferry',
  'Rector St',
  'WTC Cortlandt',
  'Chambers St',
  'Franklin St',
  'Canal St',
  'Houston St',
  'Christopher St–Sheridan Sq',
  '14 St',
  '18 St',
  '23 St',
  '28 St',
  '34 St–Penn Station',
  'Times Sq–42 St',
  '50 St',
  '59 St–Columbus Circle',
];

const BOARDING = [10, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 8, 18];
const ZONES = 5;

export class Crowd {
  riders: Rider[] = [];
  onboard = 0;
  boarded = 0;
  exited = 0;
  private readonly slots: Slot[] = [];
  private serial = 0;
  private randomState: number;

  constructor(seed: number) {
    this.randomState = seed;

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
      this.riders.push({ id: this.serial++, slot, ...slot, heading: Math.PI, stride: 0 });
    }

    this.onboard = this.riders.length;
  }

  prepare(stop: number) {
    const departures = 2;
    const leaving = this.riders
      .slice()
      .sort((a, b) => Math.abs(Math.abs(a.x) - 2.7) - Math.abs(Math.abs(b.x) - 2.7))
      .slice(0, departures);
    const leavingIds = new Set(leaving.map(({ id }) => id));
    const staying = this.riders.filter(({ id }) => !leavingIds.has(id)).map(({ slot }) => slot);
    const slots = this.assign(staying, BOARDING[stop], stop >= 2);

    this.exited = leaving.length;
    this.boarded = slots.length;

    for (const [index, rider] of leaving.entries()) {
      const door = this.door(rider.x);

      rider.trajectory = {
        points: [
          { x: rider.x, z: rider.z },
          { x: rider.x, z: -0.16 },
          { x: door, z: -0.16 },
          { x: door, z: -2.9 },
        ],
        delay: index * 0.18,
        span: 1.35,
        exits: true,
      };
    }

    for (const [index, slot] of slots.entries()) {
      const door = this.door(slot.x);
      const start = { x: door + ((index % 3) - 1) * 0.36, z: -2.32 - Math.floor(index / 6) * 0.36 };
      const lane = -0.24 + (index % 3) * 0.24;
      const approach = { x: slot.x + Math.sign(slot.x || 1) * 0.14, z: lane };

      this.riders.push({
        id: this.serial++,
        slot,
        ...start,
        heading: 0,
        stride: 0,
        trajectory: {
          points: [start, { x: door, z: lane }, approach, slot],
          delay: 1.68 + Math.floor(index / 2) * 0.22,
          span: 2.65,
          exits: false,
        },
      });
    }
  }

  update(time: number) {
    for (const rider of this.riders) {
      const path = rider.trajectory;

      if (!path) continue;

      const progress = Math.max(0, Math.min(1, (time - path.delay) / path.span));
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

    this.riders = this.riders.filter((rider) => !rider.trajectory?.exits || rider.z > -2.89);
    this.onboard = this.riders.filter(({ z }) => z >= -1.2).length;
  }

  occupy(grid: Grid, mask: Uint8Array, stop: number) {
    const packed = Math.min(1, Math.max(0, (stop - 2) / 6));
    const shoulderX = 0.16 + 0.09 * packed;
    const shoulderZ = 0.23 + 0.02 * packed;

    for (const { x, z } of this.riders) {
      if (z < -1.46) continue;

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

  private random() {
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;

    return this.randomState / 4294967296;
  }
}
