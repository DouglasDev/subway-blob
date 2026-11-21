import * as T from 'three';
import { HOT_VOLUME } from '../sim/ride.ts';
import type { Fluid } from '../sim/fluid.ts';
import { roundSurface } from './smoothSurface.ts';

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
  const maxVertices = Math.max(fluid.volume, HOT_VOLUME) * 36;
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
  const forward = new T.Vector3();
  const inward = new T.Vector3();
  const eyePoints = [new T.Vector3(), new T.Vector3()];
  let previousFacing = Infinity;
  let previousX = Infinity;
  let previousZ = Infinity;
  let previous: number[] | undefined;

  const green = new T.Color(0xb6ec58);
  const amber = new T.Color(0xffbc48);
  const red = new T.Color(0xf74136);

  return (popped: boolean, heat: number, wobble: number, facing: number) => {
    slime.color
      .copy(heat < 0.5 ? green : amber)
      .lerp(heat < 0.5 ? amber : red, heat < 0.5 ? heat * 2 : (heat - 0.5) * 2);

    slime.emissive.copy(slime.color).multiplyScalar(0.38);
    group.position.x = wobble * 0.13;
    group.visible = !popped;
    group.position.y = 0.12 * Math.abs(wobble);

    if (popped) return;

    if (fluid.cells !== previous) {
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
    } else if (facing === previousFacing && fluid.x === previousX && fluid.z === previousZ) {
      return;
    }

    previousFacing = facing;
    previousX = fluid.x;
    previousZ = fluid.z;
    forward.set(Math.sin(facing), 0, Math.cos(facing));
    inward.copy(forward).negate();
    group.updateMatrixWorld(true);

    for (const eye of eyes) eye.visible = false;

    // Cast onto the current surface so the eyes also follow compressed shapes.
    for (const [height, spacing] of [
      [1.46, 0.075],
      [1.2, 0.067],
      [0.91, 0.06],
      [0.58, 0.055],
    ]) {
      let hits = 0;

      for (const [index, point] of eyePoints.entries()) {
        const side = index ? spacing : -spacing;

        eyeOrigin.set(
          fluid.x + forward.x * 2 + forward.z * side,
          height,
          fluid.z + forward.z * 2 - forward.x * side,
        );

        ray.set(group.localToWorld(eyeOrigin), inward);
        const hit = ray.intersectObject(mesh, false)[0];

        if (hit) {
          point.copy(group.worldToLocal(hit.point)).addScaledVector(forward, 0.012);
          hits++;
        }
      }

      if (hits !== eyes.length) continue;

      for (const [index, eye] of eyes.entries()) {
        eye.position.copy(eyePoints[index]);
        eye.rotation.y = facing;
        eye.visible = true;
      }

      break;
    }
  };
}
