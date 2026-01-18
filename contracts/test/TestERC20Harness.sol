// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TestERC20} from "../TestERC20.sol";

contract TestERC20Harness is TestERC20 {
    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply)
        TestERC20(name_, symbol_, decimals_, initialSupply)
    {}

    function mintTo(address to, uint256 value) external {
        _mint(to, value);
    }
}
