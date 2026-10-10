import { SolanaSignTransaction, type SolanaSignTransactionFeature } from '@solana/wallet-standard-features';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import {
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  type StandardConnectFeature,
  type StandardDisconnectFeature,
  type StandardEventsFeature,
} from '@wallet-standard/features';
import { env } from '../../config/env';
import type { ChainWallet, ChainWalletState } from '../port';
import { describeSolError } from './errors';
import { readTokenBalance } from './rpc';

type Listener = (state: ChainWalletState) => void;
type Features = Record<string, unknown>;

const LAST_WALLET_KEY = 'bump.sol.wallet';

function feature<T>(wallet: Wallet, name: string): T | undefined {
  return (wallet.features as Features)[name] as T | undefined;
}

function isSupported(wallet: Wallet): boolean {
  return (
    StandardConnect in wallet.features &&
    SolanaSignTransaction in wallet.features &&
    wallet.chains.some((c) => c.startsWith('solana:'))
  );
}

export class SolanaWallet implements ChainWallet {
  private state: ChainWalletState = {
    status: 'disconnected',
    options: [],
    selectedId: null,
    address: null,
    networkOk: true,
    bumpBalance: null,
    error: null,
  };
  private listeners = new Set<Listener>();
  private registry = new Map<string, Wallet>();
  private selected: Wallet | null = null;
  private account: WalletAccount | null = null;
  private detach: (() => void) | null = null;
  private discovering = false;
  private tried = new Set<string>();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): ChainWalletState {
    return this.state;
  }

  public isReady(): boolean {
    return this.state.status === 'connected' && this.account !== null;
  }

  public list(): ChainWalletState['options'] {
    return this.state.options;
  }

  private patch(next: Partial<ChainWalletState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener(this.state);
  }

  public discover(): void {
    if (!this.discovering) {
      this.discovering = true;
      const api = getWallets();
      for (const wallet of api.get()) this.add(wallet);
      api.on('register', (...wallets) => {
        for (const wallet of wallets) this.add(wallet);
      });
      api.on('unregister', (...wallets) => {
        for (const wallet of wallets) this.remove(wallet);
      });
    }
    this.tried.clear();
    for (const wallet of this.registry.values()) this.autoConnect(wallet);
  }

  private add(wallet: Wallet): void {
    if (!isSupported(wallet) || this.registry.has(wallet.name)) return;
    this.registry.set(wallet.name, wallet);
    this.patch({ options: [...this.state.options, { id: wallet.name, name: wallet.name, icon: wallet.icon }] });
    this.autoConnect(wallet);
  }

  private remove(wallet: Wallet): void {
    if (this.registry.get(wallet.name) !== wallet) return;
    this.registry.delete(wallet.name);
    this.patch({ options: this.state.options.filter((o) => o.id !== wallet.name) });
    if (this.selected === wallet) this.disconnect();
  }

  private autoConnect(wallet: Wallet): void {
    if (this.state.status !== 'disconnected' || this.tried.has(wallet.name)) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_WALLET_KEY);
    } catch {
      last = null;
    }
    if (!last || last !== wallet.name) return;
    this.tried.add(wallet.name);
    void this.connect(wallet.name, true);
  }

  public async connect(id: string, silent = false): Promise<void> {
    const wallet = this.registry.get(id);
    const connector = wallet ? feature<StandardConnectFeature[typeof StandardConnect]>(wallet, StandardConnect) : undefined;
    if (!wallet || !connector) return;
    this.patch({ status: 'connecting', error: null });
    try {
      const { accounts } = await connector.connect(silent ? { silent: true } : undefined);
      const account = accounts[0] ?? wallet.accounts[0];
      if (!account) {
        if (silent) {
          this.patch({ status: 'disconnected' });
          return;
        }
        throw new Error('Wallet returned no account');
      }
      this.bind(wallet);
      this.selected = wallet;
      this.account = account;
      try {
        localStorage.setItem(LAST_WALLET_KEY, wallet.name);
      } catch {
        this.patch({});
      }
      this.patch({ status: 'connected', selectedId: wallet.name, address: account.address, networkOk: true });
      await this.refreshBalance();
    } catch (error) {
      this.patch({ status: 'disconnected', error: silent ? null : describeSolError(error).message });
    }
  }

  private bind(wallet: Wallet): void {
    this.detach?.();
    const events = feature<StandardEventsFeature[typeof StandardEvents]>(wallet, StandardEvents);
    if (!events) return;
    this.detach = events.on('change', (props) => {
      if (!props.accounts) return;
      const account = wallet.accounts[0] ?? null;
      if (!account) {
        this.disconnect();
        return;
      }
      this.account = account;
      this.patch({ address: account.address, bumpBalance: null });
      void this.refreshBalance();
    });
  }

  public disconnect(forget = false): void {
    const wallet = this.selected;
    if (forget) {
      try {
        localStorage.removeItem(LAST_WALLET_KEY);
      } catch {
        this.patch({});
      }
      const disconnector = wallet ? feature<StandardDisconnectFeature[typeof StandardDisconnect]>(wallet, StandardDisconnect) : undefined;
      void disconnector?.disconnect().catch(() => undefined);
    }
    this.detach?.();
    this.detach = null;
    this.selected = null;
    this.account = null;
    this.patch({ status: 'disconnected', selectedId: null, address: null, bumpBalance: null });
  }

  public async refreshBalance(): Promise<void> {
    const address = this.state.address;
    if (!address) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const bumpBalance = await readTokenBalance(address);
        if (this.state.address === address) this.patch({ bumpBalance });
        return;
      } catch {
        if (this.state.address !== address) return;
        await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
  }

  public async signTransaction(transaction: Uint8Array): Promise<Uint8Array> {
    const wallet = this.selected;
    const account = this.account;
    const signer = wallet ? feature<SolanaSignTransactionFeature[typeof SolanaSignTransaction]>(wallet, SolanaSignTransaction) : undefined;
    if (!wallet || !account || !signer) throw new Error('Connect your wallet first');
    const [output] = await signer.signTransaction({ account, transaction, chain: `solana:${env.sol.cluster}` });
    if (!output) throw new Error('Wallet returned no signed transaction');
    return output.signedTransaction;
  }
}

export const solWallet = new SolanaWallet();
