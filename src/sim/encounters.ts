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

export type Power = 'crazy' | 'gross' | 'cool' | 'shield';

export const POWERS: Power[] = ['crazy', 'gross', 'cool', 'shield'];

export type PowerEffect = Exclude<Power, 'gross'> | 'fart' | 'vomit';

export type Cue =
  | Encounter
  | 'announcement'
  | 'chime'
  | 'crazy'
  | 'fart'
  | 'vomit'
  | 'cool'
  | 'shield'
  | 'pickup'
  | 'pop';

export const POWER_NAMES: Record<Power, string> = {
  crazy: 'Crazy Mode',
  gross: 'Gross-out',
  cool: 'Cool Pack',
  shield: 'Quiet Bubble',
};

export const ENCOUNTER_CYCLE = 12;

export function shuffle<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));

    [items[index], items[other]] = [items[other], items[index]];
  }

  return items;
}

export function encounterSchedule(start: number, random: () => number) {
  const encounters = Object.keys(ENCOUNTERS) as Encounter[];
  const quiet =
    ENCOUNTER_CYCLE - encounters.reduce((total, kind) => total + ENCOUNTERS[kind].stops, 0);
  const slots = shuffle<Encounter | null>(
    [...encounters, ...new Array<null>(quiet).fill(null)],
    random,
  );
  const schedule = new Map<number, Encounter>();
  let stop = start;

  for (const kind of slots) {
    if (kind) schedule.set(stop, kind);

    stop += kind ? ENCOUNTERS[kind].stops : 1;
  }

  return schedule;
}

export function squeezeTolerance(
  value: number,
  squeeze: number,
  dt: number,
  smoker = false,
  guest = 0,
) {
  const low = smoker ? 0.14 : 0.21;
  const high = smoker ? 0.6 : 0.75;

  if (squeeze < low && guest === 0) return Math.min(1, value + dt / 15);

  const strain = Math.max(0, Math.min(1, (squeeze - low) / (high - low)));
  const drain = (strain * (0.38 + 0.62 * strain)) / 30 + guest / 95;

  return Math.max(0, value - Math.min(1 / 30, drain) * dt);
}

export function guestProximity(distance: number) {
  return Math.max(0, Math.min(1, (0.83 - distance) / 0.48));
}
