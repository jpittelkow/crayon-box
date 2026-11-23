// The vehicles' names, for screen readers, tests and the parent area: kid screens show no text (ADR 0003).
import type { VehicleKind } from './sim/sim';

export const VEHICLE_NAMES: Record<VehicleKind, string> = {
  car: 'Car', police: 'Police car', monster: 'Monster truck', bus: 'School bus', fire: 'Fire truck', ambulance: 'Ambulance',
  tow: 'Tow truck', digger: 'Digger', dump: 'Dump truck', mixer: 'Cement mixer', tractor: 'Tractor', garbage: 'Garbage truck',
  icecream: 'Ice-cream van', race: 'Race car',
  forklift: 'Forklift', roller: 'Road roller', loader: 'Loader', sweeper: 'Street sweeper', mail: 'Mail van', quad: 'Quad bike',
};
