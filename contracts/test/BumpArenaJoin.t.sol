// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Base} from "./Base.t.sol";
import {BumpArena} from "../src/BumpArena.sol";
import {MockBUMP} from "../src/MockBUMP.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract BumpArenaJoinTest is Base {
    address internal sessionKey = makeAddr("sessionKey");

    function _joinSigned(bytes32 id, address p, uint8 vehicle) internal returns (BumpArena.JoinIntent memory i) {
        i = _intent(id, p, sessionKey, vehicle);
        arena.joinWithSig(i, _signJoin(pkOf[p], arena, i));
    }

    function test_joinWithSig_validSignature() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 4);
        bytes memory sig = _signJoin(pkOf[p], arena, i);

        vm.expectEmit(true, true, false, true, address(arena));
        emit BumpArena.PlayerJoined(MATCH_ID, p, sessionKey, 4, 0);
        vm.prank(operator);
        arena.joinWithSig(i, sig);

        assertEq(arena.sessionKeyOf(MATCH_ID, p), sessionKey);
        assertEq(arena.vehicleOf(MATCH_ID, p), 4);
        assertEq(arena.getPlayers(MATCH_ID)[0], p);
        assertEq(arena.getMatch(MATCH_ID).pot, STAKE);
        assertEq(token.balanceOf(p), TOKENS - STAKE);
        assertEq(token.balanceOf(address(arena)), STAKE);
        assertEq(token.allowance(p, address(arena)), 0);
        assertEq(p.balance, 0);
    }

    function test_joinWithSig_anyoneMaySubmit() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        vm.prank(stranger);
        arena.joinWithSig(i, _signJoin(pkOf[p], arena, i));
        assertEq(arena.getPlayers(MATCH_ID).length, 1);
    }

    function test_joinWithSig_wrongSigner() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(0xBAD, arena, i);
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.joinWithSig(i, sig);
    }

    function test_joinWithSig_otherPlayersSignatureCannotJoinSomeoneElse() public {
        _open(MATCH_ID, 8);
        address p0 = _player(0);
        address p1 = _player(1);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p1, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p0], arena, i);
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.joinWithSig(i, sig);
    }

    function test_joinWithSig_expired() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p], arena, i);
        vm.warp(i.deadline + 1);
        vm.expectRevert(BumpArena.IntentExpired.selector);
        arena.joinWithSig(i, sig);
    }

    function test_joinWithSig_atDeadlineStillAllowed() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        i.deadline = block.timestamp;
        arena.joinWithSig(i, _signJoin(pkOf[p], arena, i));
        assertEq(arena.getPlayers(MATCH_ID).length, 1);
    }

    function test_joinWithSig_wrongMatchId() public {
        _open(MATCH_ID, 8);
        _open(keccak256("match-2"), 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p], arena, i);
        i.matchId = keccak256("match-2");
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.joinWithSig(i, sig);
        assertEq(arena.getPlayers(keccak256("match-2")).length, 0);
    }

    function test_joinWithSig_unknownMatch() public {
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(keccak256("nope"), p, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p], arena, i);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.joinWithSig(i, sig);
    }

    function test_joinWithSig_tamperedFields() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 1);
        bytes memory sig = _signJoin(pkOf[p], arena, i);

        BumpArena.JoinIntent memory t = _intent(MATCH_ID, p, makeAddr("other"), 1);
        t.deadline = i.deadline;
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.joinWithSig(t, sig);

        t = i;
        t.vehicleId = 2;
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.joinWithSig(t, sig);

        t = i;
        t.deadline = i.deadline + 1;
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.joinWithSig(t, sig);
    }

    function test_joinWithSig_doubleJoinSameSignature() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p], arena, i);
        arena.joinWithSig(i, sig);
        vm.expectRevert(BumpArena.AlreadyJoined.selector);
        arena.joinWithSig(i, sig);
        assertEq(token.balanceOf(p), TOKENS - STAKE);
    }

    function test_joinWithSig_doubleJoinFreshSignatureAndDirect() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        _joinSigned(MATCH_ID, p, 0);

        BumpArena.JoinIntent memory again = _intent(MATCH_ID, p, makeAddr("k2"), 1);
        bytes memory sig = _signJoin(pkOf[p], arena, again);
        vm.expectRevert(BumpArena.AlreadyJoined.selector);
        arena.joinWithSig(again, sig);

        vm.prank(p);
        vm.expectRevert(BumpArena.AlreadyJoined.selector);
        arena.join(MATCH_ID, makeAddr("k3"), 0);
    }

    function test_joinWithSig_badSignatureOtherChainAndContract() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p], arena, i);

        BumpArena twin = new BumpArena(owner, signerAddr, operator, treasury, SETTLE_WINDOW, address(token));
        vm.prank(operator);
        twin.openMatch(MATCH_ID, STAKE, 8, START_BALANCE, uint64(block.timestamp + 120));
        vm.expectRevert(BumpArena.BadSignature.selector);
        twin.joinWithSig(i, sig);

        vm.chainId(46630);
        vm.expectRevert(BumpArena.BadSignature.selector);
        arena.joinWithSig(i, sig);
    }

    function test_joinWithSig_malformedSignature() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        vm.expectRevert();
        arena.joinWithSig(i, hex"1234");
    }

    function test_joinWithSig_rules() public {
        uint64 dl = _open(MATCH_ID, 2);
        address p0 = _player(0);
        address p1 = _player(1);
        address p2 = _player(2);

        BumpArena.JoinIntent memory zeroKey = _intent(MATCH_ID, p0, address(0), 0);
        bytes memory zeroKeySig = _signJoin(pkOf[p0], arena, zeroKey);
        vm.expectRevert(BumpArena.ZeroSessionKey.selector);
        arena.joinWithSig(zeroKey, zeroKeySig);

        BumpArena.JoinIntent memory badVehicle = _intent(MATCH_ID, p0, sessionKey, 7);
        bytes memory badVehicleSig = _signJoin(pkOf[p0], arena, badVehicle);
        vm.expectRevert(BumpArena.BadVehicle.selector);
        arena.joinWithSig(badVehicle, badVehicleSig);

        _joinSigned(MATCH_ID, p0, 0);
        _joinSigned(MATCH_ID, p1, 1);
        BumpArena.JoinIntent memory full = _intent(MATCH_ID, p2, sessionKey, 2);
        bytes memory fullSig = _signJoin(pkOf[p2], arena, full);
        vm.expectRevert(BumpArena.MatchFull.selector);
        arena.joinWithSig(full, fullSig);

        bytes32 other = keccak256("other");
        _open(other, 8);
        BumpArena.JoinIntent memory late = _intent(other, p2, sessionKey, 2);
        late.deadline = dl + 1000;
        bytes memory lateSig = _signJoin(pkOf[p2], arena, late);
        vm.warp(dl + 1);
        vm.expectRevert(BumpArena.JoinClosed.selector);
        arena.joinWithSig(late, lateSig);
    }

    function test_joinWithSig_badStatusAfterStart() public {
        _startedMatch(MATCH_ID, 2);
        address p = _player(5);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p], arena, i);
        vm.expectRevert(BumpArena.BadStatus.selector);
        arena.joinWithSig(i, sig);
    }

    function test_joinWithSig_insufficientBalanceReverts() public {
        _open(MATCH_ID, 8);
        (address broke, uint256 pk) = makeAddrAndKey("broke");
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, broke, sessionKey, 0);
        bytes memory sig = _signJoin(pk, arena, i);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, broke, 0, STAKE));
        arena.joinWithSig(i, sig);
        assertEq(arena.getPlayers(MATCH_ID).length, 0);
    }

    function test_joinWithSig_pausedBlocksUnpausedWorks() public {
        _open(MATCH_ID, 8);
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p], arena, i);
        vm.prank(owner);
        arena.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        arena.joinWithSig(i, sig);
        vm.prank(owner);
        arena.unpause();
        arena.joinWithSig(i, sig);
    }

    function test_pull_requiresSetArena() public {
        MockBUMP t = new MockBUMP(owner);
        BumpArena a = new BumpArena(owner, signerAddr, operator, treasury, SETTLE_WINDOW, address(t));
        vm.prank(operator);
        a.openMatch(MATCH_ID, STAKE, 8, START_BALANCE, uint64(block.timestamp + 120));
        (address p, uint256 pk) = makeAddrAndKey("solo");
        t.claim(p);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(pk, a, i);

        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(a), 0, STAKE));
        a.joinWithSig(i, sig);

        vm.prank(owner);
        t.setArena(address(a));
        a.joinWithSig(i, sig);
        assertEq(t.balanceOf(address(a)), STAKE);
    }

    function test_pull_noBypassForOtherArena() public {
        BumpArena twin = new BumpArena(owner, signerAddr, operator, treasury, SETTLE_WINDOW, address(token));
        vm.prank(operator);
        twin.openMatch(MATCH_ID, STAKE, 8, START_BALANCE, uint64(block.timestamp + 120));
        address p = _player(0);
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, p, sessionKey, 0);
        bytes memory sig = _signJoin(pkOf[p], twin, i);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(twin), 0, STAKE)
        );
        twin.joinWithSig(i, sig);
    }

    function test_hashJoin_matchesManualEncoding() public {
        BumpArena.JoinIntent memory i = _intent(MATCH_ID, makeAddr("a"), makeAddr("b"), 5);
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "JoinIntent(bytes32 matchId,address player,address sessionKey,uint8 vehicleId,uint256 deadline)"
                ),
                i.matchId,
                i.player,
                i.sessionKey,
                uint256(5),
                i.deadline
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
        assertEq(arena.hashJoin(i), keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash)));
        assertEq(
            arena.JOIN_INTENT_TYPEHASH(),
            keccak256("JoinIntent(bytes32 matchId,address player,address sessionKey,uint8 vehicleId,uint256 deadline)")
        );
    }

    function test_fullLifecycle_gasless_endsAtZero() public {
        _open(MATCH_ID, 8);
        address[] memory players = new address[](3);
        for (uint256 k; k < 3; ++k) {
            players[k] = _player(k);
            _joinSigned(MATCH_ID, players[k], uint8(k));
            assertEq(players[k].balance, 0);
        }
        _start(MATCH_ID);
        uint32[] memory balances = new uint32[](3);
        balances[0] = 0;
        balances[1] = 211;
        balances[2] = 89;
        uint8[] memory ranks = new uint8[](3);
        ranks[0] = 3;
        ranks[1] = 1;
        ranks[2] = 2;
        BumpArena.Result memory r = _result(MATCH_ID, players, balances, ranks);
        arena.settle(r, _sign(r));
        assertEq(token.balanceOf(players[0]), TOKENS - STAKE);
        assertEq(token.balanceOf(players[1]), TOKENS - STAKE + STAKE * 211 / 100);
        assertEq(token.balanceOf(players[2]), TOKENS - STAKE + STAKE * 89 / 100);
        assertEq(token.balanceOf(address(arena)), 0);
        assertEq(address(arena).balance, 0);
    }

    function test_gas_join_and_settle() public {
        _open(MATCH_ID, 8);
        address[] memory players = new address[](8);
        for (uint256 k; k < 8; ++k) {
            players[k] = _player(k);
            BumpArena.JoinIntent memory i = _intent(MATCH_ID, players[k], sessionKey, uint8(k % 7));
            bytes memory sig = _signJoin(pkOf[players[k]], arena, i);
            uint256 g = gasleft();
            arena.joinWithSig(i, sig);
            g -= gasleft();
            if (k == 0) emit log_named_uint("joinWithSig gas, first player", g);
            if (k == 1) emit log_named_uint("joinWithSig gas, second player", g);
            if (k == 7) emit log_named_uint("joinWithSig gas, eighth player", g);
        }
        _start(MATCH_ID);
        BumpArena.Result memory r8 = _result(MATCH_ID, players, _evenBalances(8), _identityRanks(8));
        bytes memory s8 = _sign(r8);
        uint256 g8 = gasleft();
        arena.settle(r8, s8);
        emit log_named_uint("settle gas, 8 players", g8 - gasleft());

        bytes32 id2 = keccak256("two");
        _open(id2, 8);
        address[] memory two = new address[](2);
        for (uint256 k; k < 2; ++k) {
            two[k] = players[k];
            _joinSigned(id2, two[k], 0);
        }
        _start(id2);
        BumpArena.Result memory r2 = _result(id2, two, _evenBalances(2), _identityRanks(2));
        bytes memory s2 = _sign(r2);
        uint256 g2 = gasleft();
        arena.settle(r2, s2);
        emit log_named_uint("settle gas, 2 players", g2 - gasleft());
    }
}
