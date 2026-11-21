export const SODA_RADIUS = 0.64;

export const SODA_SPEED = 0.46;

export const SODA_DRAIN = 0.014;

export const SHOVE_RANGE = 0.71;

export const SHOVE_DURATION = 0.42;

export const SPREADER_X = -3.86;

export const SPREADER_Z = -0.99;

export const RHINO_PRANK = 5;

export function sprayHits(x: number, z: number, facing: number) {
  const forward = x * Math.sin(facing) + z * Math.cos(facing);
  const sideways = x * Math.cos(facing) - z * Math.sin(facing);

  return forward > 0 && Math.abs(sideways) < 0.15 + forward * 0.48;
}
