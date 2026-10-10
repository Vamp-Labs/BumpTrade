// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {BumpArena} from "../src/BumpArena.sol";
import {MockBUMP} from "../src/MockBUMP.sol";

contract JoinIntentVectorTest is Test {
    string internal json;
    BumpArena internal arena;
    MockBUMP internal token;

    function setUp() public {
        json = vm.readFile("test/fixtures/join-vector.json");
        vm.chainId(vm.parseJsonUint(json, ".domain.chainId"));
        address verifying = vm.parseJsonAddress(json, ".domain.verifyingContract");
        address tokenOwner = makeAddr("tokenOwner");
        token = new MockBUMP(tokenOwner);
        deployCodeTo(
            "BumpArena.sol:BumpArena",
            abi.encode(
                makeAddr("owner"),
                makeAddr("signer"),
                makeAddr("operator"),
                makeAddr("treasury"),
                uint64(3600),
                address(token)
            ),
            verifying
        );
        arena = BumpArena(verifying);
        vm.prank(tokenOwner);
        token.setArena(verifying);
    }

    function _intent() internal view returns (BumpArena.JoinIntent memory i) {
        i.matchId = vm.parseJsonBytes32(json, ".message.matchId");
        i.player = vm.parseJsonAddress(json, ".message.player");
        i.sessionKey = vm.parseJsonAddress(json, ".message.sessionKey");
        i.vehicleId = uint8(vm.parseJsonUint(json, ".message.vehicleId"));
        i.deadline = vm.parseJsonUint(json, ".message.deadline");
    }

    function test_hashJoinMatchesVectorDigest() public view {
        assertEq(arena.hashJoin(_intent()), vm.parseJsonBytes32(json, ".digest"));
    }

    function test_signatureRecoversToVectorPlayer() public view {
        bytes32 digest = arena.hashJoin(_intent());
        bytes memory signature = vm.parseJsonBytes(json, ".signature");
        assertEq(ECDSA.recover(digest, signature), vm.parseJsonAddress(json, ".signerAddress"));
        assertEq(vm.parseJsonAddress(json, ".signerAddress"), _intent().player);
    }

    function test_vectorJoinsEndToEnd() public {
        BumpArena.JoinIntent memory i = _intent();
        bytes memory signature = vm.parseJsonBytes(json, ".signature");
        address operator = arena.operator();

        vm.warp(1_790_000_000 - 100);
        vm.prank(operator);
        arena.openMatch(i.matchId, 100e18, 8, 100, uint64(block.timestamp + 120));
        token.claim(i.player);

        vm.expectEmit(true, true, false, true, address(arena));
        emit BumpArena.PlayerJoined(i.matchId, i.player, i.sessionKey, i.vehicleId, 0);
        vm.prank(makeAddr("anyone"));
        arena.joinWithSig(i, signature);

        assertEq(arena.sessionKeyOf(i.matchId, i.player), i.sessionKey);
        assertEq(arena.vehicleOf(i.matchId, i.player), i.vehicleId);
        assertEq(token.balanceOf(i.player), 900e18);
        assertEq(token.balanceOf(address(arena)), 100e18);
    }
}
