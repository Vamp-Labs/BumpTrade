import { faucet, type FaucetState } from '../../chain/faucet';
import { shortAddress } from '../../chain/format';
import {
  getActiveChain,
  onActiveChainChange,
  setActiveChain,
  type ChainId,
  type ChainWallet,
  type ChainWalletState,
} from '../../chain/port';
import { renderChainSelector } from './chainSelector';
import { button, clear, h, overlayRoot, row, safeIconSrc } from './dom';
import { claimFaucet, renderFaucetBlock } from './faucetBlock';
import './online.css';

export class WalletPanel {
  public onContinue?: () => void;
  public onClose?: () => void;
  public onSelectChain?: (id: ChainId) => void;
  private readonly backdrop: HTMLElement;
  private readonly panel: HTMLElement;
  private visible = false;
  private wallet: ChainWallet = getActiveChain().wallet;
  private unsubscribe: () => void;
  private state: ChainWalletState;
  private faucetState: FaucetState = faucet.getState();
  private clock: number | null = null;

  constructor() {
    this.backdrop = h('div', 'on-backdrop');
    this.panel = h('div', 'on-panel');
    this.backdrop.appendChild(this.panel);
    overlayRoot().appendChild(this.backdrop);
    this.state = this.wallet.getState();
    this.unsubscribe = this.watch();
    onActiveChainChange(() => {
      this.unsubscribe();
      this.wallet = getActiveChain().wallet;
      this.unsubscribe = this.watch();
    });
    faucet.subscribe((state) => {
      this.faucetState = state;
      if (this.visible) this.render();
    });
  }

  private watch(): () => void {
    return this.wallet.subscribe((state) => {
      this.state = state;
      if (this.visible) {
        if (state.address) void faucet.refresh(state.address);
        this.render();
      }
    });
  }

  private selectChain(id: ChainId): void {
    if (this.onSelectChain) this.onSelectChain(id);
    else setActiveChain(id);
  }

  public show(): void {
    this.wallet.discover();
    this.visible = true;
    this.backdrop.classList.add('show');
    if (this.state.address) void faucet.refresh(this.state.address);
    this.clock ??= window.setInterval(() => {
      if (this.visible && faucet.secondsLeft() > 0) this.render();
    }, 1000);
    this.render();
  }

  public hide(): void {
    if (this.clock !== null) {
      window.clearInterval(this.clock);
      this.clock = null;
    }
    this.visible = false;
    this.backdrop.classList.remove('show');
  }

  public isVisible(): boolean {
    return this.visible;
  }

  private render(): void {
    const state = this.state;
    clear(this.panel);

    const head = h('div', 'on-head');
    head.append(h('div', 'on-title', 'WALLET'), button('✕', '', () => this.onClose?.()));
    head.lastElementChild?.setAttribute('aria-label', 'Close');
    this.panel.appendChild(head);
    renderChainSelector(this.panel, (id) => this.selectChain(id));

    const arenaReady = getActiveChain().isConfigured();
    if (state.status !== 'connected') {
      this.renderConnect(state);
    } else {
      this.renderConnected(state);
    }

    if (!arenaReady) {
      this.panel.appendChild(h('div', 'on-error', `Arena is not deployed on ${getActiveChain().label} yet. Online play is unavailable.`));
    }
    if (state.error) this.panel.appendChild(h('div', 'on-error', state.error));
  }

  private renderConnect(state: ChainWalletState): void {
    this.panel.appendChild(
      h('div', 'on-sub', `Connect a wallet to play on ${getActiveChain().label}. Stakes are free BUMP and you never pay gas.`)
    );
    const wallets = this.wallet.list();
    if (wallets.length === 0) {
      this.panel.appendChild(h('div', 'on-error', getActiveChain().id === 'solana'
          ? 'No wallet detected. Install Phantom, Backpack or Solflare.'
          : 'No wallet detected. Install a browser wallet such as MetaMask.'));
      return;
    }
    const list = h('div', 'on-wallet-list');
    for (const option of wallets) {
      const item = h('button', 'on-wallet-option');
      item.type = 'button';
      const src = safeIconSrc(option.icon);
      if (src) {
        const icon = h('img');
        icon.src = src;
        icon.alt = '';
        item.appendChild(icon);
      }
      item.appendChild(h('span', '', option.name));
      item.disabled = state.status === 'connecting';
      item.addEventListener('click', () => void this.wallet.connect(option.id));
      list.appendChild(item);
    }
    this.panel.appendChild(list);
    if (state.status === 'connecting') {
      const status = h('div', 'on-status');
      status.append(h('span', 'on-spinner'), h('span', '', 'WAITING FOR WALLET'));
      this.panel.appendChild(status);
    }
  }

  private renderConnected(state: ChainWalletState): void {
    const chain = getActiveChain();
    const onChain = state.networkOk;
    const well = h('div', 'on-well');
    well.append(row('Address', state.address ? shortAddress(state.address) : '-'));
    const badgeRow = h('div', 'on-row');
    badgeRow.append(
      h('span', 'on-label', 'Network'),
      h('span', `on-pill ${onChain ? 'ok' : 'warn'}`, onChain ? chain.label : 'Wrong network')
    );
    well.appendChild(badgeRow);
    well.append(row('BUMP balance', state.bumpBalance === null ? '...' : chain.formatAmount(state.bumpBalance), 'gold'));
    this.panel.appendChild(well);

    const actions = h('div', 'on-actions');
    if (!onChain) {
      this.panel.appendChild(h('div', 'on-sub', 'Switch network to sign your match entry. No gas needed.'));
      actions.appendChild(button('SWITCH NETWORK', 'hot', () => void this.wallet.switchNetwork?.()));
    } else {
      const low = state.bumpBalance !== null && state.bumpBalance < chain.defaultStake;
      if (chain.isTokenConfigured()) {
        const faucetBox = h('div', 'on-actions');
        renderFaucetBlock(faucetBox, this.faucetState, low, () => claimFaucet(state.address, this.wallet));
        this.panel.appendChild(faucetBox);
      }
      const cont = button('CONTINUE', 'hot', () => this.onContinue?.());
      cont.disabled = !chain.isConfigured();
      actions.appendChild(cont);
    }
    actions.appendChild(button('DISCONNECT', '', () => this.wallet.disconnect(true)));
    this.panel.appendChild(actions);
  }
}
