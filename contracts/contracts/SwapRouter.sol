// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SwapRouter
 * @notice Coin Planet AMM (鑷姩鍋氬競鍟? - SUPER 鈫?USDT 浜ゆ崲
 * - 绠€鍗曠殑 x * y = k 妯″紡
 * - 鍒濆娴佸姩鎬э細50M SUPER + 50k USDT
 * - 鎵嬬画璐癸細0.5% (70% LP, 20% 骞冲彴, 10% 鐢熸€?
 */
contract SwapRouter is Ownable, ReentrancyGuard {
    IERC20 public superToken;
    IERC20 public usdtToken;
    
    // 娴佸姩鎬ф睜
    uint256 public reserveSuper;
    uint256 public reserveUSDT;
    
    // 鎵嬬画璐瑰弬鏁?
    uint256 public constant FEE_BIPS = 50;  // 0.5% = 50 basis points
    uint256 public lpFeeShare = 70;         // LP 鑾峰緱 70%
    uint256 public platformFeeShare = 20;   // 骞冲彴 20%
    uint256 public ecosystemFeeShare = 10;  // 鐢熸€?10%
    
    // 娴佸姩鎬ф彁渚涜€?(LP) 杩借釜
    mapping(address => uint256) public lpShares;
    uint256 public totalLPShares;
    
    // 鎵嬬画璐圭Н绱?
    uint256 public accumulatedPlatformFee;
    uint256 public accumulatedEcosystemFee;
    
    // 浠锋牸鍘嗗彶
    struct PricePoint {
        uint256 timestamp;
        uint256 priceSuperPerUSDT;  // SUPER 浠锋牸 (鐩稿 USDT锛岀簿搴?18)
    }
    PricePoint[] public priceHistory;
    
    // 浜嬩欢
    event LiquidityAdded(address indexed provider, uint256 superAmount, uint256 usdtAmount, uint256 sharesIssued);
    event LiquidityRemoved(address indexed provider, uint256 superAmount, uint256 usdtAmount, uint256 sharesBurned);
    event Swap(address indexed user, bool isSuperToUsdt, uint256 inputAmount, uint256 outputAmount, uint256 feeAmount);
    event FeeCollected(uint256 platformFee, uint256 ecosystemFee);
    event PriceUpdated(uint256 priceSuperPerUSDT);
    
    constructor(address _super, address _usdt) {
        require(_super != address(0) && _usdt != address(0), "Invalid token addresses");
        superToken = IERC20(_super);
        usdtToken = IERC20(_usdt);
    }
    
    /**
     * @notice 鍒濆鍖栨祦鍔ㄦ€ф睜 (浠?Owner锛屽彧鑳借皟鐢ㄤ竴娆?
     * @param _superAmount SUPER 浠ｅ竵鏁伴噺
     * @param _usdtAmount USDT 鏁伴噺
     */
    function initializeLiquidity(uint256 _superAmount, uint256 _usdtAmount) external onlyOwner nonReentrant {
        require(reserveSuper == 0 && reserveUSDT == 0, "Liquidity already initialized");
        require(_superAmount > 0 && _usdtAmount > 0, "Invalid amounts");
        
        // 浠?Owner 杞处浠ｅ竵
        require(superToken.transferFrom(msg.sender, address(this), _superAmount), "SUPER transfer failed");
        require(usdtToken.transferFrom(msg.sender, address(this), _usdtAmount), "USDT transfer failed");
        
        reserveSuper = _superAmount;
        reserveUSDT = _usdtAmount;
        
        // 鍒濆 LP 浠介
        uint256 issuedShares = _sqrt(_superAmount * _usdtAmount);
        lpShares[msg.sender] = issuedShares;
        totalLPShares = issuedShares;
        
        emit LiquidityAdded(msg.sender, _superAmount, _usdtAmount, issuedShares);
        _recordPrice();
    }
    
    /**
     * @notice 娣诲姞娴佸姩鎬?
     * @param _superAmount SUPER 浠ｅ竵鏁伴噺
     * @param _usdtAmount USDT 鏁伴噺
     */
    function addLiquidity(uint256 _superAmount, uint256 _usdtAmount) external nonReentrant {
        require(_superAmount > 0 && _usdtAmount > 0, "Invalid amounts");
        require(reserveSuper > 0 && reserveUSDT > 0, "No initial liquidity");
        
        // 杞处浠ｅ竵
        require(superToken.transferFrom(msg.sender, address(this), _superAmount), "SUPER transfer failed");
        require(usdtToken.transferFrom(msg.sender, address(this), _usdtAmount), "USDT transfer failed");
        
        // 璁＄畻鏂板 LP 浠介
        uint256 superShare = (_superAmount * totalLPShares) / reserveSuper;
        uint256 usdtShare = (_usdtAmount * totalLPShares) / reserveUSDT;
        uint256 newShares = superShare < usdtShare ? superShare : usdtShare;
        
        reserveSuper += _superAmount;
        reserveUSDT += _usdtAmount;
        lpShares[msg.sender] += newShares;
        totalLPShares += newShares;
        
        emit LiquidityAdded(msg.sender, _superAmount, _usdtAmount, newShares);
        _recordPrice();
    }
    
    /**
     * @notice 绉婚櫎娴佸姩鎬?
     * @param _sharesToBurn 瑕侀攢姣佺殑 LP 浠介
     */
    function removeLiquidity(uint256 _sharesToBurn) external nonReentrant {
        require(_sharesToBurn > 0 && lpShares[msg.sender] >= _sharesToBurn, "Invalid shares");
        
        // 璁＄畻鍙彁鍙栫殑浠ｅ竵鏁伴噺
        uint256 superAmount = (reserveSuper * _sharesToBurn) / totalLPShares;
        uint256 usdtAmount = (reserveUSDT * _sharesToBurn) / totalLPShares;
        
        require(superAmount > 0 && usdtAmount > 0, "Insufficient liquidity");
        
        // 鏇存柊姹犲拰浠介
        reserveSuper -= superAmount;
        reserveUSDT -= usdtAmount;
        lpShares[msg.sender] -= _sharesToBurn;
        totalLPShares -= _sharesToBurn;
        
        // 杞处浠ｅ竵
        require(superToken.transfer(msg.sender, superAmount), "SUPER transfer failed");
        require(usdtToken.transfer(msg.sender, usdtAmount), "USDT transfer failed");
        
        emit LiquidityRemoved(msg.sender, superAmount, usdtAmount, _sharesToBurn);
        _recordPrice();
    }
    
    /**
     * @notice SUPER 鈫?USDT 浜ゆ崲
     * @param _superAmount SUPER 鏁伴噺
     * @return usdtAmount 鑾峰緱鐨?USDT 鏁伴噺
     */
    function swapSuperToUsdt(uint256 _superAmount) external nonReentrant returns (uint256) {
        require(_superAmount > 0, "Invalid amount");
        
        // 璁＄畻杈撳嚭 (鑰冭檻鎵嬬画璐?
        uint256 amountWithoutFee = _superAmount * (10000 - FEE_BIPS) / 10000;
        uint256 usdtAmount = _getAmountOut(amountWithoutFee, reserveSuper, reserveUSDT);
        
        require(usdtAmount > 0, "Insufficient liquidity");
        
        // 杞处杈撳叆
        require(superToken.transferFrom(msg.sender, address(this), _superAmount), "SUPER transfer failed");
        
        // 璁＄畻鎵嬬画璐?
        uint256 totalFee = _superAmount - amountWithoutFee;
        uint256 lpFee = (totalFee * lpFeeShare) / 100;
        uint256 platformFee = (totalFee * platformFeeShare) / 100;
        uint256 ecosystemFee = totalFee - lpFee - platformFee;
        
        // 鏇存柊姹?
        reserveSuper += _superAmount - lpFee;  // LP 璐圭敤 LP 鍒嗕韩
        reserveUSDT -= usdtAmount;
        
        accumulatedPlatformFee += platformFee;
        accumulatedEcosystemFee += ecosystemFee;
        
        // 杞处杈撳嚭
        require(usdtToken.transfer(msg.sender, usdtAmount), "USDT transfer failed");
        
        emit Swap(msg.sender, true, _superAmount, usdtAmount, totalFee);
        _recordPrice();
        
        return usdtAmount;
    }
    
    /**
     * @notice USDT 鈫?SUPER 浜ゆ崲
     * @param _usdtAmount USDT 鏁伴噺
     * @return superAmount 鑾峰緱鐨?SUPER 鏁伴噺
     */
    function swapUsdtToSuper(uint256 _usdtAmount) external nonReentrant returns (uint256) {
        require(_usdtAmount > 0, "Invalid amount");
        
        // 璁＄畻杈撳嚭 (鑰冭檻鎵嬬画璐?
        uint256 amountWithoutFee = _usdtAmount * (10000 - FEE_BIPS) / 10000;
        uint256 superAmount = _getAmountOut(amountWithoutFee, reserveUSDT, reserveSuper);
        
        require(superAmount > 0, "Insufficient liquidity");
        
        // 杞处杈撳叆
        require(usdtToken.transferFrom(msg.sender, address(this), _usdtAmount), "USDT transfer failed");
        
        // 璁＄畻鎵嬬画璐?
        uint256 totalFee = _usdtAmount - amountWithoutFee;
        uint256 lpFee = (totalFee * lpFeeShare) / 100;
        uint256 platformFee = (totalFee * platformFeeShare) / 100;
        uint256 ecosystemFee = totalFee - lpFee - platformFee;
        
        // 鏇存柊姹?
        reserveUSDT += _usdtAmount - lpFee;
        reserveSuper -= superAmount;
        
        accumulatedPlatformFee += platformFee;
        accumulatedEcosystemFee += ecosystemFee;
        
        // 杞处杈撳嚭
        require(superToken.transfer(msg.sender, superAmount), "SUPER transfer failed");
        
        emit Swap(msg.sender, false, _usdtAmount, superAmount, totalFee);
        _recordPrice();
        
        return superAmount;
    }
    
    /**
     * @notice 鑾峰彇 SUPER/USDT 浠锋牸
     */
    function getPrice() external view returns (uint256) {
        if (reserveUSDT == 0) return 0;
        return (reserveSuper * 1e18) / reserveUSDT;
    }
    
    /**
     * @notice 鎻愬彇骞冲彴鎵嬬画璐?(浠?Owner)
     */
    function collectPlatformFee() external onlyOwner nonReentrant {
        uint256 fee = accumulatedPlatformFee;
        require(fee > 0, "No fee to collect");
        accumulatedPlatformFee = 0;
        require(superToken.transfer(msg.sender, fee), "Transfer failed");
        emit FeeCollected(fee, 0);
    }
    
    /**
     * @notice 鎻愬彇鐢熸€佸熀閲?(浠?Owner)
     */
    function collectEcosystemFee(address _recipient) external onlyOwner nonReentrant {
        uint256 fee = accumulatedEcosystemFee;
        require(fee > 0, "No fee to collect");
        accumulatedEcosystemFee = 0;
        require(superToken.transfer(_recipient, fee), "Transfer failed");
        emit FeeCollected(0, fee);
    }
    
    // ========== 鍐呴儴鍑芥暟 ==========
    
    /**
     * @notice 璁＄畻 AMM 杈撳嚭 (x * y = k)
     */
    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        uint256 k = reserveIn * reserveOut;
        uint256 newReserveIn = reserveIn + amountIn;
        uint256 newReserveOut = k / newReserveIn;
        return reserveOut - newReserveOut;
    }
    
    /**
     * @notice 寮€骞虫柟鏍?(鐢ㄤ簬娴佸姩鎬ц绠?
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 xx = x;
        uint256 r = 1;
        if (xx >= 0x100000000000000000000000000000000) { xx >>= 128; r <<= 64; }
        if (xx >= 0x10000000000000000) { xx >>= 64; r <<= 32; }
        if (xx >= 0x100000000) { xx >>= 32; r <<= 16; }
        if (xx >= 0x10000) { xx >>= 16; r <<= 8; }
        if (xx >= 0x100) { xx >>= 8; r <<= 4; }
        if (xx >= 0x10) { xx >>= 4; r <<= 2; }
        if (xx >= 0x8) r <<= 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        uint256 r1 = x / r;
        return r < r1 ? r : r1;
    }
    
    /**
     * @notice 璁板綍浠锋牸鍘嗗彶
     */
    function _recordPrice() internal {
        uint256 price = (reserveSuper * 1e18) / (reserveUSDT == 0 ? 1 : reserveUSDT);
        priceHistory.push(PricePoint({
            timestamp: block.timestamp,
            priceSuperPerUSDT: price
        }));
        
        // 鍙繚鐣欐渶杩?1000 鏉¤褰?
        if (priceHistory.length > 1000) {
            for (uint256 i = 0; i < priceHistory.length - 1; i++) {
                priceHistory[i] = priceHistory[i + 1];
            }
            priceHistory.pop();
        }
        
        emit PriceUpdated(price);
    }
}


