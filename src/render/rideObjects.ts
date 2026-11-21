import * as T from 'three';
import type { Ride } from '../sim/ride.ts';
import { POWERS } from '../sim/powers.ts';
import { wrappedCandy } from './candy';
import { buildGags, buildInstruments } from './gags';

function part(parent: T.Object3D, geometry: T.BufferGeometry, color: number) {
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.59 }));

  parent.add(mesh);

  return mesh;
}

export function buildRideObjects(scene: T.Scene) {
  const tokens = Array.from({ length: 2 }, () => {
    const token = new T.Group();
    const jewel = part(token, new T.IcosahedronGeometry(0.13, 0), 0xffd061);
    const halo = part(token, new T.TorusGeometry(0.16, 0.016, 6, 16), 0xfffac0);
    const sweet = wrappedCandy(0xff4d8f, 0xffc1de);

    sweet.scale.setScalar(0.78);
    token.add(sweet);
    const beacon = part(token, new T.CircleGeometry(0.24, 16), 0xd79849);

    beacon.rotation.x = -Math.PI / 2;
    beacon.position.y = 0.014;
    scene.add(token);

    return { token, jewel, halo, beacon, sweet };
  });

  const candyDisplay = new T.Group();
  const sweets = [
    wrappedCandy(0xff397c, 0xffa6d6),
    wrappedCandy(0x47e5d6, 0xbaffed),
    wrappedCandy(0xd685ff, 0xffe4a0),
  ];

  candyDisplay.add(...sweets);
  scene.add(candyDisplay);

  const luggage = new Map<number, T.Group>();
  const stageMark = part(scene, new T.RingGeometry(0.44, 0.5, 20), 0xffc963);

  stageMark.rotation.x = -Math.PI / 2;
  const updateGags = buildGags(scene);
  const updateInstruments = buildInstruments(scene);
  const mic = part(scene, new T.BoxGeometry(0.105, 0.055, 0.045), 0xeeb641);

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
    const { pickups, time } = ride;
    const actor = ride.act;

    const candy = ride.candy;

    candyDisplay.visible = !!candy && candy.until > time && ride.phase !== 'popped';

    if (candy && candyDisplay.visible) {
      candyDisplay.position.set(candy.x, 1.48, candy.z);
      const life = Math.min(1, (candy.until - time) * 4);

      candyDisplay.scale.setScalar(life);

      for (const [index, sweet] of sweets.entries()) {
        const angle = time * 1.65 + (index * 2 * Math.PI) / sweets.length;

        sweet.position.set(
          Math.cos(angle) * 0.38,
          Math.sin(angle * 2) * 0.18,
          Math.sin(angle) * 0.38,
        );

        sweet.rotation.set(0.19, -angle, 0.22 * Math.sin(angle));
      }
    }

    for (const [index, { token, jewel, halo, beacon, sweet }] of tokens.entries()) {
      const pickup = pickups[index];

      token.visible = !!pickup;

      if (!pickup) continue;

      token.position.set(pickup.x, 0, pickup.z);
      jewel.position.y = pickup.y + Math.sin(time * 6 + index) * 0.055;
      jewel.rotation.set(time, index + time * 2.4, 0.2);
      jewel.visible = pickup.power !== 'candy';
      sweet.visible = !jewel.visible;
      sweet.position.copy(jewel.position);
      sweet.rotation.set(0.22, time * 2.4, 0.19);
      const color = POWERS[pickup.power].color;

      (jewel.material as T.MeshStandardMaterial).color.setHex(color);
      (beacon.material as T.MeshStandardMaterial).color.setHex(color);
      halo.position.y = jewel.position.y;
      halo.rotation.y = time * 2.4;
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
    const elapsed = time - (ride.encounter?.began ?? 0);
    const variant = ride.encounter?.variant;

    updateGags(act === 'prank' ? variant : undefined, actor?.x, actor?.z, elapsed);
    updateInstruments(act === 'musician' ? variant : undefined, actor?.x, actor?.z, elapsed);
    mic.visible = act === 'takes';
    stageMark.visible = !!actor;

    if (!actor) return;

    mic.position.set(actor.x + 0.21, 1.31, actor.z + 0.18);
    stageMark.position.set(actor.x, 0.018, actor.z);
    stageMark.scale.setScalar(1 + 0.15 * Math.sin(elapsed * 8) + ride.guestPressure * 0.16);

    (stageMark.material as T.MeshStandardMaterial).color.setHex(
      ride.guestPressure > 0 ? 0xf17340 : 0xffc963,
    );
  };
}
