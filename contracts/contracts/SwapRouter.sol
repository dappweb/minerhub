// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SwapRouter
 * @notice MinerHub AMM (自动做市商) - MM ↔ USDT 交换
 * - 简单的 x * y = k 模式
 * - 初始流动性：50M MM + 50k USDT
 * - 手续费：0.5% (70% LP, 20% 平台, 10% 生态)
 */
contract SwapRouter is Ownable, ReentrancyGuard {
    IERC20 public mmToken;
    IERC20 public usdtToken;
    
    // 流动性池
    uint256 public reserveMM;
    uint256 public reserveUSDT;
    
    // 手续费参数
    uint256 public constant FEE_BIPS = 50;  // 0.5% = 50 basis points
    uint256 public lpFeeShare = 70;         // LP 获得 70%
    uint256 public platformFeeShare = 20;   // 平台 20%
    uint256 public ecosystemFeeShare = 10;  // 生态 10%
    
    // 流动性提供者 (LP) 追踪
    mapping(address => uint256) public lpShares;
    uint256 public totalLPShares;
    
    // 手续费积累
    uint256 public accumulatedPlatformFee;
    uint256 public accumulatedEcosystemFee;
    
    // 价格历史
    struct PricePoint {
        uint256 timestamp;
        uint256 priceMMPerUSDT;  // MM 价格 (相对 USDT，精度 18)
    }
    PricePoint[] public priceHistory;
    
    // 事件
    event LiquidityAdded(address indexed provider, uint256 mmAmount, uint256 usdtAmount, uint256 sharesIssued);
    event LiquidityRemoved(address indexed provider, uint256 mmAmount, uint256 usdtAmount, uint256 sharesBurned);
    event Swap(address indexed user, bool isMmToUsdt, uint256 inputAmount, uint256 outputAmount, uint256 feeAmount);
    event FeeCollected(uint256 platformFee, uint256 ecosystemFee);
    event PriceUpdated(uint256 priceMMPerUSDT);
    
    constructor(address _mm, address _usdt) {
        require(_mm != address(0) && _usdt != address(0), "Invalid token addresses");
        mmToken = IERC20(_mm);
        usdtToken = IERC20(_usdt);
    }
    
    /**
     * @notice 初始化流动性池 (仅 Owner，只能调用一次)
     * @param _mmAmount MM 代币数量
     * @param _usdtAmount USDT 数量
     */
    function initializeLiquidity(uint256 _mmAmount, uint256 _usdtAmount) external onlyOwner nonReentrant {
        require(reserveMM == 0 && reserveUSDT == 0, "Liquidity already initialized");
        require(_mmAmount > 0 && _usdtAmount > 0, "Invalid amounts");
        
        // 从 Owner 转账代币
        require(mmToken.transferFrom(msg.sender, address(this), _mmAmount), "MM transfer failed");
        require(usdtToken.transferFrom(msg.sender, address(this), _usdtAmount), "USDT transfer failed");
        
        reserveMM = _mmAmount;
        reserveUSDT = _usdtAmount;
        
        // 初始 LP 份额
        uint256 lpShares = _sqrt(_mmAmount * _usdtAmount);
        lpShares[msg.sender] = lpShares;
        totalLPShares = lpShares;
        
        emit LiquidityAdded(msg.sender, _mmAmount, _usdtAmount, lpShares);
        _recordPrice();
    }
    
    /**
     * @notice 添加流动性
     * @param _mmAmount MM 代币数量
     * @param _usdtAmount USDT 数量
     */
    function addLiquidity(uint256 _mmAmount, uint256 _usdtAmount) external nonReentrant {
        require(_mmAmount > 0 && _usdtAmount > 0, "Invalid amounts");
        require(reserveMM > 0 && reserveUSDT > 0, "No initial liquidity");
        
        // 转账代币
        require(mmToken.transferFrom(msg.sender, address(this), _mmAmount), "MM transfer failed");
        require(usdtToken.transferFrom(msg.sender, address(this), _usdtAmount), "USDT transfer failed");
        
        // 计算新增 LP 份额
        uint256 mmShare = (_mmAmount * totalLPShares) / reserveMM;
        uint256 usdtShare = (_usdtAmount * totalLPShares) / reserveUSDT;
        uint256 newShares = mmShare < usdtShare ? mmShare : usdtShare;
        
        reserveMM += _mmAmount;
        reserveUSDT += _usdtAmount;
        lpShares[msg.sender] += newShares;
        totalLPShares += newShares;
        
        emit LiquidityAdded(msg.sender, _mmAmount, _usdtAmount, newShares);
        _recordPrice();
    }
    
    /**
     * @notice 移除流动性
     * @param _sharesToBurn 要销毁的 LP 份额
     */
    function removeLiquidity(uint256 _sharesToBurn) external nonReentrant {
        require(_sharesToBurn > 0 && lpShares[msg.sender] >= _sharesToBurn, "Invalid shares");
        
        // 计算可提取的代币数量
        uint256 mmAmount = (reserveMM * _sharesToBurn) / totalLPShares;
        uint256 usdtAmount = (reserveUSDT * _sharesToBurn) / totalLPShares;
        
        require(mmAmount > 0 && usdtAmount > 0, "Insufficient liquidity");
        
        // 更新池和份额
        reserveMM -= mmAmount;
        reserveUSDT -= usdtAmount;
        lpShares[msg.sender] -= _sharesToBurn;
        totalLPShares -= _sharesToBurn;
        
        // 转账代币
        require(mmToken.transfer(msg.sender, mmAmount), "MM transfer failed");
        require(usdtToken.transfer(msg.sender, usdtAmount), "USDT transfer failed");
        
        emit LiquidityRemoved(msg.sender, mmAmount, usdtAmount, _sharesToBurn);
        _recordPrice();
    }
    
    /**
     * @notice MM → USDT 交换
     * @param _mmAmount MM 数量
     * @return usdtAmount 获得的 USDT 数量
     */
    function swapMmToUsdt(uint256 _mmAmount) external nonReentrant returns (uint256) {
        require(_mmAmount > 0, "Invalid amount");
        
        // 计算输出 (考虑手续费)
        uint256 amountWithoutFee = _mmAmount * (10000 - FEE_BIPS) / 10000;
        uint256 usdtAmount = _getAmountOut(amountWithoutFee, reserveMM, reserveUSDT);
        
        require(usdtAmount > 0, "Insufficient liquidity");
        
        // 转账输入
        require(mmToken.transferFrom(msg.sender, address(this), _mmAmount), "MM transfer failed");
        
        // 计算手续费
        uint256 totalFee = _mmAmount - amountWithoutFee;
        uint256 lpFee = (totalFee * lpFeeShare) / 100;
        uint256 platformFee = (totalFee * platformFeeShare) / 100;
        uint256 ecosystemFee = totalFee - lpFee - platformFee;
        
        // 更新池
        reserveMM += _mmAmount - lpFee;  // LP 费用 LP 分享
        reserveUSDT -= usdtAmount;
        
        accumulatedPlatformFee += platformFee;
        accumulatedEcosystemFee += ecosystemFee;
        
        // 转账输出
        require(usdtToken.transfer(msg.sender, usdtAmount), "USDT transfer failed");
        
        emit Swap(msg.sender, true, _mmAmount, usdtAmount, totalFee);
        _recordPrice();
        
        return usdtAmount;
    }
    
    /**
     * @notice USDT → MM 交换
     * @param _usdtAmount USDT 数量
     * @return mmAmount 获得的 MM 数量
     */
    function swapUsdtToMm(uint256 _usdtAmount) external nonReentrant returns (uint256) {
        require(_usdtAmount > 0, "Invalid amount");
        
        // 计算输出 (考虑手续费)
        uint256 amountWithoutFee = _usdtAmount * (10000 - FEE_BIPS) / 10000;
        uint256 mmAmount = _getAmountOut(amountWithoutFee, reserveUSDT, reserveMM);
        
        require(mmAmount > 0, "Insufficient liquidity");
        
        // 转账输入
        require(usdtToken.transferFrom(msg.sender, address(this), _usdtAmount), "USDT transfer failed");
        
        // 计算手续费
        uint256 totalFee = _usdtAmount - amountWithoutFee;
        uint256 lpFee = (totalFee * lpFeeShare) / 100;
        uint256 platformFee = (totalFee * platformFeeShare) / 100;
        uint256 ecosystemFee = totalFee - lpFee - platformFee;
        
        // 更新池
        reserveUSDT += _usdtAmount - lpFee;
        reserveMM -= mmAmount;
        
        accumulatedPlatformFee += platformFee;
        accumulatedEcosystemFee += ecosystemFee;
        
        // 转账输出
        require(mmToken.transfer(msg.sender, mmAmount), "MM transfer failed");
        
        emit Swap(msg.sender, false, _usdtAmount, mmAmount, totalFee);
        _recordPrice();
        
        return mmAmount;
    }
    
    /**
     * @notice 获取 MM/USDT 价格
     */
    function getPrice() external view returns (uint256) {
        if (reserveUSDT == 0) return 0;
        return (reserveMM * 1e18) / reserveUSDT;
    }
    
    /**
     * @notice 提取平台手续费 (仅 Owner)
     */
    function collectPlatformFee() external onlyOwner nonReentrant {
        uint256 fee = accumulatedPlatformFee;
        require(fee > 0, "No fee to collect");
        accumulatedPlatformFee = 0;
        require(mmToken.transfer(msg.sender, fee), "Transfer failed");
        emit FeeCollected(fee, 0);
    }
    
    /**
     * @notice 提取生态基金 (仅 Owner)
     */
    function collectEcosystemFee(address _recipient) external onlyOwner nonReentrant {
        uint256 fee = accumulatedEcosystemFee;
        require(fee > 0, "No fee to collect");
        accumulatedEcosystemFee = 0;
        require(mmToken.transfer(_recipient, fee), "Transfer failed");
        emit FeeCollected(0, fee);
    }
    
    // ========== 内部函数 ==========
    
    /**
     * @notice 计算 AMM 输出 (x * y = k)
     */
    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        uint256 k = reserveIn * reserveOut;
        uint256 newReserveIn = reserveIn + amountIn;
        uint256 newReserveOut = k / newReserveIn;
        return reserveOut - newReserveOut;
    }
    
    /**
     * @notice 开平方根 (用于流动性计算)
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
     * @notice 记录价格历史
     */
    function _recordPrice() internal {
        uint256 price = (reserveMM * 1e18) / (reserveUSDT == 0 ? 1 : reserveUSDT);
        priceHistory.push(PricePoint({
            timestamp: block.timestamp,
            priceMMPerUSDT: price
        }));
        
        // 只保留最近 1000 条记录
        if (priceHistory.length > 1000) {
            for (uint256 i = 0; i < priceHistory.length - 1; i++) {
                priceHistory[i] = priceHistory[i + 1];
            }
            priceHistory.pop();
        }
        
        emit PriceUpdated(price);
    }
}
