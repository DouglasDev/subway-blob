import * as T from 'three';
import type { Rider } from '../sim/crowd.ts';
import { canvasTexture } from './platformArt';

type Figure = Pick<Rider, 'id' | 'x' | 'z' | 'heading' | 'stride'>;

const coats = [
  0xbc754b, 0x355e60, 0x934856, 0xcb9f57, 0x556f9b, 0x466349, 0x66558a, 0xbfb89a, 0x6b7983,
  0x283d45,
];
const skins = [0xdfa982, 0x8e5040, 0xb87752, 0x58362b, 0xe8ba98, 0xa66b52];
const pants = [0x273741, 0x41443b, 0x2c3e42, 0x4c3a39];
const hair = [0x332a26, 0x221a1a, 0x593c2e, 0xa77b54, 0x333433];

function part(scene: T.Object3D, geometry: T.BufferGeometry, map?: T.Texture) {
  const mesh = new T.InstancedMesh(
    geometry,
    new T.MeshStandardMaterial({ roughness: 0.84, map }),
    128,
  );

  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  return mesh;
}

function garment(kind: number) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#efeadf';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = ['#42406c', '#5a5347', '#3a6164', '#55445e'][kind];

    if (kind === 0) {
      ctx.save();
      ctx.translate(62, 52);
      ctx.rotate(-0.4);
      ctx.fillRect(-88, -20, 170, 29);
      ctx.fillRect(-88, 15, 170, 7);
      ctx.restore();
    } else if (kind === 1) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 5; col++) {
          if ((col + row) % 2 === 0) ctx.fillRect(14 + col * 20, 23 + row * 19, 20, 19);
        }
      }
    } else if (kind === 2) {
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.lineTo(61, 52);
      ctx.lineTo(128, 24);
      ctx.lineTo(128, 78);
      ctx.lineTo(62, 102);
      ctx.lineTo(0, 72);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#5c514a';

      for (const [x, y, size] of [
        [47, 44, 24],
        [83, 61, 23],
        [54, 83, 16],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillRect(17, 101, 94, 8);
    }
  });
}

export function buildRiders(scene: T.Object3D) {
  const torso = Array.from({ length: 4 }, (_, kind) =>
    part(scene, new T.BoxGeometry(1, 1, 1), garment(kind)),
  );
  const head = part(scene, new T.IcosahedronGeometry(1, 1));
  const hairMesh = part(scene, new T.IcosahedronGeometry(1, 1));
  const arms = [part(scene, new T.BoxGeometry(1, 1, 1)), part(scene, new T.BoxGeometry(1, 1, 1))];
  const legs = [part(scene, new T.BoxGeometry(1, 1, 1)), part(scene, new T.BoxGeometry(1, 1, 1))];
  const shoes = [part(scene, new T.BoxGeometry(1, 1, 1)), part(scene, new T.BoxGeometry(1, 1, 1))];
  const bags = part(scene, new T.BoxGeometry(1, 1, 1));
  const meshes = [head, hairMesh, bags, ...arms, ...legs, ...shoes];
  const person = new T.Object3D();
  const marker = new T.Object3D();
  const matrix = new T.Matrix4();
  const color = new T.Color();

  function stamp(
    mesh: T.InstancedMesh,
    index: number,
    tint: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    swing = 0,
  ) {
    marker.position.set(x, y, z);
    marker.rotation.x = swing;
    marker.scale.set(sx, sy, sz);
    marker.updateMatrix();
    mesh.setMatrixAt(index, matrix.multiplyMatrices(person.matrix, marker.matrix));
    mesh.setColorAt(index, color.setHex(tint));
  }

  return (riders: Figure[]) => {
    const shirts = [0, 0, 0, 0];

    for (const [index, { id, x, z, heading, stride }] of riders.entries()) {
      const size = 0.88 + ((id * 7) % 21) / 100;
      const jacket = coats[(id * 7 + 3) % coats.length];
      const skin = skins[(id * 5 + 3) % skins.length];
      const trousers = pants[(id * 5) % pants.length];
      const swing = stride ? Math.sin(stride) * 0.47 : 0;

      person.position.set(x, Math.abs(swing) * 0.06, z);
      person.rotation.y = heading + (stride ? 0 : ((id % 5) - 2) * 0.25);
      person.scale.setScalar(size);
      person.updateMatrix();
      const kind = (id * 3 + Math.floor(id / 7)) % torso.length;

      stamp(torso[kind], shirts[kind]++, jacket, 0, 1.08, 0, 0.36, 0.56, 0.23);
      stamp(head, index, skin, 0, 1.52, 0.014, 0.127, 0.167, 0.126);
      stamp(hairMesh, index, hair[id % hair.length], 0, 1.6, -0.023, 0.133, 0.091, 0.12);
      stamp(bags, index, 0x354348, 0, 1.05, -0.16, id % 3 === 0 ? 0.25 : 0, 0.33, 0.12);

      for (const [sideIndex, sign] of [-1, 1].entries()) {
        stamp(
          arms[sideIndex],
          index,
          jacket,
          sign * 0.231,
          1.04,
          -sign * swing * 0.1,
          0.092,
          0.51,
          0.11,
          -sign * swing,
        );

        stamp(
          legs[sideIndex],
          index,
          trousers,
          sign * 0.101,
          0.4,
          sign * swing * 0.13,
          0.132,
          0.77,
          0.154,
          sign * swing,
        );

        stamp(
          shoes[sideIndex],
          index,
          0x262c2c,
          sign * 0.101,
          0.068,
          0.045 - sign * swing * 0.33,
          0.146,
          0.124,
          0.244,
          sign * swing,
        );
      }
    }

    for (const mesh of meshes) mesh.count = riders.length;
    for (const [kind, mesh] of torso.entries()) mesh.count = shirts[kind];

    for (const mesh of [...meshes, ...torso]) {
      mesh.instanceMatrix.needsUpdate = true;

      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
}
