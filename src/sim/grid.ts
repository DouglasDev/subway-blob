export type Point = { x: number; y: number; z: number };

export class Grid {
  readonly size: number;
  readonly neighbors: Int32Array;
  readonly centers: Float32Array;

  constructor(
    readonly length: number,
    readonly height: number,
    readonly width: number,
    readonly cell = 0.1,
  ) {
    this.size = length * height * width;
    this.neighbors = new Int32Array(this.size * 6).fill(-1);
    this.centers = new Float32Array(this.size * 3);

    for (let x = 0; x < length; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < width; z++) {
          const id = this.index(x, y, z);

          this.centers.set(
            [(x + 0.5 - length / 2) * cell, (y + 0.5) * cell, (z + 0.5 - width / 2) * cell],
            id * 3,
          );

          this.neighbors.set(
            [
              this.index(x + 1, y, z),
              this.index(x - 1, y, z),
              this.index(x, y + 1, z),
              this.index(x, y - 1, z),
              this.index(x, y, z + 1),
              this.index(x, y, z - 1),
            ],
            id * 6,
          );
        }
      }
    }
  }

  index(x: number, y: number, z: number) {
    if (x < 0 || y < 0 || z < 0 || x >= this.length || y >= this.height || z >= this.width)
      return -1;

    return (x * this.height + y) * this.width + z;
  }

  point(id: number): Point {
    return { x: this.centers[id * 3], y: this.centers[id * 3 + 1], z: this.centers[id * 3 + 2] };
  }

  block(mask: Uint8Array, min: Point, max: Point) {
    const indexAt = (value: number, offset: number) =>
      Math.ceil(value / this.cell + offset - 0.50001);

    const startX = Math.max(0, indexAt(min.x, this.length / 2));
    const endX = Math.min(this.length, indexAt(max.x, this.length / 2));
    const startZ = Math.max(0, indexAt(min.z, this.width / 2));
    const endZ = Math.min(this.width, indexAt(max.z, this.width / 2));
    const startY = Math.max(0, indexAt(min.y, 0));
    const endY = Math.min(this.height, indexAt(max.y, 0));

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        for (let z = startZ; z < endZ; z++) mask[this.index(x, y, z)] = 1;
      }
    }
  }
}
