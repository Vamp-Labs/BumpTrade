import { formatBump } from '../../chain/token';
import { shortAddress } from '../../chain/wallet';
import { addressUrl, env } from '../../config/env';
import { aliasFor } from './alias';
import { clear, externalLink, h } from './dom';
import './online.css';

export type LeaderboardWindow = 'all' | '7d';

export interface LeaderboardRow {
  wallet: string;
  matches: number;
  wins: number;
  netPnl: string;
  bestBalance: number;
}

export interface Standing {
  rank: number;
  total: number;
  matches: number;
  wins: number;
  netPnl: string;
}

const REFRESH_MS = 15_000;
const STANDING_LIMIT = 200;

function isRow(value: unknown): value is LeaderboardRow {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.wallet === 'string' && (typeof r.netPnlAmount === 'string' || typeof r.netPnlWei === 'string');
}

function parseRows(value: unknown): LeaderboardRow[] {
  const rows = (value as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) throw new Error('Unexpected leaderboard response');
  return rows.filter(isRow).map((r) => {
    const raw = r as unknown as Record<string, unknown>;
    return { ...r, netPnl: String(raw.netPnlAmount ?? raw.netPnlWei) };
  });
}

async function fetchRows(window: LeaderboardWindow, limit: number): Promise<LeaderboardRow[]> {
  const response = await fetch(`${env.indexerUrl}/leaderboard?window=${window}&limit=${limit}`);
  if (!response.ok) throw new Error(`Indexer returned ${response.status}`);
  return parseRows(await response.json());
}

export async function fetchStanding(wallet: string): Promise<Standing | null> {
  const rows = await fetchRows('all', STANDING_LIMIT);
  const index = rows.findIndex((r) => r.wallet.toLowerCase() === wallet.toLowerCase());
  if (index < 0) return null;
  const row = rows[index];
  return { rank: index + 1, total: rows.length, matches: row.matches, wins: row.wins, netPnl: row.netPnl };
}

export function formatPnl(raw: string): { text: string; className: string } {
  let amount: bigint;
  try {
    amount = BigInt(raw);
  } catch {
    return { text: '-', className: '' };
  }
  if (amount === 0n) return { text: '0', className: '' };
  const negative = amount < 0n;
  const text = `${negative ? '-' : '+'}${formatBump(negative ? -amount : amount)}`;
  return { text, className: negative ? 'loss' : 'gain' };
}

function winRate(row: LeaderboardRow): string {
  return row.matches > 0 ? `${Math.round((row.wins / row.matches) * 100)}%` : '-';
}

export class OnlineLeaderboard {
  private host: HTMLElement | null = null;
  private requestId = 0;
  private myWallet: string | null = null;
  private window: LeaderboardWindow = 'all';
  private rows: LeaderboardRow[] = [];
  private timer: number | null = null;

  public setWallet(address: string | null): void {
    this.myWallet = address ? address.toLowerCase() : null;
    if (this.host && this.rows.length > 0) this.renderRows(this.host, this.rows);
  }

  public attach(host: HTMLElement): void {
    this.host = host;
    void this.load(true);
    this.timer ??= window.setInterval(() => void this.load(false), REFRESH_MS);
  }

  public detach(): void {
    this.host = null;
    this.requestId += 1;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  public refresh(): void {
    if (this.host) void this.load(false);
  }

  private async load(showSpinner: boolean): Promise<void> {
    const host = this.host;
    if (!host) return;
    const id = ++this.requestId;
    if (showSpinner || this.rows.length === 0) {
      clear(host);
      host.appendChild(this.segments());
      const loading = h('div', 'on-status');
      loading.append(h('span', 'on-spinner'), h('span', '', 'LOADING'));
      host.appendChild(loading);
    }
    try {
      const rows = await fetchRows(this.window, 50);
      if (id !== this.requestId || this.host !== host) return;
      this.rows = rows;
      this.renderRows(host, rows);
    } catch (error) {
      if (id !== this.requestId || this.host !== host) return;
      if (this.rows.length > 0 && !showSpinner) return;
      this.renderError(host, error instanceof Error ? error.message : 'Request failed');
    }
  }

  private segments(): HTMLElement {
    const bar = h('div', 'on-segs');
    const items: Array<[LeaderboardWindow, string]> = [
      ['all', 'ALL TIME'],
      ['7d', '7 DAYS'],
    ];
    for (const [key, label] of items) {
      const seg = h('button', `on-seg${this.window === key ? ' active' : ''}`, label);
      seg.type = 'button';
      seg.addEventListener('click', () => {
        if (this.window === key) return;
        this.window = key;
        this.rows = [];
        void this.load(true);
      });
      bar.appendChild(seg);
    }
    return bar;
  }

  private renderError(host: HTMLElement, message: string): void {
    clear(host);
    host.appendChild(this.segments());
    host.appendChild(h('div', 'on-error', `Leaderboard unavailable: ${message}`));
    const retry = h('button', 'on-btn', 'RETRY');
    retry.type = 'button';
    retry.addEventListener('click', () => void this.load(true));
    host.appendChild(retry);
  }

  private isMe(wallet: string): boolean {
    return this.myWallet !== null && wallet.toLowerCase() === this.myWallet;
  }

  private podium(rows: LeaderboardRow[]): HTMLElement {
    const wrap = h('div', 'on-podium');
    rows.slice(0, 3).forEach((r, index) => {
      const pnl = formatPnl(r.netPnl);
      const card = h('div', `on-pod p${index + 1}${this.isMe(r.wallet) ? ' me' : ''}`);
      card.append(
        h('div', 'on-pod-rank', String(index + 1)),
        h('div', 'on-pod-name', aliasFor(r.wallet)),
        h('div', `on-pod-pnl ${pnl.className}`.trim(), `${pnl.text} BUMP`),
        h('div', 'on-pod-sub', `${r.wins}W / ${r.matches}M`)
      );
      wrap.appendChild(card);
    });
    return wrap;
  }

  private yourRank(rows: LeaderboardRow[]): HTMLElement | null {
    if (!this.myWallet) return null;
    const index = rows.findIndex((r) => this.isMe(r.wallet));
    const text =
      index >= 0
        ? `YOUR RANK #${index + 1} OF ${rows.length}`
        : 'YOU ARE NOT RANKED YET. PLAY A MATCH';
    return h('div', 'on-yourrank', text);
  }

  private renderRows(host: HTMLElement, rows: LeaderboardRow[]): void {
    clear(host);
    host.appendChild(this.segments());
    if (rows.length === 0) {
      host.appendChild(h('div', 'on-sub', 'No settled matches yet'));
      return;
    }
    host.appendChild(this.podium(rows));
    const mine = this.yourRank(rows);
    if (mine) host.appendChild(mine);

    const table = h('table', 'on-table');
    const headRow = h('tr');
    headRow.append(
      h('th', '', '#'),
      h('th', '', 'PLAYER'),
      h('th', 'num', 'MATCHES'),
      h('th', 'num', 'WINS'),
      h('th', 'num', 'WIN %'),
      h('th', 'num', 'NET PNL (BUMP)'),
      h('th', 'num', 'BEST BAG')
    );
    table.appendChild(h('thead')).appendChild(headRow);
    const body = h('tbody');
    rows.forEach((r, index) => {
      const pnl = formatPnl(r.netPnl);
      const me = this.isMe(r.wallet);
      const tr = h('tr', me ? 'me' : '');
      const rank = h('td');
      rank.appendChild(h('span', `on-rank${index === 0 ? ' first' : ''}`, String(index + 1)));
      const player = h('td', 'on-player');
      player.append(h('div', 'on-alias', me ? `${aliasFor(r.wallet)} (YOU)` : aliasFor(r.wallet)));
      player.append(externalLink(shortAddress(r.wallet), addressUrl(r.wallet)));
      tr.append(
        rank,
        player,
        h('td', 'num', String(r.matches)),
        h('td', 'num', String(r.wins)),
        h('td', 'num', winRate(r)),
        h('td', `num on-value ${pnl.className}`.trim(), pnl.text),
        h('td', 'num', `$${r.bestBalance}`)
      );
      body.appendChild(tr);
    });
    table.appendChild(body);
    host.appendChild(table);
  }
}
