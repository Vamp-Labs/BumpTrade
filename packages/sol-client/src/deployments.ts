import type { Address } from "@solana/kit";
import devnet from "../../../solana/deployments/devnet.json";

export type Deployment = {
  cluster: string;
  programId: Address;
  mint: Address | null;
  treasury: Address | null;
  configPda: Address;
  slot: number | null;
  txSig: string | null;
  pending: boolean;
};

export const deployments: Deployment = devnet as Deployment;
