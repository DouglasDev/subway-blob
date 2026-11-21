import { Grid } from './grid.ts';

// center X, Y, Z and radii X, Y, Z in a body frame facing +Z.
const body = [
  [0, 1.43, 0.055, 0.205, 0.24, 0.18],
  [0, 1.03, 0.02, 0.245, 0.38, 0.16],
  [0.28, 0.86, 0.015, 0.095, 0.37, 0.1],
  [-0.28, 0.86, 0.015, 0.095, 0.37, 0.1],
  [0.125, 0.39, -0.025, 0.11, 0.41, 0.12],
  [-0.125, 0.39, -0.025, 0.11, 0.41, 0.12],
];

function bodyDistance(x: number, y: number, z: number) {
  let distance = Infinity;

  for (const [centerX, centerY, centerZ, radiusX, radiusY, radiusZ] of body) {
    const normalized =
      ((x - centerX) / radiusX) ** 2 +
      ((y - centerY) / radiusY) ** 2 +
      ((z - centerZ) / radiusZ) ** 2;

    distance = Math.min(
      distance,
      (Math.sqrt(normalized) - 1) * Math.min(radiusX, radiusY, radiusZ),
    );
  }

  return distance;
}

export class Fluid {
  cells: number[] = [];
  pressure = 0;
  x: number;
  z: number;
  private readonly reach: Uint8Array;
  private readonly ranks: Float32Array;
  private readonly visited: Uint8Array;
  private readonly queue: number[] = [];

  constructor(
    readonly grid: Grid,
    public volume: number,
    x: number,
    z: number,
    private readonly flowLayers = 2,
  ) {
    this.x = x;
    this.z = z;
    this.reach = new Uint8Array(grid.size);
    this.ranks = new Float32Array(grid.size);
    this.visited = new Uint8Array(grid.size);
  }

  step(blocked: Uint8Array, dx = 0, dz = 0, targetVolume = this.volume, facing = 0) {
    const previous = this.cells;
    const { grid, queue, reach, ranks, visited } = this;
    const x = this.x + dx;
    const z = this.z + dz;

    queue.length = 0;
    reach.fill(0);
    visited.fill(0);

    if (previous.length === 0) {
      for (let id = 0; id < grid.size; id++) {
        if (!blocked[id]) queue.push(id);
      }
    } else {
      // A newly displaced cell can expel its contents into an open neighbor.
      // Every subsequent step moves exclusively through open cells.
      for (const id of previous) {
        queue.push(id);
        reach[id] = 1;
      }

      for (let index = 0; index < queue.length; index++) {
        const id = queue[index];

        if (reach[id] > this.flowLayers) continue;

        for (let side = 0; side < 6; side++) {
          const neighbor = grid.neighbors[id * 6 + side];

          if (neighbor >= 0 && !blocked[neighbor] && !reach[neighbor]) {
            reach[neighbor] = reach[id] + 1;
            queue.push(neighbor);
          }
        }
      }
    }

    const candidates = queue.filter((id) => !blocked[id]);
    let comfortable = 0;
    const cos = Math.cos(facing);
    const sin = Math.sin(facing);

    for (const id of candidates) {
      const offset = id * 3;
      const localX = grid.centers[offset] - x;
      const localZ = grid.centers[offset + 2] - z;
      const rank = bodyDistance(
        localX * cos - localZ * sin,
        grid.centers[offset + 1],
        localX * sin + localZ * cos,
      );

      ranks[id] = rank;

      if (rank <= 0.035) comfortable++;
    }

    candidates.sort((a, b) => ranks[a] - ranks[b] || a - b);
    const chosen = this.findPlacement(candidates, targetVolume);

    this.pressure = 1 - Math.min(comfortable / targetVolume, 1);

    if (!chosen) return false;

    this.cells = chosen;
    this.volume = targetVolume;

    // Follow displaced fluid, including when the preferred position is occupied.
    let centerX = 0;
    let centerZ = 0;

    for (const id of chosen) {
      centerX += grid.centers[id * 3];
      centerZ += grid.centers[id * 3 + 2];
    }

    this.x = x * 0.56 + (centerX / this.volume) * 0.44;
    this.z = z * 0.56 + (centerZ / this.volume) * 0.44;

    return true;
  }

  private findPlacement(candidates: number[], volume: number) {
    const { grid, ranks, visited } = this;
    const available = new Uint8Array(grid.size);

    for (const id of candidates) available[id] = 1;

    for (const seed of candidates) {
      if (visited[seed]) continue;

      const chosen: number[] = [];
      const heap = new MinHeap(ranks);

      heap.push(seed);
      visited[seed] = 1;

      while (heap.items.length) {
        const id = heap.pop();

        chosen.push(id);

        if (chosen.length === volume) return chosen;

        for (let side = 0; side < 6; side++) {
          const neighbor = grid.neighbors[id * 6 + side];

          if (neighbor >= 0 && available[neighbor] && !visited[neighbor]) {
            visited[neighbor] = 1;
            heap.push(neighbor);
          }
        }
      }
    }

    return undefined;
  }
}

class MinHeap {
  readonly items: number[] = [];

  constructor(private readonly ranks: Float32Array) {}

  push(id: number) {
    const { items, ranks } = this;
    let child = items.length;

    items.push(id);

    while (child > 0) {
      const parent = (child - 1) >> 1;

      if (ranks[items[parent]] <= ranks[id]) break;

      items[child] = items[parent];
      child = parent;
    }

    items[child] = id;
  }

  pop() {
    const { items, ranks } = this;
    const first = items[0];
    const last = items.pop()!;
    let parent = 0;

    if (items.length === 0) return first;

    while (parent * 2 + 1 < items.length) {
      let child = parent * 2 + 1;

      if (child + 1 < items.length && ranks[items[child + 1]] < ranks[items[child]]) child++;
      if (ranks[last] <= ranks[items[child]]) break;

      items[parent] = items[child];
      parent = child;
    }

    items[parent] = last;

    return first;
  }
}
