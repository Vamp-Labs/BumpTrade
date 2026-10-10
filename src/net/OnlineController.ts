import * as THREE from 'three';
import { describeServerCode, faucet } from '../chain/faucet';
import { shortAddress, walletKey } from '../chain/format';
import {
  getActiveChain,
  onActiveChainChange,
  setActiveChain,
  type ChainId,
  type ClientChain,
  type MatchSnapshot,
  type SessionKeyHandle,
} from '../chain/port';
import { ServerJoinError } from '../chain/serverError';
import { claimFaucet } from '../ui/online/faucetBlock';
import type { VehicleInput } from '../input/InputManager';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { GameplayHUD, RankingRowData } from '../ui/GameplayHUD';
import { LobbyPanel, emptyLobbyModel, type LobbyModel } from '../ui/online/LobbyPanel';
import { OnlineLeaderboard, fetchStanding } from '../ui/online/OnlineLeaderboard';
import { ResultPanel, emptyResultModel, type ResultModel } from '../ui/online/ResultPanel';
import { WalletPanel } from '../ui/online/WalletPanel';
import type { HeroCar } from '../vehicles/HeroCar';
import { VehicleFactory } from '../vehicles/VehicleFactory';
import type { VehicleType } from '../vehicles/VehicleTypes';
import { EventBridge, type ArenaVisualHooks } from './eventBridge';
import { encodeInput } from './inputEncoder';
import { LocalNetCar } from './LocalNetCar';
import { NetClient } from './NetClient';
import { CarState, Phase, TICK_RATE, rankingPayout, vehicleIdOf, vehicleTypeOf, type MatchView, type RankingRow, type ServerCar, type ServerEvent } from './protocol';
import { RemoteCar } from './RemoteCar';

function parseAmount(raw: string): bigint {
  try {
    return BigInt(raw || '0');
  } catch {
    return 0n;
  }
}

export interface OnlineHost {
  scene: THREE.Scene;
  physicsWorld: PhysicsWorld;
  hud: GameplayHUD;
  visuals: ArenaVisualHooks;
  prepareMatch(type: VehicleType): Promise<HeroCar>;
  beginGameplay(): void;
  endOnline(): void;
  exitToMenu(): void;
  exitToVehicleSelect(): void;
}

type Stage = 'idle' | 'wallet' | 'lobby' | 'match' | 'result';

const CHAIN_POLL_MS = 3000;
const JOIN_CONFIRM_TIMEOUT_MS = 60_000;
const RESULT_DELAY_MS = 1800;
const SPAWN_HEIGHT = 0.4;

export class OnlineController {
  public readonly leaderboard = new OnlineLeaderboard();
  public onFlowChange?: (active: boolean) => void;
  private readonly walletPanel: WalletPanel;
  private readonly lobbyPanel = new LobbyPanel();
  private readonly resultPanel = new ResultPanel();
  private stage: Stage = 'idle';
  private net: NetClient | null = null;
  private view: MatchView | null = null;
  private lastPhase: number = -1;
  private vehicleType: VehicleType = 'hood_bull';
  private localWallet = '';
  private sessionKey: SessionKeyHandle | null = null;
  private unwatchWallet: (() => void) | null = null;
  private lobby: LobbyModel = emptyLobbyModel();
  private result: ResultModel = emptyResultModel();
  private standingLoading = false;
  private localCar: LocalNetCar | null = null;
  private readonly remotes = new Map<string, RemoteCar>();
  private readonly spawning = new Set<string>();
  private readonly eliminatedAt = new Map<string, number>();
  private readonly seatedWallets = new Set<string>();
  private bridge: EventBridge | null = null;
  private matchStarting = false;
  private matchBegun = false;
  private live = false;
  private lastCountdown = 0;
  private claimingSeat = false;
  private reclaimedStale = false;
  private lobbyClock: number | null = null;
  private chainClock: number | null = null;
  private resultTimer: number | null = null;
  private generation = 0;
  private joinStartedAt = 0;

  constructor(private readonly host: OnlineHost) {
    this.walletPanel = new WalletPanel();
    this.chain.wallet.discover();
    this.walletPanel.onClose = () => this.closeWallet();
    this.walletPanel.onSelectChain = (id) => this.selectChain(id);
    this.lobbyPanel.onSelectChain = (id) => this.selectChain(id);
    this.walletPanel.onContinue = () => {
      this.walletPanel.hide();
      this.host.exitToVehicleSelect();
    };
    this.lobbyPanel.onJoin = () => void this.signAndJoin();
    this.lobbyPanel.onLeave = () => this.leave();
    this.lobbyPanel.onFaucet = () => claimFaucet(this.chain.wallet.getState().address, this.chain.wallet);
    this.resultPanel.onBack = () => this.leave();
    this.watchWallet();
    onActiveChainChange(() => this.watchWallet());
  }

  private get chain(): ClientChain {
    return getActiveChain();
  }

  private key(address: string): string {
    return walletKey(address);
  }

  private watchWallet(): void {
    this.unwatchWallet?.();
    const chain = this.chain;
    this.unwatchWallet = chain.wallet.subscribe((state) => {
      this.leaderboard.setWallet(state.address, chain.id);
      if (this.stage === 'lobby') {
        const low = state.bumpBalance !== null && state.bumpBalance >= this.lobby.stakeAmount;
        this.patchLobby({ bumpBalance: state.bumpBalance, ...(low ? { lowBalance: false } : {}) });
      }
    });
  }

  private selectChain(id: ChainId): void {
    if (id === this.chain.id) return;
    const inLobby = this.stage === 'lobby';
    if (inLobby) this.resetToIdle();
    setActiveChain(id);
    if (inLobby) this.openWallet();
  }

  public isActive(): boolean {
    return this.stage !== 'idle';
  }

  public isInMatch(): boolean {
    return this.stage === 'match';
  }

  public isLive(): boolean {
    return this.live;
  }

  public getRemoteCars(): HeroCar[] {
    return Array.from(this.remotes.values()).map((remote) => remote.car);
  }

  public openWallet(): void {
    if (this.stage === 'idle') this.stage = 'wallet';
    this.onFlowChange?.(true);
    this.walletPanel.show();
  }

  private closeWallet(): void {
    this.walletPanel.hide();
    this.resetToIdle();
    this.host.exitToMenu();
  }

  public async launch(type: VehicleType): Promise<void> {
    const chain = this.chain;
    if (!chain.wallet.isReady() || !chain.isConfigured()) {
      this.openWallet();
      return;
    }
    this.vehicleType = type;
    this.localWallet = this.key(chain.wallet.getState().address ?? '');
    this.stage = 'lobby';
    this.generation += 1;
    const generation = this.generation;
    this.lobby = { ...emptyLobbyModel(), stage: 'connecting', bumpBalance: chain.wallet.getState().bumpBalance };
    void chain.wallet.refreshBalance();
    if (this.localWallet) void faucet.refresh(this.localWallet);
    this.lobbyPanel.update(this.lobby);
    this.lobbyPanel.show();
    this.startLobbyClock();

    const net = new NetClient({
      onState: (view) => this.handleState(view),
      onEvent: (event) => this.handleEvent(event),
      onDrop: () => this.patchLobby({ message: 'Connection lost, reconnecting' }),
      onReconnect: () => {
        this.patchLobby({ message: null });
        void this.claimSeat();
      },
      onClose: () => this.handleClose(),
    });
    this.net = net;
    try {
      await net.connect(vehicleIdOf(type));
      if (generation !== this.generation) return;
      this.patchLobby({ stage: 'lobby' });
    } catch (error) {
      if (generation !== this.generation) return;
      const message = error instanceof Error ? error.message : 'Unable to reach the arena server';
      this.patchLobby({ stage: 'unavailable', message: `Arena server unavailable: ${message}` });
    }
  }

  public tickInput(input: VehicleInput): void {
    if (!this.live || !this.net) return;
    this.net.sendInput(encodeInput(this.net.estimateTick(), input));
  }

  public update(dt: number): void {
    const now = performance.now();
    this.localCar?.update(now, dt);
    for (const remote of this.remotes.values()) remote.update(now, dt);
  }

  private handleState(view: MatchView): void {
    this.view = view;
    this.syncLobbyFromState(view);

    if (view.phase !== this.lastPhase) {
      const previous = this.lastPhase;
      this.lastPhase = view.phase;
      this.handlePhase(view.phase, previous);
    }

    if (this.stage === 'match' || this.matchStarting) this.pushCars(view);
    if (this.stage === 'match') this.syncHud(view);
  }

  private syncLobbyFromState(view: MatchView): void {
    if (this.stage !== 'lobby' || this.lobby.stage === 'cancelled') return;
    const stakeAmount = parseAmount(view.stakeAmount);
    const firstSight = this.lobby.matchId === '' && view.matchId !== '';
    this.patchLobby({
      matchId: view.matchId,
      stakeAmount: stakeAmount > 0n ? stakeAmount : this.lobby.stakeAmount || this.chain.defaultStake,
      joinDeadline: view.joinDeadline,
      fillEndsAt: view.fillEndsAt,
      seats: Math.max(this.lobby.seats, this.seatedWallets.size),
    });
    if (firstSight) void this.onMatchKnown(view.matchId);
  }

  private async onMatchKnown(matchId: string): Promise<void> {
    this.startChainClock();
    const key = this.chain.loadSessionKey(matchId);
    if (key && this.lobby.action === 'idle') this.sessionKey = key;
    await this.refreshChain();
  }

  private async checkRegistered(matchId: string): Promise<void> {
    const key = this.sessionKey;
    if (!key || !this.localWallet || this.lobby.action === 'seated' || this.claimingSeat) return;
    if (this.stage !== 'lobby' || this.lobby.stage === 'cancelled') return;
    try {
      const registered = await this.chain.readSessionKeyOf(matchId, this.localWallet);
      if (!registered || this.key(registered) !== this.key(key.publicId)) return;
      if (this.lobby.action === 'idle' || this.lobby.action === 'failed') this.patchLobby({ action: 'pending', error: null });
      await this.claimSeat();
    } catch {
      return;
    }
  }

  private handlePhase(phase: number, previous: number): void {
    if (phase === Phase.COUNTDOWN && previous < Phase.COUNTDOWN) {
      void this.beginMatch();
    } else if (phase === Phase.LIVE) {
      this.live = true;
    } else if (phase === Phase.ENDED) {
      this.live = false;
    } else if (phase === Phase.SETTLED) {
      this.live = false;
      this.patchResult({ stage: 'settled' });
      void this.loadStanding();
      this.showResultSoon();
    } else if (phase === Phase.CANCELLED) {
      this.live = false;
      if (this.stage === 'lobby') this.markCancelled();
    } else if (phase === Phase.SETTLE_FAILED) {
      this.live = false;
      this.patchResult({ stage: 'failed' });
      this.showResultSoon();
    }
  }

  private handleEvent(event: ServerEvent): void {
    switch (event.t) {
      case 'joinResult':
        if (this.key(event.wallet) === this.localWallet) {
          this.joinStartedAt = 0;
          void this.chain.wallet.refreshBalance();
          void this.claimSeat();
        }
        break;
      case 'seat':
        this.seatedWallets.add(this.key(event.wallet));
        this.patchLobby({ seats: Math.max(this.lobby.seats, this.seatedWallets.size) });
        if (this.key(event.wallet) === this.localWallet) {
          this.claimingSeat = false;
          this.patchLobby({ action: 'seated', error: null });
        }
        break;
      case 'bump':
        this.bridge?.bump(event);
        break;
      case 'eliminate':
        this.eliminatedAt.set(this.key(event.car), event.tick);
        this.bridge?.eliminate(event);
        break;
      case 'marketEvent':
        this.bridge?.marketEvent(event);
        break;
      case 'matchEnd':
        this.handleMatchEnd(event.ranking, event.matchId);
        break;
      case 'settlement':
        this.handleSettlement(event);
        break;
      case 'error':
        this.handleNetError(event);
        break;
      default:
        break;
    }
  }

  private handleNetError(event: Extract<ServerEvent, { t: 'error' }>): void {
    this.claimingSeat = false;
    if (event.code === 'STALE_AUTH' && !this.reclaimedStale && this.sessionKey) {
      this.reclaimedStale = true;
      void this.claimSeat();
      return;
    }
    if (event.code === 'ALREADY_JOINED' && this.sessionKey) {
      void this.claimSeat();
      return;
    }
    if (this.stage !== 'lobby') return;
    const active = this.lobby.action === 'pending' || this.lobby.action === 'seated' || this.lobby.action === 'signing';
    this.joinStartedAt = 0;
    this.patchLobby({
      action: active ? 'failed' : this.lobby.action,
      lowBalance: event.code === 'INSUFFICIENT_BALANCE' || this.lobby.lowBalance,
      error: describeServerCode(event.code, event.message, event.retryAfterS),
    });
    if (event.code === 'INSUFFICIENT_BALANCE') void this.chain.wallet.refreshBalance();
  }

  private handleClose(): void {
    if (this.stage === 'lobby' && this.lobby.stage !== 'cancelled') {
      this.patchLobby({ stage: 'unavailable', message: 'Connection to the arena closed' });
    }
  }

  private async signAndJoin(): Promise<void> {
    const view = this.view;
    const chain = this.chain;
    const net = this.net;
    if (!view?.matchId || !net || !chain.wallet.isReady()) {
      this.patchLobby({ action: 'failed', error: 'Connect your wallet on the right network first' });
      return;
    }
    const matchId = view.matchId;
    const stake = this.lobby.stakeAmount > 0n ? this.lobby.stakeAmount : chain.defaultStake;
    await chain.wallet.refreshBalance();
    const balance = chain.wallet.getState().bumpBalance;
    if (balance !== null && balance < stake) {
      this.patchLobby({ action: 'failed', lowBalance: true, error: 'Not enough BUMP to stake' });
      return;
    }

    this.patchLobby({ action: 'signing', error: null, lowBalance: false });
    this.reclaimedStale = false;
    this.sessionKey = chain.loadSessionKey(matchId) ?? chain.createSessionKey(matchId);
    try {
      await chain.join({
        net,
        matchId,
        vehicleId: vehicleIdOf(this.vehicleType),
        joinDeadline: view.joinDeadline,
        onSigned: () => {
          this.patchLobby({ action: 'pending' });
          this.joinStartedAt = performance.now();
          this.startChainClock();
        },
      });
      await this.refreshChain();
    } catch (error) {
      this.handleJoinError(error);
    }
  }

  private handleJoinError(error: unknown): void {
    this.joinStartedAt = 0;
    if (error instanceof ServerJoinError) {
      if (error.code === 'ALREADY_JOINED' && this.sessionKey) {
        void this.claimSeat();
        return;
      }
      const lowBalance = error.code === 'INSUFFICIENT_BALANCE';
      this.patchLobby({
        action: 'failed',
        lowBalance: lowBalance || this.lobby.lowBalance,
        error: describeServerCode(error.code, error.message, error.retryAfterS),
      });
      if (lowBalance) void this.chain.wallet.refreshBalance();
      return;
    }
    this.patchLobby({ action: 'failed', error: this.chain.describeError(error).message });
  }

  private async claimSeat(): Promise<void> {
    const net = this.net;
    const key = this.sessionKey;
    const view = this.view;
    if (!net || !key || !view?.matchId || !this.localWallet || this.claimingSeat) return;
    this.claimingSeat = true;
    try {
      await net.claimSeat(this.localWallet, key, view.matchId);
    } catch (error) {
      this.claimingSeat = false;
      this.patchLobby({ action: 'failed', error: this.chain.describeError(error).message });
    }
  }

  private async refreshChain(): Promise<void> {
    const matchId = this.view?.matchId;
    if (!matchId) return;
    try {
      const snapshot = await this.chain.readMatch(matchId);
      this.applyChain(snapshot);
      await this.checkRegistered(matchId);
      this.checkJoinTimeout();
    } catch {
      return;
    }
  }

  private checkJoinTimeout(): void {
    if (this.lobby.action !== 'pending' || this.joinStartedAt === 0) return;
    if (performance.now() - this.joinStartedAt < JOIN_CONFIRM_TIMEOUT_MS) return;
    this.joinStartedAt = 0;
    this.patchLobby({ action: 'failed', error: 'Join was not confirmed in time, try again' });
  }

  private applyChain(snapshot: MatchSnapshot): void {
    this.patchLobby({
      matchOpen: snapshot.status === 'open',
      seats: Math.max(snapshot.playerCount, this.seatedWallets.size),
      maxSeats: snapshot.maxPlayers || 8,
    });
    if (snapshot.status === 'cancelled' && this.stage === 'lobby') this.markCancelled();

    const nowSeconds = Date.now() / 1000;
    const refundable =
      (snapshot.status === 'open' || snapshot.status === 'started' || snapshot.status === 'refunding') &&
      snapshot.settleDeadline > 0 &&
      nowSeconds > snapshot.settleDeadline &&
      snapshot.playerCount > 0;
    const patch: Partial<ResultModel> = { refundPending: refundable };
    if (snapshot.status === 'settled') {
      patch.stage = 'settled';
      void this.resolveSettleTx();
    } else if (snapshot.status === 'cancelled') {
      patch.stage = 'cancelled';
    } else if (refundable) {
      patch.stage = 'failed';
    }
    if (snapshot.status === 'settled' || snapshot.status === 'cancelled') {
      if (this.view?.matchId) this.chain.clearSessionKey(this.view.matchId);
    }
    this.patchResult(patch);
    if (this.stage === 'match' && (snapshot.status === 'settled' || snapshot.status === 'cancelled')) {
      this.showResultSoon();
    }
  }

  private async resolveSettleTx(): Promise<void> {
    const matchId = this.view?.matchId;
    if (!matchId || this.result.settleTx) return;
    try {
      const response = await fetch(`${this.chain.leaderboardUrl}/matches/${matchId}`);
      if (!response.ok) return;
      const detail = (await response.json()) as { settleTx?: unknown };
      if (typeof detail.settleTx === 'string') this.patchResult({ settleTx: detail.settleTx });
    } catch {
      return;
    }
  }

  private markCancelled(): void {
    this.patchLobby({ stage: 'cancelled', action: 'idle', error: null });
    this.patchResult({ stage: 'cancelled' });
    void this.refreshChain();
  }

  private handleMatchEnd(ranking: RankingRow[], matchId: string): void {
    this.live = false;
    const rows = ranking
      .map((r) => ({
        rank: r.rank,
        wallet: this.key(r.wallet),
        finalBalance: r.finalBalance,
        payout: rankingPayout(r),
        isMe: this.key(r.wallet) === this.localWallet,
      }))
      .sort((a, b) => a.rank - b.rank);
    this.patchResult({ rows, stage: this.result.stage === 'ended' ? 'settling' : this.result.stage });
    if (this.view && !this.view.matchId) this.view = { ...this.view, matchId: matchId as MatchView['matchId'] };
    this.host.hud.showRoundCompleteBanner();
    this.startChainClock();
    this.showResultSoon();
  }

  private handleSettlement(event: Extract<ServerEvent, { t: 'settlement' }>): void {
    if (event.status === 'submitted') this.patchResult({ stage: 'settling' });
    else if (event.status === 'confirmed') {
      this.patchResult({ stage: 'settled', settleTx: event.txHash ?? this.result.settleTx });
      void this.refreshChain();
      void this.loadStanding();
      this.showResultSoon();
    } else if (event.status === 'failed') {
      this.patchResult({ stage: 'failed', note: event.error ?? null });
      void this.refreshChain();
    } else if (event.status === 'cancelled') {
      if (this.stage === 'lobby') this.markCancelled();
    }
  }

  private showResultSoon(): void {
    if (this.stage === 'result' || this.resultTimer !== null || this.stage === 'idle') return;
    if (this.stage === 'lobby') return;
    this.resultTimer = window.setTimeout(() => {
      this.resultTimer = null;
      this.stage = 'result';
      this.host.hud.hideResultModal();
      this.resultPanel.update(this.result);
      this.resultPanel.show();
    }, RESULT_DELAY_MS);
  }

  private async beginMatch(): Promise<void> {
    if (this.matchStarting || this.matchBegun) return;
    const view = this.view;
    if (!view) return;
    const mine = view.cars.find((car) => car.wallet === this.localWallet);
    if (!mine) {
      this.patchLobby({
        stage: 'unavailable',
        message: 'The match started without your seat. Any stake is returned to your wallet automatically.',
      });
      return;
    }
    this.matchStarting = true;
    this.lobbyPanel.hide();
    const generation = this.generation;
    try {
      const car = await this.host.prepareMatch(vehicleTypeOf(mine.vehicle));
      if (generation !== this.generation) return;
      this.localCar = new LocalNetCar(car, view.startBalance);
      this.bridge = new EventBridge({
        localWallet: this.localWallet,
        findCar: (w) => this.findCar(w),
        carId: (w) => (this.key(w) === this.localWallet ? 'player_car' : this.key(w)),
        visuals: this.host.visuals,
      });
      this.host.hud.setOnlineMode(true);
      this.stage = 'match';
      this.matchBegun = true;
      this.pushCars(this.view ?? view);
      this.host.beginGameplay();
    } finally {
      this.matchStarting = false;
    }
  }

  private findCar(walletAddress: string): HeroCar | undefined {
    const key = this.key(walletAddress);
    if (key === this.localWallet) return this.localCar?.getCar();
    return this.remotes.get(key)?.car;
  }

  private pushCars(view: MatchView): void {
    const now = performance.now();
    for (const car of view.cars) {
      if (car.wallet === this.localWallet) {
        this.localCar?.push(car, now);
        continue;
      }
      const remote = this.remotes.get(car.wallet);
      if (remote) remote.push(car, now);
      else if (!this.spawning.has(car.wallet)) void this.spawnRemote(car, view.startBalance);
    }
  }

  private async spawnRemote(server: ServerCar, startBalance: number): Promise<void> {
    this.spawning.add(server.wallet);
    const generation = this.generation;
    try {
      const car = await VehicleFactory.createVehicle(
        vehicleTypeOf(server.vehicle),
        server.wallet,
        this.host.scene,
        this.host.physicsWorld,
        new THREE.Vector3(server.px, server.py || SPAWN_HEIGHT, server.pz)
      );
      if (generation !== this.generation) {
        car.destroy(this.host.scene, this.host.physicsWorld);
        return;
      }
      const remote = new RemoteCar(car, server.wallet, server.seat, startBalance);
      this.remotes.set(server.wallet, remote);
      const latest = this.view?.cars.find((c) => c.wallet === server.wallet) ?? server;
      remote.push(latest, performance.now());
      this.refreshNames();
    } finally {
      this.spawning.delete(server.wallet);
    }
  }

  private refreshNames(): void {
    const names = new Map<string, string>();
    for (const wallet of this.remotes.keys()) names.set(wallet, shortAddress(wallet));
    this.host.hud.setOnlineNames(names);
  }

  private syncHud(view: MatchView): void {
    const hud = this.host.hud;
    const total = Math.max(0, view.endsAtTick - view.liveStartTick);
    if (view.phase === Phase.COUNTDOWN) {
      hud.setOnlineRoundSeconds(total / TICK_RATE);
      const left = Math.ceil(Math.max(0, view.liveStartTick - view.tick) / TICK_RATE);
      if (left >= 1 && left <= 3 && left !== this.lastCountdown) {
        this.lastCountdown = left;
        hud.showCountdownTick(left);
      }
    } else if (view.phase === Phase.LIVE) {
      hud.setOnlineRoundSeconds(Math.max(0, view.endsAtTick - view.tick) / TICK_RATE);
    } else {
      hud.setOnlineRoundSeconds(0);
    }
    hud.setOnlineRanking(this.buildRanking(view));
  }

  private buildRanking(view: MatchView): RankingRowData[] {
    const rows = view.cars.map((car) => {
      const eliminated = car.state === CarState.ELIMINATED || car.balance <= 0;
      const isMe = car.wallet === this.localWallet;
      return {
        id: isMe ? 'player_car' : car.wallet,
        name: isMe ? 'You' : shortAddress(car.wallet),
        cash: car.balance,
        isPlayer: isMe,
        rank: 0,
        isEliminated: eliminated,
        seat: car.seat,
        eliminatedAt: this.eliminatedAt.get(car.wallet) ?? 0,
      };
    });
    rows.sort((a, b) => {
      if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
      if (!a.isEliminated) return b.cash - a.cash || a.seat - b.seat;
      return b.eliminatedAt - a.eliminatedAt || a.seat - b.seat;
    });
    return rows.map((row, index) => ({
      id: row.id,
      name: row.name,
      cash: row.cash,
      isPlayer: row.isPlayer,
      rank: index + 1,
      isEliminated: row.isEliminated,
    }));
  }

  private patchLobby(patch: Partial<LobbyModel>): void {
    this.lobby = { ...this.lobby, ...patch };
    this.lobbyPanel.update(this.lobby);
  }

  private async loadStanding(): Promise<void> {
    const me = this.localWallet;
    if (!me || this.standingLoading || this.result.standing) return;
    this.standingLoading = true;
    this.leaderboard.refresh();
    for (const delay of [3000, 6000, 10000]) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      if (!this.standingLoading) return;
      try {
        const standing = await fetchStanding(this.chain.id, me);
        if (standing) {
          this.patchResult({ standing });
          this.leaderboard.refresh();
          break;
        }
      } catch {
        continue;
      }
    }
    this.standingLoading = false;
  }

  private patchResult(patch: Partial<ResultModel>): void {
    this.result = { ...this.result, ...patch };
    this.resultPanel.update(this.result);
  }

  private startLobbyClock(): void {
    this.stopClock('lobby');
    this.lobbyClock = window.setInterval(() => {
      if (this.stage === 'lobby') this.lobbyPanel.update(this.lobby);
    }, 1000);
  }

  private startChainClock(): void {
    if (this.chainClock !== null) return;
    this.chainClock = window.setInterval(() => void this.refreshChain(), CHAIN_POLL_MS);
  }

  private stopClock(which: 'lobby' | 'chain' | 'all'): void {
    if ((which === 'lobby' || which === 'all') && this.lobbyClock !== null) {
      window.clearInterval(this.lobbyClock);
      this.lobbyClock = null;
    }
    if ((which === 'chain' || which === 'all') && this.chainClock !== null) {
      window.clearInterval(this.chainClock);
      this.chainClock = null;
    }
  }

  public leave(): void {
    const exitStage = this.stage;
    this.resetToIdle();
    if (exitStage === 'match' || exitStage === 'result') {
      this.host.exitToMenu();
      return;
    }
    this.onFlowChange?.(true);
    this.host.exitToVehicleSelect();
  }

  public shutdown(): void {
    this.resetToIdle();
  }

  private resetToIdle(): void {
    this.generation += 1;
    this.stopClock('all');
    if (this.resultTimer !== null) {
      window.clearTimeout(this.resultTimer);
      this.resultTimer = null;
    }
    const net = this.net;
    this.net = null;
    void net?.leave();
    for (const remote of this.remotes.values()) remote.car.destroy(this.host.scene, this.host.physicsWorld);
    this.remotes.clear();
    this.spawning.clear();
    this.eliminatedAt.clear();
    this.seatedWallets.clear();
    this.localCar = null;
    this.bridge = null;
    this.view = null;
    this.sessionKey = null;
    this.lastPhase = -1;
    this.lastCountdown = 0;
    this.live = false;
    this.matchStarting = false;
    this.matchBegun = false;
    this.claimingSeat = false;
    this.reclaimedStale = false;
    this.joinStartedAt = 0;
    this.lobby = emptyLobbyModel();
    this.result = emptyResultModel();
    this.standingLoading = false;
    this.stage = 'idle';
    this.walletPanel.hide();
    this.lobbyPanel.hide();
    this.resultPanel.hide();
    this.host.hud.setOnlineMode(false);
    this.host.endOnline();
    this.onFlowChange?.(false);
  }
}
