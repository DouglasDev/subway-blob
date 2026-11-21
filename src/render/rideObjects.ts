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
  const stageMark = part(scene, new T.RingGeometry(0.44, 0.5, 20), 0xffc963);

  stageMark.rotation.x = -Math.PI / 2;
  const gag = new T.Group();
  const pigeon = part(gag, new T.SphereGeometry(0.23, 10, 7), 0xb4a4cb);

  pigeon.scale.set(1.35, 0.9, 0.76);
  part(gag, new T.SphereGeometry(0.11, 8, 6), 0x71838a).position.set(0.22, 0.16, 0);
  part(gag, new T.ConeGeometry(0.06, 0.12, 6), 0xffab55).position.set(0.32, 0.15, 0);
  const wing = part(gag, new T.SphereGeometry(0.19, 7, 6), 0x9366c5);

  wing.position.set(-0.09, 0.04, 0.17);
  wing.scale.set(1.55, 0.39, 0.8);
  const crown = part(gag, new T.CylinderGeometry(0.086, 0.11, 0.09, 7), 0xf4b84b);

  crown.position.set(0.22, 0.28, 0);
  const caseLid = part(scene, new T.BoxGeometry(0.48, 0.23, 0.29), 0x9d6099);
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
    const { pickup, time } = ride;
    const actor = ride.act;

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

    const onboard = new Set(ride.crowd.riders.filter(({ prop }) => prop).map(({ id }) => id));

    for (const [id, group] of luggage) {
      if (onboard.has(id)) continue;
      group.removeFromParent();

      group.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        object.geometry.dispose();
        (object.material as T.Material).dispose();
      });

      luggage.delete(id);
    }

    for (const { id, prop } of ride.crowd.riders) {
      if (!prop) continue;

      const group = luggage.get(id) ?? makeLuggage(prop.kind, id);

      group.visible = true;
      group.position.set(prop.x, 0, prop.z);
    }

    const act = actor?.role;

    gag.visible = act === 'prank';
    caseLid.visible = gag.visible;
    instrument.visible = act === 'musician';
    mic.visible = act === 'takes';
    stageMark.visible = act === 'acrobat' || instrument.visible || gag.visible;

    if (!actor || !ride.encounter) return;

    const elapsed = time - ride.encounter.began;
    const bit = elapsed % 7.2;
    const flight = Math.min(1, Math.max(0, (bit - 1.15) / 1.05));
    const tuck = Math.min(1, Math.max(0, (7.15 - bit) / 1.28));

    gag.position.set(
      actor.x + 0.2 + Math.sin(bit * 2.0) * 1.1 * flight,
      0.32 + (1.14 + Math.abs(Math.sin(bit * 3)) * 0.56) * flight,
      actor.z + 0.35 + Math.sin(bit * 1.7) * 0.42 * flight,
    );

    gag.scale.setScalar(0.22 + 1.68 * flight * tuck);
    gag.rotation.set(Math.sin(bit * 2) * 0.43, bit * 4 * flight, Math.sin(bit * 3) * 0.36);
    wing.rotation.z = Math.sin(bit * 23) * 0.95;
    caseLid.position.set(actor.x - 0.1, 0.15, actor.z + 0.57);
    caseLid.rotation.z = Math.sin(bit * 2.7) * 0.3;
    instrument.position.set(actor.x, 1.09 + Math.sin(elapsed * 8) * 0.06, actor.z + 0.2);
    instrument.rotation.z = Math.sin(elapsed * 4.1) * 0.18;
    mic.position.set(actor.x + 0.21, 1.31, actor.z + 0.18);
    stageMark.position.set(actor.x, 0.018, actor.z);
    stageMark.scale.setScalar(1 + 0.18 * Math.sin(elapsed * 8));
  };
}
