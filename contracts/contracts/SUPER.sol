// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title SUPER Token
 * @notice Coin Planet 鐢熸€佷唬甯侊紝鏀寔閾搁€犮€侀攢姣併€佹爣鍑?ERC20 鎿嶄綔
 */
contract SUPER is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    // 浠ｅ竵鎬讳緵搴旈噺锛?0 浜?SUPER
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;
    
    // 宸查摳閫犵殑浠ｅ竵鎬婚噺杩借釜
    uint256 public totalMinted;
    
    // 浜嬩欢
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    // 閾搁€犺€呮潈闄愭槧灏?
    mapping(address => bool) public minters;

    constructor() ERC20("Coin Planet Token", "SUPER") ERC20Permit("Coin Planet Token") {
        // 鍒濆渚涘簲缁欓儴缃茶€咃紙鐢ㄤ簬鍒濆鍖?Swap 姹犲拰鐢熸€佸熀閲戯級
        // 灏嗗湪閮ㄧ讲鑴氭湰涓垎閰嶅埌涓嶅悓鍦板潃
    }
    
    /**
     * @notice 娣诲姞閾搁€犺€呮潈闄愶紙浠?Owner锛?
     * @param _minter 閾搁€犺€呭湴鍧€
     */
    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter address");
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }
    
    /**
     * @notice 绉婚櫎閾搁€犺€呮潈闄愶紙浠?Owner锛?
     * @param _minter 閾搁€犺€呭湴鍧€
     */
    function removeMinter(address _minter) external onlyOwner {
        require(minters[_minter], "Address is not a minter");
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }
    
    /**
     * @notice 閾搁€犳柊鐨?SUPER 浠ｅ竵锛堜粎閾搁€犺€呮垨 Owner锛?
     * @param _to 鎺ユ敹鍦板潃
     * @param _amount 閾搁€犳暟閲?
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
     * @notice 閿€姣佷唬甯佺殑閲嶅啓锛堟坊鍔犱簨浠讹級
     * @param _amount 閿€姣佹暟閲?
     */
    function burn(uint256 _amount) public override {
        super.burn(_amount);
        emit TokensBurned(_msgSender(), _amount);
    }
    
    /**
     * @notice 浠庢寚瀹氬湴鍧€閿€姣佷唬甯佺殑閲嶅啓锛堟坊鍔犱簨浠讹級
     * @param _account 璐︽埛鍦板潃
     * @param _amount 閿€姣佹暟閲?
     */
    function burnFrom(address _account, uint256 _amount) public override {
        super.burnFrom(_account, _amount);
        emit TokensBurned(_account, _amount);
    }
    
    /**
     * @notice 鑾峰彇鍓╀綑鍙摳閫犱唬甯佹暟閲?
     * @return 鍓╀綑浠ｅ竵鏁伴噺
     */
    function remainingSupply() external view returns (uint256) {
        return TOTAL_SUPPLY - totalMinted;
    }
    
    /**
     * @notice 妫€鏌ュ湴鍧€鏄惁涓洪摳閫犺€?
     * @param _account 璐︽埛鍦板潃
     * @return 鏄惁涓洪摳閫犺€?
     */
    function isMinter(address _account) external view returns (bool) {
        return _account == owner() || minters[_account];
    }
}

