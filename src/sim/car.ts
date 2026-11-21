import { Grid } from './grid.ts';

export const CAR_LENGTH = 9.6;

export const CAR_WIDTH = 2.4;

export const HEIGHT_LIMIT = 1.7;

export const DOORS = [-2.7, 2.7];

export const BENCH_DEPTH = 0.18;

export const BENCH_Z = CAR_WIDTH / 2 - BENCH_DEPTH / 2;

export const BENCHES = [
  { x: -4.04, length: 1.45 },
  { x: 0, length: 3.8 },
  { x: 4.04, length: 1.45 },
];

export function createCar() {
  const grid = new Grid(96, 17, 24);
  const fixtures = new Uint8Array(grid.size);

  for (const { x, length } of BENCHES) {
    for (const side of [-1, 1]) {
      const z = side * BENCH_Z;

      grid.block(
        fixtures,
        { x: x - length / 2, y: 0, z: z - BENCH_DEPTH / 2 },
        { x: x + length / 2, y: 0.47, z: z + BENCH_DEPTH / 2 },
      );
    }
  }

  for (const x of [-1.9, 1.9]) {
    grid.block(
      fixtures,
      { x: x - 0.07, y: 0, z: -0.05 },
      { x: x + 0.07, y: HEIGHT_LIMIT, z: 0.05 },
    );
  }

  return { grid, fixtures };
}
