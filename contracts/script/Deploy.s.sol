// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Script, console} from "forge-std/Script.sol";
import {BumpArena} from "../src/BumpArena.sol";
import {MockBUMP} from "../src/MockBUMP.sol";

contract Deploy is Script {
    function run() external returns (MockBUMP token, BumpArena arena) {
        address owner = vm.envAddress("OWNER_ADDRESS");
        address signer = vm.envAddress("SIGNER_ADDRESS");
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        uint64 settleWindow = uint64(vm.envOr("SETTLE_WINDOW_S", uint256(3600)));

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        token = new MockBUMP(deployer);
        arena = new BumpArena(owner, signer, operator, treasury, settleWindow, address(token));
        token.setArena(address(arena));
        vm.stopBroadcast();

        console.log("MockBUMP", address(token));
        console.log("BumpArena", address(arena));
        console.log("chainId", block.chainid);
    }
}
