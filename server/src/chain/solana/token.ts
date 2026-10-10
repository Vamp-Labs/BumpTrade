import {
  type AccountMeta,
  type AccountSignerMeta,
  AccountRole,
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";

export const TOKEN_PROGRAM: Address =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
export const ATA_PROGRAM: Address =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" as Address;
export const SYSTEM_PROGRAM: Address =
  "11111111111111111111111111111111" as Address;

export const findAta = async (owner: Address, mint: Address): Promise<Address> => {
  const encoder = getAddressEncoder();
  const [ata] = await getProgramDerivedAddress({
    programAddress: ATA_PROGRAM,
    seeds: [
      encoder.encode(owner),
      encoder.encode(TOKEN_PROGRAM),
      encoder.encode(mint),
    ],
  });
  return ata;
};

export const createAtaIdempotentIx = (
  payer: TransactionSigner,
  ata: Address,
  owner: Address,
  mint: Address,
): Instruction<string, readonly (AccountMeta | AccountSignerMeta)[]> => ({
  programAddress: ATA_PROGRAM,
  accounts: [
    { address: payer.address, role: AccountRole.WRITABLE_SIGNER, signer: payer },
    { address: ata, role: AccountRole.WRITABLE },
    { address: owner, role: AccountRole.READONLY },
    { address: mint, role: AccountRole.READONLY },
    { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
  ],
  data: new Uint8Array([1]),
});

export const mintToIx = (
  mint: Address,
  destination: Address,
  authority: TransactionSigner,
  amount: bigint,
): Instruction<string, readonly (AccountMeta | AccountSignerMeta)[]> => {
  const data = new Uint8Array(9);
  data[0] = 7;
  new DataView(data.buffer).setBigUint64(1, amount, true);
  return {
    programAddress: TOKEN_PROGRAM,
    accounts: [
      { address: mint, role: AccountRole.WRITABLE },
      { address: destination, role: AccountRole.WRITABLE },
      {
        address: authority.address,
        role: AccountRole.READONLY_SIGNER,
        signer: authority,
      },
    ],
    data,
  };
};
