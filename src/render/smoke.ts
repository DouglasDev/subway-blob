import * as T from 'three';
import type { Rider } from '../sim/crowd.ts';
import { canvasTexture } from './platformArt';
import { riderFacing, riderSize } from './riders';

const EMIT_INTERVAL = 0.22;
const PUFF_LIFETIME = 4.3;

export function buildSmoke(scene: T.Scene) {
  const texture = canvasTexture(96, 96, (ctx) => {
    for (const [x, y, radius] of [
      [48, 49, 37],
      [28, 52, 26],
      [59, 29, 26],
      [68, 51, 22],
      [51, 68, 23],
    ]) {
      const fade = ctx.createRadialGradient(x, y, 1, x, y, radius);

      fade.addColorStop(0, 'rgba(223, 233, 218, 0.52)');
      fade.addColorStop(0.48, 'rgba(211, 226, 211, 0.27)');
      fade.addColorStop(1, 'rgba(211, 226, 211, 0)');
      ctx.fillStyle = fade;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  });
  const geometry = new T.PlaneGeometry();
  const pool = Array.from({ length: Math.ceil(PUFF_LIFETIME / EMIT_INTERVAL) + 1 }, () => {
    const mesh = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );

    mesh.visible = false;
    scene.add(mesh);

    return { mesh, born: -Infinity, x: 0, y: 0, z: 0, heading: 0, curl: 0 };
  });
  let emittedAt = -Infinity;
  let cursor = 0;
  const position = new T.Vector3();

  return (smoker: Rider | undefined, time: number, camera: T.PerspectiveCamera) => {
    if (smoker && time - emittedAt >= EMIT_INTERVAL) {
      const puff = pool[cursor];
      const size = riderSize(smoker.id);
      const heading = riderFacing(smoker);

      puff.born = emittedAt = time;
      puff.heading = heading;
      puff.curl = Math.sin(time * 4.1) * 0.5;
      puff.x = smoker.x + Math.sin(heading) * 0.14 * size;
      puff.y = 1.48 * size + Math.abs(Math.sin(smoker.stride) * 0.47) * 0.06;
      puff.z = smoker.z + Math.cos(heading) * 0.14 * size;
      cursor = (cursor + 1) % pool.length;
    }

    for (const puff of pool) {
      const age = time - puff.born;

      puff.mesh.visible = age < PUFF_LIFETIME;
      if (!puff.mesh.visible) continue;

      const progress = age / PUFF_LIFETIME;
      const outward = 0.34 * (1 - Math.exp(-age * 2));
      const swirl = Math.sin(age * 1.8 + puff.curl * 5) * age * 0.053;

      position.set(
        T.MathUtils.clamp(puff.x + Math.sin(puff.heading) * outward + age * 0.24, -4.82, 4.82),
        Math.min(2.13, puff.y + age * 0.25),
        T.MathUtils.clamp(puff.z + Math.cos(puff.heading) * outward + swirl, -1.06, 1.06),
      );

      puff.mesh.position.copy(position);
      puff.mesh.quaternion.copy(camera.quaternion);
      puff.mesh.rotateZ(puff.curl + age * 0.24);
      puff.mesh.scale.set(0.145 + progress * 1.22, 0.13 + progress * 0.64, 1);
      puff.mesh.material.opacity = Math.min(1, age * 11) * (1 - progress) ** 1.08 * 0.94;
    }
  };
}
