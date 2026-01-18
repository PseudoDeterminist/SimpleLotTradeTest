// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Test-only token that can reenter a target during transfer hooks.
contract ReentrantERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public reentryTarget;
    bytes public reentryData;
    bool public reenterOnTransfer;
    bool public reenterOnTransferFrom;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }

    function setReentry(
        address target,
        bytes calldata data,
        bool onTransfer,
        bool onTransferFrom
    ) external {
        reentryTarget = target;
        reentryData = data;
        reenterOnTransfer = onTransfer;
        reenterOnTransferFrom = onTransferFrom;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        _maybeReenter(false);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= value, "allowance");
        unchecked {
            allowance[from][msg.sender] = currentAllowance - value;
        }
        _transfer(from, to, value);
        _maybeReenter(true);
        return true;
    }

    function _maybeReenter(bool isTransferFrom) internal {
        if (reentryTarget == address(0)) return;
        if (isTransferFrom && !reenterOnTransferFrom) return;
        if (!isTransferFrom && !reenterOnTransfer) return;

        (bool ok, bytes memory data) = reentryTarget.call(reentryData);
        if (!ok) _bubbleRevert(data);
    }

    function _bubbleRevert(bytes memory data) private pure {
        if (data.length == 0) revert("reentry failed");
        assembly {
            revert(add(data, 32), mload(data))
        }
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "zero to");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "balance");
        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        require(spender != address(0), "zero spender");
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _mint(address to, uint256 value) internal {
        require(to != address(0), "zero to");
        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }
}
