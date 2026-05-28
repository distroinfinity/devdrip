// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@uniswap/v4-core/lib/solmate/src/tokens/ERC20.sol";

// mintable erc20 for the demo pool pair
contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_, decimals_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
