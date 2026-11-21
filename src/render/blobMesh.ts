import * as T from 'three';
import type { Fluid } from '../sim/fluid.ts';

const faces = [
  [
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
    [1, 0, 1],
  ],
  [
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 0],
    [0, 0, 0],
  ],
  [
    [0, 1, 0],
    [0, 1, 1],
    [1, 1, 1],
    [1, 1, 0],
  ],
  [
    [0, 0, 1],
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
  ],
  [
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
    [0, 0, 1],
  ],
  [
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [1, 0, 0],
  ],
];
const normals = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const triangles = [0, 1, 2, 0, 2, 3];

export function buildBlob(scene: T.Scene, fluid: Fluid) {
  const group = new T.Group();
  const geometry = new T.BufferGeometry();
  const maxVertices = fluid.volume * 36;
  const positions = new Float32Array(maxVertices * 3);
  const directions = new Float32Array(maxVertices * 3);
  const position = new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage);
  const direction = new T.BufferAttribute(directions, 3).setUsage(T.DynamicDrawUsage);

  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', direction);
  const slime = new T.MeshPhysicalMaterial({
    color: 0xb6ec58,
    emissive: 0x486319,
    emissiveIntensity: 0.28,
    roughness: 0.3,
    metalness: 0.04,
    clearcoat: 0.83,
    clearcoatRoughness: 0.29,
  });
  const mesh = new T.Mesh(geometry, slime);

  mesh.frustumCulled = false;
  group.add(mesh);

  const eyeMaterial = new T.MeshBasicMaterial({ color: 0x253227 });
  const eyeGeometry = new T.SphereGeometry(1, 12, 8);
  const eyes = [-1, 1].map(() => {
    const eye = new T.Mesh(eyeGeometry, eyeMaterial);

    eye.scale.set(0.028, 0.043, 0.019);
    group.add(eye);

    return eye;
  });

  scene.add(group);

  const wet = new Uint8Array(fluid.grid.size);
  let previous: number[] | undefined;

  return (popped: boolean) => {
    group.visible = !popped;

    if (popped || fluid.cells === previous) return;

    previous = fluid.cells;
    wet.fill(0);

    for (const id of fluid.cells) wet[id] = 1;

    const { grid } = fluid;
    const smooth = new Map<number, T.Vector3>();
    const boundary: { side: number; vertices: number[] }[] = [];
    const vertexWidth = grid.width + 1;
    const vertexHeight = grid.height + 1;
    const vertexLayer = vertexHeight * vertexWidth;

    for (const id of fluid.cells) {
      const x = Math.floor(id / (grid.height * grid.width));
      const y = Math.floor(id / grid.width) % grid.height;
      const z = id % grid.width;

      for (let side = 0; side < 6; side++) {
        if (wet[grid.neighbors[id * 6 + side]]) continue;

        const vertices = faces[side].map(
          ([dx, dy, dz]) => (x + dx) * vertexLayer + (y + dy) * vertexWidth + z + dz,
        );

        boundary.push({ side, vertices });

        for (const vertex of vertices) {
          const normal = smooth.get(vertex) ?? new T.Vector3();
          const [nx, ny, nz] = normals[side];

          normal.x += nx;
          normal.y += ny;
          normal.z += nz;
          smooth.set(vertex, normal);
        }
      }
    }

    let cursor = 0;
    const normal = new T.Vector3();

    for (const { side, vertices } of boundary) {
      const base = normals[side];

      for (const point of triangles) {
        const vertex = vertices[point];
        const avg = smooth.get(vertex)!;

        positions[cursor] = (Math.floor(vertex / vertexLayer) - grid.length / 2) * grid.cell;
        positions[cursor + 1] = (Math.floor(vertex / vertexWidth) % vertexHeight) * grid.cell;
        positions[cursor + 2] = ((vertex % vertexWidth) - grid.width / 2) * grid.cell;

        normal
          .set(base[0] + avg.x * 0.64, base[1] + avg.y * 0.64, base[2] + avg.z * 0.64)
          .normalize();

        directions[cursor] = normal.x;
        directions[cursor + 1] = normal.y;
        directions[cursor + 2] = normal.z;
        cursor += 3;
      }
    }

    geometry.setDrawRange(0, cursor / 3);
    position.needsUpdate = true;
    direction.needsUpdate = true;

    for (const [index, eye] of eyes.entries()) {
      const x = fluid.x + (index ? 0.075 : -0.075);
      let front = -Infinity;

      for (const id of fluid.cells) {
        const point = id * 3;

        if (
          Math.abs(grid.centers[point] - x) < 0.052 &&
          Math.abs(grid.centers[point + 1] - 1.45) < 0.051
        ) {
          front = Math.max(front, grid.centers[point + 2]);
        }
      }

      eye.visible = Number.isFinite(front) && fluid.pressure < 0.42;

      if (eye.visible) eye.position.set(x, 1.461, front + 0.051);
    }
  };
}
