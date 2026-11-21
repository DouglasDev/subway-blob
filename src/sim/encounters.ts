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

export function encounterSchedule(stopCount: number, random: () => number) {
  const entries = Object.keys(ENCOUNTERS) as Encounter[];

  for (let index = entries.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));

    [entries[index], entries[other]] = [entries[other], entries[index]];
  }

  // Allocate every duration before scattering the remaining quiet stops.
  const quiet = new Uint8Array(entries.length + 1);
  const duration = entries.reduce((sum, kind) => sum + ENCOUNTERS[kind].stops, 0);

  for (let gap = 0; gap < stopCount - 4 - duration; gap++)
    quiet[Math.floor(random() * quiet.length)]++;

  let start = 3;
  const schedule = new Map<number, Encounter>();

  for (const [index, kind] of entries.entries()) {
    start += quiet[index];
    schedule.set(start, kind);
    start += ENCOUNTERS[kind].stops;
  }

  return schedule;
}

export function squeezeTolerance(value: number, squeeze: number, dt: number, smoker = false) {
  if (squeeze >= (smoker ? 0.6 : 0.75)) return Math.max(0, value - dt / 30);
  if (squeeze < 0.4) return Math.min(1, value + dt / 15);

  return value;
}

export const LINES: Partial<Record<Encounter, string[]>> = {
  takes: [
    'Kareem: What’s your take?',
    'Rider: The quiet car should be a library.',
    'Kareem: How late is it open?',
    'Rider: Until someone returns the train.',
  ],
  weird: [
    'I taught a pigeon to parallel park.',
    'The moon owes me seven dollars.',
    'Nobody checks the expiration date on stairs.',
    'Do you think a ghost can get a seat?',
  ],
  prank: ['Who ordered the inflatable pigeon?'],
};
