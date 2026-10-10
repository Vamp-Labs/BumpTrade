import { faucet, formatCountdown, type FaucetState } from '../../chain/faucet';
import { getActiveChain } from '../../chain/port';
import { button, externalLink, h } from './dom';

export function claimFaucet(address: string | null, wallet: { refreshBalance(): Promise<void> }): void {
  if (!address) return;
  void faucet.claim(address).then((ok) => {
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
  const chain = getActiveChain();
  const left = faucet.secondsLeft();
  const cooling = left > 0;
  let label = `CLAIM ${chain.formatAmount(chain.claimAmount)} BUMP FREE`;
  if (state.claiming) label = 'CLAIMING…';
  else if (cooling) label = `NEXT CLAIM IN ${formatCountdown(left)}`;
  const claim = button(label, `${emphasize && !cooling ? 'hot' : ''}${state.claiming ? ' loading' : ''}`.trim(), onClaim);
  claim.disabled = state.claiming || cooling;
  parent.appendChild(claim);
  if (state.error) parent.appendChild(h('div', 'on-error', state.error));
  if (state.txHash && !state.error) {
    const line = h('div', 'on-sub');
    line.append('BUMP sent. ', externalLink('View transaction', chain.explorerTx(state.txHash)));
    parent.appendChild(line);
  }
}
