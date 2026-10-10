// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {BumpArena} from "../src/BumpArena.sol";
import {MockBUMP} from "../src/MockBUMP.sol";

contract ArenaHandler is Test {
    BumpArena public immutable arena;
    MockBUMP public immutable token;
    uint256 internal immutable signerPk;
    address internal immutable operator;
    address internal immutable owner;
    address public immutable treasury;

    uint256 public constant STAKE = 10e18 + 7;
    uint32 public constant START_BALANCE = 100;

    bytes32[] public matchIds;
    address[] public actors;
    mapping(bytes32 => uint256) public settleSuccesses;
    mapping(bytes32 => uint256) public refundCount;
    mapping(address => uint256) internal pkOf;
    uint256 public minted;

    constructor(
        BumpArena arena_,
        MockBUMP token_,
        uint256 signerPk_,
        address operator_,
        address owner_,
        address treasury_
    ) {
        arena = arena_;
        token = token_;
        signerPk = signerPk_;
        operator = operator_;
        owner = owner_;
        treasury = treasury_;
        for (uint256 i; i < 12; ++i) {
            uint256 pk = bound(uint256(keccak256(abi.encode("actor", i))), 1, type(uint128).max);
            address a = vm.addr(pk);
            pkOf[a] = pk;
            actors.push(a);
            token.claim(a);
            minted += token.CLAIM_AMOUNT();
        }
    }

    function matchCount() external view returns (uint256) {
        return matchIds.length;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    function open(uint8 maxPlayers, uint32 deadlineOffset) external {
        bytes32 id = keccak256(abi.encode("m", matchIds.length));
        maxPlayers = uint8(bound(maxPlayers, 2, 8));
        deadlineOffset = uint32(bound(deadlineOffset, 1, 600));
        vm.prank(operator);
        arena.openMatch(id, STAKE, maxPlayers, START_BALANCE, uint64(block.timestamp + deadlineOffset));
        matchIds.push(id);
    }

    function join(uint256 matchSeed, uint256 actorSeed) external {
        if (matchIds.length == 0) return;
        bytes32 id = matchIds[matchSeed % matchIds.length];
        address a = actors[actorSeed % actors.length];
        vm.prank(a);
        try arena.join(id, address(uint160(a) ^ 1), uint8(actorSeed % 7)) {} catch {}
    }

    function joinWithSig(uint256 matchSeed, uint256 actorSeed, uint256 deadlineOffset) external {
        if (matchIds.length == 0) return;
        bytes32 id = matchIds[matchSeed % matchIds.length];
        address a = actors[actorSeed % actors.length];
        BumpArena.JoinIntent memory intent = BumpArena.JoinIntent({
            matchId: id,
            player: a,
            sessionKey: address(uint160(a) ^ 1),
            vehicleId: uint8(actorSeed % 7),
            deadline: block.timestamp + bound(deadlineOffset, 0, 600)
        });
        (uint8 v, bytes32 r, bytes32 sg) = vm.sign(pkOf[a], arena.hashJoin(intent));
        vm.prank(operator);
        try arena.joinWithSig(intent, abi.encodePacked(r, sg, v)) {} catch {}
    }

    function faucet(uint256 actorSeed) external {
        address a = actors[actorSeed % actors.length];
        try token.claim(a) {
            minted += token.CLAIM_AMOUNT();
        } catch {}
    }

    function start(uint256 matchSeed) external {
        if (matchIds.length == 0) return;
        bytes32 id = matchIds[matchSeed % matchIds.length];
        vm.prank(operator);
        try arena.startMatch(id) {} catch {}
    }

    function settle(uint256 matchSeed, uint256 balanceSeed) external {
        if (matchIds.length == 0) return;
        bytes32 id = matchIds[matchSeed % matchIds.length];
        address[] memory players = arena.getPlayers(id);
        uint256 n = players.length;
        if (n == 0) return;

        uint32[] memory balances = new uint32[](n);
        uint8[] memory ranks = new uint8[](n);
        uint256 remaining = n * START_BALANCE;
        for (uint256 i; i < n; ++i) {
            ranks[i] = uint8(i + 1);
            if (i + 1 == n) {
                balances[i] = uint32(remaining);
            } else {
                uint256 take = uint256(keccak256(abi.encode(balanceSeed, i))) % (remaining + 1);
                balances[i] = uint32(take);
                remaining -= take;
            }
        }
        BumpArena.Result memory r = BumpArena.Result({
            matchId: id,
            players: players,
            finalBalances: balances,
            ranks: ranks,
            inputLogHash: bytes32(0),
            replayHash: bytes32(0),
            endedAt: uint64(block.timestamp)
        });
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(signerPk, arena.hashResult(r));
        try arena.settle(r, abi.encodePacked(rr, s, v)) {
            ++settleSuccesses[id];
        } catch {}
    }

    function cancel(uint256 matchSeed, bool asOperator) external {
        if (matchIds.length == 0) return;
        bytes32 id = matchIds[matchSeed % matchIds.length];
        vm.prank(asOperator ? operator : actors[matchSeed % actors.length]);
        try arena.cancel(id) {} catch {}
    }

    function refund(uint256 matchSeed, uint256 actorSeed) external {
        if (matchIds.length == 0) return;
        bytes32 id = matchIds[matchSeed % matchIds.length];
        address a = actors[actorSeed % actors.length];
        vm.prank(actors[(actorSeed >> 8) % actors.length]);
        try arena.claimRefund(id, a) {
            ++refundCount[id];
        } catch {}
    }

    function warp(uint32 delta) external {
        vm.warp(block.timestamp + bound(delta, 1, 2 hours));
    }

    function togglePause(bool pauseIt) external {
        vm.prank(owner);
        if (pauseIt) {
            try arena.pause() {} catch {}
        } else {
            try arena.unpause() {} catch {}
        }
    }
}

contract BumpArenaInvariantTest is StdInvariant, Test {
    BumpArena internal arena;
    MockBUMP internal token;
    ArenaHandler internal handler;

    uint256 internal constant SIGNER_PK = 0xA11CE;
    address internal owner = makeAddr("owner");
    address internal operator = makeAddr("operator");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockBUMP(owner);
        arena = new BumpArena(owner, vm.addr(SIGNER_PK), operator, treasury, 3600, address(token));
        vm.prank(owner);
        token.setArena(address(arena));
        handler = new ArenaHandler(arena, token, SIGNER_PK, operator, owner, treasury);
        targetContract(address(handler));
    }

    function invariant_arenaTokenBalanceEqualsLiveStakes() public view {
        uint256 live;
        uint256 matches_ = handler.matchCount();
        for (uint256 i; i < matches_; ++i) {
            bytes32 id = handler.matchIds(i);
            BumpArena.MatchView memory v = arena.getMatch(id);
            if (v.status == BumpArena.Status.Open || v.status == BumpArena.Status.Started) {
                live += v.pot;
            } else if (v.status == BumpArena.Status.Refunding) {
                live += v.pot - handler.refundCount(id) * v.stake;
            }
        }
        assertEq(token.balanceOf(address(arena)), live);
    }

    function invariant_arenaHoldsNoEth() public view {
        assertEq(address(arena).balance, 0);
    }

    function invariant_tokenSupplyEqualsMinted() public view {
        assertEq(token.totalSupply(), handler.minted());
    }

    function invariant_settledAndCancelledMatchesHoldNothing() public view {
        uint256 matches_ = handler.matchCount();
        uint256 live;
        for (uint256 i; i < matches_; ++i) {
            BumpArena.Status st = arena.getMatch(handler.matchIds(i)).status;
            if (st == BumpArena.Status.Settled || st == BumpArena.Status.Cancelled) continue;
            live++;
        }
        if (live == 0) assertEq(token.balanceOf(address(arena)), 0);
    }

    function invariant_matchSettlesAtMostOnce() public view {
        uint256 matches_ = handler.matchCount();
        for (uint256 i; i < matches_; ++i) {
            assertLe(handler.settleSuccesses(handler.matchIds(i)), 1);
        }
    }

    function invariant_potEqualsPlayersTimesStake() public view {
        uint256 matches_ = handler.matchCount();
        for (uint256 i; i < matches_; ++i) {
            BumpArena.MatchView memory v = arena.getMatch(handler.matchIds(i));
            assertEq(v.pot, uint256(v.playerCount) * v.stake);
            assertLe(v.playerCount, v.maxPlayers);
        }
    }

    function invariant_refundsNeverExceedPlayers() public view {
        uint256 matches_ = handler.matchCount();
        for (uint256 i; i < matches_; ++i) {
            bytes32 id = handler.matchIds(i);
            assertLe(handler.refundCount(id), arena.getMatch(id).playerCount);
        }
    }

    function invariant_settledAndRefundingAreExclusive() public view {
        uint256 matches_ = handler.matchCount();
        for (uint256 i; i < matches_; ++i) {
            bytes32 id = handler.matchIds(i);
            if (handler.settleSuccesses(id) == 1) {
                assertEq(handler.refundCount(id), 0);
            }
        }
    }
}
