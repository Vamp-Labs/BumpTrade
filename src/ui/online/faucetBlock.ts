import { faucet, formatCountdown, type FaucetState } from '../../chain/faucet';
import { CLAIM_AMOUNT, formatBump } from '../../chain/token';
import { txUrl } from '../../config/env';
import { button, externalLink, h } from './dom';

export function claimFaucet(address: string | null, wallet: { refreshBalance(): Promise<void> }): void {
  if (!address) return;
  void faucet.claim(address as `0x${string}`).then((ok) => {
    void wallet.refreshBalance();
    if (ok) window.setTimeout(() => void wallet.refreshBalance(), 2500);
  });
}

export function renderFaucetBlock(
  parent: HTMLElement,
  state: FaucetState,
  emphasize: boolean,
  onClaim: () => void
): void {
  const left = faucet.secondsLeft();
  const cooling = left > 0;
  let label = `CLAIM ${formatBump(CLAIM_AMOUNT)} BUMP FREE`;
  if (state.claiming) label = 'CLAIMING…';
  else if (cooling) label = `NEXT CLAIM IN ${formatCountdown(left)}`;
  const claim = button(label, `${emphasize && !cooling ? 'hot' : ''}${state.claiming ? ' loading' : ''}`.trim(), onClaim);
  claim.disabled = state.claiming || cooling;
  parent.appendChild(claim);
  if (state.error) parent.appendChild(h('div', 'on-error', state.error));
  if (state.txHash && !state.error) {
    const line = h('div', 'on-sub');
    line.append('BUMP sent. ', externalLink('View transaction', txUrl(state.txHash)));
    parent.appendChild(line);
  }
}
