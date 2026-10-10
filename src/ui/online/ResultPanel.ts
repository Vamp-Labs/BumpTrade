import { formatBump } from '../../chain/token';
import { txUrl } from '../../config/env';
import { aliasFor } from './alias';
import { button, clear, externalLink, h, overlayRoot } from './dom';
import type { Standing } from './OnlineLeaderboard';
import './online.css';

export type ResultStage = 'ended' | 'settling' | 'settled' | 'failed' | 'cancelled';

export interface ResultRow {
  rank: number;
  wallet: string;
  finalBalance: number;
  payout: bigint;
  isMe: boolean;
}

export interface ResultModel {
  stage: ResultStage;
  rows: ResultRow[];
  settleTx: string | null;
  refundPending: boolean;
  error: string | null;
  note: string | null;
  standing: Standing | null;
}

export function emptyResultModel(): ResultModel {
  return {
    stage: 'ended',
    rows: [],
    settleTx: null,
    refundPending: false,
    error: null,
    note: null,
    standing: null,
  };
}

export class ResultPanel {
  public onBack?: () => void;
  private readonly backdrop: HTMLElement;
  private readonly panel: HTMLElement;
  private visible = false;
  private model: ResultModel = emptyResultModel();

  constructor() {
    this.backdrop = h('div', 'on-backdrop');
    this.panel = h('div', 'on-panel wide');
    this.backdrop.appendChild(this.panel);
    overlayRoot().appendChild(this.backdrop);
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

  public update(model: ResultModel): void {
    this.model = model;
    if (this.visible) this.render();
  }

  private render(): void {
    const m = this.model;
    clear(this.panel);

    const head = h('div', 'on-head');
    head.appendChild(h('div', 'on-title', m.stage === 'cancelled' ? 'MATCH CANCELLED' : 'MATCH RESULT'));
    head.appendChild(this.stagePill());
    this.panel.appendChild(head);

    if (m.rows.length > 0) this.panel.appendChild(this.table());
    this.panel.appendChild(this.statusBlock());

    if (m.error) this.panel.appendChild(h('div', 'on-error', m.error));

    const actions = h('div', 'on-actions');
    actions.appendChild(button('BACK TO MENU', '', () => this.onBack?.()));
    this.panel.appendChild(actions);
  }

  private stagePill(): HTMLElement {
    switch (this.model.stage) {
      case 'settled':
        return h('span', 'on-pill ok', 'SETTLED');
      case 'failed':
        return h('span', 'on-pill bad', 'SETTLE FAILED');
      case 'cancelled':
        return h('span', 'on-pill warn', 'CANCELLED');
      case 'settling':
        return h('span', 'on-pill', 'SETTLING');
      default:
        return h('span', 'on-pill', 'ROUND COMPLETE');
    }
  }

  private table(): HTMLElement {
    const table = h('table', 'on-table');
    const head = h('tr');
    head.append(h('th', '', '#'), h('th', '', 'PLAYER'), h('th', 'num', 'BAG'), h('th', 'num', 'PAYOUT (BUMP)'));
    table.appendChild(h('thead')).appendChild(head);
    const body = h('tbody');
    for (const r of this.model.rows) {
      const tr = h('tr', r.isMe ? 'me' : '');
      const rank = h('td');
      rank.appendChild(h('span', `on-rank${r.rank === 1 ? ' first' : ''}`, String(r.rank)));
      const player = h('td', '', r.isMe ? `${aliasFor(r.wallet)} (you)` : aliasFor(r.wallet));
      const bag = h('td', 'num', `$${r.finalBalance}`);
      const payout = h('td', 'num', r.payout > 0n ? formatBump(r.payout) : '0');
      tr.append(rank, player, bag, payout);
      body.appendChild(tr);
    }
    table.appendChild(body);
    return table;
  }

  private statusBlock(): HTMLElement {
    const m = this.model;
    const block = h('div', 'on-well');
    const line = h('div', 'on-status');
    const mine = m.rows.find((r) => r.isMe);
    if (m.stage === 'settling' || m.stage === 'ended') {
      line.append(h('span', 'on-spinner'), h('span', '', m.stage === 'ended' ? 'WAITING FOR SETTLEMENT' : 'SETTLING…'));
    } else if (m.stage === 'settled') {
      line.append(h('span', '', mine ? `PAID ${formatBump(mine.payout)} BUMP TO YOUR WALLET` : 'SETTLED'));
      if (m.settleTx) line.append(externalLink('View settle transaction', txUrl(m.settleTx)));
    } else if (m.stage === 'failed') {
      line.append(h('span', '', m.refundPending ? 'SETTLEMENT FAILED. STAKE REFUND IS BEING SENT' : 'SETTLEMENT FAILED. RETRYING'));
    } else {
      line.append(h('span', '', 'MATCH CANCELLED. STAKE RETURNED TO YOUR WALLET'));
    }
    block.appendChild(line);
    if (m.stage === 'settled' && m.standing) {
      const st = m.standing;
      block.appendChild(
        h('div', 'on-standing', `ALL-TIME RANK #${st.rank} OF ${st.total} | ${st.wins}W / ${st.matches}M`)
      );
    }
    if (m.note) block.appendChild(h('div', 'on-sub', m.note));
    return block;
  }
}
