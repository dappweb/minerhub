// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title MM Token
 * @notice MinerHub 生态代币，支持铸造、销毁、标准 ERC20 操作
 */
contract MM is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    // 代币总供应量：10 亿 MM
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;
    
    // 已铸造的代币总量追踪
    uint256 public totalMinted;
    
    // 事件
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    // 铸造者权限映射
    mapping(address => bool) public minters;

    constructor() ERC20("MinerHub Token", "MM") ERC20Permit("MinerHub Token") {
        // 初始供应给部署者（用于初始化 Swap 池和生态基金）
        // 将在部署脚本中分配到不同地址
    }
    
    /**
     * @notice 添加铸造者权限（仅 Owner）
     * @param _minter 铸造者地址
     */
    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter address");
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }
    
    /**
     * @notice 移除铸造者权限（仅 Owner）
     * @param _minter 铸造者地址
     */
    function removeMinter(address _minter) external onlyOwner {
        require(minters[_minter], "Address is not a minter");
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }
    
    /**
     * @notice 铸造新的 MM 代币（仅铸造者或 Owner）
     * @param _to 接收地址
     * @param _amount 铸造数量
     */
    function mint(address _to, uint256 _amount) external {
        require(msg.sender == owner() || minters[msg.sender], "Only minter or owner can mint");
        require(_to != address(0), "Invalid recipient address");
        require(totalMinted + _amount <= TOTAL_SUPPLY, "Exceeds max supply");
        
        totalMinted += _amount;
        _mint(_to, _amount);
        emit TokensMinted(_to, _amount);
    }
    
    /**
     * @notice 销毁代币的重写（添加事件）
     * @param _amount 销毁数量
     */
    function burn(uint256 _amount) public override {
        super.burn(_amount);
        emit TokensBurned(_msgSender(), _amount);
    }
    
    /**
     * @notice 从指定地址销毁代币的重写（添加事件）
     * @param _account 账户地址
     * @param _amount 销毁数量
     */
    function burnFrom(address _account, uint256 _amount) public override {
        super.burnFrom(_account, _amount);
        emit TokensBurned(_account, _amount);
    }
    
    /**
     * @notice 获取剩余可铸造代币数量
     * @return 剩余代币数量
     */
    function remainingSupply() external view returns (uint256) {
        return TOTAL_SUPPLY - totalMinted;
    }
    
    /**
     * @notice 检查地址是否为铸造者
     * @param _account 账户地址
     * @return 是否为铸造者
     */
    function isMinter(address _account) external view returns (bool) {
        return _account == owner() || minters[_account];
    }
}
