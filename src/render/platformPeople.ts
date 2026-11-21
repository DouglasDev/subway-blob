import type { Object3D } from 'three';
import { buildRiders } from './riders';

const waiting = [
  { x: -6.4, z: -2.08, heading: 0.32 },
  { x: -4.1, z: -1.95, heading: -0.82 },
  { x: -0.63, z: -2.77, heading: 0.2 },
  { x: 0.92, z: -2.37, heading: -0.52 },
  { x: 4.32, z: -2.04, heading: 0.19 },
  { x: 6.06, z: -2.49, heading: -0.5 },
  { x: 8.05, z: -2.22, heading: 0.27 },
];

export function buildPlatformPeople(parent: Object3D) {
  const update = buildRiders(parent);

  return (time: number, station: number) => {
    const people = waiting.map((person, index) => ({
      ...person,
      x: person.x + Math.sin(station * 7 + index * 3) * 0.34,
      id: 127 + station * 13 + index,
      stride: 0,
    }));

    for (let index = 0; index < 5; index++) {
      const pace = 0.57 + 0.08 * index;
      const progress = (time * pace + index * 3.7 + station * 2.1) % 36;
      const reverse = progress > 18;

      people.push({
        x: (reverse ? 36 - progress : progress) - 9,
        z: -3.19 + (index % 2) * 0.29,
        heading: reverse ? -Math.PI / 2 : Math.PI / 2,
        stride: time * 8.8 + index,
        id: 234 + station * 5 + index,
      });
    }

    update(people);
  };
}
