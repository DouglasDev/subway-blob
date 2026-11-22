import * as T from 'three';
import type { Ride } from '../sim/ride.ts';
import { SODA_RADIUS } from '../sim/hazards.ts';

function part(parent: T.Object3D, geometry: T.BufferGeometry, color: number) {
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.52 }));

  parent.add(mesh);

  return mesh;
}

export function buildHazards(car: T.Object3D) {
  const speaker = new T.Group();

  part(speaker, new T.BoxGeometry(0.51, 0.29, 0.17), 0x283334);
  part(speaker, new T.BoxGeometry(0.48, 0.24, 0.035), 0x59615b).position.z = 0.09;
  for (let row = -2; row <= 2; row++)
    part(speaker, new T.BoxGeometry(0.4, 0.017, 0.012), 0x262725).position.set(
      0,
      row * 0.035,
      0.116,
    );
  const light = part(speaker, new T.SphereGeometry(0.023, 8, 6), 0xfcc66d);

  light.position.set(0.19, 0.09, 0.126);
  light.material.emissive.setHex(0xff962e);
  const soundRings = Array.from({ length: 3 }, () => {
    const ring = new T.Mesh(
      new T.RingGeometry(0.89, 1, 32),
      new T.MeshBasicMaterial({
        color: 0xffd38b,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );

    speaker.add(ring);

    return ring;
  });

  const spill = new T.Group();
  const outline = new T.Shape();

  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const radius = SODA_RADIUS * (0.89 + 0.08 * Math.sin(angle * 5) + 0.06 * Math.sin(angle * 9));

    if (i === 0) outline.moveTo(radius, 0);
    else outline.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.86);
  }

  outline.closePath();
  const puddle = part(spill, new T.ShapeGeometry(outline), 0x8f4723);

  puddle.rotation.x = -Math.PI / 2;
  puddle.material.roughness = 0.13;
  puddle.material.emissive.setHex(0x391a07);
  const can = new T.Group();

  can.position.set(0.49, 0.081, -0.26);
  can.scale.setScalar(1.24);
  can.rotation.z = 1.44;
  part(can, new T.CylinderGeometry(0.061, 0.061, 0.175, 10), 0xb84439);
  for (const side of [-1, 1])
    part(can, new T.CylinderGeometry(0.062, 0.062, 0.018, 10), 0xd6d3c5).position.y = side * 0.084;
  spill.add(can);

  for (let i = 0; i < 23; i++) {
    const angle = i * 2.39996;
    const distance = (0.24 + (i % 9) * 0.061) * SODA_RADIUS;
    const shine = part(
      spill,
      new T.CircleGeometry(0.009 + (i % 5) * 0.007, 8),
      i % 3 ? 0xc77c41 : 0xe8af6d,
    );

    shine.position.set(Math.cos(angle) * distance, 0.0027, Math.sin(angle) * distance * 0.81);
    shine.rotation.x = -Math.PI / 2;
    shine.scale.x = 1.4;
  }

  car.add(spill, speaker);
  speaker.visible = spill.visible = false;

  return (ride: Ride) => {
    const event = ride.encounter;
    const location = event?.location;

    speaker.visible = !!location && event?.kind === 'speaker';
    spill.visible = !!location && event?.kind === 'soda';
    if (!location || !event) return;

    if (spill.visible) spill.position.set(location.x, 0.017, location.z);

    if (speaker.visible) {
      speaker.position.set(location.x, 1.96, location.z);
      const age = ride.time - event.began - 2;

      light.material.emissiveIntensity = age >= 0 && age < 3.2 ? 1.1 + Math.sin(age * 26) : 0.12;

      for (const [index, ring] of soundRings.entries()) {
        const progress = (age * 1.58 - index / 3 + 1) % 1;

        ring.visible = age >= 0 && age < 3.2;
        ring.scale.setScalar(0.16 + progress * 0.74);
        ring.position.set(0, -progress * 0.19, 0.15 + progress * 0.38);
        ring.material.opacity = (1 - progress) * 0.62;
      }
    }
  };
}
