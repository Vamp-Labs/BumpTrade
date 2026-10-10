import { createWalletClient, custom, type Address, type EIP1193Provider, type WalletClient } from 'viem';
import { chain } from './clients';
import { describeChainError } from './errors';
import { readTokenBalance } from './token';

export interface DiscoveredWallet {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
  provider: EIP1193Provider;
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EIP1193Provider;
}

interface EthereumWindow {
  ethereum?: EIP1193Provider;
}

export type WalletStatus = 'disconnected' | 'connecting' | 'connected';

export interface WalletState {
  status: WalletStatus;
  wallets: DiscoveredWallet[];
  selected: DiscoveredWallet | null;
  address: Address | null;
  chainId: number | null;
  bumpBalance: bigint | null;
  error: string | null;
}

type Listener = (state: WalletState) => void;

const LAST_WALLET_KEY = 'bump.wallet.rdns';

function parseChainId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = value.startsWith('0x') ? parseInt(value, 16) : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isEip6963Detail(value: unknown): value is Eip6963Detail {
  if (typeof value !== 'object' || value === null) return false;
  const detail = value as Partial<Eip6963Detail>;
  return !!detail.info && typeof detail.info.uuid === 'string' && !!detail.provider;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export class WalletController {
  private state: WalletState = {
    status: 'disconnected',
    wallets: [],
    selected: null,
    address: null,
    chainId: null,
    bumpBalance: null,
    error: null,
  };
  private listeners = new Set<Listener>();
  private client: WalletClient | null = null;
  private detach: (() => void) | null = null;
  private discovering = false;
  private autoTried = false;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): WalletState {
    return this.state;
  }

  public getClient(): WalletClient | null {
    return this.client;
  }

  public isReady(): boolean {
    return this.state.status === 'connected' && this.state.chainId === chain.id && this.state.address !== null;
  }

  private patch(next: Partial<WalletState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener(this.state);
  }

  public discover(): void {
    if (this.discovering) return;
    this.discovering = true;
    window.addEventListener('eip6963:announceProvider', (event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isEip6963Detail(detail)) return;
      if (this.state.wallets.some((w) => w.uuid === detail.info.uuid)) return;
      const wallet: DiscoveredWallet = { ...detail.info, provider: detail.provider };
      this.patch({ wallets: [...this.state.wallets, wallet] });
      this.autoConnect(wallet);
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    window.setTimeout(() => {
      const injected = this.listWallets();
      if (injected.length > 0) this.autoConnect(injected[0]);
    }, 800);
  }

  private autoConnect(candidate: DiscoveredWallet): void {
    if (this.autoTried || this.state.status !== 'disconnected') return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_WALLET_KEY);
    } catch {
      last = null;
    }
    if (!last || last !== candidate.rdns) return;
    this.autoTried = true;
    void this.connect(candidate, true);
  }

  public listWallets(): DiscoveredWallet[] {
    if (this.state.wallets.length > 0) return this.state.wallets;
    const injected = (window as unknown as EthereumWindow).ethereum;
    if (injected) {
      return [{ uuid: 'window.ethereum', name: 'Browser wallet', icon: '', rdns: 'window.ethereum', provider: injected }];
    }
    return [];
  }

  public async connect(wallet: DiscoveredWallet, silent = false): Promise<void> {
    this.patch({ status: 'connecting', error: null });
    try {
      const accounts = (await wallet.provider.request({
        method: silent ? 'eth_accounts' : 'eth_requestAccounts',
      })) as Address[];
      const address = accounts[0];
      if (!address) {
        if (silent) {
          this.patch({ status: 'disconnected' });
          return;
        }
        throw new Error('Wallet returned no account');
      }
      const chainId = parseChainId(await wallet.provider.request({ method: 'eth_chainId' }));
      this.bind(wallet);
      this.client = createWalletClient({ account: address, chain, transport: custom(wallet.provider) });
      try {
        localStorage.setItem(LAST_WALLET_KEY, wallet.rdns);
      } catch {
        this.patch({});
      }
      this.patch({ status: 'connected', selected: wallet, address, chainId });
      await this.refreshBalance();
    } catch (error) {
      this.patch({
        status: 'disconnected',
        error: silent ? null : describeChainError(error).message,
      });
    }
  }

  private bind(wallet: DiscoveredWallet): void {
    this.detach?.();
    const onAccounts = (accounts: Address[]): void => {
      const address = accounts[0] ?? null;
      if (!address) {
        this.disconnect();
        return;
      }
      this.client = createWalletClient({ account: address, chain, transport: custom(wallet.provider) });
      this.patch({ address });
      void this.refreshBalance();
    };
    const onChain = (chainId: string): void => {
      this.patch({ chainId: parseChainId(chainId) });
      void this.refreshBalance();
    };
    wallet.provider.on('accountsChanged', onAccounts);
    wallet.provider.on('chainChanged', onChain);
    this.detach = () => {
      wallet.provider.removeListener('accountsChanged', onAccounts);
      wallet.provider.removeListener('chainChanged', onChain);
    };
  }

  public disconnect(forget = false): void {
    if (forget) {
      try {
        localStorage.removeItem(LAST_WALLET_KEY);
      } catch {
        this.patch({});
      }
    }
    this.detach?.();
    this.detach = null;
    this.client = null;
    this.patch({ status: 'disconnected', selected: null, address: null, chainId: null, bumpBalance: null });
  }

  public async switchToTarget(): Promise<void> {
    const client = this.client;
    if (!client) return;
    this.patch({ error: null });
    try {
      await client.switchChain({ id: chain.id });
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      const unknownChain = code === 4902 || /unrecognized chain|not been added/i.test(String((error as Error).message));
      if (!unknownChain) {
        this.patch({ error: describeChainError(error).message });
        return;
      }
      try {
        await client.addChain({ chain });
        await client.switchChain({ id: chain.id });
      } catch (addError) {
        this.patch({ error: describeChainError(addError).message });
        return;
      }
    }
    const provider = this.state.selected?.provider;
    if (provider) {
      this.patch({ chainId: parseChainId(await provider.request({ method: 'eth_chainId' })) });
    }
    await this.refreshBalance();
  }

  public async refreshBalance(): Promise<void> {
    const address = this.state.address;
    if (!address) return;
    try {
      const bumpBalance = await readTokenBalance(address);
      if (this.state.address === address) this.patch({ bumpBalance });
    } catch {
      this.patch({ bumpBalance: null });
    }
  }
}

export const wallet = new WalletController();
