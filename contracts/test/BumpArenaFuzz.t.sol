// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Base} from "./Base.t.sol";
import {BumpArena} from "../src/BumpArena.sol";

contract BumpArenaFuzzTest is Base {
    function _split(uint256 seed, uint256 n, uint256 total) internal pure returns (uint32[] memory b) {
        b = new uint32[](n);
        uint256 remaining = total;
        for (uint256 i; i + 1 < n; ++i) {
            uint256 take = uint256(keccak256(abi.encode(seed, i))) % (remaining + 1);
            b[i] = uint32(take);
            remaining -= take;
        }
        b[n - 1] = uint32(remaining);
    }

    function _shuffledRanks(uint256 seed, uint256 n) internal pure returns (uint8[] memory r) {
        r = new uint8[](n);
        for (uint256 i; i < n; ++i) {
            r[i] = uint8(i + 1);
        }
        for (uint256 i = n - 1; i > 0; --i) {
            uint256 j = uint256(keccak256(abi.encode(seed, "shuffle", i))) % (i + 1);
            (r[i], r[j]) = (r[j], r[i]);
        }
    }

    function testFuzz_payoutsPlusDustEqualPot(uint256 seed, uint8 playerCountRaw, uint32 startBalance, uint96 stake)
        public
    {
        uint256 n = bound(playerCountRaw, 2, 8);
        startBalance = uint32(bound(startBalance, 1, 1_000_000));
        stake = uint96(bound(stake, 1, 100 ether));

        uint64 joinDeadline = uint64(block.timestamp + 120);
        vm.prank(operator);
        arena.openMatch(MATCH_ID, stake, uint8(8), startBalance, joinDeadline);
        address[] memory players = new address[](n);
        for (uint256 i; i < n; ++i) {
            players[i] = makeAddr(string.concat("fz", vm.toString(i)));
            deal(address(token), players[i], stake);
            vm.prank(players[i]);
            arena.join(MATCH_ID, makeAddr("k"), uint8(i % 7));
        }
        _start(MATCH_ID);

        uint32[] memory balances = _split(seed, n, n * uint256(startBalance));
        uint8[] memory ranks = _shuffledRanks(seed, n);
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, ranks);
        arena.settle(r, _sign(r));

        uint256 pot = n * uint256(stake);
        uint256 sumPlayers;
        for (uint256 i; i < n; ++i) {
            uint256 expected = uint256(stake) * balances[i] / startBalance;
            assertEq(token.balanceOf(players[i]), expected);
            sumPlayers += token.balanceOf(players[i]);
        }
        assertEq(sumPlayers + token.balanceOf(treasury), pot);
        assertLe(sumPlayers, pot);
        assertEq(token.balanceOf(address(arena)), 0);
        assertEq(address(arena).balance, 0);
    }

    function testFuzz_onlyJoinedPlayersAreCredited(uint256 seed, address outsider) public {
        address[] memory players = _startedMatch(MATCH_ID, 5);
        vm.assume(outsider != treasury && outsider != address(0) && outsider != address(arena));
        uint256 before = token.balanceOf(outsider);
        for (uint256 i; i < players.length; ++i) {
            vm.assume(outsider != players[i]);
        }
        uint32[] memory balances = _split(seed, 5, 5 * uint256(START_BALANCE));
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, _shuffledRanks(seed, 5));
        arena.settle(r, _sign(r));
        assertEq(token.balanceOf(outsider), before);
    }

    function testFuzz_settleOnlyOnce(uint256 seed) public {
        address[] memory players = _startedMatch(MATCH_ID, 4);
        uint32[] memory balances = _split(seed, 4, 4 * uint256(START_BALANCE));
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, _shuffledRanks(seed, 4));
        bytes memory sig = _sign(r);
        arena.settle(r, sig);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.settle(r, sig);
    }

    function testFuzz_wrongSumAlwaysReverts(uint256 seed, uint32 delta) public {
        delta = uint32(bound(delta, 1, 1000));
        address[] memory players = _startedMatch(MATCH_ID, 3);
        uint32[] memory balances = _split(seed, 3, 3 * uint256(START_BALANCE));
        balances[0] += delta;
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, _identityRanks(3));
        bytes memory sig = _sign(r);
        vm.expectRevert(BumpArena.BalanceSumMismatch.selector);
        arena.settle(r, sig);
    }

    function testFuzz_forgedSignatureReverts(uint256 forgerPk, uint256 seed) public {
        forgerPk = bound(forgerPk, 1, 115792089237316195423570985008687907852837564279074904382605163141518161494336);
        vm.assume(vm.addr(forgerPk) != signerAddr);
        address[] memory players = _startedMatch(MATCH_ID, 3);
        uint32[] memory balances = _split(seed, 3, 3 * uint256(START_BALANCE));
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, _shuffledRanks(seed, 3));
        bytes memory forged = _sign(forgerPk, arena, r);
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(r, forged);
    }

    function testFuzz_signatureNotReplayableAcrossChainIds(uint64 otherChainId) public {
        vm.assume(otherChainId != block.chainid && otherChainId != 0);
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        vm.chainId(otherChainId);
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(r, sig);
    }

    function testFuzz_signatureNotReplayableAcrossMatchIds(bytes32 otherId) public {
        vm.assume(otherId != MATCH_ID);
        address[] memory players = _startedMatch(MATCH_ID, 2);
        _open(otherId, 8);
        for (uint256 i; i < 2; ++i) {
            vm.prank(players[i]);
            arena.join(otherId, makeAddr("k"), 0);
        }
        _start(otherId);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        BumpArena.Result memory forged = _result(otherId, players, _evenBalances(2), _identityRanks(2));
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(forged, sig);
    }

    function testFuzz_signatureNotReplayableAcrossContracts(address verifying) public {
        vm.assume(verifying != address(arena));
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena twin = new BumpArena(owner, signerAddr, operator, treasury, SETTLE_WINDOW, address(token));
        vm.prank(operator);
        twin.openMatch(MATCH_ID, STAKE, 8, START_BALANCE, uint64(block.timestamp + 120));
        for (uint256 i; i < 2; ++i) {
            vm.startPrank(players[i]);
            token.approve(address(twin), STAKE);
            twin.join(MATCH_ID, makeAddr("k"), 0);
            vm.stopPrank();
        }
        vm.prank(operator);
        twin.startMatch(MATCH_ID);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        vm.expectRevert(BumpArena.BadSignature.selector);
        twin.settle(r, sig);
    }

    function testFuzz_cancelReturnsFullStakes(uint8 countRaw, uint96 stake) public {
        uint256 n = bound(countRaw, 0, 8);
        stake = uint96(bound(stake, 1, 100 ether));
        vm.prank(operator);
        arena.openMatch(MATCH_ID, stake, 8, START_BALANCE, uint64(block.timestamp + 120));
        address[] memory players = new address[](n);
        for (uint256 i; i < n; ++i) {
            players[i] = makeAddr(string.concat("cf", vm.toString(i)));
            deal(address(token), players[i], stake);
            vm.prank(players[i]);
            arena.join(MATCH_ID, makeAddr("k"), 0);
        }
        vm.prank(operator);
        arena.cancel(MATCH_ID);
        for (uint256 i; i < n; ++i) {
            assertEq(token.balanceOf(players[i]), stake);
        }
        assertEq(token.balanceOf(address(arena)), 0);
    }

    function testFuzz_refundReturnsFullStakes(uint8 countRaw, uint96 stake) public {
        uint256 n = bound(countRaw, 2, 8);
        stake = uint96(bound(stake, 1, 100 ether));
        vm.prank(operator);
        arena.openMatch(MATCH_ID, stake, 8, START_BALANCE, uint64(block.timestamp + 120));
        address[] memory players = new address[](n);
        for (uint256 i; i < n; ++i) {
            players[i] = makeAddr(string.concat("rf", vm.toString(i)));
            deal(address(token), players[i], stake);
            vm.prank(players[i]);
            arena.join(MATCH_ID, makeAddr("k"), 0);
        }
        _start(MATCH_ID);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        for (uint256 i; i < n; ++i) {
            arena.claimRefund(MATCH_ID, players[i]);
            assertEq(token.balanceOf(players[i]), stake);
        }
        assertEq(token.balanceOf(address(arena)), 0);
    }
}
