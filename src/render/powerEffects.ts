import * as T from 'three';
import type { Ride } from '../sim/ride.ts';

const palettes = {
  crazy: [0xff75da, 0x69ebff, 0xffe478, 0xa177ff, 0xe0ffa2],
  fart: [0xa6d941, 0xced74b, 0x7eb746, 0xe4ed76, 0x76ba86],
  cool: [0x76ecff, 0xd8ffff, 0x7dcdff, 0xa7eadf, 0xffffff],
  shield: [0x65b3fa, 0x67f1ff, 0x87eeee, 0xa1b6ff, 0xc9f7ff],
  annoy: [0xff834e, 0xffdb62, 0xf15b4d, 0xff9c73, 0xffef9e],
  candy: [0xff76b3, 0xffc26d, 0xddabff, 0x93ebd2, 0xfff19a],
  express: [0xffcf58, 0xffe694, 0xffa858, 0xffffaf, 0xfff8d2],
  fan: [0x67dcca, 0xa1f9dd, 0x7ff2eb, 0xc7fff3, 0x74c7ef],
  vomit: [0x96f032, 0xd5fb5a, 0x54d04d, 0xe9f977, 0x8bd931],
};

export function buildPowerEffects(scene: T.Scene) {
  const group = new T.Group();
  const chunk = new T.IcosahedronGeometry(1, 0);
  const ring = new T.Mesh(
    new T.TorusGeometry(1, 0.023, 7, 32),
    new T.MeshBasicMaterial({ color: 0xfedc84, transparent: true, depthWrite: false }),
  );

  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const particles = Array.from({ length: 28 }, () => {
    const particle = new T.Mesh(
      chunk,
      new T.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );

    group.add(particle);

    return particle;
  });

  const shield = new T.Mesh(
    new T.SphereGeometry(0.71, 21, 15),
    new T.MeshBasicMaterial({
      color: 0x75ccff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );

  shield.scale.y = 1.29;
  scene.add(group, shield);

  return (ride: Ride) => {
    const { animation, time, fluid } = ride;

    shield.visible = ride.shieldUntil > time && ride.phase !== 'popped';
    shield.position.set(fluid.x, 0.78, fluid.z);
    shield.material.opacity = 0.16 + Math.sin(time * 7) * 0.045;
    group.visible = !!animation && time < animation.until && ride.phase !== 'popped';
    if (!group.visible || !animation) return;

    const age = time - animation.began;
    const mode = animation.cue;
    const progress = age / (animation.until - animation.began);
    const palette = palettes[mode];

    group.position.set(fluid.x, 0, fluid.z);
    ring.scale.setScalar(0.22 + 1.58 * Math.min(1, progress * 1.35));
    ring.material.color.setHex(palette[1]);
    ring.material.opacity = (1 - progress) * 0.72;
    ring.position.y = 0.055;

    for (const [index, particle] of particles.entries()) {
      const angle = index * 2.39996 + age * (mode === 'crazy' ? 2.8 : 0.16);
      const burst = Math.max(0, age - (index % 7) * 0.055);
      const radius = Math.min(1.4, burst * (0.38 + (index % 6) * 0.12));

      particle.visible = burst > 0;
      particle.material.color.setHex(palette[index % palette.length]);
      particle.material.opacity = (1 - progress) * (mode === 'fart' ? 0.74 : 1);
      particle.rotation.set(age * (4 + (index % 3)), angle, age * 4 + index);

      if (mode !== 'fart' && mode !== 'vomit') {
        particle.position.set(
          Math.cos(angle) * radius,
          0.18 + (index % 8) * 0.23 + Math.sin(age * 5 + index) * 0.16,
          Math.sin(angle) * radius,
        );

        const size = (1 - progress * 0.7) * (0.7 + (index % 4) * 0.16);

        particle.scale.set(size * 0.072, size * 0.19, size * 0.053);
      } else if (mode === 'fart') {
        particle.position.set(
          Math.cos(angle) * radius,
          0.13 + burst * 0.54 + (index % 4) * 0.09,
          Math.sin(angle) * radius,
        );

        particle.scale.setScalar(0.09 + burst * (0.11 + (index % 5) * 0.025));
      } else {
        const forward = 0.22 + Math.min(1.7, burst * (1.35 + (index % 5) * 0.16));
        const height = Math.max(0.05, 1.3 + burst * (1.12 + (index % 4) * 0.27) - burst ** 2 * 2.3);

        particle.position.set(Math.sin(angle) * forward * 0.51, height, forward - 0.13);
        particle.scale.setScalar(0.062 + (index % 6) * 0.018);
      }
    }
  };
}
