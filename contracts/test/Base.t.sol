// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Test} from "forge-std/Test.sol";
import {BumpArena} from "../src/BumpArena.sol";
import {MockBUMP} from "../src/MockBUMP.sol";

abstract contract Base is Test {
    BumpArena internal arena;
    MockBUMP internal token;

    uint256 internal constant SIGNER_PK = 0xA11CE;
    uint256 internal constant STAKE = 100e18;
    uint256 internal constant TOKENS = 1000e18;
    uint32 internal constant START_BALANCE = 100;
    uint64 internal constant SETTLE_WINDOW = 3600;
    bytes32 internal constant MATCH_ID = keccak256("match-1");

    address internal owner = makeAddr("owner");
    address internal signerAddr = vm.addr(SIGNER_PK);
    address internal operator = makeAddr("operator");
    address internal treasury = makeAddr("treasury");
    address internal stranger = makeAddr("stranger");

    mapping(address => uint256) internal pkOf;

    function setUp() public virtual {
        vm.warp(1_000_000);
        token = new MockBUMP(owner);
        arena = new BumpArena(owner, signerAddr, operator, treasury, SETTLE_WINDOW, address(token));
        vm.prank(owner);
        token.setArena(address(arena));
    }

    function _player(uint256 i) internal returns (address p) {
        uint256 pk;
        (p, pk) = makeAddrAndKey(string.concat("player", vm.toString(i)));
        pkOf[p] = pk;
        if (token.nextClaimAt(p) == 0) token.claim(p);
    }

    function _intent(bytes32 id, address p, address sessionKey, uint8 vehicleId)
        internal
        view
        returns (BumpArena.JoinIntent memory)
    {
        return BumpArena.JoinIntent({
            matchId: id, player: p, sessionKey: sessionKey, vehicleId: vehicleId, deadline: block.timestamp + 300
        });
    }

    function _signJoin(uint256 pk, BumpArena target, BumpArena.JoinIntent memory i)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, target.hashJoin(i));
        return abi.encodePacked(r, s, v);
    }

    function _open(bytes32 id, uint8 maxPlayers) internal returns (uint64 joinDeadline) {
        joinDeadline = uint64(block.timestamp + 120);
        vm.prank(operator);
        arena.openMatch(id, STAKE, maxPlayers, START_BALANCE, joinDeadline);
    }

    function _join(bytes32 id, address p, uint8 vehicleId) internal {
        BumpArena.JoinIntent memory i = _intent(id, p, address(uint160(p) ^ 1), vehicleId);
        bytes memory sig = _signJoin(pkOf[p], arena, i);
        vm.prank(operator);
        arena.joinWithSig(i, sig);
    }

    function _joinMany(bytes32 id, uint256 n) internal returns (address[] memory players) {
        players = new address[](n);
        for (uint256 i; i < n; ++i) {
            players[i] = _player(i);
            _join(id, players[i], uint8(i % 7));
        }
    }

    function _start(bytes32 id) internal {
        vm.prank(operator);
        arena.startMatch(id);
    }

    function _startedMatch(bytes32 id, uint256 n) internal returns (address[] memory players) {
        _open(id, 8);
        players = _joinMany(id, n);
        _start(id);
    }

    function _evenBalances(uint256 n) internal pure returns (uint32[] memory b) {
        b = new uint32[](n);
        for (uint256 i; i < n; ++i) {
            b[i] = START_BALANCE;
        }
    }

    function _identityRanks(uint256 n) internal pure returns (uint8[] memory r) {
        r = new uint8[](n);
        for (uint256 i; i < n; ++i) {
            r[i] = uint8(i + 1);
        }
    }

    function _result(bytes32 id, address[] memory players, uint32[] memory balances, uint8[] memory ranks)
        internal
        view
        returns (BumpArena.Result memory)
    {
        return BumpArena.Result({
            matchId: id,
            players: players,
            finalBalances: balances,
            ranks: ranks,
            inputLogHash: keccak256("input-log"),
            replayHash: keccak256("replay"),
            endedAt: uint64(block.timestamp)
        });
    }

    function _sign(uint256 pk, BumpArena target, BumpArena.Result memory r) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(pk, target.hashResult(r));
        return abi.encodePacked(rr, s, v);
    }

    function _sign(BumpArena.Result memory r) internal view returns (bytes memory) {
        return _sign(SIGNER_PK, arena, r);
    }

    function _skewedBalances(uint256 n) internal pure returns (uint32[] memory b) {
        b = new uint32[](n);
        uint256 total = n * START_BALANCE;
        uint256 remaining = total;
        for (uint256 i; i + 1 < n; ++i) {
            uint256 take = (i % 2 == 0) ? 137 % (remaining + 1) : 7 % (remaining + 1);
            b[i] = uint32(take);
            remaining -= take;
        }
        b[n - 1] = uint32(remaining);
    }
}
