import * as T from 'three';
import type { Power } from '../sim/powers.ts';
import type { Ride } from '../sim/ride.ts';

const palettes: Record<Exclude<Power, 'shield' | 'omny'>, number[]> = {
  crazy: [0xff75da, 0x69ebff, 0xffe478, 0xa177ff, 0xe0ffa2],
  fart: [0xa6d941, 0xced74b, 0x7eb746, 0xe4ed76, 0x76ba86],
  cool: [0x76ecff, 0xd8ffff, 0x7dcdff, 0xa7eadf, 0xffffff],
  fluid: [0x6effdc, 0xb6fff1, 0x61d4a9, 0xcffffe, 0x9bfbcd],
  annoy: [0xff834e, 0xffdb62, 0xf15b4d, 0xff9c73, 0xffef9e],
  express: [0xffcf58, 0xffe694, 0xffa858, 0xffffaf, 0xfff8d2],
  vomit: [0x96f032, 0xd5fb5a, 0x54d04d, 0xe9f977, 0x8bd931],
};

export function buildPowerEffects(scene: T.Object3D) {
  const group = new T.Group();
  const chunk = new T.IcosahedronGeometry(1, 0);
  const flake = new T.Shape();

  for (let tip = 0; tip < 24; tip++) {
    const angle = (tip / 24) * Math.PI * 2;
    const radius = tip % 4 === 0 ? 1 : tip % 2 === 0 ? 0.49 : 0.27;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (tip === 0) flake.moveTo(x, y);
    else flake.lineTo(x, y);
  }

  flake.closePath();
  const snow = new T.ShapeGeometry(flake);
  const alarm = new T.Group();
  const beacon = new T.Mesh(
    new T.CylinderGeometry(0.115, 0.14, 0.2, 10),
    new T.MeshBasicMaterial({ color: 0xff6b3d }),
  );
  const cap = new T.Mesh(
    new T.CylinderGeometry(0.101, 0.113, 0.056, 10),
    new T.MeshBasicMaterial({ color: 0xfcc875 }),
  );

  cap.position.y = 0.124;
  alarm.add(beacon, cap);
  const waves = Array.from({ length: 3 }, () => {
    const wave = new T.Mesh(
      new T.RingGeometry(0.87, 1, 38),
      new T.MeshBasicMaterial({
        color: 0xffbc5b,
        side: T.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );

    alarm.add(wave);

    return wave;
  });

  group.add(alarm);
  const ring = new T.Mesh(
    new T.TorusGeometry(1, 0.023, 7, 32),
    new T.MeshBasicMaterial({ color: 0xfedc84, transparent: true, depthWrite: false }),
  );

  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const particles = Array.from({ length: 28 }, () => {
    const particle = new T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>(
      chunk,
      new T.MeshBasicMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide }),
    );

    group.add(particle);

    return particle;
  });

  const spareGeometry = new T.Mesh(snow, particles[0].material);

  spareGeometry.visible = false;
  const spareChunk = new T.Mesh(chunk, particles[0].material);

  spareChunk.visible = false;
  scene.add(group, spareGeometry, spareChunk);

  return (ride: Ride) => {
    const { animation, time, fluid } = ride;

    group.visible =
      !!animation &&
      animation.cue !== 'shield' &&
      animation.cue !== 'omny' &&
      time < animation.until &&
      ride.phase !== 'popped';

    if (!group.visible || !animation || animation.cue === 'shield' || animation.cue === 'omny')
      return;

    const age = time - animation.began;
    const mode = animation.cue;
    const progress = age / (animation.until - animation.began);
    const palette = palettes[mode];

    const origin = mode === 'vomit' ? animation.origin : fluid;

    group.position.set(origin.x, 0, origin.z);
    group.rotation.y = mode === 'vomit' ? animation.facing : 0;
    ring.visible = mode !== 'vomit' && mode !== 'cool' && mode !== 'annoy';
    alarm.visible = mode === 'annoy';

    if (alarm.visible) {
      let top = 0;

      for (const id of fluid.cells) top = Math.max(top, fluid.grid.centers[id * 3 + 1]);

      alarm.position.set(0, top + 0.25 + 0.065 * Math.sin(age * 9), 0);
      alarm.rotation.y = 0.15 * Math.sin(age * 14);
      beacon.material.color.setHex(Math.sin(age * 29) > 0 ? 0xff3f2a : 0xff9e32);

      for (const [index, wave] of waves.entries()) {
        const pulse = (age * 1.9 + index / waves.length) % 1;

        wave.position.set(0, 0, 0.1 + pulse * 0.21);
        wave.scale.setScalar(0.21 + pulse * 0.88);
        wave.material.opacity = (1 - pulse) * (1 - progress) * 0.9;
      }
    }

    ring.scale.setScalar(0.22 + 1.58 * Math.min(1, progress * 1.35));
    ring.material.color.setHex(palette[1]);
    ring.material.opacity = (1 - progress) * 0.72;
    ring.position.y = 0.055;

    for (const [index, particle] of particles.entries()) {
      const angle = index * 2.39996 + age * (mode === 'crazy' ? 2.8 : 0.16);
      const burst = Math.max(0, age - (index % 7) * 0.055);
      const radius = Math.min(1.4, burst * (0.38 + (index % 6) * 0.12));

      particle.visible = burst > 0 && mode !== 'annoy';
      particle.geometry = mode === 'cool' ? snow : chunk;
      particle.material.color.setHex(palette[index % palette.length]);
      particle.material.opacity = (1 - progress) * (mode === 'fart' ? 0.74 : 1);
      particle.rotation.set(age * (4 + (index % 3)), angle, age * 4 + index);

      if (mode === 'cool') {
        const drift = 0.22 + (index % 7) * 0.08;

        particle.position.set(
          Math.cos(angle) * drift + 0.09 * Math.sin(age * 5 + index),
          1.95 + (index % 6) * 0.08 - burst * (0.46 + (index % 4) * 0.14),
          Math.sin(angle) * drift + 0.14,
        );

        particle.material.color.setHex(index % 4 ? 0xf9fcff : 0xa8ddff);
        particle.rotation.set(0.18 * Math.sin(angle), 0.28, angle + age * 1.4);
        particle.scale.setScalar((0.052 + (index % 5) * 0.011) * (1 - progress * 0.42));
      } else if (mode !== 'fart' && mode !== 'vomit') {
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
