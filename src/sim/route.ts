export const STATIONS = [
  '149 St–Grand Concourse',
  '138 St–Grand Concourse',
  '125 St',
  '86 St',
  'Lexington Av/59 St',
  'Grand Central–42 St',
  '14 St–Union Sq',
  'Brooklyn Bridge–City Hall',
  'Fulton St',
  'Wall St',
  'Bowling Green',
  'Borough Hall',
  'Nevins St',
  'Atlantic Av–Barclays Ctr',
  'Franklin Av–Medgar Evers College',
  'Crown Hts–Utica Av',
];

const leg = STATIONS.length - 1;

export function stationIndex(stop: number) {
  const cycle = stop % (leg * 2);

  return cycle <= leg ? cycle : leg * 2 - cycle;
}

export function travelDirection(stop: number) {
  return stationIndex(stop + 1) > stationIndex(stop) ? 1 : -1;
}
