import { Vector3 } from 'three';
import type { Grid } from '../sim/grid.ts';

type Corner = {
  origin: Vector3;
  position: Vector3;
  normal: Vector3;
  adjacent: Set<number>;
};

export function roundSurface(faces: number[][], grid: Grid, blocked: Uint8Array) {
  const vertices = new Map<number, Corner>();
  const width = grid.width + 1;
  const height = grid.height + 1;
  const layer = width * height;

  for (const face of faces) {
    for (let index = 0; index < face.length; index++) {
      const id = face[index];
      let vertex = vertices.get(id);

      if (!vertex) {
        const origin = new Vector3(
          (Math.floor(id / layer) - grid.length / 2) * grid.cell,
          (Math.floor(id / width) % height) * grid.cell,
          ((id % width) - grid.width / 2) * grid.cell,
        );

        vertex = { origin, position: origin.clone(), normal: new Vector3(), adjacent: new Set() };
        vertices.set(id, vertex);
      }

      vertex.adjacent.add(face[(index + 1) % face.length]);
      vertex.adjacent.add(face[(index + face.length - 1) % face.length]);
    }
  }

  const average = new Vector3();
  const moves: Vector3[] = Array.from(vertices, () => new Vector3());

  // The alternating pass softens voxel steps while retaining the outline.
  for (const weight of [0.65, -0.28, 0.65, -0.28]) {
    let cursor = 0;

    for (const { origin, position, adjacent } of vertices.values()) {
      average.set(0, 0, 0);

      for (const neighbor of adjacent) average.add(vertices.get(neighbor)!.position);

      const next = moves[cursor++];

      next
        .copy(average)
        .divideScalar(adjacent.size)
        .sub(position)
        .multiplyScalar(weight)
        .add(position);

      next
        .sub(origin)
        .clampLength(0, grid.cell * 0.57)
        .add(origin);

      const cell = grid.index(
        Math.floor(next.x / grid.cell + grid.length / 2),
        Math.floor(next.y / grid.cell),
        Math.floor(next.z / grid.cell + grid.width / 2),
      );

      if (cell < 0 || blocked[cell]) next.copy(position);
    }

    cursor = 0;

    for (const vertex of vertices.values()) vertex.position.copy(moves[cursor++]);
  }

  const delta = new Vector3();

  for (const [a, b, c, d] of faces) {
    const corners = [a, b, c, d].map((id) => vertices.get(id)!);
    const [first, second, third, fourth] = corners;

    average.subVectors(third.position, first.position);
    delta.subVectors(fourth.position, second.position);
    average.cross(delta).normalize();

    for (const corner of corners) corner.normal.add(average);
  }

  for (const vertex of vertices.values()) vertex.normal.normalize();

  return vertices;
}
