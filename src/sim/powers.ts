import { shuffle } from './encounters.ts';

const catalog = {
  crazy: { name: 'Crazy Mode', color: 0xd794ff, weight: 1 },
  fart: { name: 'Stink Bomb', color: 0xdeed65, weight: 3 },
  vomit: { name: 'Slime Spray', color: 0x8bf45d, weight: 3 },
  annoy: { name: 'Annoying Alarm', color: 0xff8a55, weight: 2 },
  omny: { name: 'OMNY Card Toss', color: 0x83ddfa, weight: 2 },
  cool: { name: 'Cool Pack', color: 0x8de8ff, weight: 2 },
  shield: { name: 'Quiet Bubble', color: 0x70a8ff, weight: 1 },
  express: { name: 'Speed Boost', color: 0xffdc73, weight: 2 },
  fluid: { name: 'Super Fluid', color: 0x7affdf, weight: 2 },
} as const;

export type Power = keyof typeof catalog;

export const POWERS = catalog;

export const DOUBLE_PICKUP_STOP = 7;

export const COOL_POINTS = 25;

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

export function crowdPressure(stop: number, raw: number, local: number) {
  const late = 1 - Math.exp(-Math.max(0, stop - 4) / 12);
  const difficulty = 0.85 + 0.25 * (1 - Math.exp(-Math.max(0, stop - 2) / 19));
  const crowd = Math.max(raw, Math.min(1, local * difficulty));

  return crowd * (1 - 0.31 * late);
}
