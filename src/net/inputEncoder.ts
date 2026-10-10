import { encodeButtons, quantizeAxis } from '@bump/shared';
import type { VehicleInput } from '../input/InputManager';

export interface EncodedInput {
  tick: number;
  throttle: number;
  steer: number;
  buttons: number;
}

export function encodeInput(tick: number, input: VehicleInput): EncodedInput {
  return {
    tick: tick >>> 0,
    throttle: quantizeAxis(input.throttle),
    steer: quantizeAxis(input.steer),
    buttons: encodeButtons({ brake: input.brake, boost: input.boost, handbrake: input.handbrake }),
  };
}
