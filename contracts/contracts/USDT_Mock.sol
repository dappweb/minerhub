// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title USDT Mock
 * @notice Mock USDT for local integration, demos, and non-mainnet use.
 */
contract USDT_Mock is ERC20, ERC20Burnable {
    constructor() ERC20("USDT", "USDT") {
        // Mint initial supply to the deployer.
        _mint(msg.sender, 10_000_000 * 10 ** 18);
    }
    
    /**
     * @notice Faucet for test balances.
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10 ** 18);  // 1000 USDT
    }
    
    /**
     * @notice USDT decimals.
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
