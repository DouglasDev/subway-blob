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
import { STATIONS, stationIndex, travelDirection } from '../sim/route.ts';
import { addPoster, platformMaterials } from './platformArt';
import { interiorMaterials } from './interiorMaterials';
import { buildPlatformPeople } from './platformPeople';

const paint = (color: number, metalness = 0, roughness = 0.72) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });

const steel = paint(0x8d9e9b, 0.62, 0.34);
const darkSteel = paint(0x374849, 0.4);
const panels = paint(0xd0d8cb);
const seat = paint(0x478d88, 0.08, 0.38);
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

const ledMessages = [
  'NEXT STOP: YOUR NAP',
  'SIGNAL SAID MAYBE',
  'PIGEON IN CHARGE',
  'MIND THE NAP',
  'MOOD: LOCAL',
  'JUST ONE MORE STOP',
  'DELAYED BY A BAGEL',
  'RATS HAVE PRIORITY',
  'EXPRESS TO NOWHERE',
  'PLEASE HOLD YOUR BAGEL',
  'OOZE STANDS CLEAR',
  'DOORS NEED A MINUTE',
];

function addLedDisplay(car: T.Object3D, x: number, y: number, z: number, offset: number) {
  const width = 1.39;
  const height = 0.205;
  const lettering = document.createElement('canvas');

  lettering.width = 142;
  lettering.height = 19;
  const dots = lettering.getContext('2d', { willReadFrequently: true })!;

  dots.font = 'bold 12px monospace';
  dots.textAlign = 'center';
  dots.textBaseline = 'middle';

  function draw(ctx: CanvasRenderingContext2D, stop: number) {
    const message = ledMessages[(stop + offset) % ledMessages.length];

    dots.clearRect(0, 0, lettering.width, lettering.height);
    dots.fillText(message, lettering.width / 2, lettering.height / 2 + 0.4, 134);
    const { data } = dots.getImageData(0, 0, lettering.width, lettering.height);
    const pitchX = ctx.canvas.width / lettering.width;
    const pitchY = ctx.canvas.height / lettering.height;

    for (let row = 0; row < lettering.height; row++) {
      for (let column = 0; column < lettering.width; column++) {
        const lit = data[(row * lettering.width + column) * 4 + 3] > 73;

        ctx.fillStyle = lit ? '#ff563e' : '#43211e';
        ctx.fillRect(column * pitchX + 0.7, row * pitchY + 0.7, pitchX - 1.4, pitchY - 1.4);
      }
    }
  }

  box(car, ink, x, y, z, width + 0.07, height + 0.052, 0.047);
  const panel = label(car, width, height, x, y, z + 0.027, '#231315', (ctx) => draw(ctx, 0));
  const map = panel.material.map!;
  const ctx = (map.image as HTMLCanvasElement).getContext('2d')!;

  return (stop: number) => {
    draw(ctx, stop);
    map.needsUpdate = true;
  };
}

export function buildCar(scene: T.Object3D) {
  const car = new T.Group();
  const back = -CAR_WIDTH / 2;
  const { floor, wall } = interiorMaterials();
  const leaves: { mesh: T.Group; x: number; sign: number }[] = [];
  const displays: ((stop: number) => void)[] = [];
  let displayedStop = 0;

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

    box(car, wall, x, 0.62, back, length, 1.02, 0.13);
    box(car, wall, x, 1.775, back, length, 0.25, 0.13);

    for (const side of [-1, 1]) {
      box(car, wall, x + (side * (length - jamb)) / 2, 1.39, back, jamb, 0.52, 0.13);
    }

    for (const y of [1.125, 1.645]) {
      box(car, ink, x, y, back + 0.074, opening, 0.042, 0.032);
    }

    for (const y of [0.41, 0.5, 1.069]) box(car, steel, x, y, back + 0.071, length, 0.013, 0.014);

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

  for (const [index, x] of [-4.41, -3.68, -1.61, -0.82, 0, 0.82, 1.61, 3.68, 4.41].entries()) {
    const width = Math.abs(x) < 1.05 ? 0.66 : 0.63;
    const y = Math.abs(x) < 1.05 ? 1.76 : 1.8;

    box(car, darkSteel, x, y, back + 0.081, width + 0.04, 0.252, 0.024);
    addPoster(car, x, y, back + 0.102, width, 0.222, index);
  }

  for (const [index, x] of [-4.07, -1.34, 0.11, 1.36, 4.02].entries())
    addPoster(car, x, 0.86, back + 0.089, 0.48, 0.27, index + 9);

  for (const x of DOORS) {
    for (const sign of [-1, 1]) {
      box(car, steel, x + sign * 0.728, 0.99, back + 0.015, 0.09, 1.96, 0.16);
      const leaf = new T.Group();
      const rest = x + sign * 0.345;

      leaf.position.set(rest, 0, back + 0.01);
      // Frame an actual opening, with the platform visible through its pane.
      box(leaf, wall, 0, 0.526, 0, 0.682, 1.038, 0.086);
      box(leaf, wall, 0, 1.758, 0, 0.682, 0.298, 0.086);

      for (const edge of [-1, 1]) {
        box(leaf, wall, edge * 0.269, 1.328, 0, 0.144, 0.724, 0.086);
        box(leaf, darkSteel, edge * 0.184, 1.328, 0.047, 0.034, 0.574, 0.021);
        box(leaf, darkSteel, 0, 1.328 + edge * 0.272, 0.047, 0.4, 0.033, 0.021);
      }

      box(leaf, windowGlass, 0, 1.328, 0.044, 0.367, 0.533, 0.008);
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
    box(car, wall, body, 2.078, 0, 3.48, 0.114, 2.4);

    for (const side of [-1, 1]) {
      box(car, wall, body, 1.027, side * 1.15, 3.48, 2.05, 0.13);
      box(car, steel, body, 0.27, side * 1.222, 3.46, 0.021, 0.012);
      box(car, steel, body, 1.89, side * 1.222, 3.46, 0.015, 0.012);
      box(car, wall, body + side * 1.681, 1.022, 0, 0.116, 2.05, 2.4);
    }

    displays.push(
      addLedDisplay(car, x + sign * 0.93, 1.56, 1.232, sign < 0 ? 0 : ledMessages.length / 2),
    );
  }

  return (door: number, stop = 0) => {
    for (const { mesh, x, sign } of leaves) mesh.position.x = x + sign * door * 0.665;

    if (stop === displayedStop) return;

    displayedStop = stop;
    for (const update of displays) update(stop);
  };
}

function buildPlatform(scene: T.Scene, posterOffset: number) {
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

    addPoster(platform, x, 1.62, -3.65, 0.99, 0.56, index + 8 + posterOffset);

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
  const platforms = [buildPlatform(scene, 0), buildPlatform(scene, 5)];
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
    const direction = travelDirection(stop);
    const departing = moving ? progress * distance * direction : 0;
    const arriving = departing - distance * direction;
    const left = moving ? Math.min(arriving, departing) : departing;
    const right = moving ? Math.max(arriving, departing) : departing;

    platforms[stop % 2](departing, stationIndex(stop), time);
    platforms[(stop + 1) % 2](arriving, moving ? stationIndex(stop + 1) : STATIONS.length, time);
    track.position.x = departing % 0.75;
    wall(0, -74, left - 14);
    wall(1, left + 14, right - 14);
    wall(2, right + 14, 74);

    for (const [index, rib] of ribs.entries()) {
      const x = (index - 11) * 2.15 + (departing % 2.15);

      rib.position.x = x;
      rib.visible = Math.abs(x - departing) > 14.1 && (!moving || Math.abs(x - arriving) > 14.1);
    }
  };
}
