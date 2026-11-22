import { seededRandom, shuffle } from './encounters.ts';

const catalog = {
  crazy: { name: 'Crazy Mode', color: 0xd794ff, weight: 1 },
  fart: { name: 'Stink Bomb', color: 0xdeed65, weight: 3 },
  vomit: { name: 'Slime Spray', color: 0x8bf45d, weight: 3 },
  annoy: { name: 'Annoying Alarm', color: 0xff8a55, weight: 2 },
  omny: { name: 'OMNY Card Toss', color: 0x83ddfa, weight: 2 },
  cool: { name: 'Cool Pack', color: 0x8de8ff, weight: 2 },
  recovery: { name: 'Prebiotic Soda', color: 0xffb9d8, weight: 0 },
  shield: { name: 'Quiet Bubble', color: 0x70a8ff, weight: 1 },
  express: { name: 'Speed Boost', color: 0xffdc73, weight: 2 },
  fluid: { name: 'Super Fluid', color: 0x7affdf, weight: 2 },
} as const;

export type Power = keyof typeof catalog;

export const POWERS = catalog;

export const DOUBLE_PICKUP_STOP = 7;

export const LATE_PICKUP_STOP = 12;

export const COOL_POINTS = 25;

export const RECOVERY_POINTS = 50;

export function healPoints(power: Power | null) {
  return power === 'cool' ? COOL_POINTS : power === 'recovery' ? RECOVERY_POINTS : 0;
}

export function pickupWave(stop: number, seed: number) {
  if (stop < DOUBLE_PICKUP_STOP) return { count: 1, recovery: false };
  const late = stop - LATE_PICKUP_STOP;

  if (late < 0 || late % 2 !== 0) return { count: 2, recovery: false };
  const block = Math.floor(late / 4);
  const random = seededRandom(Math.imul(seed ^ block ^ 0x538cb15f, 0x9e3779b1));

  return { count: 3, recovery: late % 4 === (random() < 0.5 ? 0 : 2) };
}

export const EXPRESS_SECONDS = 10;

export const SUPER_FLUID_SECONDS = 10;

export const OMNY_SECONDS = 10;

export const OMNY_FLIGHT = 0.75;

export function omnyLocation(x: number) {
  return { x: x + (x < 0 ? 2.19 : -2.19), z: -0.09 };
}

export function powerDeck(random: () => number) {
  const stock = (Object.keys(catalog) as Power[]).flatMap((kind) =>
    new Array<Power>(catalog[kind].weight).fill(kind),
  );
  let bag: Power[] = [];

  return (exclude?: Power) => {
    if (bag.length === 0 || bag.every((kind) => kind === exclude))
      bag.push(...shuffle([...stock], random));

    const index = bag.findIndex((kind) => kind !== exclude);

    return bag.splice(index, 1)[0];
  };
}

const OPENING_PROXIMITY = [1.35, 1.8, 2.27, 2.4, 2.55];

export function crowdPressure(stop: number, raw: number, local: number) {
  const late = 1 - Math.exp(-Math.max(0, stop - 5) / 4);
  const packedCarRelief = 0.02 * Math.min(1, Math.max(0, (stop - 13) / 4));
  const difficulty = OPENING_PROXIMITY[stop] ?? 1.55 - 0.45 * (1 - Math.exp(-(stop - 5) / 9));
  const crowd = Math.max(raw, Math.min(1, local * difficulty));

  return crowd * (1 - 0.5 * late - packedCarRelief);
}
