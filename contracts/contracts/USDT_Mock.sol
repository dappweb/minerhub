// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title USDT Mock
 * @notice Sepolia 测试网上的模拟 USDT，用于测试 Swap 功能
 */
contract USDT_Mock is ERC20, ERC20Burnable {
    constructor() ERC20("USDT", "USDT") {
        // 初始铸造 1000 万 USDT 给部署者
        _mint(msg.sender, 10_000_000 * 10 ** 6);
    }
    
    /**
     * @notice 任何人可以申领测试 USDT
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10 ** 6);  // 1000 USDT
    }
    
    /**
     * @notice USDT 的小数点（6 位）
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
