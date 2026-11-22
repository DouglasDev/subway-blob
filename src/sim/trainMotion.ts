export const TRAVEL_SECONDS = 6.5;

const ACCELERATE = 1.1;
const BRAKE = 1.85;
const COAST = TRAVEL_SECONDS - ACCELERATE - BRAKE;
const DISTANCE = COAST + (ACCELERATE + BRAKE) / 2;

export function trainSpeed(elapsed: number) {
  const t = Math.max(0, Math.min(1, elapsed / ACCELERATE, (TRAVEL_SECONDS - elapsed) / BRAKE));

  return t * t * (3 - 2 * t);
}

export function travelProgress(elapsed: number) {
  if (elapsed <= 0) return 0;
  if (elapsed >= TRAVEL_SECONDS) return 1;

  if (elapsed < ACCELERATE) {
    const t = elapsed / ACCELERATE;

    return (ACCELERATE * t ** 3 * (1 - t / 2)) / DISTANCE;
  }

  if (elapsed > TRAVEL_SECONDS - BRAKE) {
    const remainder = (TRAVEL_SECONDS - elapsed) / BRAKE;

    return 1 - (BRAKE * remainder ** 3 * (1 - remainder / 2)) / DISTANCE;
  }

  return (elapsed - ACCELERATE / 2) / DISTANCE;
}
