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

export function buildBlob(scene: T.Object3D, fluid: Fluid, blocked: Uint8Array) {
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

  slime.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 blobPoint;\n' + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nblobPoint = position;',
    );

    shader.fragmentShader = 'varying vec3 blobPoint;\n' + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      float current = sin(blobPoint.y * 17.0 + sin(blobPoint.x * 10.0) * 1.4 + blobPoint.z * 8.0);
      diffuseColor.rgb *= 0.94 + 0.10 * smoothstep(-0.5, 0.85, current);
    `,
    );
  };

  const eyeGeometry = new T.SphereGeometry(1, 12, 8);
  const whites = new T.MeshBasicMaterial({ color: 0xf4e9c0 });
  const ink = new T.MeshBasicMaterial({ color: 0x29332b });
  const eyes = [-1, 1].map(() => {
    const eye = new T.Group();
    const white = new T.Mesh(eyeGeometry, whites);
    const pupil = new T.Mesh(eyeGeometry, ink);
    const lid = new T.Mesh(eyeGeometry, slime);
    const brow = new T.Mesh(eyeGeometry, ink);

    white.scale.set(0.043, 0.047, 0.026);
    pupil.position.set(0, -0.004, 0.027);
    pupil.scale.set(0.019, 0.029, 0.011);
    lid.position.set(0, 0.035, 0.029);
    lid.scale.set(0.043, 0.019, 0.015);
    brow.position.set(0, 0.057, 0.022);
    brow.scale.set(0.047, 0.009, 0.012);
    eye.add(white, pupil, lid, brow);
    group.add(eye);

    return { eye, lid, brow, pupil };
  });

  scene.add(group);

  const wet = new Uint8Array(fluid.grid.size);
  const ray = new T.Raycaster();
  const eyeOrigin = new T.Vector3();
  const forward = new T.Vector3();
  const inward = new T.Vector3();
  const worldFacing = new T.Quaternion();
  const eyePoints = [new T.Vector3(), new T.Vector3()];
  let previousFacing = Infinity;
  let previousX = Infinity;
  let previousZ = Infinity;
  let previous: number[] | undefined;

  const green = new T.Color(0xb6ec58);
  const amber = new T.Color(0xffbc48);
  const red = new T.Color(0xf74136);
  const blue = new T.Color(0x54a9ff);
  const aqua = new T.Color(0x53f3c7);
  const hurt = new T.Color(0xffcfaf);
  const shieldHurt = new T.Color(0xc3edff);

  return (
    popped: boolean,
    heat: number,
    wobble: number,
    facing: number,
    riders = 12,
    quiet = false,
    superFluid = false,
    pulse = 0,
    damageFlash = 0,
  ) => {
    const tone = T.MathUtils.clamp(heat + pulse, 0, 1);

    slime.color
      .copy(tone < 0.5 ? green : amber)
      .lerp(tone < 0.5 ? amber : red, tone < 0.5 ? tone * 2 : (tone - 0.5) * 2);

    if (quiet) slime.color.copy(blue).multiplyScalar(1 + pulse * 0.5);
    else if (superFluid) slime.color.lerp(aqua, 0.64);

    slime.color.lerp(quiet ? shieldHurt : hurt, damageFlash * 0.74);

    const fatigue = T.MathUtils.clamp((riders - 12) / 55, 0, 1);

    for (const [index, { lid, brow, pupil }] of eyes.entries()) {
      const tilt = (index === 0 ? 1 : -1) * (0.11 + fatigue * 0.42);

      lid.position.y = 0.034 - fatigue * 0.023;
      lid.scale.y = 0.021 + fatigue * 0.012;
      lid.rotation.z = brow.rotation.z = tilt;
      brow.position.y = 0.06 - fatigue * 0.003;
      pupil.position.y = -0.007 - fatigue * 0.012;
      pupil.scale.y = 0.025 - fatigue * 0.006;
    }

    slime.emissive.copy(slime.color).multiplyScalar(0.38);
    slime.emissiveIntensity = 0.28 + 0.89 * damageFlash;
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
    group.updateWorldMatrix(true, true);
    inward.copy(forward).negate().applyQuaternion(group.getWorldQuaternion(worldFacing));

    for (const { eye } of eyes) eye.visible = false;

    // Cast onto the current surface so the eyes also follow compressed shapes.
    for (const [height, spacing] of [
      [1.46, 0.075],
      [1.2, 0.067],
      [0.91, 0.06],
      [0.58, 0.055],
      [0.36, 0.065],
      [0.24, 0.064],
      [0.14, 0.061],
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

      for (const [index, { eye }] of eyes.entries()) {
        eye.position.copy(eyePoints[index]);
        eye.rotation.y = facing;
        eye.visible = true;
      }

      break;
    }
  };
}
