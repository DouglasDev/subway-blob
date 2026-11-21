import * as T from 'three';
import {
  BENCHES,
  BENCH_DEPTH,
  BENCH_Z,
  CAR_LENGTH,
  CAR_WIDTH,
  CROSS_BACK,
  CROSS_DEPTH,
  CROSS_SEATS,
  CROSS_WIDTH,
  DOORS,
} from '../sim/car.ts';
import { STATIONS } from '../sim/route.ts';
import { addPoster, platformMaterials } from './platformArt';
import { buildPlatformPeople } from './platformPeople';

const paint = (color: number, metalness = 0, roughness = 0.72) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });

const steel = paint(0x8d9e9b, 0.62, 0.34);
const darkSteel = paint(0x374849, 0.4);
const panels = paint(0xd0d8cb);
const seat = paint(0x478d88, 0.08, 0.38);
const glass = paint(0x243a3c, 0.31);
const floor = paint(0x515d53);
const windowGlass = new T.MeshStandardMaterial({
  color: 0x72998e,
  transparent: true,
  opacity: 0.24,
  roughness: 0.22,
  depthWrite: false,
});
const crossSeat = paint(0x9b613c, 0.08, 0.42);
const yellow = paint(0xe4b144);
const ink = paint(0x183032);
const lamp = new T.MeshBasicMaterial({ color: 0xf8e7bd });

function box(
  parent: T.Object3D,
  material: T.Material,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
) {
  const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), material);

  mesh.position.set(x, y, z);
  parent.add(mesh);

  return mesh;
}

function rod(parent: T.Object3D, material: T.Material, from: T.Vector3, to: T.Vector3, r: number) {
  const axis = to.clone().sub(from);
  const mesh = new T.Mesh(new T.CylinderGeometry(r, r, axis.length(), 9), material);

  mesh.position.copy(from).addScaledVector(axis, 0.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis.normalize());
  parent.add(mesh);
}

function label(
  parent: T.Object3D,
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
  color: string,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');

  canvas.width = 1024;
  canvas.height = Math.round((canvas.width * height) / width);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  draw(ctx);
  const map = new T.CanvasTexture(canvas);

  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  const mesh = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({ map }));

  mesh.position.set(x, y, z);
  parent.add(mesh);

  return mesh;
}

export function buildCar(scene: T.Scene) {
  const car = new T.Group();
  const back = -CAR_WIDTH / 2;
  const leaves: { mesh: T.Group; x: number; sign: number }[] = [];

  scene.add(car);
  box(car, darkSteel, 0, -0.25, 0, CAR_LENGTH + 0.12, 0.43, CAR_WIDTH + 0.16);
  box(car, floor, 0, -0.025, 0, CAR_LENGTH, 0.05, CAR_WIDTH);
  box(car, steel, 0, -0.064, 1.218, CAR_LENGTH + 0.07, 0.12, 0.045);
  box(car, ink, 0, -0.29, 1.288, CAR_LENGTH + 0.07, 0.036, 0.026);
  box(car, steel, 0, 2.13, -1.13, CAR_LENGTH + 0.12, 0.15, 0.32);
  box(car, lamp, 0, 2.042, -0.94, CAR_LENGTH - 0.12, 0.022, 0.065);
  box(car, ink, 0, 1.91, back + 0.071, CAR_LENGTH, 0.16, 0.075);

  for (const { x, length } of [...BENCHES, { x: 0, length: 3.8 }]) {
    const opening = Math.min(length - 0.27, 3.29);
    const jamb = (length - opening) / 2;

    box(car, panels, x, 0.62, back, length, 1.02, 0.13);
    box(car, panels, x, 1.775, back, length, 0.25, 0.13);

    for (const side of [-1, 1]) {
      box(car, panels, x + (side * (length - jamb)) / 2, 1.39, back, jamb, 0.52, 0.13);
    }

    for (const y of [1.125, 1.645]) {
      box(car, ink, x, y, back + 0.074, opening, 0.042, 0.032);
    }

    box(car, windowGlass, x, 1.385, back + 0.07, opening, 0.51, 0.015);

    for (const side of [-1, 1]) {
      if (x === 0) continue;

      const z = BENCH_Z * side;
      const count = Math.round(length / 0.47);

      box(car, steel, x, 0.18, z, length, 0.36, BENCH_DEPTH);
      box(car, seat, x, 0.414, z, length, 0.105, BENCH_DEPTH);

      for (let index = 1; index < count; index++) {
        box(
          car,
          darkSteel,
          x + (index / count - 0.5) * length,
          0.468,
          z,
          0.009,
          0.004,
          BENCH_DEPTH - 0.02,
        );
      }

      if (side < 0) box(car, seat, x, 0.66, -1.111, length, 0.36, 0.13);
    }
  }

  for (const { x, z, direction } of CROSS_SEATS) {
    const seatBack = x - (direction * (CROSS_DEPTH - CROSS_BACK)) / 2;

    box(car, steel, x, 0.18, z, CROSS_DEPTH, 0.36, CROSS_WIDTH);
    box(car, crossSeat, x, 0.414, z, CROSS_DEPTH, 0.105, CROSS_WIDTH);
    box(car, crossSeat, seatBack, 0.735, z, CROSS_BACK, 0.53, CROSS_WIDTH);
  }

  for (const [index, x] of [-3.95, -1.55, 1.55, 3.95].entries()) {
    addPoster(car, x, 1.82, back + 0.086, 0.64, 0.29, index);
  }

  for (const x of DOORS) {
    for (const sign of [-1, 1]) {
      box(car, steel, x + sign * 0.728, 0.99, back + 0.015, 0.09, 1.96, 0.16);
      const leaf = new T.Group();
      const rest = x + sign * 0.345;

      leaf.position.set(rest, 0, back + 0.01);
      box(leaf, steel, 0, 0.957, 0, 0.682, 1.9, 0.086);
      box(leaf, darkSteel, 0, 1.326, 0.05, 0.4, 0.57, 0.026);
      box(leaf, glass, 0, 1.328, 0.067, 0.346, 0.51, 0.02);
      box(leaf, yellow, 0, 0.92, 0.06, 0.26, 0.034, 0.013);
      box(leaf, ink, sign * -0.328, 0.952, 0.051, 0.02, 1.89, 0.024);
      car.add(leaf);
      leaves.push({ mesh: leaf, x: rest, sign });
    }

    box(car, yellow, x, 0.008, -1.137, 1.35, 0.015, 0.073);
  }

  for (const x of [-1.9, 1.9]) {
    rod(car, steel, new T.Vector3(x, 0, 0), new T.Vector3(x, 2.04, 0), 0.028);
    rod(car, steel, new T.Vector3(x, 2.04, 0), new T.Vector3(x, 2.04, -1.1), 0.022);
  }

  rod(car, steel, new T.Vector3(-4.72, 1.92, -0.83), new T.Vector3(4.72, 1.92, -0.83), 0.021);

  for (const x of [-4.81, 4.81]) {
    box(car, steel, x, 0.48, 0, 0.09, 0.96, 2.4);
    box(car, panels, x, 1.39, -0.95, 0.09, 0.92, 0.45);
    box(car, ink, x, 0.68, 0, 0.1, 1.12, 0.76);
  }

  label(car, 2.05, 0.144, 0, 1.91, back + 0.117, '#19292a', (ctx) => {
    ctx.fillStyle = '#008a59';
    ctx.beginPath();
    ctx.arc(42, 36, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8f3e7';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('4', 30, 49);
    ctx.font = 'bold 30px monospace';
    ctx.fillText('LEXINGTON AV EXPRESS', 91, 47);
  });

  for (const sign of [-1, 1]) {
    const x = sign * (CAR_LENGTH / 2 + 0.23);
    const body = x + sign * 1.85;

    box(car, ink, x, 0.75, 0, 0.38, 1.54, 1.04);
    box(car, darkSteel, body, -0.22, 0, 3.48, 0.42, 2.42);
    box(car, steel, body, 2.06, 0, 3.48, 0.12, 2.35);
    box(car, steel, body, 0.55, 1.13, 3.48, 1.12, 0.1);
    box(car, panels, body, 1.04, -1.16, 3.48, 2, 0.13);
    box(car, panels, x + sign * 0.13, 1.04, 0, 0.12, 2, 2.34);
    box(car, glass, body, 1.44, 1.12, 1.19, 0.62, 0.07);
    box(car, glass, body + sign * 0.98, 1.44, 1.12, 0.59, 0.62, 0.07);
  }

  return (door: number) => {
    for (const { mesh, x, sign } of leaves) mesh.position.x = x + sign * door * 0.665;
  };
}

function buildPlatform(scene: T.Scene) {
  const platform = new T.Group();

  scene.add(platform);
  const surfaces = platformMaterials();
  const updatePlatformPeople = buildPlatformPeople(platform);

  box(platform, surfaces.floor, 0, -0.125, -2.55, 28, 0.25, 2.57);
  box(platform, yellow, 0, 0.006, -1.422, 28, 0.019, 0.33);
  box(platform, ink, 0, 1.05, -3.92, 28, 2.62, 0.22);
  box(platform, surfaces.wall, 0, 1.39, -3.793, 28, 2.26, 0.055);
  box(platform, darkSteel, 0, 0.24, -3.748, 28, 0.49, 0.047);

  for (let index = -6; index <= 6; index++) {
    const x = index * 2.08 + 0.48;

    addPoster(platform, x, 1.62, -3.65, 0.99, 0.56, index + 8);

    if (index % 2 === 0) {
      box(platform, darkSteel, x - 0.64, 0.23, -3.24, 0.42, 0.46, 0.35);
      box(platform, steel, x - 0.64, 0.46, -3.24, 0.46, 0.061, 0.37);
    }
  }

  box(platform, seat, 0, 0.52, -3.75, 28, 0.2, 0.04);
  box(platform, lamp, 0, 2.53, -3.35, 28, 0.07, 0.16);

  for (let index = -8; index <= 8; index++) {
    box(platform, darkSteel, index * 1.65 - 0.69, 1.02, -3.71, 0.045, 2.08, 0.059);
  }

  for (const x of [-7.2, 7.2]) {
    box(platform, seat, x, 1.24, -2.6, 0.24, 2.48, 0.24);
    box(platform, ink, x, 0.13, -2.6, 0.32, 0.26, 0.32);
  }

  const signs = STATIONS.map((name) =>
    label(platform, 3.6, 0.35, 0, 2.23, -3.71, '#1b2b2c', (ctx) => {
      ctx.fillStyle = '#fff7dd';
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, 512, 69, 948);
    }),
  );

  let lastTime = -1;
  let lastStation = -1;

  return (x: number, station: number, time: number) => {
    platform.position.x = x;
    platform.visible = station < STATIONS.length;

    if (!platform.visible || Math.abs(x) > 36 || (time === lastTime && station === lastStation))
      return;

    if (station !== lastStation) {
      for (const [index, sign] of signs.entries()) sign.visible = index === station;
    }

    updatePlatformPeople(time, station);
    lastTime = time;
    lastStation = station;
  };
}

export function buildTrack(scene: T.Scene) {
  const platforms = [buildPlatform(scene), buildPlatform(scene)];
  const track = new T.Group();

  scene.add(track);
  box(scene, ink, 0, -0.64, 0, 90, 0.2, 8);

  for (const z of [-0.72, 0.72]) box(scene, steel, 0, -0.485, z, 80, 0.08, 0.07);
  for (let index = -18; index <= 18; index++)
    box(track, darkSteel, index * 0.75, -0.53, 0, 0.2, 0.07, 2.03);

  const walls = Array.from({ length: 3 }, () =>
    box(scene, darkSteel, 0, 1.1, -3.16, 1, 3.02, 0.15),
  );
  const ribs = Array.from({ length: 23 }, () => box(scene, ink, 0, 1.1, -3.06, 0.095, 3, 0.14));

  function wall(index: number, from: number, to: number) {
    walls[index].visible = to > from;
    walls[index].position.x = (to + from) / 2;
    walls[index].scale.x = Math.max(0.01, to - from);
  }

  return (stop: number, progress: number, moving: boolean, time: number) => {
    const distance = 58;
    const departing = moving ? progress * distance : 0;
    const arriving = departing - distance;
    const ahead = moving && stop + 1 < STATIONS.length;

    platforms[stop % 2](departing, stop, time);
    platforms[(stop + 1) % 2](arriving, ahead ? stop + 1 : STATIONS.length, time);
    track.position.x = departing % 0.75;
    wall(0, -58, (ahead ? arriving : departing) - 14);
    wall(1, ahead ? arriving + 14 : departing - 14, departing - 14);
    wall(2, departing + 14, 58);

    for (const [index, rib] of ribs.entries()) {
      const x = (index - 11) * 2.15 + (departing % 2.15);

      rib.position.x = x;
      rib.visible = Math.abs(x - departing) > 14.1 && (!ahead || Math.abs(x - arriving) > 14.1);
    }
  };
}
