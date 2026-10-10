import { createPublicClient, defineChain, fallback, http, type Chain, type PublicClient } from 'viem';
import { robinhoodTestnet } from 'viem/chains';
import { env } from '../config/env';

function buildChain(): Chain {
  if (env.chainId === robinhoodTestnet.id) return robinhoodTestnet;
  return defineChain({
    id: env.chainId,
    name: `Chain ${env.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [env.rpcUrl] } },
  });
}

export const chain: Chain = buildChain();

function rpcUrls(): string[] {
  const urls = [env.rpcUrl];
  if (env.chainId === robinhoodTestnet.id && env.rpcUrl !== env.publicRpcUrl) {
    urls.push(env.publicRpcUrl);
  }
  return urls;
}

export const publicClient: PublicClient = createPublicClient({
  chain,
  transport: fallback(rpcUrls().map((url) => http(url))),
});
