import * as T from 'three';
import { CAR_LENGTH, CAR_WIDTH } from '../sim/car.ts';
import type { Ride } from '../sim/ride.ts';
import { PA_FEEDBACK_SECONDS, SODA_EDGE } from '../sim/hazards.ts';

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
  const spillUniforms = {
    center: { value: new T.Vector2() },
    radius: { value: 0 },
    room: { value: dangerUniforms.room.value },
  };
  const [base, rippleEdge, flecks] = SODA_EDGE;
  const puddle = new T.Mesh(
    new T.PlaneGeometry(CAR_LENGTH, CAR_WIDTH),
    new T.ShaderMaterial({
      uniforms: spillUniforms,
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
      uniform float radius;
      uniform vec2 room;
      void main() {
        vec2 point = vec2(floorUV.x - 0.5, 0.5 - floorUV.y) * room - center;
        float angle = dot(point, point) > 0.00000001 ? atan(point.y, point.x) : 0.0;
        float edge = radius * (${base} + ${rippleEdge} * sin(angle * 5.0) + ${flecks} * sin(angle * 9.0));
        float inset = edge - length(point);
        if (inset < 0.0) discard;
        float lip = (1.0 - smoothstep(0.009, 0.05, inset)) * (0.58 + 0.42 * cos(angle + 0.9));
        float sheen = smoothstep(0.78, 0.98, sin(point.x * 19.0 + sin(point.y * 31.0) * 0.5)) * 0.12;
        vec3 color = vec3(0.47, 0.22, 0.105) + (lip * 0.42 + sheen) * vec3(1.0, 0.68, 0.38);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    }),
  );

  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = 0.017;
  puddle.visible = false;
  car.add(puddle);
  const can = new T.Group();

  can.position.set(0.49, 0.081, -0.26);
  can.scale.setScalar(1.24);
  can.rotation.z = 1.44;
  part(can, new T.CylinderGeometry(0.061, 0.061, 0.175, 10), 0xb84439);
  for (const side of [-1, 1])
    part(can, new T.CylinderGeometry(0.062, 0.062, 0.018, 10), 0xd6d3c5).position.y = side * 0.084;
  spill.add(can);

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
    const soda = ride.sodaSpill;

    spill.visible = puddle.visible = !!soda;

    if (soda) {
      spill.position.set(soda.x, 0.017, soda.z);
      spillUniforms.center.value.set(soda.x, soda.z);
      spillUniforms.radius.value = soda.radius;
    }

    if (!location || !event) return;

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
