export function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 4294967296;
  };
}

export const ENCOUNTERS = {
  acrobat: { name: 'Subway acrobat', stops: 1 },
  musician: { name: 'Bad musician', stops: 1 },
  prank: { name: 'Eric André prank', stops: 1 },
  smoker: { name: 'Weed smoke', stops: 1 },
  ac: { name: 'AC out · +25% volume', stops: 1 },
  takes: { name: 'SubwayTakes', stops: 2 },
  weird: { name: 'A rider is following you', stops: 1 },
} as const;

export type Encounter = keyof typeof ENCOUNTERS;

export type Power = 'crazy' | 'gross';

export type Cue =
  | Encounter
  | 'announcement'
  | 'chime'
  | 'crazy'
  | 'fart'
  | 'vomit'
  | 'pickup'
  | 'pop';

export const POWER_NAMES: Record<Power, string> = { crazy: 'Crazy Mode', gross: 'Gross-out' };

export const ENCOUNTER_CYCLE = 12;

function shuffle<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));

    [items[index], items[other]] = [items[other], items[index]];
  }

  return items;
}

export function encounterSchedule(start: number, random: () => number) {
  const performers = shuffle<Encounter>(['acrobat', 'musician', 'prank'], random);
  const modifiers = shuffle<Encounter>(['smoker', 'ac', 'weird'], random);
  const schedule = new Map<number, Encounter>();

  for (const [index, slot] of [1, 2, 4].entries()) schedule.set(start + slot, performers[index]);

  schedule.set(start + 5, 'takes');

  for (const [index, slot] of [7, 8, 10].entries()) schedule.set(start + slot, modifiers[index]);

  return schedule;
}

export function squeezeTolerance(value: number, squeeze: number, dt: number, smoker = false) {
  const low = smoker ? 0.14 : 0.21;
  const high = smoker ? 0.6 : 0.75;

  if (squeeze < low) return Math.min(1, value + dt / 15);

  const strain = Math.min(1, (squeeze - low) / (high - low));

  return Math.max(0, value - (strain * (0.38 + 0.62 * strain) * dt) / 30);
}

export const PRANK_LINES = [
  'Eric: I brought my emotional support pigeon.',
  'Eric: It’s also the assistant conductor.',
  'Eric: Look out! It’s learning to fly!',
];

export const TAKES = [
  'Dress shoes should have turn signals.',
  'A folding chair is a carry-on apartment.',
  'A subway nap counts as time travel.',
  'Soup is a drink with furniture.',
  'Bodegas should offer a cat loyalty card.',
  'There should be a quiet car for your phone.',
  'Escalators should have an overtaking lane.',
  'The last slice of pizza is a public trust.',
  'Every umbrella should come with an apology.',
  'A group chat needs an emergency exit.',
  'Freeze the rent and unfreeze the platform.',
  'The train should pause for a good bass solo.',
  'Window seats should come with binoculars.',
  'All tiny dogs are off-duty security guards.',
  'The mayor should ride the train with groceries.',
  'A rainy day should count as a free transfer.',
  'The subway map should be a picnic blanket.',
  'Stop putting tiny forks in big desserts.',
  'Pigeons know the weekend schedule.',
  'We should let the city have a bedtime.',
  'The best bagel is the one you didn’t share.',
  'Running for the train is an unpaid internship.',
  'Every station needs a lost-and-found fashion show.',
  'Any bag that needs a second seat pays fare.',
];

export const WEIRD_LINES = [
  'I taught a pigeon to parallel park.',
  'The moon owes me seven dollars.',
  'Nobody checks the expiration date on stairs.',
  'Do you think a ghost can get a seat?',
];
