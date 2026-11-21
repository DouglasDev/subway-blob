import * as T from 'three';

export function wrappedCandy(color: number, wrapper: number) {
  const group = new T.Group();
  const center = new T.Mesh(
    new T.SphereGeometry(1, 12, 8),
    new T.MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.23 }),
  );
  const fold = new T.CylinderGeometry(0.095, 0.025, 0.13, 5);
  const foil = new T.MeshStandardMaterial({ color: wrapper, roughness: 0.38 });

  center.scale.set(0.155, 0.102, 0.101);
  group.add(center);

  for (const side of [-1, 1]) {
    const end = new T.Mesh(fold, foil);

    end.position.x = side * 0.186;
    end.rotation.z = (-side * Math.PI) / 2;
    group.add(end);
  }

  return group;
}
