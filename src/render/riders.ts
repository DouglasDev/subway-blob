import * as T from 'three';
import { SKIN_TONES } from '../sim/crowd.ts';
import type { Rider } from '../sim/crowd.ts';
import { SPREADER_LEG, spreaderHeading, spreaderSitting } from '../sim/hazards.ts';
import { garment, riderStyle, shirts } from './wardrobe';
import { buildSneezeSpray } from './sneezeSpray';

type Figure = Pick<Rider, 'id' | 'x' | 'z' | 'heading' | 'stride' | 'role' | 'trajectory'> &
  Partial<Pick<Rider, 'skinTone' | 'phone'>>;

export function riderSize(id: number) {
  return 0.88 + ((id * 7) % 21) / 100;
}

export function riderFacing({ id, heading, stride }: Pick<Figure, 'id' | 'heading' | 'stride'>) {
  return heading + (stride ? 0 : ((id % 5) - 2) * 0.25);
}

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

  arms.name = 'Passenger arms';
  const legs = part(scene, box, undefined, 128 * 4);
  const seatedLegs = part(scene, new T.CylinderGeometry(0.47, 0.54, 1, 9), undefined, 128 * 4);
  const shoes = part(scene, box, undefined, 128 * 4);
  const hems = part(scene, new T.CylinderGeometry(0.34, 0.56, 1, 10));
  const bags = part(scene, box);
  const phones = part(scene, box);
  const screens = new T.InstancedMesh(box, new T.MeshBasicMaterial(), 128);

  phones.name = 'Passenger phones';
  screens.name = 'Passenger phone screens';
  screens.count = 0;
  screens.frustumCulled = false;
  screens.instanceMatrix.setUsage(T.DynamicDrawUsage);
  scene.add(screens);
  const meshes = [head, hair, arms, legs, seatedLegs, shoes, hems, bags, phones, screens, ...torso];
  const person = new T.Object3D();
  const marker = new T.Object3D();
  const joint = new T.Object3D();
  const jointMatrix = new T.Matrix4();
  const upperMatrix = new T.Matrix4();
  const headMatrix = new T.Matrix4();
  const neckOffset = new T.Matrix4().makeTranslation(0, -1.38, 0);
  const hipOffset = new T.Matrix4().makeTranslation(0, -0.84, 0);
  const mouth = new T.Vector3();
  const sneezeSpray = buildSneezeSpray(scene);
  const matrix = new T.Matrix4();
  const color = new T.Color();
  const up = new T.Vector3(0, 1, 0);
  const axis = new T.Vector3();
  const pivot = new T.Vector3();

  function legSegment(
    index: number,
    shade: number,
    sign: number,
    from: typeof SPREADER_LEG.hip,
    to: typeof SPREADER_LEG.hip,
    width: number,
  ) {
    axis.set(sign * (to.x - from.x), to.y - from.y, to.z - from.z);

    marker.position.set(
      (sign * (from.x + to.x)) / 2,
      (from.y + to.y) / 2 + 0.34,
      (from.z + to.z) / 2,
    );

    marker.scale.set(width, axis.length() + 0.1, width);
    marker.quaternion.setFromUnitVectors(up, axis.normalize());
    marker.updateMatrix();
    seatedLegs.setMatrixAt(index, matrix.multiplyMatrices(person.matrix, marker.matrix));
    seatedLegs.setColorAt(index, color.setHex(shade));
  }

  function hinge(x: number, y: number, z: number, angle: number, parent = person.matrix) {
    joint.position.set(x, y, z);
    joint.rotation.x = angle;
    joint.updateMatrix();
    jointMatrix.multiplyMatrices(parent, joint.matrix);
  }

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
    parent = person.matrix,
  ) {
    marker.position.set(x, y, z);
    marker.rotation.set(swing, 0, 0);
    marker.scale.set(sx, sy, sz);
    marker.updateMatrix();
    mesh.setMatrixAt(index, matrix.multiplyMatrices(parent, marker.matrix));
    mesh.setColorAt(index, color.setHex(tint));
  }

  return (
    riders: Figure[],
    acrobat?: { id: number; move: number; age: number },
    shove?: { id: number; age: number; heading: number },
    sneeze?: { id: number; age: number; at: number },
  ) => {
    const counts = new Uint16Array(torso.length);
    let hairCount = 0;
    let phoneCount = 0;
    let legCount = 0;
    let seatedLegCount = 0;
    let hemCount = 0;
    let spray: Parameters<typeof sneezeSpray>[0];

    for (const [index, rider] of riders.entries()) {
      const { id, x, z, stride, role } = rider;
      const phoneHand = !stride && !role && !rider.trajectory ? rider.phone : null;
      const seated = role === 'spreader' && !rider.trajectory && !stride && spreaderSitting(x, z);
      const size = seated ? 1 : riderSize(id);
      const style = riderStyle(id);
      const kind = role === 'takes' ? 1 : role === 'prank' ? 10 : style.shirt;
      const jacket = shirts[kind];
      const skin = rider.skinTone ?? SKIN_TONES[(id * 5 + 3) % SKIN_TONES.length];
      const dress = style.cut >= 8;
      const skirt = !seated && style.cut >= 6;
      const long = style.cut % 2 === 0;
      const shorts = style.cut === 5;
      const swing = stride ? Math.sin(stride) * 0.36 : 0;
      const hipY = 0.84;
      const soleLow = hipY - 0.8365 * Math.cos(swing) - 0.17 * Math.abs(Math.sin(swing));

      person.position.set(x, stride ? (0.0035 - soleLow) * size : 0, z);
      person.rotation.y = riderFacing(rider);
      person.rotation.x = 0;
      person.rotation.z = 0;
      const pushing = shove?.id === id ? Math.max(0, 1 - shove.age / 0.42) : 0;

      if (seated) {
        person.position.y = -0.34;
        person.rotation.y = spreaderHeading(x);
      }

      if (pushing && shove) {
        person.rotation.y = shove.heading;
        person.rotation.x = pushing * 0.16;
      }

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
            person.position.y += 0.13;
            break;
          case 2:
            person.rotation.y += beat * 1.9;
            person.rotation.x = Math.sin(beat) * 0.45;
            person.position.y += leap * 0.42;
            break;
          case 3:
            person.rotation.x = -leap * 1.08;
            person.position.y += leap * 0.35;
            break;

          case 4: {
            const turn = (acrobat.age % 2.1) / 2.1;

            person.rotation.z = turn * Math.PI * 2;
            person.position.x += Math.sin(turn * Math.PI * 2) * 0.35;
            person.position.y += Math.sin(turn * Math.PI) * 0.23;
            break;
          }
        }

        // Counter the movement of the local center when rotating the body.
        pivot.set(0, 0.85 * size, 0).applyQuaternion(person.quaternion);
        person.position.x -= pivot.x;
        person.position.y += 0.85 * size - pivot.y;
        person.position.z -= pivot.z;
      }

      person.scale.setScalar(size);
      person.updateMatrix();

      const sneezePose = sneeze?.id === id && sneeze.age < 0.78 ? sneeze : undefined;
      const bob =
        sneezePose && sneezePose.age < 0.44
          ? Math.sin(Math.PI * (sneezePose.age / 0.44) ** 0.68) * 0.64
          : 0;
      let upper = person.matrix;

      if (bob) {
        hinge(0, hipY, 0, bob);
        upper = upperMatrix.copy(jointMatrix).multiply(hipOffset);
      }

      if (sneezePose) {
        mouth.set(0, 1.46, 0.13).applyMatrix4(upper);
        spray = { ...sneezePose, mouth, heading: person.rotation.y };
      }

      stamp(torso[kind], counts[kind]++, 0xffffff, 0, 1.08, 0, 0.36, 0.56, 0.23, 0, upper);
      let face = upper;

      if (phoneHand) {
        hinge(0, 1.38, 0, 0.36, upper);
        face = headMatrix.copy(jointMatrix).multiply(neckOffset);
        hinge(phoneHand * 0.12, 1.11, 0.438, 0.37, upper);
        stamp(phones, phoneCount, 0x1b2029, 0, 0, 0, 0.1326, 0.221, 0.0429, 0, jointMatrix);

        stamp(
          screens,
          phoneCount++,
          0x8caeba,
          0,
          0,
          -0.0234,
          0.104,
          0.1872,
          0.0078,
          0,
          jointMatrix,
        );
      }

      stamp(head, index, skin, 0, 1.52, 0.014, 0.127, 0.167, 0.126, 0, face);
      for (const [x, y, z, sx, sy, sz] of style.hair)
        stamp(hair, hairCount++, style.dye, x, y, z, sx, sy, sz, 0, face);

      stamp(bags, index, 0x354348, 0, 1.05, -0.16, id % 3 === 0 ? 0.25 : 0, 0.33, 0.12, 0, upper);

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
        const angle = sign * swing;
        const cuff = style.cut % 3 === 0 ? 0.159 : 0.119;

        if (seated) {
          stamp(arms, limb, jacket, sign * 0.245, 0.94, 0.15, 0.104, 0.32, 0.113, -0.58);
          const { hip, knee, ankle } = SPREADER_LEG;

          legSegment(seatedLegCount++, style.bottom, sign, hip, knee, 0.23);
          legSegment(seatedLegCount++, style.bottom, sign, knee, ankle, 0.19);

          stamp(
            shoes,
            foot,
            style.sneaker,
            sign * ankle.x,
            0.414,
            ankle.z + 0.06,
            0.19,
            0.105,
            0.275,
          );

          stamp(
            shoes,
            foot + 1,
            0xe5e0d3,
            sign * ankle.x,
            0.366,
            ankle.z + 0.062,
            0.2,
            0.042,
            0.28,
          );

          continue;
        }

        hinge(
          sign * 0.202,
          1.315,
          0.006,
          -angle * 0.8 -
            pushing * 1.4 -
            (role === 'musician' ? 1.04 : phoneHand === sign ? 0.84 : 0),
          upper,
        );

        stamp(arms, limb, jacket, 0, -0.255, 0, 0.092, 0.51, 0.11, 0, jointMatrix);

        hinge(legX, hipY, 0, angle);

        stamp(
          legs,
          legCount++,
          skirt || shorts ? skin : style.bottom,
          0,
          -0.385,
          0,
          skirt || shorts ? 0.103 : cuff,
          0.77,
          0.144,
          0,
          jointMatrix,
        );

        if (shorts) {
          stamp(legs, legCount++, style.bottom, 0, -0.15, 0, 0.153, 0.3, 0.17, 0, jointMatrix);
        }

        stamp(
          shoes,
          foot,
          style.sneaker,
          0,
          0.077 - hipY,
          0.045,
          0.146,
          0.105,
          0.231,
          0,
          jointMatrix,
        );

        stamp(
          shoes,
          foot + 1,
          0xe5e0d3,
          0,
          0.023 - hipY,
          0.049,
          0.153,
          0.039,
          0.242,
          0,
          jointMatrix,
        );
      }
    }

    sneezeSpray(spray);
    head.count = bags.count = riders.length;
    arms.count = riders.length * 2;
    shoes.count = riders.length * 4;
    hair.count = hairCount;
    hems.count = hemCount;
    legs.count = legCount;
    seatedLegs.count = seatedLegCount;
    phones.count = screens.count = phoneCount;

    for (const [kind, mesh] of torso.entries()) mesh.count = counts[kind];

    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;

      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
}
