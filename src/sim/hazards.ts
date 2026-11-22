export const PA_FEEDBACK_SECONDS = 4.15;

export const SODA_EDGE = [0.94, 0.04, 0.02] as const;

export function sodaRadius(age: number) {
  const progress = Math.max(0, Math.min(1, age / 6));

  return 0.68 + 0.36 * progress * progress * (3 - 2 * progress);
}

export function sodaContains(x: number, z: number, radius: number) {
  const angle = Math.atan2(z, x);
  const [base, ripple, flecks] = SODA_EDGE;
  const edge = base + ripple * Math.sin(angle * 5) + flecks * Math.sin(angle * 9);

  return Math.hypot(x, z) <= radius * edge;
}

export const SODA_SPEED = 0.46;

export const SODA_DRAIN = 0.014;

export const GUEST_RADIUS = 0.83 * 1.3;

export const SPEAKER_RADIUS = 3.4 * 1.3;

export const SNEEZE_SECONDS = 1.05;

export const SHOVE_RANGE = 0.71 * 1.3;

export const SHOVE_DURATION = 0.42;

export const SPREADER_X = 3.56;

export const SPREADER_Z = 0.99;

export const SPREADER_SEATS = [
  { x: SPREADER_X, z: SPREADER_Z, heading: Math.PI },
  { x: 0.65, z: 0.72, heading: -Math.PI / 2 },
];

export const SPREADER_LEG = {
  hip: { x: 0.1, y: 0.5, z: 0.08 },
  knee: { x: 0.44, y: 0.49, z: 0.5 },
  ankle: { x: 0.54, y: 0.1, z: 0.64 },
};

export function spreaderHeading(x: number) {
  return SPREADER_SEATS[x < 2 ? 1 : 0].heading;
}

export function spreaderSitting(x: number, z: number) {
  const seat = SPREADER_SEATS[x < 2 ? 1 : 0];

  return Math.abs(x - seat.x) < 0.025 && Math.abs(z - seat.z) < 0.025;
}

export const RHINO_PRANK = 5;

export function sprayHits(x: number, z: number, facing: number) {
  const forward = x * Math.sin(facing) + z * Math.cos(facing);
  const sideways = x * Math.cos(facing) - z * Math.sin(facing);

  return forward > 0 && Math.abs(sideways) < 0.15 + forward * 0.48;
}
