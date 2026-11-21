import * as T from 'three';
import type { Rider } from '../sim/crowd.ts';
import { garment, riderStyle, shirts } from './wardrobe';

type Figure = Pick<Rider, 'id' | 'x' | 'z' | 'heading' | 'stride' | 'role'>;

const skins = [0xdfa982, 0x8e5040, 0xb87752, 0x58362b, 0xe8ba98, 0xa66b52];

function part(scene: T.Object3D, geometry: T.BufferGeometry, map?: T.Texture, capacity = 128) {
  const mesh = new T.InstancedMesh(
    geometry,
    new T.MeshStandardMaterial({ roughness: 0.84, map }),
    capacity,
  );

  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  return mesh;
}

export function buildRiders(scene: T.Object3D) {
  const torso = Array.from({ length: shirts.length }, (_, kind) =>
    part(scene, new T.BoxGeometry(1, 1, 1), garment(kind)),
  );
  const head = part(scene, new T.IcosahedronGeometry(1, 1));
  const hair = part(scene, new T.IcosahedronGeometry(1, 1), undefined, 128 * 3);
  const box = new T.BoxGeometry(1, 1, 1);
  const arms = part(scene, box, undefined, 128 * 2);
  const legs = part(scene, box, undefined, 128 * 4);
  const shoes = part(scene, box, undefined, 128 * 4);
  const hems = part(scene, new T.CylinderGeometry(0.34, 0.56, 1, 10));
  const bags = part(scene, box);
  const meshes = [head, hair, arms, legs, shoes, hems, bags, ...torso];
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

  return (riders: Figure[], acrobat?: { id: number; move: number; age: number }) => {
    const counts = new Uint16Array(torso.length);
    let hairCount = 0;
    let legCount = 0;
    let hemCount = 0;

    for (const [index, { id, x, z, heading, stride, role }] of riders.entries()) {
      const size = 0.88 + ((id * 7) % 21) / 100;
      const style = riderStyle(id);
      const kind = role === 'takes' ? 1 : role === 'prank' ? 10 : style.shirt;
      const jacket = shirts[kind];
      const skin = skins[(id * 5 + 3) % skins.length];
      const dress = style.cut >= 8;
      const skirt = style.cut >= 6;
      const long = style.cut % 2 === 0;
      const shorts = style.cut === 5;
      const swing = stride ? Math.sin(stride) * 0.47 : 0;

      person.position.set(x, Math.abs(swing) * 0.06, z);
      person.rotation.y = heading + (stride ? 0 : ((id % 5) - 2) * 0.25);
      person.rotation.x = 0;
      person.rotation.z = 0;

      if (acrobat?.id === id && !stride) {
        const beat = acrobat.age * 4.6;
        const leap = Math.max(0, Math.sin(beat));

        switch (acrobat.move) {
          case 0:
            person.rotation.z = Math.sin(beat) * 1.28;
            person.position.y += Math.abs(Math.sin(beat)) * 0.38;
            break;
          case 1:
            person.rotation.z = Math.PI + Math.sin(beat) * 0.16;
            person.position.y += 1.6;
            break;
          case 2:
            person.rotation.y += beat * 1.9;
            person.rotation.x = Math.sin(beat) * 0.45;
            person.position.y += leap * 0.42;
            break;
          case 3:
            person.rotation.x = -leap * 1.08;
            person.position.y += leap * 0.72;
            break;

          case 4: {
            const turn = (acrobat.age % 2.1) / 2.1;

            person.rotation.z = turn * Math.PI * 2;
            person.position.x += Math.sin(turn * Math.PI * 2) * 0.35;
            person.position.y += Math.sin(turn * Math.PI) * 1.45;
            break;
          }
        }
      }

      person.scale.setScalar(size);
      person.updateMatrix();

      stamp(torso[kind], counts[kind]++, 0xffffff, 0, 1.08, 0, 0.36, 0.56, 0.23);
      stamp(head, index, skin, 0, 1.52, 0.014, 0.127, 0.167, 0.126);
      for (const [x, y, z, sx, sy, sz] of style.hair)
        stamp(hair, hairCount++, style.dye, x, y, z, sx, sy, sz);

      stamp(bags, index, 0x354348, 0, 1.05, -0.16, id % 3 === 0 ? 0.25 : 0, 0.33, 0.12);

      if (skirt) {
        const length = long ? 0.62 : 0.36;

        stamp(
          hems,
          hemCount++,
          dress ? jacket : style.bottom,
          0,
          0.91 - length / 2,
          0,
          0.51,
          length,
          0.38,
        );
      }

      for (const [sideIndex, sign] of [-1, 1].entries()) {
        const limb = index * 2 + sideIndex;
        const foot = limb * 2;
        const legX = sign * 0.101;
        const footZ = 0.045 - sign * swing * 0.33;
        const angle = sign * swing;
        const cuff = style.cut % 3 === 0 ? 0.159 : 0.119;

        stamp(
          arms,
          limb,
          jacket,
          sign * 0.231,
          1.04,
          -sign * swing * 0.1,
          0.092,
          0.51,
          0.11,
          -angle,
        );

        stamp(
          legs,
          legCount++,
          skirt || shorts ? skin : style.bottom,
          legX,
          0.4,
          sign * swing * 0.13,
          skirt || shorts ? 0.103 : cuff,
          0.77,
          0.144,
          angle,
        );

        if (shorts) {
          stamp(
            legs,
            legCount++,
            style.bottom,
            legX,
            0.66,
            sign * swing * 0.08,
            0.153,
            0.3,
            0.17,
            angle,
          );
        }

        stamp(shoes, foot, style.sneaker, legX, 0.077, footZ, 0.146, 0.105, 0.231, angle);
        stamp(shoes, foot + 1, 0xe5e0d3, legX, 0.023, footZ + 0.004, 0.153, 0.039, 0.242, angle);
      }
    }

    head.count = bags.count = riders.length;
    arms.count = riders.length * 2;
    shoes.count = riders.length * 4;
    hair.count = hairCount;
    hems.count = hemCount;
    legs.count = legCount;

    for (const [kind, mesh] of torso.entries()) mesh.count = counts[kind];

    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;

      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
}
