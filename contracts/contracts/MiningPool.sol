// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MiningPool
 * @notice MinerHub 挖矿核心合约
 * - 矿工注册、算力更新
 * - 奖励计算和分配
 * - 提取冷却机制
 * - 防作弊检测
 */
contract MiningPool is Ownable, ReentrancyGuard {
    // MM 代币地址
    IERC20 public mmToken;
    
    // 挖矿参数
    uint256 public constant DAILY_EMISSION = 2_847_222 * 10 ** 18;  // 日产 284.7222 万 MM
    uint256 public constant MIN_HASHRATE = 100;                      // 最小算力：0.1 MH/s
    uint256 public constant MAX_HASHRATE = 10_000_000;               // 最大算力：10 MH/s
    
    // 奖励参数
    uint256 public rewardPerHashPerDay = 1 * 10 ** 12;  // 每天每单位算力获得奖励
    uint256 public claimCooldown = 1 days;              // 领取冷却时间
    uint256 public lockupPeriod = 7 days;               // 首次挖矿锁仓期
    
    // 难度调整
    uint256 public globalHashrate;
    uint256 public lastDifficultyAdjustment;
    uint256 public difficultyAdjustmentPeriod = 7 days;
    
    // 矿工信息结构
    struct Miner {
        uint256 hashrate;              // 当前算力
        uint256 lastClaimed;           // 上次领取时间
        uint256 pendingReward;         // 待领取奖励
        uint256 totalClaimed;          // 已领取总量
        uint256 registeredTime;        // 注册时间
        bool active;                   // 是否活跃
        uint256 suspiciousScore;       // 可疑分数 (0-100)
    }
    
    // 矿工映射 (钱包地址 -> Miner)
    mapping(address => Miner) public miners;
    mapping(address => bool) public registeredMiners;
    
    // 统计数据
    uint256 public totalMiners;
    uint256 public totalActiveHashrate;
    uint256 public totalEmitted;
    
    // 事件
    event MinerRegistered(address indexed miner, uint256 hashrate);
    event HashrateUpdated(address indexed miner, uint256 oldHashrate, uint256 newHashrate);
    event RewardClaimed(address indexed miner, uint256 amount);
    event DifficultyAdjusted(uint256 newGlobalHashrate);
    event MinerDeactivated(address indexed miner, string reason);
    event RewardParametersUpdated(uint256 newRewardPerHash, uint256 newClaimCooldown);
    event SuspiciousActivityDetected(address indexed miner, uint256 score, string reason);
    
    constructor(address _mmToken) {
        require(_mmToken != address(0), "Invalid MM token address");
        mmToken = IERC20(_mmToken);
        lastDifficultyAdjustment = block.timestamp;
    }
    
    /**
     * @notice 矿工注册
     * @param _hashrate 初始算力
     * @param _deviceId 设备 ID (链下标识)
     */
    function registerMiner(uint256 _hashrate, string calldata _deviceId) external {
        require(_hashrate >= MIN_HASHRATE && _hashrate <= MAX_HASHRATE, "Invalid hashrate");
        require(!registeredMiners[msg.sender], "Miner already registered");
        require(bytes(_deviceId).length > 0, "Device ID required");
        
        miners[msg.sender] = Miner({
            hashrate: _hashrate,
            lastClaimed: block.timestamp,
            pendingReward: 0,
            totalClaimed: 0,
            registeredTime: block.timestamp,
            active: true,
            suspiciousScore: 0
        });
        
        registeredMiners[msg.sender] = true;
        totalMiners++;
        totalActiveHashrate += _hashrate;
        
        emit MinerRegistered(msg.sender, _hashrate);
    }
    
    /**
     * @notice 更新挖矿算力
     * @param _newHashrate 新算力
     */
    function updateHashrate(uint256 _newHashrate) external {
        require(registeredMiners[msg.sender], "Miner not registered");
        require(_newHashrate >= MIN_HASHRATE && _newHashrate <= MAX_HASHRATE, "Invalid hashrate");
        
        Miner storage miner = miners[msg.sender];
        require(miner.active, "Miner not active");
        
        // 检测异常算力变化 (离线后突然提升)
        if (_newHashrate > miner.hashrate * 2 && miner.lastClaimed + 1 days < block.timestamp) {
            miner.suspiciousScore += 10;
            emit SuspiciousActivityDetected(msg.sender, miner.suspiciousScore, "Sudden hashrate increase");
        }
        
        uint256 oldHashrate = miner.hashrate;
        totalActiveHashrate = totalActiveHashrate - oldHashrate + _newHashrate;
        miner.hashrate = _newHashrate;
        
        emit HashrateUpdated(msg.sender, oldHashrate, _newHashrate);
    }
    
    /**
     * @notice 计算待领取奖励
     * @param _miner 矿工地址
     * @return 待领取奖励金额
     */
    function calculatePendingReward(address _miner) public view returns (uint256) {
        require(registeredMiners[_miner], "Miner not registered");
        
        Miner storage miner = miners[_miner];
        if (!miner.active || miner.hashrate == 0) return miner.pendingReward;
        
        // 检查锁仓期
        if (block.timestamp < miner.registeredTime + lockupPeriod) {
            return miner.pendingReward;  // 锁仓期内不计算奖励
        }
        
        // 时间差
        uint256 timePassed = block.timestamp - miner.lastClaimed;
        
        // 奖励 = 全局日产 * (该矿工算力 / 全球总算力) * 时间比例
        uint256 dailyGlobalReward = DAILY_EMISSION;
        uint256 minerShare = (dailyGlobalReward * miner.hashrate) / (totalActiveHashrate == 0 ? 1 : totalActiveHashrate);
        uint256 reward = (minerShare * timePassed) / (1 days);
        
        return miner.pendingReward + reward;
    }
    
    /**
     * @notice 领取奖励
     */
    function claimReward() external nonReentrant {
        require(registeredMiners[msg.sender], "Miner not registered");
        
        Miner storage miner = miners[msg.sender];
        require(miner.active, "Miner not active");
        
        // 检查冷却
        uint256 timeSinceLast = block.timestamp - miner.lastClaimed;
        require(timeSinceLast >= claimCooldown, "Claim cooldown not met");
        
        // 计算奖励
        uint256 reward = calculatePendingReward(msg.sender);
        require(reward > 0, "No reward to claim");
        
        // 检测作弊行为
        if (timeSinceLast > 7 days && miner.hashrate > MIN_HASHRATE * 10) {
            // 7 天未领取却有高算力 = 可疑
            miner.suspiciousScore += 5;
        }
        
        // 重置待领取奖励和最后领取时间
        miner.pendingReward = 0;
        miner.lastClaimed = block.timestamp;
        miner.totalClaimed += reward;
        totalEmitted += reward;
        
        // 转账 MM 代币
        require(mmToken.transfer(msg.sender, reward), "Token transfer failed");
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    /**
     * @notice 调整难度 (定期调用)
     */
    function adjustDifficulty() external onlyOwner {
        require(block.timestamp >= lastDifficultyAdjustment + difficultyAdjustmentPeriod, "Too early to adjust");
        
        globalHashrate = totalActiveHashrate;
        lastDifficultyAdjustment = block.timestamp;
        
        emit DifficultyAdjusted(globalHashrate);
    }
    
    /**
     * @notice 更新奖励参数 (仅 Owner)
     * @param _rewardPerHash 每单位算力的奖励
     * @param _claimCooldown 新的冷却时间
     */
    function updateRewardParameters(uint256 _rewardPerHash, uint256 _claimCooldown) external onlyOwner {
        rewardPerHashPerDay = _rewardPerHash;
        claimCooldown = _claimCooldown;
        
        emit RewardParametersUpdated(_rewardPerHash, _claimCooldown);
    }
    
    /**
     * @notice 停用矿工 (异常检测)
     * @param _miner 矿工地址
     */
    function deactivateMiner(address _miner, string calldata _reason) external onlyOwner {
        require(registeredMiners[_miner], "Miner not registered");
        
        Miner storage miner = miners[_miner];
        require(miner.active, "Miner already inactive");
        
        miner.active = false;
        totalActiveHashrate -= miner.hashrate;
        
        emit MinerDeactivated(_miner, _reason);
    }
    
    /**
     * @notice 获取矿工信息
     */
    function getMinerInfo(address _miner) external view returns (
        uint256 hashrate,
        uint256 pending,
        uint256 totalClaimed,
        bool active,
        uint256 suspiciousScore
    ) {
        require(registeredMiners[_miner], "Miner not registered");
        Miner storage miner = miners[_miner];
        return (
            miner.hashrate,
            calculatePendingReward(_miner),
            miner.totalClaimed,
            miner.active,
            miner.suspiciousScore
        );
    }
    
    /**
     * @notice 获取全局统计
     */
    function getGlobalStats() external view returns (
        uint256 totalEm,
        uint256 totalActive,
        uint256 minerCount
    ) {
        return (totalEmitted, totalActiveHashrate, totalMiners);
    }
}
