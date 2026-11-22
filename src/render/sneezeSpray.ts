import * as T from 'three';
import { CAR_LENGTH, CAR_WIDTH } from '../sim/car.ts';

const DROPLETS = 24;
const START = 0.07;
const END = 0.76;
const colors = [0x9b5630, 0xbc7846, 0x733c26, 0xad673d, 0xd39257];

type Burst = { at: number; age: number; mouth: T.Vector3; heading: number };

export function buildSneezeSpray(scene: T.Object3D) {
  const spray = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 0),
    new T.MeshBasicMaterial(),
    DROPLETS,
  );
  const drop = new T.Object3D();
  const origin = new T.Vector3();
  const color = new T.Color();
  let lastSneeze = -Infinity;
  let heading = 0;

  spray.name = 'Sneeze spray';
  spray.frustumCulled = false;
  spray.visible = false;
  spray.instanceMatrix.setUsage(T.DynamicDrawUsage);

  for (let i = 0; i < DROPLETS; i++) spray.setColorAt(i, color.setHex(colors[i % colors.length]));

  scene.add(spray);

  return (burst?: Burst) => {
    spray.visible = !!burst && burst.age >= START && burst.age < END;

    if (!burst || !spray.visible) return;

    if (lastSneeze !== burst.at) {
      lastSneeze = burst.at;
      origin.copy(burst.mouth);
      heading = burst.heading;
    }

    for (let i = 0; i < DROPLETS; i++) {
      const time = burst.age - START - (i % 5) * 0.022;
      const direction = heading + Math.sin(i * 2.4) * (0.12 + (i % 7) * 0.074);
      const travel = time * (1.38 + (i % 8) * 0.18);
      const x = origin.x + Math.sin(direction) * travel;
      const z = origin.z + Math.cos(direction) * travel;
      const y = origin.y + (0.34 - (i % 6) * 0.12) * time - time ** 2 * 1.42;
      const inside = Math.abs(x) < CAR_LENGTH / 2 && Math.abs(z) < CAR_WIDTH / 2;
      const size =
        inside && time >= 0 ? (0.025 + (i % 5) * 0.006) * Math.max(0, 1 - (time / 0.68) ** 1.4) : 0;

      drop.position.set(x, y, z);
      drop.rotation.set(i * 1.2, direction, 0);
      drop.scale.set(size * 0.84, size * 0.78, size * 1.45);
      drop.updateMatrix();
      spray.setMatrixAt(i, drop.matrix);
    }

    spray.instanceMatrix.needsUpdate = true;
  };
}
