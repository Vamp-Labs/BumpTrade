// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockBUMP is ERC20, ERC20Permit, Ownable {
    uint256 public constant CLAIM_AMOUNT = 1000e18;
    uint256 public constant CLAIM_COOLDOWN = 24 hours;

    address public arena;
    mapping(address => uint256) public nextClaimAt;

    event Claimed(address indexed to, uint256 amount, uint256 nextClaimAt);
    event ArenaSet(address arena);

    error ClaimCooldown(uint256 nextClaimAt);
    error ArenaAlreadySet();
    error ZeroAddress();

    constructor(address owner_) ERC20("Bump Token", "BUMP") ERC20Permit("Bump Token") Ownable(owner_) {}

    function claim(address to) external {
        uint256 next = nextClaimAt[to];
        if (block.timestamp < next) revert ClaimCooldown(next);
        next = block.timestamp + CLAIM_COOLDOWN;
        nextClaimAt[to] = next;
        _mint(to, CLAIM_AMOUNT);
        emit Claimed(to, CLAIM_AMOUNT, next);
    }

    function setArena(address arena_) external onlyOwner {
        if (arena != address(0)) revert ArenaAlreadySet();
        if (arena_ == address(0)) revert ZeroAddress();
        arena = arena_;
        emit ArenaSet(arena_);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (msg.sender == arena) {
            _transfer(from, to, value);
            return true;
        }
        return super.transferFrom(from, to, value);
    }
}
