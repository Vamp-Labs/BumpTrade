// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {MockBUMP} from "../src/MockBUMP.sol";

contract MockBUMPTest is Test {
    MockBUMP internal token;
    address internal owner = makeAddr("owner");
    address internal arena = makeAddr("arena");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockBUMP(owner);
    }

    function test_metadata() public view {
        assertEq(token.name(), "Bump Token");
        assertEq(token.symbol(), "BUMP");
        assertEq(token.decimals(), 18);
        assertEq(token.owner(), owner);
        assertEq(token.CLAIM_AMOUNT(), 1000e18);
        assertEq(token.CLAIM_COOLDOWN(), 24 hours);
        assertEq(token.totalSupply(), 0);
    }

    function test_claim_mintsAndEmits() public {
        vm.expectEmit(true, false, false, true, address(token));
        emit MockBUMP.Claimed(alice, 1000e18, block.timestamp + 24 hours);
        vm.prank(bob);
        token.claim(alice);
        assertEq(token.balanceOf(alice), 1000e18);
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.totalSupply(), 1000e18);
        assertEq(token.nextClaimAt(alice), block.timestamp + 24 hours);
        assertEq(token.nextClaimAt(bob), 0);
    }

    function test_claim_cooldown() public {
        token.claim(alice);
        uint256 next = token.nextClaimAt(alice);

        vm.expectRevert(abi.encodeWithSelector(MockBUMP.ClaimCooldown.selector, next));
        token.claim(alice);

        vm.warp(next - 1);
        vm.expectRevert(abi.encodeWithSelector(MockBUMP.ClaimCooldown.selector, next));
        token.claim(alice);

        vm.warp(next);
        token.claim(alice);
        assertEq(token.balanceOf(alice), 2000e18);
        assertEq(token.nextClaimAt(alice), next + 24 hours);
    }

    function test_claim_cooldownIsPerRecipient() public {
        token.claim(alice);
        token.claim(bob);
        assertEq(token.balanceOf(bob), 1000e18);
    }

    function test_claim_zeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        token.claim(address(0));
    }

    function test_setArena_onlyOwnerAndOnce() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.setArena(arena);

        vm.startPrank(owner);
        vm.expectRevert(MockBUMP.ZeroAddress.selector);
        token.setArena(address(0));

        vm.expectEmit(false, false, false, true, address(token));
        emit MockBUMP.ArenaSet(arena);
        token.setArena(arena);
        assertEq(token.arena(), arena);

        vm.expectRevert(MockBUMP.ArenaAlreadySet.selector);
        token.setArena(makeAddr("other"));
        vm.stopPrank();
    }

    function test_transferFrom_needsAllowanceForEveryoneButArena() public {
        token.claim(alice);
        vm.prank(owner);
        token.setArena(arena);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, 1));
        token.transferFrom(alice, bob, 1);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, owner, 0, 1));
        token.transferFrom(alice, owner, 1);

        vm.prank(arena);
        token.transferFrom(alice, arena, 40e18);
        assertEq(token.balanceOf(arena), 40e18);
        assertEq(token.allowance(alice, arena), 0);
    }

    function test_transferFrom_beforeArenaSetNobodyBypasses() public {
        token.claim(alice);
        vm.prank(arena);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, arena, 0, 1));
        token.transferFrom(alice, arena, 1);
    }

    function test_transferFrom_arenaStillBoundByBalance() public {
        token.claim(alice);
        vm.prank(owner);
        token.setArena(arena);
        vm.prank(arena);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 1000e18, 1001e18));
        token.transferFrom(alice, arena, 1001e18);
    }

    function test_transferFrom_normalAllowanceStillWorks() public {
        token.claim(alice);
        vm.prank(alice);
        token.approve(bob, 10e18);
        vm.prank(bob);
        token.transferFrom(alice, bob, 4e18);
        assertEq(token.allowance(alice, bob), 6e18);
    }

    function test_permit() public {
        (address holder, uint256 pk) = makeAddrAndKey("holder");
        token.claim(holder);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                holder,
                bob,
                5e18,
                token.nonces(holder),
                deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
        token.permit(holder, bob, 5e18, deadline, v, r, s);
        assertEq(token.allowance(holder, bob), 5e18);
        assertEq(token.nonces(holder), 1);
    }

    function testFuzz_claimNeverExceedsOncePerDay(uint32 gap, uint8 attempts) public {
        gap = uint32(bound(gap, 1, 3 days));
        attempts = uint8(bound(attempts, 1, 20));
        uint256 expectedSupply;
        for (uint256 i; i < attempts; ++i) {
            try token.claim(alice) {
                expectedSupply += 1000e18;
            } catch {}
            vm.warp(block.timestamp + gap);
        }
        assertEq(token.totalSupply(), expectedSupply);
        assertLe(expectedSupply, ((uint256(gap) * attempts) / 24 hours + 1) * 1000e18);
    }
}
