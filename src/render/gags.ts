import * as T from 'three';
import { RHINO_PRANK } from '../sim/hazards.ts';

function shape(parent: T.Object3D, geometry: T.BufferGeometry, color: number, x = 0, y = 0, z = 0) {
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.6 }));

  mesh.position.set(x, y, z);
  parent.add(mesh);

  return mesh;
}

export function buildGags(scene: T.Object3D) {
  const pigeon = new T.Group();

  shape(pigeon, new T.SphereGeometry(0.24, 10, 7), 0xb4a4cb).scale.set(1.35, 0.9, 0.76);
  shape(pigeon, new T.SphereGeometry(0.11, 8, 6), 0x71838a, 0.22, 0.16);
  const beak = shape(pigeon, new T.ConeGeometry(0.065, 0.14, 6), 0xffad56, 0.33, 0.14);

  beak.rotation.z = -Math.PI / 2;
  const wing = shape(pigeon, new T.SphereGeometry(0.19, 7, 6), 0x9366c5, -0.09, 0.04, 0.17);

  wing.scale.set(1.55, 0.39, 0.8);
  shape(pigeon, new T.CylinderGeometry(0.086, 0.11, 0.09, 7), 0xf4b84b, 0.22, 0.28);
  const rocket = new T.Group();

  shape(rocket, new T.CapsuleGeometry(0.14, 0.49, 4, 9), 0xe8aa55).scale.set(1.35, 1, 0.8);
  shape(rocket, new T.CapsuleGeometry(0.095, 0.55, 4, 9), 0xb94b34, 0, 0.045, 0.1);
  const jet = shape(rocket, new T.ConeGeometry(0.11, 0.37, 7), 0xffdf59, 0, -0.49);

  jet.rotation.x = Math.PI;

  const choir = new T.Group();
  const cones = Array.from({ length: 3 }, (_, index) => {
    const cone = new T.Group();

    cone.position.x = (index - 1) * 0.39;
    shape(cone, new T.ConeGeometry(0.14, 0.34, 7), 0xf2853e, 0, 0.17);
    shape(cone, new T.BoxGeometry(0.29, 0.055, 0.26), 0x4a565a);
    shape(cone, new T.SphereGeometry(0.07, 9, 7), 0xffdeb0, 0, 0.16, 0.09);
    choir.add(cone);

    return cone;
  });

  const fish = new T.Group();

  shape(fish, new T.SphereGeometry(0.21, 11, 7), 0x69c4af).scale.set(1.65, 0.85, 0.68);
  shape(fish, new T.ConeGeometry(0.15, 0.24, 4), 0x41a491, -0.35).rotation.z = -Math.PI / 2;
  shape(fish, new T.SphereGeometry(0.038, 7, 5), 0xfcf0ae, 0.19, 0.08, 0.119);

  shape(fish, new T.BoxGeometry(0.065, 0.15, 0.025), 0xdb5972, 0.13, -0.09, 0.147).rotation.z =
    -0.24;

  const caseLid = shape(scene, new T.BoxGeometry(0.48, 0.23, 0.29), 0x9d6099);

  const stampede = new T.Group();
  const horses = Array.from({ length: 5 }, (_, index) => {
    const horse = new T.Group();
    const color = [0xffad78, 0xf2de76, 0xa9e7b7, 0xc7a4fa, 0xff92c6][index];

    shape(horse, new T.BoxGeometry(0.28, 0.12, 0.11), color, 0, 0.12);
    shape(horse, new T.BoxGeometry(0.1, 0.18, 0.11), color, 0.09, 0.2).rotation.z = -0.32;
    shape(horse, new T.BoxGeometry(0.15, 0.075, 0.095), color, 0.14, 0.28);
    for (const x of [-0.09, 0.08])
      shape(horse, new T.BoxGeometry(0.045, 0.14, 0.075), color, x, 0.055);

    stampede.add(horse);

    return horse;
  });
  const rhino = new T.Group();

  shape(rhino, new T.SphereGeometry(0.28, 12, 9), 0x8797a8, 0, 1.47, 0.015);

  shape(rhino, new T.SphereGeometry(0.2, 10, 8), 0x929eaa, 0, 1.38, 0.22).scale.set(
    0.94,
    0.59,
    1.12,
  );

  shape(rhino, new T.BoxGeometry(0.44, 0.52, 0.33), 0x8393a4, 0, 1.04, 0.022);
  const horn = shape(rhino, new T.ConeGeometry(0.088, 0.33, 11), 0xf0e1bb, 0, 1.53, 0.36);

  horn.rotation.x = 0.6;

  for (const side of [-1, 1]) {
    shape(rhino, new T.SphereGeometry(0.082, 8, 7), 0x7a8695, side * 0.19, 1.69, -0.1).scale.set(
      0.63,
      1.18,
      0.58,
    );

    shape(rhino, new T.SphereGeometry(0.031, 8, 6), 0x101c21, side * 0.152, 1.5, 0.236);
  }

  const gags = [pigeon, rocket, choir, fish, stampede, rhino];

  scene.add(...gags);

  return (variant: number | undefined, x = 0, z = 0, time = 0, heading = 0, size = 1, bump = 0) => {
    for (const [index, gag] of gags.entries()) gag.visible = index === variant;
    caseLid.visible = variant === 0 || variant === 3 || variant === 4;

    if (variant === undefined) return;

    const bit = time % 7.2;
    const rise = Math.min(1, Math.max(0, (bit - 0.9) / 0.85));
    const settle = Math.min(1, Math.max(0, (7.2 - bit) / 1.12));

    caseLid.position.set(x - 0.1, 0.15, z + 0.56);
    caseLid.rotation.z = Math.sin(bit * 2.7) * 0.3;

    switch (variant) {
      case 0:
        pigeon.position.set(
          x + 0.2 + Math.sin(bit * 2) * rise,
          0.36 + (1.14 + Math.abs(Math.sin(bit * 3)) * 0.56) * rise,
          z + 0.35,
        );

        pigeon.scale.setScalar(0.22 + 1.68 * rise * settle);
        pigeon.rotation.set(Math.sin(bit * 2) * 0.43, bit * 4 * rise, Math.sin(bit * 3) * 0.36);
        wing.rotation.z = Math.sin(bit * 23) * 0.95;
        break;

      case 1: {
        const flight = Math.max(0, (bit - 0.94) % 2.25);

        rocket.position.set(
          x + Math.sin(flight * 2.6) * 0.9,
          0.43 + Math.sin((flight / 2.25) * Math.PI) * 1.48,
          z + 0.37,
        );

        rocket.rotation.z = 0.22 + Math.sin(flight * 4) * 0.82;
        jet.scale.setScalar(0.46 + rise * (0.8 + Math.sin(bit * 38) * 0.35));
        break;
      }

      case 2:
        choir.position.set(x, 0.25, z + 0.55);

        for (const [index, cone] of cones.entries()) {
          cone.position.y = Math.max(0, Math.sin(bit * 6 - index * 1.05)) ** 2 * 0.49;
          cone.rotation.z = Math.sin(bit * 7 + index * 0.95) * 0.37;
          cone.scale.y = 1 + Math.sin(bit * 10 + index) * 0.26;
        }

        break;
      case 3:
        fish.position.set(
          x + Math.sin(bit * 4.4) * 0.32,
          0.26 + Math.abs(Math.sin(bit * 4)) * 1.12 * rise,
          z + 0.54,
        );

        fish.rotation.set(bit * 5, Math.sin(bit * 4) * 0.59, 0.28 * Math.sin(bit * 13));
        fish.scale.setScalar(0.62 + rise * 0.89);
        break;
      case RHINO_PRANK:
        rhino.position.set(x, Math.abs(Math.sin(time * 12)) * 0.035, z);
        rhino.rotation.y = heading;
        rhino.rotation.x = bump * 0.19;
        rhino.scale.setScalar(size * (1 + bump * 0.1));
        break;
      case 4:
        stampede.position.set(x, 0.06, z + 0.45);

        for (const [index, horse] of horses.entries()) {
          const loop = (bit * 0.62 + index * 0.24) * Math.PI * 2;

          horse.position.set(
            Math.cos(loop) * (0.4 + rise * 0.59),
            Math.max(0, Math.sin(loop * 4)) * 0.2,
            Math.sin(loop) * 0.31,
          );

          horse.rotation.y = -loop - Math.PI;
        }

        break;
    }
  };
}

export function buildInstruments(scene: T.Object3D) {
  const accordion = new T.Group();

  shape(accordion, new T.BoxGeometry(0.37, 0.19, 0.13), 0xad5950);
  shape(accordion, new T.BoxGeometry(0.25, 0.14, 0.139), 0xd9b083);
  for (let i = 0; i < 6; i++)
    shape(accordion, new T.BoxGeometry(0.012, 0.14, 0.025), 0x584654, -0.095 + i * 0.038, 0, 0.072);

  const sax = new T.Group();

  shape(sax, new T.CylinderGeometry(0.025, 0.044, 0.33, 7), 0xf3bf5b).rotation.z = 0.35;

  shape(
    sax,
    new T.TorusGeometry(0.073, 0.027, 6, 12, Math.PI),
    0xc58f38,
    0.015,
    -0.114,
  ).rotation.z = Math.PI;

  shape(sax, new T.ConeGeometry(0.1, 0.14, 9), 0xf3bf5b, 0.105, -0.027).rotation.z = -0.32;

  const drum = new T.Group();

  shape(drum, new T.CylinderGeometry(0.17, 0.125, 0.25, 10), 0x7da0b3);
  shape(drum, new T.CylinderGeometry(0.174, 0.174, 0.028, 10), 0xded7b9, 0, 0.126);
  shape(drum, new T.BoxGeometry(0.022, 0.28, 0.022), 0xdfa776, 0.08, 0.25).rotation.z = 0.85;

  const violin = new T.Group();

  shape(violin, new T.SphereGeometry(0.15, 9, 7), 0xc27e4d, -0.095).scale.set(0.95, 0.7, 0.35);
  shape(violin, new T.BoxGeometry(0.19, 0.041, 0.039), 0x59372e, 0.1);

  shape(violin, new T.BoxGeometry(0.023, 0.29, 0.024), 0xdbbb82, -0.015, 0.01, 0.09).rotation.z =
    -0.49;

  const keytar = new T.Group();

  shape(keytar, new T.BoxGeometry(0.35, 0.14, 0.115), 0xa76bc4);
  shape(keytar, new T.BoxGeometry(0.19, 0.061, 0.041), 0xa76bc4, 0.245, 0.013);
  for (let i = 0; i < 8; i++)
    shape(keytar, new T.BoxGeometry(0.022, 0.079, 0.03), 0xf5d6b0, -0.125 + i * 0.033, 0, 0.065);

  const instruments = [accordion, sax, drum, violin, keytar];

  scene.add(...instruments);

  return (variant: number | undefined, x = 0, z = 0, time = 0, heading = 0) => {
    for (const [index, item] of instruments.entries()) {
      item.visible = index === variant;

      if (item.visible) {
        item.position.set(
          x + Math.sin(heading) * 0.22,
          1.07 + Math.sin(time * 8) * 0.055,
          z + Math.cos(heading) * 0.22,
        );

        item.rotation.y = heading;
        item.rotation.z = Math.sin(time * 4.1) * 0.18 - (index === 4 ? 0.29 : 0);
      }
    }
  };
}
