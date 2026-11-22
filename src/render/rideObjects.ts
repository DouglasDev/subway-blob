import * as T from 'three';
import type { Ride } from '../sim/ride.ts';
import { POWERS } from '../sim/powers.ts';
import { omnyCardFactory } from './omnyCard';
import { riderFacing, riderSize } from './riders';
import { buildGags, buildInstruments } from './gags';

function part(parent: T.Object3D, geometry: T.BufferGeometry, color: number) {
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.59 }));

  parent.add(mesh);

  return mesh;
}

export function buildRideObjects(scene: T.Object3D) {
  const makeCard = omnyCardFactory();
  const tokens = Array.from({ length: 2 }, () => {
    const token = new T.Group();
    const jewel = part(token, new T.IcosahedronGeometry(0.13, 0), 0xffd061);
    const halo = part(token, new T.TorusGeometry(0.16, 0.016, 6, 16), 0xfffac0);
    const card = makeCard();

    card.scale.setScalar(0.78);
    token.add(card);
    const beacon = part(token, new T.CircleGeometry(0.24, 16), 0xd79849);

    beacon.rotation.x = -Math.PI / 2;
    beacon.position.y = 0.014;
    scene.add(token);

    return { token, jewel, halo, beacon, card };
  });

  const thrownCard = makeCard();

  thrownCard.visible = false;
  scene.add(thrownCard);

  const luggage = new Map<number, T.Group>();
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

    const toss = ride.omny;

    thrownCard.visible = !!toss && time < toss.until && ride.phase !== 'popped';

    if (toss && thrownCard.visible) {
      const travel = T.MathUtils.clamp((time - toss.began) / (toss.landsAt - toss.began), 0, 1);
      const heading = Math.atan2(toss.x - toss.origin.x, toss.z - toss.origin.z);
      const arc = Math.sin(Math.PI * travel);
      const landing = Math.max(0, time - toss.landsAt);
      const bounce = Math.max(0, 1 - landing * 5) * Math.abs(Math.sin(landing * 22)) * 0.065;

      thrownCard.position.set(
        T.MathUtils.lerp(toss.origin.x, toss.x, travel),
        T.MathUtils.lerp(1.02, 0.026, travel) + arc * 1.31 + bounce,
        T.MathUtils.lerp(toss.origin.z, toss.z, travel),
      );

      thrownCard.rotation.set(
        -Math.PI / 2 + arc * Math.cos(travel * Math.PI * 5) * 1.55,
        arc * 0.3,
        heading + travel * Math.PI * 4,
      );
    }

    for (const [index, { token, jewel, halo, beacon, card }] of tokens.entries()) {
      const pickup = pickups[index];

      token.visible = !!pickup;

      if (!pickup) continue;

      token.position.set(pickup.x, 0, pickup.z);
      jewel.position.y = pickup.y + Math.sin(time * 6 + index) * 0.055;
      jewel.rotation.set(time, index + time * 2.4, 0.2);
      jewel.visible = pickup.power !== 'omny';
      card.visible = !jewel.visible;
      card.position.copy(jewel.position);
      card.rotation.set(-0.17, time * 2.4, 0.19);
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

    updateGags(
      act === 'prank' ? variant : undefined,
      actor?.x,
      actor?.z,
      elapsed,
      actor ? riderFacing(actor) : 0,
      actor ? riderSize(actor.id) : 1,
      Math.max(0, 1 - (time - ride.rhinoImpactAt) * 4),
    );

    updateInstruments(
      act === 'musician' ? variant : undefined,
      actor?.x,
      actor?.z,
      elapsed,
      actor ? riderFacing(actor) : 0,
    );

    mic.visible = act === 'takes';
    if (actor && mic.visible) mic.position.set(actor.x + 0.21, 1.31, actor.z + 0.18);
  };
}
