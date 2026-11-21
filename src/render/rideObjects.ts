import * as T from 'three';
import type { Ride } from '../sim/ride.ts';

function part(parent: T.Object3D, geometry: T.BufferGeometry, color: number) {
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.59 }));

  parent.add(mesh);

  return mesh;
}

export function buildRideObjects(scene: T.Scene) {
  const token = new T.Group();
  const jewel = part(token, new T.IcosahedronGeometry(0.13, 0), 0xffd061);
  const halo = part(token, new T.TorusGeometry(0.16, 0.016, 6, 16), 0xfffac0);
  const beacon = part(token, new T.CircleGeometry(0.24, 16), 0xd79849);

  beacon.rotation.x = -Math.PI / 2;
  scene.add(token);

  const luggage = new Map<number, T.Group>();
  const haze = new T.Group();
  const dots = Array.from({ length: 9 }, () =>
    part(haze, new T.IcosahedronGeometry(0.08, 0), 0xc2df66),
  );

  scene.add(haze);

  const gag = new T.Group();
  const pigeon = part(gag, new T.SphereGeometry(0.23, 10, 7), 0xb4a4cb);

  pigeon.scale.set(1.35, 0.9, 0.76);
  part(gag, new T.SphereGeometry(0.11, 8, 6), 0x71838a).position.set(0.22, 0.16, 0);
  part(gag, new T.ConeGeometry(0.06, 0.12, 6), 0xffab55).position.set(0.32, 0.15, 0);
  const instrument = new T.Group();

  part(instrument, new T.BoxGeometry(0.38, 0.19, 0.13), 0xc2944f);
  part(instrument, new T.BoxGeometry(0.31, 0.055, 0.14), 0xf4dfb6).position.y = 0.052;
  const mic = part(scene, new T.BoxGeometry(0.105, 0.055, 0.045), 0xeeb641);

  scene.add(gag, instrument);

  function makeLuggage(kind: 'bike' | 'suitcase', id: number) {
    const group = new T.Group();

    if (kind === 'suitcase') {
      part(group, new T.BoxGeometry(0.25, 0.37, 0.2), id % 2 ? 0x805e72 : 0x4f6b86).position.y =
        0.215;

      part(group, new T.BoxGeometry(0.1, 0.08, 0.035), 0x8d9c98).position.y = 0.437;

      for (const x of [-0.083, 0.083]) {
        part(group, new T.SphereGeometry(0.04, 6, 5), 0x252829).position.set(x, 0.045, 0.086);
      }
    } else {
      for (const x of [-0.22, 0.22]) {
        part(group, new T.TorusGeometry(0.14, 0.022, 6, 14), 0x293134).position.set(x, 0.15, 0);
      }

      for (const [x, y, angle] of [
        [-0.1, 0.24, -0.78],
        [0.11, 0.24, 0.78],
        [0, 0.32, 0],
        [0.17, 0.31, -1.12],
      ]) {
        const tube = part(
          group,
          new T.BoxGeometry(0.24, 0.022, 0.027),
          id % 2 ? 0xe2b76d : 0x65bbac,
        );

        tube.position.set(x, y, 0);
        tube.rotation.z = angle;
      }

      part(group, new T.BoxGeometry(0.11, 0.026, 0.08), 0x293134).position.set(-0.12, 0.39, 0);
      part(group, new T.BoxGeometry(0.045, 0.026, 0.21), 0x293134).position.set(0.16, 0.46, 0);
    }

    scene.add(group);
    luggage.set(id, group);

    return group;
  }

  return (ride: Ride) => {
    const { pickup, time, animation } = ride;
    const actor = ride.crowd.performer;

    token.visible = !!pickup;

    if (pickup) {
      token.position.set(pickup.x, 0, pickup.z);
      jewel.position.y = pickup.y + Math.sin(time * 6) * 0.055;
      jewel.rotation.set(time, time * 2.4, 0.2);

      (jewel.material as T.MeshStandardMaterial).color.setHex(
        pickup.power === 'crazy' ? 0xb880fe : 0xffd061,
      );

      halo.position.y = jewel.position.y;
      halo.rotation.y = time * 2.4;
      beacon.position.y = 0.014;
    }

    for (const group of luggage.values()) group.visible = false;

    for (const { id, prop } of ride.crowd.riders) {
      if (!prop) continue;

      const group = luggage.get(id) ?? makeLuggage(prop.kind, id);

      group.visible = true;
      group.position.set(prop.x, 0, prop.z);
    }

    gag.visible = !!actor && ride.encounter?.kind === 'prank' && !actor.trajectory;
    instrument.visible = !!actor && ride.encounter?.kind === 'musician' && !actor.trajectory;
    mic.visible = !!actor && ride.encounter?.kind === 'takes' && !actor.trajectory;

    if (actor) {
      gag.position.set(actor.x + 0.25, 0.78 + Math.abs(Math.sin(time * 4)) * 0.48, actor.z + 0.29);
      gag.rotation.z = Math.sin(time * 3) * 0.23;
      instrument.position.set(actor.x, 1.07 + Math.sin(time * 7) * 0.05, actor.z + 0.18);
      mic.position.set(actor.x + 0.21, 1.31, actor.z + 0.18);
    }

    haze.visible = !!animation && animation.cue !== 'crazy' && animation.until > time;

    if (haze.visible && animation) {
      const elapsed = 1.15 - (animation.until - time);

      haze.position.set(ride.fluid.x, animation.cue === 'vomit' ? 1.13 : 0.27, ride.fluid.z);

      for (const [index, dot] of dots.entries()) {
        dot.position.set(
          Math.sin(index * 2.4) * elapsed * 0.65,
          Math.max(-0.24, Math.sin(index * 4) * elapsed * 0.56),
          elapsed * Math.cos(index * 2.4) * 0.78,
        );

        dot.scale.setScalar(
          Math.max(0.1, (1.2 - elapsed) * (animation.cue === 'vomit' ? 0.7 : 1.45)),
        );
      }
    }
  };
}
