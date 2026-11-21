import * as T from 'three';
import type { Fluid } from '../sim/fluid.ts';
import { roundSurface } from './smoothSurface';

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
const triangles = [0, 1, 2, 0, 2, 3];

export function buildBlob(scene: T.Scene, fluid: Fluid, blocked: Uint8Array) {
  const group = new T.Group();
  const geometry = new T.BufferGeometry();
  const maxVertices = fluid.volume * 36;
  const positions = new Float32Array(maxVertices * 3);
  const directions = new Float32Array(maxVertices * 3);
  const position = new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage);
  const direction = new T.BufferAttribute(directions, 3).setUsage(T.DynamicDrawUsage);

  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', direction);
  geometry.boundingSphere = new T.Sphere(new T.Vector3(0, 0.85, 0), 6);
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
  const ray = new T.Raycaster();
  const eyeOrigin = new T.Vector3();
  const towardCar = new T.Vector3(0, 0, -1);
  let previous: number[] | undefined;

  return (popped: boolean) => {
    group.visible = !popped;

    if (popped || fluid.cells === previous) return;

    previous = fluid.cells;
    wet.fill(0);

    for (const id of fluid.cells) wet[id] = 1;

    const { grid } = fluid;
    const boundary: number[][] = [];
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

        boundary.push(vertices);
      }
    }

    const vertices = roundSurface(boundary, grid, blocked);
    let cursor = 0;

    for (const face of boundary) {
      for (const point of triangles) {
        const vertex = vertices.get(face[point])!;

        vertex.position.toArray(positions, cursor);
        vertex.normal.toArray(directions, cursor);
        cursor += 3;
      }
    }

    geometry.setDrawRange(0, cursor / 3);
    position.needsUpdate = true;
    direction.needsUpdate = true;

    for (const [index, eye] of eyes.entries()) {
      eye.visible = false;

      if (fluid.pressure >= 0.42) continue;

      const x = fluid.x + (index ? 0.075 : -0.075);

      ray.set(eyeOrigin.set(x, 1.461, 1.3), towardCar);
      const hit = ray.intersectObject(mesh, false)[0];

      if (!hit) continue;

      eye.position.copy(hit.point);
      eye.position.z += 0.008;
      eye.visible = true;
    }
  };
}
