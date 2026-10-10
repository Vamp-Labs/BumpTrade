import { faucet, type FaucetState } from '../../chain/faucet';
import { getActiveChain, type ChainId } from '../../chain/port';
import { renderChainSelector } from './chainSelector';
import { button, clear, h, overlayRoot, row } from './dom';
import { renderFaucetBlock } from './faucetBlock';
import './online.css';

export type JoinAction = 'idle' | 'signing' | 'pending' | 'seated' | 'failed';
export type LobbyStage = 'connecting' | 'lobby' | 'cancelled' | 'unavailable';

export interface LobbyModel {
  stage: LobbyStage;
  matchId: string;
  stakeAmount: bigint;
  bumpBalance: bigint | null;
  seats: number;
  maxSeats: number;
  joinDeadline: number;
  fillEndsAt: number;
  action: JoinAction;
  error: string | null;
  lowBalance: boolean;
  matchOpen: boolean;
  message: string | null;
}

export function emptyLobbyModel(): LobbyModel {
  return {
    stage: 'connecting',
    matchId: '',
    stakeAmount: 0n,
    bumpBalance: null,
    seats: 0,
    maxSeats: 8,
    joinDeadline: 0,
    fillEndsAt: 0,
    action: 'idle',
    error: null,
    lowBalance: false,
    matchOpen: false,
    message: null,
  };
}

function shortMatch(matchId: string): string {
  return matchId.length > 12 ? `${matchId.slice(0, 6)}…${matchId.slice(-4)}` : matchId || '-';
}

function remaining(deadline: number): string {
  if (deadline <= 0) return '-';
  const left = Math.max(0, Math.floor(deadline - Date.now() / 1000));
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export class LobbyPanel {
  public onJoin?: () => void;
  public onLeave?: () => void;
  public onFaucet?: () => void;
  public onSelectChain?: (id: ChainId) => void;
  private readonly backdrop: HTMLElement;
  private readonly panel: HTMLElement;
  private visible = false;
  private model: LobbyModel = emptyLobbyModel();
  private faucetState: FaucetState = faucet.getState();

  constructor() {
    this.backdrop = h('div', 'on-backdrop');
    this.panel = h('div', 'on-panel');
    this.backdrop.appendChild(this.panel);
    overlayRoot().appendChild(this.backdrop);
    faucet.subscribe((state) => {
      this.faucetState = state;
      if (this.visible) this.render();
    });
  }

  public show(): void {
    this.visible = true;
    this.backdrop.classList.add('show');
    this.render();
  }

  public hide(): void {
    this.visible = false;
    this.backdrop.classList.remove('show');
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public update(model: LobbyModel): void {
    this.model = model;
    if (this.visible) this.render();
  }

  private render(): void {
    const m = this.model;
    clear(this.panel);

    const head = h('div', 'on-head');
    head.appendChild(h('div', 'on-title', m.stage === 'cancelled' ? 'MATCH CANCELLED' : 'LOBBY'));
    const seatPill = h('span', 'on-pill', `${m.seats}/${m.maxSeats} SEATS`);
    head.appendChild(seatPill);
    this.panel.appendChild(head);
    renderChainSelector(this.panel, (id) => this.onSelectChain?.(id));

    if (m.stage === 'connecting') {
      const status = h('div', 'on-status');
      status.append(h('span', 'on-spinner'), h('span', '', 'CONNECTING TO ARENA'));
      this.panel.appendChild(status);
      this.panel.appendChild(this.leaveButton());
      return;
    }

    if (m.stage === 'unavailable') {
      this.panel.appendChild(h('div', 'on-error', m.message ?? 'Arena server is unavailable'));
      this.panel.appendChild(this.leaveButton('BACK'));
      return;
    }

    const chain = getActiveChain();
    const well = h('div', 'on-well');
    well.append(row('Match', shortMatch(m.matchId)));
    well.append(row('Stake', `${chain.formatAmount(m.stakeAmount)} BUMP`, 'gold'));
    well.append(row('Your BUMP', m.bumpBalance === null ? '...' : chain.formatAmount(m.bumpBalance)));
    if (m.stage === 'lobby') {
      well.append(row('Join window', remaining(m.joinDeadline)));
      well.append(row('Match starts in', m.fillEndsAt > 0 ? remaining(m.fillEndsAt) : 'waiting for 2nd player'));
    }
    this.panel.appendChild(well);

    if (m.stage === 'cancelled') {
      this.renderCancelled();
      return;
    }

    if (m.message) this.panel.appendChild(h('div', 'on-info', m.message));
    this.renderJoin();
  }

  private renderJoin(): void {
    const m = this.model;
    const actions = h('div', 'on-actions');

    if (m.action === 'seated') {
      this.panel.appendChild(h('div', 'on-status', 'SEAT CONFIRMED. WAITING FOR THE MATCH TO START'));
    } else if (m.action === 'pending') {
      const status = h('div', 'on-status');
      status.append(h('span', 'on-spinner'), h('span', '', 'JOINING. THE ARENA PAYS THE GAS'));
      this.panel.appendChild(status);
    } else if (m.action === 'signing') {
      const status = h('div', 'on-status');
      status.append(h('span', 'on-spinner'), h('span', '', 'SIGN IN YOUR WALLET. NO FEE'));
      this.panel.appendChild(status);
    }

    if (m.error) this.panel.appendChild(h('div', 'on-error', m.error));
    if (m.lowBalance && m.action !== 'seated') {
      this.panel.appendChild(h('div', 'on-sub', 'Not enough BUMP to stake. Claim free BUMP.'));
      const box = h('div', 'on-actions');
      renderFaucetBlock(box, this.faucetState, true, () => this.onFaucet?.());
      this.panel.appendChild(box);
    }

    const busy = m.action === 'signing' || m.action === 'pending';
    const seated = m.action === 'seated';
    const label = seated ? 'SEATED - WAITING FOR PLAYERS' : m.action === 'failed' ? 'RETRY SIGN & JOIN' : 'SIGN & JOIN';
    const join = button(label, seated ? '' : `hot${busy ? ' loading' : ''}`, () => this.onJoin?.());
    join.disabled = busy || m.action === 'seated' || !m.matchOpen || m.stakeAmount <= 0n;
    actions.appendChild(join);
    actions.appendChild(this.leaveButton());
    this.panel.appendChild(actions);
  }

  private renderCancelled(): void {
    const m = this.model;
    this.panel.appendChild(h('div', 'on-info', 'Match cancelled. Any stake is returned to your wallet automatically.'));
    if (m.error) this.panel.appendChild(h('div', 'on-error', m.error));
    const actions = h('div', 'on-actions');
    actions.appendChild(this.leaveButton('BACK TO MENU'));
    this.panel.appendChild(actions);
  }

  private leaveButton(label = 'LEAVE'): HTMLButtonElement {
    return button(label, '', () => this.onLeave?.());
  }
}
