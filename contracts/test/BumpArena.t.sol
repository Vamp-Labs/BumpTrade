// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Base} from "./Base.t.sol";
import {BumpArena} from "../src/BumpArena.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BumpArenaTest is Base {
    function _expectSettleRevert(bytes4 selector, BumpArena.Result memory r) internal {
        bytes memory sig = _sign(r);
        vm.expectRevert(selector);
        arena.settle(r, sig);
    }

    function test_constructor_state() public view {
        assertEq(arena.owner(), owner);
        assertEq(arena.signer(), signerAddr);
        assertEq(arena.operator(), operator);
        assertEq(arena.treasury(), treasury);
        assertEq(arena.settleWindow(), SETTLE_WINDOW);
        assertEq(address(arena.token()), address(token));
    }

    function test_constructor_zeroAddress() public {
        vm.expectRevert(BumpArena.ZeroAddress.selector);
        new BumpArena(owner, address(0), operator, treasury, SETTLE_WINDOW, address(token));
        vm.expectRevert(BumpArena.ZeroAddress.selector);
        new BumpArena(owner, signerAddr, address(0), treasury, SETTLE_WINDOW, address(token));
        vm.expectRevert(BumpArena.ZeroAddress.selector);
        new BumpArena(owner, signerAddr, operator, address(0), SETTLE_WINDOW, address(token));
        vm.expectRevert(BumpArena.ZeroAddress.selector);
        new BumpArena(owner, signerAddr, operator, treasury, SETTLE_WINDOW, address(0));
    }

    function test_eip712Domain() public view {
        (, string memory name, string memory version, uint256 chainId, address verifying,,) = arena.eip712Domain();
        assertEq(name, "BumpArena");
        assertEq(version, "1");
        assertEq(chainId, block.chainid);
        assertEq(verifying, address(arena));
    }

    function test_openMatch_storesAndEmits() public {
        uint64 joinDeadline = uint64(block.timestamp + 120);
        vm.expectEmit(true, false, false, true, address(arena));
        emit BumpArena.MatchOpened(MATCH_ID, STAKE, 8, START_BALANCE, joinDeadline, joinDeadline + SETTLE_WINDOW);
        vm.prank(operator);
        arena.openMatch(MATCH_ID, STAKE, 8, START_BALANCE, joinDeadline);

        BumpArena.MatchView memory v = arena.getMatch(MATCH_ID);
        assertEq(v.stake, STAKE);
        assertEq(v.startBalance, START_BALANCE);
        assertEq(v.maxPlayers, 8);
        assertEq(v.playerCount, 0);
        assertEq(uint8(v.status), uint8(BumpArena.Status.Open));
        assertEq(v.joinDeadline, joinDeadline);
        assertEq(v.settleDeadline, joinDeadline + SETTLE_WINDOW);
        assertEq(v.pot, 0);
    }

    function test_openMatch_notOperator() public {
        vm.expectRevert(BumpArena.NotOperator.selector);
        vm.prank(stranger);
        arena.openMatch(MATCH_ID, STAKE, 8, START_BALANCE, uint64(block.timestamp + 10));
    }

    function test_openMatch_matchExists() public {
        _open(MATCH_ID, 8);
        vm.expectRevert(BumpArena.MatchExists.selector);
        vm.prank(operator);
        arena.openMatch(MATCH_ID, STAKE, 8, START_BALANCE, uint64(block.timestamp + 10));
    }

    function test_openMatch_invalidParams() public {
        uint64 dl = uint64(block.timestamp + 10);
        vm.startPrank(operator);
        vm.expectRevert(BumpArena.InvalidMatchParams.selector);
        arena.openMatch(MATCH_ID, 0, 8, START_BALANCE, dl);
        vm.expectRevert(BumpArena.InvalidMatchParams.selector);
        arena.openMatch(MATCH_ID, STAKE, 1, START_BALANCE, dl);
        vm.expectRevert(BumpArena.InvalidMatchParams.selector);
        arena.openMatch(MATCH_ID, STAKE, 9, START_BALANCE, dl);
        vm.expectRevert(BumpArena.InvalidMatchParams.selector);
        arena.openMatch(MATCH_ID, STAKE, 8, 0, dl);
        vm.expectRevert(BumpArena.InvalidMatchParams.selector);
        arena.openMatch(MATCH_ID, STAKE, 8, START_BALANCE, uint64(block.timestamp));
        vm.stopPrank();
    }

    function test_join_emitsSeatAndGrowsPot() public {
        _open(MATCH_ID, 8);
        address p0 = _player(0);
        address p1 = _player(1);
        address k0 = makeAddr("k0");
        address k1 = makeAddr("k1");

        vm.expectEmit(true, true, false, true, address(arena));
        emit BumpArena.PlayerJoined(MATCH_ID, p0, k0, 3, 0);
        vm.prank(p0);
        arena.join(MATCH_ID, k0, 3);

        vm.expectEmit(true, true, false, true, address(arena));
        emit BumpArena.PlayerJoined(MATCH_ID, p1, k1, 6, 1);
        vm.prank(p1);
        arena.join(MATCH_ID, k1, 6);

        assertEq(arena.getMatch(MATCH_ID).pot, 2 * STAKE);
        assertEq(arena.getMatch(MATCH_ID).playerCount, 2);
        assertEq(arena.getPlayers(MATCH_ID)[1], p1);
        assertEq(arena.sessionKeyOf(MATCH_ID, p0), k0);
        assertEq(arena.vehicleOf(MATCH_ID, p1), 6);
        assertEq(token.balanceOf(address(arena)), 2 * STAKE);
        assertEq(token.balanceOf(p0), TOKENS - STAKE);
        assertEq(token.allowance(p0, address(arena)), 0);
    }

    function test_join_badStatus() public {
        address p = _player(0);
        vm.expectRevert(BumpArena.BadStatus.selector);
        vm.prank(p);
        arena.join(MATCH_ID, makeAddr("k"), 0);

        _open(MATCH_ID, 8);
        _joinMany(MATCH_ID, 2);
        _start(MATCH_ID);
        vm.expectRevert(BumpArena.BadStatus.selector);
        vm.prank(p);
        arena.join(MATCH_ID, makeAddr("k"), 0);
    }

    function test_join_joinClosed() public {
        uint64 dl = _open(MATCH_ID, 8);
        vm.warp(dl);
        _join(MATCH_ID, _player(0), 0);
        vm.warp(dl + 1);
        address p = _player(1);
        vm.expectRevert(BumpArena.JoinClosed.selector);
        vm.prank(p);
        arena.join(MATCH_ID, makeAddr("k"), 0);
    }

    function test_join_matchFull() public {
        _open(MATCH_ID, 2);
        _joinMany(MATCH_ID, 2);
        address p = _player(2);
        vm.expectRevert(BumpArena.MatchFull.selector);
        vm.prank(p);
        arena.join(MATCH_ID, makeAddr("k"), 0);
    }

    function test_join_alreadyJoined() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        _join(MATCH_ID, p, 0);
        vm.expectRevert(BumpArena.AlreadyJoined.selector);
        vm.prank(p);
        arena.join(MATCH_ID, makeAddr("k"), 1);
    }

    function test_join_zeroSessionKey() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        vm.expectRevert(BumpArena.ZeroSessionKey.selector);
        vm.prank(p);
        arena.join(MATCH_ID, address(0), 0);
    }

    function test_join_badVehicle() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        vm.expectRevert(BumpArena.BadVehicle.selector);
        vm.prank(p);
        arena.join(MATCH_ID, makeAddr("k"), 7);
        _join(MATCH_ID, p, 6);
    }

    function test_startMatch_emitsAndSets() public {
        _open(MATCH_ID, 8);
        _joinMany(MATCH_ID, 3);
        vm.expectEmit(true, false, false, true, address(arena));
        emit BumpArena.MatchStarted(MATCH_ID, 3);
        _start(MATCH_ID);
        assertEq(uint8(arena.getMatch(MATCH_ID).status), uint8(BumpArena.Status.Started));
    }

    function test_startMatch_notOperator() public {
        _open(MATCH_ID, 8);
        _joinMany(MATCH_ID, 2);
        vm.expectRevert(BumpArena.NotOperator.selector);
        vm.prank(stranger);
        arena.startMatch(MATCH_ID);
    }

    function test_startMatch_notEnoughPlayers() public {
        _open(MATCH_ID, 8);
        _joinMany(MATCH_ID, 1);
        vm.expectRevert(BumpArena.NotEnoughPlayers.selector);
        vm.prank(operator);
        arena.startMatch(MATCH_ID);
    }

    function test_startMatch_badStatus() public {
        vm.expectRevert(BumpArena.BadStatus.selector);
        vm.prank(operator);
        arena.startMatch(MATCH_ID);
        _startedMatch(keccak256("other"), 2);
        vm.expectRevert(BumpArena.BadStatus.selector);
        vm.prank(operator);
        arena.startMatch(keccak256("other"));
    }

    function test_settle_twoPlayers_emitsAndCredits() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        uint32[] memory balances = new uint32[](2);
        balances[0] = 33;
        balances[1] = 167;
        uint8[] memory ranks = new uint8[](2);
        ranks[0] = 2;
        ranks[1] = 1;
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, ranks);
        bytes memory sig = _sign(r);
        bytes32 digest = arena.hashResult(r);

        uint256 pot = 2 * STAKE;
        uint256 p0 = STAKE * 33 / 100;
        uint256 p1 = STAKE * 167 / 100;

        vm.expectEmit(true, true, false, true, address(arena));
        emit BumpArena.PlayerResult(MATCH_ID, players[0], 33, 2, p0);
        vm.expectEmit(true, true, false, true, address(arena));
        emit BumpArena.PlayerResult(MATCH_ID, players[1], 167, 1, p1);
        vm.expectEmit(true, false, false, true, address(arena));
        emit BumpArena.MatchSettled(MATCH_ID, digest, r.inputLogHash, r.replayHash, players[1], pot);

        vm.prank(stranger);
        arena.settle(r, sig);

        assertEq(token.balanceOf(players[0]), TOKENS - STAKE + p0);
        assertEq(token.balanceOf(players[1]), TOKENS - STAKE + p1);
        assertEq(token.balanceOf(treasury), pot - p0 - p1);
        assertEq(token.balanceOf(address(arena)), 0);
        assertEq(uint8(arena.getMatch(MATCH_ID).status), uint8(BumpArena.Status.Settled));
    }

    function test_settle_eightPlayers_zeroSum() public {
        address[] memory players = _startedMatch(MATCH_ID, 8);
        uint32[] memory balances = _skewedBalances(8);
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, _identityRanks(8));
        arena.settle(r, _sign(r));

        uint256 total = token.balanceOf(treasury);
        for (uint256 i; i < 8; ++i) {
            uint256 received = token.balanceOf(players[i]) - (TOKENS - STAKE);
            assertEq(received, STAKE * balances[i] / START_BALANCE);
            total += received;
        }
        assertEq(total, 8 * STAKE);
        assertEq(token.balanceOf(address(arena)), 0);
    }

    function test_settle_badStatus() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory unknown = _result(keccak256("none"), players, _evenBalances(2), _identityRanks(2));
        _expectSettleRevert(BumpArena.BadStatus.selector, unknown);

        bytes32 openId = keccak256("open");
        _open(openId, 8);
        BumpArena.Result memory notStarted = _result(openId, players, _evenBalances(2), _identityRanks(2));
        _expectSettleRevert(BumpArena.BadStatus.selector, notStarted);
    }

    function test_settle_replayAfterSettleReverts() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        arena.settle(r, sig);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.settle(r, sig);
    }

    function test_settle_windowClosed() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.expectRevert(BumpArena.SettleWindowClosed.selector);
        arena.settle(r, sig);
    }

    function test_settle_atDeadlineStillAllowed() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline);
        arena.settle(r, sig);
    }

    function test_settle_playersMismatch() public {
        address[] memory players = _startedMatch(MATCH_ID, 3);

        address[] memory shortPlayers = new address[](2);
        shortPlayers[0] = players[0];
        shortPlayers[1] = players[1];
        BumpArena.Result memory shortR = _result(MATCH_ID, shortPlayers, _evenBalances(2), _identityRanks(2));
        _expectSettleRevert(BumpArena.PlayersMismatch.selector, shortR);

        address[] memory swapped = new address[](3);
        swapped[0] = players[1];
        swapped[1] = players[0];
        swapped[2] = players[2];
        BumpArena.Result memory swappedR = _result(MATCH_ID, swapped, _evenBalances(3), _identityRanks(3));
        _expectSettleRevert(BumpArena.PlayersMismatch.selector, swappedR);

        BumpArena.Result memory badBalLen = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(3));
        _expectSettleRevert(BumpArena.PlayersMismatch.selector, badBalLen);

        BumpArena.Result memory badRankLen = _result(MATCH_ID, players, _evenBalances(3), _identityRanks(2));
        _expectSettleRevert(BumpArena.PlayersMismatch.selector, badRankLen);
    }

    function test_settle_balanceSumMismatch() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        uint32[] memory over = _evenBalances(2);
        over[0] = 101;
        BumpArena.Result memory r = _result(MATCH_ID, players, over, _identityRanks(2));
        _expectSettleRevert(BumpArena.BalanceSumMismatch.selector, r);

        uint32[] memory under = _evenBalances(2);
        under[1] = 99;
        r = _result(MATCH_ID, players, under, _identityRanks(2));
        _expectSettleRevert(BumpArena.BalanceSumMismatch.selector, r);
    }

    function test_settle_balanceSumNoOverflow() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        uint32[] memory huge = new uint32[](2);
        huge[0] = type(uint32).max;
        huge[1] = type(uint32).max;
        BumpArena.Result memory r = _result(MATCH_ID, players, huge, _identityRanks(2));
        _expectSettleRevert(BumpArena.BalanceSumMismatch.selector, r);
    }

    function test_settle_badRanks() public {
        address[] memory players = _startedMatch(MATCH_ID, 3);
        uint32[] memory balances = _evenBalances(3);

        uint8[] memory zero = _identityRanks(3);
        zero[0] = 0;
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, zero);
        _expectSettleRevert(BumpArena.BadRanks.selector, r);

        uint8[] memory tooHigh = _identityRanks(3);
        tooHigh[2] = 4;
        r = _result(MATCH_ID, players, balances, tooHigh);
        _expectSettleRevert(BumpArena.BadRanks.selector, r);

        uint8[] memory dup = _identityRanks(3);
        dup[2] = 1;
        r = _result(MATCH_ID, players, balances, dup);
        _expectSettleRevert(BumpArena.BadRanks.selector, r);

        uint8[] memory huge = _identityRanks(3);
        huge[1] = 255;
        r = _result(MATCH_ID, players, balances, huge);
        _expectSettleRevert(BumpArena.BadRanks.selector, r);
    }

    function test_settle_badSignature_wrongKey() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(0xBAD, arena, r);
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(r, sig);
    }

    function test_settle_badSignature_tamperedAfterSigning() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        r.inputLogHash = keccak256("different");
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(r, sig);

        r.inputLogHash = keccak256("input-log");
        uint32[] memory skew = new uint32[](2);
        skew[0] = 150;
        skew[1] = 50;
        r.finalBalances = skew;
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(r, sig);
    }

    function test_settle_badSignature_otherMatchId() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        bytes32 otherId = keccak256("match-2");
        _open(otherId, 8);
        for (uint256 i; i < 2; ++i) {
            vm.prank(players[i]);
            arena.join(otherId, makeAddr("k"), 0);
        }
        _start(otherId);

        BumpArena.Result memory r1 = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        BumpArena.Result memory r2 = _result(otherId, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig1 = _sign(r1);
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(r2, sig1);
        arena.settle(r1, sig1);
    }

    function test_settle_badSignature_otherChainId() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        vm.chainId(46630);
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(r, sig);
    }

    function test_settle_badSignature_otherContract() public {
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
        bytes memory sigForOriginal = _sign(r);
        vm.expectRevert(BumpArena.BadSignature.selector);
        twin.settle(r, sigForOriginal);
    }

    function test_settle_malformedSignatureReverts() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        vm.expectRevert();
        arena.settle(r, hex"1234");
    }

    function test_settle_afterSignerRotation() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        vm.prank(owner);
        arena.setSigner(makeAddr("newSigner"));
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.settle(r, sig);
    }

    function test_cancel_operatorWhileOpen() public {
        _open(MATCH_ID, 8);
        address[] memory players = _joinMany(MATCH_ID, 3);
        vm.expectEmit(true, false, false, true, address(arena));
        emit BumpArena.MatchCancelled(MATCH_ID);
        vm.prank(operator);
        arena.cancel(MATCH_ID);

        assertEq(uint8(arena.getMatch(MATCH_ID).status), uint8(BumpArena.Status.Cancelled));
        for (uint256 i; i < 3; ++i) {
            assertEq(token.balanceOf(players[i]), TOKENS);
        }
        assertEq(token.balanceOf(address(arena)), 0);
        {}
    }

    function test_cancel_anyoneAfterDeadlineWithFewerThanTwo() public {
        uint64 dl = _open(MATCH_ID, 8);
        address[] memory players = _joinMany(MATCH_ID, 1);
        vm.prank(stranger);
        vm.expectRevert(BumpArena.NotOperator.selector);
        arena.cancel(MATCH_ID);

        vm.warp(dl);
        vm.prank(stranger);
        vm.expectRevert(BumpArena.NotOperator.selector);
        arena.cancel(MATCH_ID);

        vm.warp(dl + 1);
        vm.prank(stranger);
        arena.cancel(MATCH_ID);
        assertEq(token.balanceOf(players[0]), TOKENS);
        assertEq(token.balanceOf(address(arena)), 0);
    }

    function test_cancel_anyoneAfterDeadlineNoPlayers() public {
        uint64 dl = _open(MATCH_ID, 8);
        vm.warp(dl + 1);
        vm.prank(stranger);
        arena.cancel(MATCH_ID);
        assertEq(uint8(arena.getMatch(MATCH_ID).status), uint8(BumpArena.Status.Cancelled));
    }

    function test_cancel_strangerCannotWithTwoPlayersAfterDeadline() public {
        uint64 dl = _open(MATCH_ID, 8);
        _joinMany(MATCH_ID, 2);
        vm.warp(dl + 1);
        vm.prank(stranger);
        vm.expectRevert(BumpArena.NotOperator.selector);
        arena.cancel(MATCH_ID);
    }

    function test_cancel_badStatus() public {
        vm.prank(operator);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.cancel(MATCH_ID);

        _startedMatch(MATCH_ID, 2);
        vm.prank(operator);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.cancel(MATCH_ID);
    }

    function test_cancel_worksWhilePaused() public {
        _open(MATCH_ID, 8);
        _joinMany(MATCH_ID, 2);
        vm.prank(owner);
        arena.pause();
        vm.prank(operator);
        arena.cancel(MATCH_ID);
    }

    function test_claimRefund_afterSettleDeadline_started() public {
        address[] memory players = _startedMatch(MATCH_ID, 3);
        uint64 deadline = arena.getMatch(MATCH_ID).settleDeadline;
        vm.warp(deadline + 1);

        vm.expectEmit(true, true, false, true, address(arena));
        emit BumpArena.Refunded(MATCH_ID, players[0], STAKE);
        vm.prank(stranger);
        arena.claimRefund(MATCH_ID, players[0]);

        assertEq(uint8(arena.getMatch(MATCH_ID).status), uint8(BumpArena.Status.Refunding));
        assertEq(token.balanceOf(players[0]), TOKENS);
        assertEq(token.balanceOf(address(arena)), 2 * STAKE);

        vm.prank(players[1]);
        arena.claimRefund(MATCH_ID, players[1]);
        assertEq(token.balanceOf(players[1]), TOKENS);
        assertEq(token.balanceOf(address(arena)), STAKE);
    }

    function test_claimRefund_anyoneCanTriggerForAnyPlayer() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.prank(stranger);
        arena.claimRefund(MATCH_ID, players[1]);
        assertEq(token.balanceOf(players[1]), TOKENS);
        assertEq(token.balanceOf(stranger), 0);
        assertEq(token.balanceOf(address(arena)), STAKE);
    }

    function test_claimRefund_afterSettleDeadline_open() public {
        _open(MATCH_ID, 8);
        address[] memory players = _joinMany(MATCH_ID, 1);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.prank(players[0]);
        arena.claimRefund(MATCH_ID, players[0]);
        assertEq(token.balanceOf(players[0]), TOKENS);
        assertEq(token.balanceOf(address(arena)), 0);
    }

    function test_claimRefund_tooEarly() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        vm.prank(players[0]);
        vm.expectRevert(BumpArena.TooEarly.selector);
        arena.claimRefund(MATCH_ID, players[0]);

        vm.warp(arena.getMatch(MATCH_ID).settleDeadline);
        vm.prank(players[0]);
        vm.expectRevert(BumpArena.TooEarly.selector);
        arena.claimRefund(MATCH_ID, players[0]);
    }

    function test_claimRefund_notJoined() public {
        _startedMatch(MATCH_ID, 2);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.prank(stranger);
        vm.expectRevert(BumpArena.NotJoined.selector);
        arena.claimRefund(MATCH_ID, stranger);
    }

    function test_claimRefund_alreadyRefunded() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.startPrank(players[0]);
        arena.claimRefund(MATCH_ID, players[0]);
        vm.expectRevert(BumpArena.AlreadyRefunded.selector);
        arena.claimRefund(MATCH_ID, players[0]);
        vm.stopPrank();
    }

    function test_claimRefund_badStatus() public {
        vm.prank(stranger);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.claimRefund(MATCH_ID, stranger);

        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        arena.settle(r, _sign(r));
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.prank(players[0]);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.claimRefund(MATCH_ID, players[0]);

        bytes32 cancelledId = keccak256("cancelled");
        _open(cancelledId, 8);
        address[] memory cp = _joinMany(cancelledId, 1);
        vm.prank(operator);
        arena.cancel(cancelledId);
        vm.warp(arena.getMatch(cancelledId).settleDeadline + 1);
        vm.prank(cp[0]);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.claimRefund(cancelledId, cp[0]);
    }

    function test_settleBlockedAfterRefund() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.prank(players[0]);
        arena.claimRefund(MATCH_ID, players[0]);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.settle(r, sig);
    }

    function test_refundBlockedAfterSettle() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        arena.settle(r, _sign(r));
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.prank(players[1]);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.claimRefund(MATCH_ID, players[1]);
    }

    function test_claimRefund_worksWhilePaused() public {
        address[] memory players = _startedMatch(MATCH_ID, 2);
        vm.warp(arena.getMatch(MATCH_ID).settleDeadline + 1);
        vm.prank(owner);
        arena.pause();
        vm.prank(players[0]);
        arena.claimRefund(MATCH_ID, players[0]);
    }

    function test_pause_blocksOpenJoinStartSettle() public {
        _open(MATCH_ID, 8);
        address[] memory players = _joinMany(MATCH_ID, 2);
        bytes32 startedId = keccak256("started");
        address[] memory sp = _startedMatch(startedId, 2);
        BumpArena.Result memory r = _result(startedId, sp, _evenBalances(2), _identityRanks(2));
        bytes memory sig = _sign(r);

        vm.prank(owner);
        arena.pause();

        vm.prank(operator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        arena.openMatch(keccak256("new"), STAKE, 8, START_BALANCE, uint64(block.timestamp + 10));

        address p = _player(9);
        vm.prank(p);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        arena.join(MATCH_ID, makeAddr("k"), 0);

        vm.prank(operator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        arena.startMatch(MATCH_ID);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        arena.settle(r, sig);

        vm.prank(owner);
        arena.unpause();
        arena.settle(r, sig);
        _start(MATCH_ID);
        assertEq(players.length, 2);
    }

    function test_admin_onlyOwner() public {
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        arena.setSigner(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        arena.setOperator(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        arena.setTreasury(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        arena.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        arena.unpause();
        vm.stopPrank();
    }

    function test_admin_settersEmit() public {
        address a = makeAddr("a");
        vm.startPrank(owner);
        vm.expectEmit(false, false, false, true, address(arena));
        emit BumpArena.SignerUpdated(a);
        arena.setSigner(a);
        vm.expectEmit(false, false, false, true, address(arena));
        emit BumpArena.OperatorUpdated(a);
        arena.setOperator(a);
        vm.expectEmit(false, false, false, true, address(arena));
        emit BumpArena.TreasuryUpdated(a);
        arena.setTreasury(a);
        vm.stopPrank();
        assertEq(arena.signer(), a);
        assertEq(arena.operator(), a);
        assertEq(arena.treasury(), a);
    }

    function test_admin_zeroAddressRejected() public {
        vm.startPrank(owner);
        vm.expectRevert(BumpArena.ZeroAddress.selector);
        arena.setSigner(address(0));
        vm.expectRevert(BumpArena.ZeroAddress.selector);
        arena.setOperator(address(0));
        vm.expectRevert(BumpArena.ZeroAddress.selector);
        arena.setTreasury(address(0));
        vm.stopPrank();
    }

    function test_admin_ownershipIsTwoStep() public {
        address next = makeAddr("next");
        vm.prank(owner);
        arena.transferOwnership(next);
        assertEq(arena.owner(), owner);
        vm.prank(next);
        arena.acceptOwnership();
        assertEq(arena.owner(), next);
    }

    function test_dustGoesToTreasury() public {
        address[] memory players = _startedMatch(MATCH_ID, 3);
        uint32[] memory balances = new uint32[](3);
        balances[0] = 1;
        balances[1] = 1;
        balances[2] = 298;
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, _identityRanks(3));
        arena.settle(r, _sign(r));
        uint256 paid = STAKE * 1 / 100 + STAKE * 1 / 100 + STAKE * 298 / 100;
        assertEq(token.balanceOf(treasury), 3 * STAKE - paid);
        assertEq(token.balanceOf(address(arena)), 0);
    }

    function test_hashResult_matchesManualEncoding() public {
        address[] memory players = new address[](2);
        players[0] = makeAddr("a");
        players[1] = makeAddr("b");
        BumpArena.Result memory r = _result(MATCH_ID, players, _evenBalances(2), _identityRanks(2));
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Result(bytes32 matchId,address[] players,uint32[] finalBalances,uint8[] ranks,bytes32 inputLogHash,bytes32 replayHash,uint64 endedAt)"
                ),
                r.matchId,
                keccak256(abi.encodePacked(uint256(uint160(players[0])), uint256(uint160(players[1])))),
                keccak256(abi.encodePacked(uint256(100), uint256(100))),
                keccak256(abi.encodePacked(uint256(1), uint256(2))),
                r.inputLogHash,
                r.replayHash,
                r.endedAt
            )
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("BumpArena"),
                keccak256("1"),
                block.chainid,
                address(arena)
            )
        );
        bytes32 expected = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        assertEq(arena.hashResult(r), expected);
    }
}
