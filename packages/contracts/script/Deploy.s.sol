// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {DistroGuardHook} from "../src/DistroGuardHook.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {HookMiner} from "./HookMiner.sol";

// self-deploys manager + v4-core test routers + mock pair, mines/deploys the hook,
// initializes a dynamic-fee pool, seeds liquidity, runs 2 demo swaps, writes addresses json
contract Deploy is Script {
    // canonical create2 proxy (deployed on chain 1952)
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 1:1
    int24 constant TICK_SPACING = 60;

    struct Deployment {
        PoolManager pm;
        PoolModifyLiquidityTest modifyLiquidityRouter;
        PoolSwapTest swapRouter;
        MockERC20 token0;
        MockERC20 token1;
        DistroGuardHook hook;
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // simulation-only balance so the broadcast sender can pay gas during sim.
        // harmless for the real broadcast (real funding exists then).
        vm.deal(deployer, 100 ether);

        vm.startBroadcast(pk);

        Deployment memory d = _deploy(deployer);
        PoolKey memory key = _initAndSeed(d);
        _demoSwaps(d, key);

        vm.stopBroadcast();

        PoolId poolId = key.toId();
        _writeAddresses(d, poolId);

        console2.log("hook:", address(d.hook));
        console2.log("poolId:", vm.toString(PoolId.unwrap(poolId)));
        console2.log("poolManager:", address(d.pm));
    }

    // core + test routers + mock pair + mined hook
    function _deploy(address deployer) internal returns (Deployment memory d) {
        // 1. core + test routers (deployer is manager owner)
        d.pm = new PoolManager(deployer);
        d.modifyLiquidityRouter = new PoolModifyLiquidityTest(IPoolManager(address(d.pm)));
        d.swapRouter = new PoolSwapTest(IPoolManager(address(d.pm)));

        // 2. mock pair, sorted so currency0 < currency1 by address
        MockERC20 tokenA = new MockERC20("Mock WETH", "mWETH", 18);
        MockERC20 tokenB = new MockERC20("Mock USDC", "mUSDC", 18);
        (d.token0, d.token1) = address(tokenA) < address(tokenB) ? (tokenA, tokenB) : (tokenB, tokenA);

        uint256 mintAmount = 1_000_000_000 ether;
        d.token0.mint(deployer, mintAmount);
        d.token1.mint(deployer, mintAmount);

        d.token0.approve(address(d.modifyLiquidityRouter), type(uint256).max);
        d.token1.approve(address(d.modifyLiquidityRouter), type(uint256).max);
        d.token0.approve(address(d.swapRouter), type(uint256).max);
        d.token1.approve(address(d.swapRouter), type(uint256).max);

        // 3. mine + deploy the hook so its address encodes the permission flags
        uint160 flags = uint160(Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER, flags, type(DistroGuardHook).creationCode, abi.encode(IPoolManager(address(d.pm)))
        );
        d.hook = new DistroGuardHook{salt: salt}(IPoolManager(address(d.pm)));
        require(address(d.hook) == hookAddr, "hook addr mismatch");
    }

    // dynamic-fee pool init + seed liquidity
    function _initAndSeed(Deployment memory d) internal returns (PoolKey memory key) {
        key = PoolKey({
            currency0: Currency.wrap(address(d.token0)),
            currency1: Currency.wrap(address(d.token1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(d.hook))
        });
        d.pm.initialize(key, SQRT_PRICE_1_1);

        // tickSpacing-aligned range
        d.modifyLiquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 1e18, salt: bytes32(0)}),
            ""
        );
    }

    // demo swaps exercise beforeSwap/afterSwap (dynamic fee + vol accumulator)
    function _demoSwaps(Deployment memory d, PoolKey memory key) internal {
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});

        d.swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1e15, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            settings,
            ""
        );
        d.swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1e16, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            settings,
            ""
        );
    }

    // persist addresses for the dashboard/cli (gitignored — env-specific)
    function _writeAddresses(Deployment memory d, PoolId poolId) internal {
        string memory obj = "addresses";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "poolManager", address(d.pm));
        vm.serializeAddress(obj, "hook", address(d.hook));
        vm.serializeAddress(obj, "token0", address(d.token0));
        vm.serializeAddress(obj, "token1", address(d.token1));
        vm.serializeInt(obj, "tickSpacing", int256(TICK_SPACING));
        vm.serializeBytes32(obj, "poolId", PoolId.unwrap(poolId));
        vm.serializeAddress(obj, "swapRouter", address(d.swapRouter));
        string memory json = vm.serializeAddress(obj, "modifyLiquidityRouter", address(d.modifyLiquidityRouter));

        string memory path = string.concat("export/addresses.", vm.toString(block.chainid), ".json");
        vm.writeFile(path, json);
        console2.log("wrote:", path);
    }
}
