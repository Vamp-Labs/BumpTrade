import { type Hex, keccak256 } from "viem";

export interface SeatInput {
  throttle: number;
  steer: number;
  buttons: number;
}

const RECORD_BYTES = 8;

export class InputLog {
  private bytes: Uint8Array;
  private view: DataView;
  private length = 0;

  constructor(private readonly seatCount: number) {
    this.bytes = new Uint8Array(RECORD_BYTES * seatCount * 600);
    this.view = new DataView(this.bytes.buffer);
  }

  recordTick(tick: number, inputs: ReadonlyArray<SeatInput | null>): void {
    const needed = this.length + RECORD_BYTES * this.seatCount;
    if (needed > this.bytes.length) {
      const grown = new Uint8Array(Math.max(needed, this.bytes.length * 2));
      grown.set(this.bytes);
      this.bytes = grown;
      this.view = new DataView(grown.buffer);
    }
    for (let seat = 0; seat < this.seatCount; seat++) {
      const input = inputs[seat];
      const offset = this.length;
      this.view.setUint32(offset, tick >>> 0, false);
      this.view.setUint8(offset + 4, seat);
      this.view.setInt8(offset + 5, input ? input.throttle : 0);
      this.view.setInt8(offset + 6, input ? input.steer : 0);
      this.view.setUint8(offset + 7, input ? input.buttons : 0);
      this.length += RECORD_BYTES;
    }
  }

  toBytes(): Uint8Array {
    return this.bytes.slice(0, this.length);
  }

  hash(): Hex {
    return keccak256(this.toBytes());
  }
}
