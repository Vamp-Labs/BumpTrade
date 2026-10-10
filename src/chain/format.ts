import { formatUnits } from 'viem';

export function formatTokenAmount(amount: bigint, decimals: number, digits = 2): string {
  const negative = amount < 0n;
  const [whole = '0', fraction = ''] = formatUnits(negative ? -amount : amount, decimals).split('.');
  const trimmed = fraction.slice(0, digits).replace(/0+$/, '');
  const body = trimmed ? `${whole}.${trimmed}` : whole;
  return negative ? `-${body}` : body;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function walletKey(address: string): string {
  return EVM_ADDRESS.test(address) ? address.toLowerCase() : address;
}

export function shortAddress(address: string): string {
  return EVM_ADDRESS.test(address) ? `${address.slice(0, 6)}…${address.slice(-4)}` : `${address.slice(0, 4)}…${address.slice(-4)}`;
}
