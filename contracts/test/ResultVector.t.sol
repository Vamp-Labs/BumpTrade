// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {BumpArena} from "../src/BumpArena.sol";
import {MockBUMP} from "../src/MockBUMP.sol";

contract ResultVectorTest is Test {
    string internal json;
    BumpArena internal arena;
    MockBUMP internal token;

    function setUp() public {
        json = vm.readFile("test/fixtures/result-vector.json");
        vm.chainId(vm.parseJsonUint(json, ".domain.chainId"));
        address verifying = vm.parseJsonAddress(json, ".domain.verifyingContract");
        address signer = vm.parseJsonAddress(json, ".signerAddress");
        address tokenOwner = makeAddr("tokenOwner");
        token = new MockBUMP(tokenOwner);
        deployCodeTo(
            "BumpArena.sol:BumpArena",
            abi.encode(
                makeAddr("owner"), signer, makeAddr("operator"), makeAddr("treasury"), uint64(3600), address(token)
            ),
            verifying
        );
        arena = BumpArena(verifying);
        vm.prank(tokenOwner);
        token.setArena(verifying);
    }

    function _message() internal view returns (BumpArena.Result memory r) {
        r.matchId = vm.parseJsonBytes32(json, ".message.matchId");
        r.players = vm.parseJsonAddressArray(json, ".message.players");
        uint256[] memory balances = vm.parseJsonUintArray(json, ".message.finalBalances");
        uint256[] memory ranks = vm.parseJsonUintArray(json, ".message.ranks");
        r.finalBalances = new uint32[](balances.length);
        r.ranks = new uint8[](ranks.length);
        for (uint256 i; i < balances.length; ++i) {
            r.finalBalances[i] = uint32(balances[i]);
            r.ranks[i] = uint8(ranks[i]);
        }
        r.inputLogHash = vm.parseJsonBytes32(json, ".message.inputLogHash");
        r.replayHash = vm.parseJsonBytes32(json, ".message.replayHash");
        r.endedAt = uint64(vm.parseJsonUint(json, ".message.endedAt"));
    }

    function test_hashResultMatchesVectorDigest() public view {
        assertEq(arena.hashResult(_message()), vm.parseJsonBytes32(json, ".digest"));
    }

    function test_signatureRecoversToVectorSigner() public view {
        bytes32 digest = arena.hashResult(_message());
        bytes memory signature = vm.parseJsonBytes(json, ".signature");
        assertEq(ECDSA.recover(digest, signature), vm.parseJsonAddress(json, ".signerAddress"));
    }

    function test_vectorSettlesEndToEnd() public {
        BumpArena.Result memory r = _message();
        bytes memory signature = vm.parseJsonBytes(json, ".signature");
        address operator = arena.operator();
        uint256 stake = 100e18;

        vm.warp(1_790_000_000 - 100);
        vm.prank(operator);
        arena.openMatch(r.matchId, stake, 8, 100, uint64(block.timestamp + 60));
        for (uint256 i; i < r.players.length; ++i) {
            token.claim(r.players[i]);
            vm.prank(r.players[i]);
            arena.join(r.matchId, makeAddr("session"), 0);
        }
        vm.prank(operator);
        arena.startMatch(r.matchId);

        arena.settle(r, signature);
        assertEq(token.balanceOf(r.players[1]), 1000e18 - stake + stake * 205 / 100);
        assertEq(token.balanceOf(address(arena)), 0);
    }
}
