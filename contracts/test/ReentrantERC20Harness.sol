// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrantERC20} from "./ReentrantERC20.sol";

contract ReentrantERC20Harness is ReentrantERC20 {
    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply)
        ReentrantERC20(name_, symbol_, decimals_, initialSupply)
    {}

    function mintTo(address to, uint256 value) external {
        _mint(to, value);
    }
}
