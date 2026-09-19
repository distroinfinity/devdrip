// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {DistroGuardHook} from "../src/DistroGuardHook.sol";

contract DistroGuardHookTest is Test, Deployers {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    DistroGuardHook hook;

    function setUp() public {
        // deploy manager + routers first so poolManager immutable is valid
        deployFreshManagerAndRouters();

        // construct impl with real poolManager so the immutable is baked in
        DistroGuardHook impl = new DistroGuardHook(IPoolManager(address(manager)));

        // compute flagged hook address (must match the flags the hook requires)
        address hookAddr = address(
            uint160(
                uint256(type(uint160).max) & clearAllHookPermissionsMask
                    | Hooks.AFTER_INITIALIZE_FLAG
                    | Hooks.BEFORE_SWAP_FLAG
                    | Hooks.AFTER_SWAP_FLAG
            )
        );

        // etch runtime bytecode — immutable poolManager value is baked into it
        vm.etch(hookAddr, address(impl).code);
        hook = DistroGuardHook(hookAddr);

        deployMintAndApprove2Currencies();
        (key,) = initPoolAndAddLiquidity(
            currency0, currency1, IHooks(address(hook)), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1
        );
    }

    // afterInitialize must seed the vol state with seeded=true
    function test_afterInitialize_seeds_vol() public view {
        (,, bool seeded) = hook.volOf(key.toId());
        assertTrue(seeded);
    }

    // two sequential swaps: the ewma vol accumulator must not decrease
    function test_fee_rises_with_volatility() public {
        // small swap — moves tick, seeds the ewma
        swap(key, true, -1e15, ZERO_BYTES);
        (, uint32 vBefore,) = hook.volOf(key.toId());

        // larger swap — moves tick further, ewma should be >= previous value
        swap(key, true, -1e16, ZERO_BYTES);
        (, uint32 vAfter,) = hook.volOf(key.toId());

        assertGe(vAfter, vBefore);
    }
}
