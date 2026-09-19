// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseTestHooks} from "@uniswap/v4-core/src/test/BaseTestHooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

// volatility + size-aware dynamic lp fee, computed on-chain from the pool's own swap flow
contract DistroGuardHook is BaseTestHooks {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // fee pips (1e-6)
    uint24 internal constant BASE_FEE = 3000; // 0.30%
    uint24 internal constant MAX_FEE = 10000; // 1.00%
    uint256 internal constant VOL_K = 50;
    uint256 internal constant SIZE_K = 20;

    struct VolState {
        int24 lastTick;
        uint32 ewmaVolBps;
        bool seeded;
    }

    IPoolManager public immutable poolManager;

    mapping(PoolId => VolState) public volOf;

    event VolUpdated(PoolId indexed poolId, int24 tick, uint32 ewmaVolBps);
    event FeeApplied(PoolId indexed poolId, uint24 feePips);

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    function afterInitialize(address, PoolKey calldata key, uint160, int24 tick)
        external
        override
        returns (bytes4)
    {
        require(key.fee == LPFeeLibrary.DYNAMIC_FEE_FLAG, "fee:not-dynamic");
        volOf[key.toId()] = VolState(tick, 0, true);
        return IHooks.afterInitialize.selector;
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        external
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint256 absAmount =
            params.amountSpecified < 0 ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);
        PoolId id = key.toId();
        uint24 fee = _currentFee(id, absAmount);
        emit FeeApplied(id, fee);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        override
        returns (bytes4, int128)
    {
        PoolId id = key.toId();
        (, int24 tick,,) = poolManager.getSlot0(id);
        VolState storage v = volOf[id];

        int24 delta = tick - v.lastTick;
        uint32 absBps = uint32(uint256(int256(delta < 0 ? -delta : delta)));
        // ewma with alpha = 1/4
        v.ewmaVolBps = uint32((uint256(v.ewmaVolBps) * 3 + absBps) / 4);
        v.lastTick = tick;

        emit VolUpdated(id, tick, v.ewmaVolBps);
        return (IHooks.afterSwap.selector, int128(0));
    }

    function _currentFee(PoolId id, uint256 absAmount) internal view returns (uint24) {
        uint256 sizeUnit = absAmount > 1e21 ? absAmount / 1e21 : 0;
        uint256 fee = uint256(BASE_FEE) + uint256(volOf[id].ewmaVolBps) * VOL_K + sizeUnit * SIZE_K;
        if (fee < BASE_FEE) fee = BASE_FEE;
        if (fee > MAX_FEE) fee = MAX_FEE;
        return uint24(fee);
    }
}
