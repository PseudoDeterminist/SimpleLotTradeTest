// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ReentryTarget {
    uint256 public calls;

    function ping() external {
        calls += 1;
    }

    function boom() external pure {
        revert("boom");
    }

    function silentBoom() external pure {
        assembly {
            revert(0, 0)
        }
    }
}
