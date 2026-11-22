import * as T from 'three';
import { CAR_LENGTH, CAR_WIDTH } from '../sim/car.ts';
import type { Ride } from '../sim/ride.ts';
import { PA_FEEDBACK_SECONDS, SODA_RADIUS } from '../sim/hazards.ts';

function part(parent: T.Object3D, geometry: T.BufferGeometry, color: number) {
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.52 }));

  parent.add(mesh);

  return mesh;
}

export function buildHazards(car: T.Object3D) {
  const dangerUniforms = {
    center: { value: new T.Vector2() },
    room: { value: new T.Vector2(CAR_LENGTH, CAR_WIDTH) },
    radius: { value: 0 },
    pulse: { value: 0 },
  };
  const ripple = new T.Mesh(
    new T.PlaneGeometry(CAR_LENGTH, CAR_WIDTH),
    new T.ShaderMaterial({
      uniforms: dangerUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 floorUV;
        void main() {
          floorUV = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 floorUV;
        uniform vec2 center;
        uniform vec2 room;
        uniform float radius;
        uniform float pulse;
        void main() {
          float d = length((floorUV - 0.5) * room - center);
          float rim = 1.0 - smoothstep(0.022, 0.064, abs(d - radius));
          float inside = 1.0 - smoothstep(radius - 0.05, radius, d);
          float wave = (1.0 - smoothstep(0.032, 0.145, abs(d - radius * pulse))) * inside;
          float fill = inside * (0.25 + 0.07 * cos(pulse * 6.283));
          float opacity = max(0.89 * rim, mix(fill, 0.86, wave));
          gl_FragColor = vec4(1.0, 0.035, 0.064, opacity);
        }
      `,
    }),
  );

  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.012;
  ripple.visible = false;
  car.add(ripple);

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
    const danger = ride.guestDanger;

    ripple.visible = !!danger && ride.phase !== 'popped' && ride.time >= ride.shieldUntil;

    if (danger) {
      dangerUniforms.center.value.set(danger.x, -danger.z);
      dangerUniforms.radius.value = danger.radius;
      const began = event?.kind === 'sneezy' ? ride.sneeze?.at : event?.began;

      dangerUniforms.pulse.value = ((ride.time - (began ?? ride.time)) * 1.38) % 1;
    }

    speaker.visible = !!location && event?.kind === 'speaker';
    spill.visible = !!location && event?.kind === 'soda';
    if (!location || !event) return;

    if (spill.visible) spill.position.set(location.x, 0.017, location.z);

    if (speaker.visible) {
      speaker.position.set(location.x, 1.96, location.z);
      const age = ride.time - event.began - 2;

      light.material.emissiveIntensity =
        age >= 0 && age < PA_FEEDBACK_SECONDS ? 1.1 + Math.sin(age * 26) : 0.12;

      for (const [index, ring] of soundRings.entries()) {
        const progress = (age * 1.58 - index / 3 + 1) % 1;

        ring.visible = age >= 0 && age < PA_FEEDBACK_SECONDS;
        ring.scale.setScalar(0.16 + progress * 0.74);
        ring.position.set(0, -progress * 0.19, 0.15 + progress * 0.38);
        ring.material.opacity = (1 - progress) * 0.62;
      }
    }
  };
}
