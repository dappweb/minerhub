// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MiningPool
 * @notice Coin Planet 鎸栫熆鏍稿績鍚堢害
 * - 鐭垮伐娉ㄥ唽銆佺畻鍔涙洿鏂?
 * - 濂栧姳璁＄畻鍜屽垎閰?
 * - 鎻愬彇鍐峰嵈鏈哄埗
 * - 闃蹭綔寮婃娴?
 */
contract MiningPool is Ownable, ReentrancyGuard {
    // SUPER 浠ｅ竵鍦板潃
    IERC20 public superToken;
    
    // 鎸栫熆鍙傛暟
    uint256 public constant DAILY_EMISSION = 2_847_222 * 10 ** 18;  // 鏃ヤ骇 284.7222 涓?SUPER
    uint256 public constant MIN_HASHRATE = 100;                      // 鏈€灏忕畻鍔涳細0.1 MH/s
    uint256 public constant MAX_HASHRATE = 10_000_000;               // 鏈€澶х畻鍔涳細10 MH/s
    
    // 濂栧姳鍙傛暟
    uint256 public rewardPerHashPerDay = 1 * 10 ** 12;  // 姣忓ぉ姣忓崟浣嶇畻鍔涜幏寰楀鍔?
    uint256 public claimCooldown = 1 days;              // 棰嗗彇鍐峰嵈鏃堕棿
    uint256 public lockupPeriod = 7 days;               // 棣栨鎸栫熆閿佷粨鏈?
    
    // 闅惧害璋冩暣
    uint256 public globalHashrate;
    uint256 public lastDifficultyAdjustment;
    uint256 public difficultyAdjustmentPeriod = 7 days;
    
    // 鐭垮伐淇℃伅缁撴瀯
    struct Miner {
        uint256 hashrate;              // 褰撳墠绠楀姏
        uint256 lastClaimed;           // 涓婃棰嗗彇鏃堕棿
        uint256 pendingReward;         // 寰呴鍙栧鍔?
        uint256 totalClaimed;          // 宸查鍙栨€婚噺
        uint256 registeredTime;        // 娉ㄥ唽鏃堕棿
        bool active;                   // 鏄惁娲昏穬
        uint256 suspiciousScore;       // 鍙枒鍒嗘暟 (0-100)
    }
    
    // 鐭垮伐鏄犲皠 (閽卞寘鍦板潃 -> Miner)
    mapping(address => Miner) public miners;
    mapping(address => bool) public registeredMiners;
    
    // 缁熻鏁版嵁
    uint256 public totalMiners;
    uint256 public totalActiveHashrate;
    uint256 public totalEmitted;
    
    // 浜嬩欢
    event MinerRegistered(address indexed miner, uint256 hashrate);
    event HashrateUpdated(address indexed miner, uint256 oldHashrate, uint256 newHashrate);
    event RewardClaimed(address indexed miner, uint256 amount);
    event DifficultyAdjusted(uint256 newGlobalHashrate);
    event MinerDeactivated(address indexed miner, string reason);
    event RewardParametersUpdated(uint256 newRewardPerHash, uint256 newClaimCooldown);
    event SuspiciousActivityDetected(address indexed miner, uint256 score, string reason);
    
    constructor(address _superToken) {
        require(_superToken != address(0), "Invalid SUPER token address");
        superToken = IERC20(_superToken);
        lastDifficultyAdjustment = block.timestamp;
    }
    
    /**
     * @notice 鐭垮伐娉ㄥ唽
     * @param _hashrate 鍒濆绠楀姏
     * @param _deviceId 璁惧 ID (閾句笅鏍囪瘑)
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
     * @notice 鏇存柊鎸栫熆绠楀姏
     * @param _newHashrate 鏂扮畻鍔?
     */
    function updateHashrate(uint256 _newHashrate) external {
        require(registeredMiners[msg.sender], "Miner not registered");
        require(_newHashrate >= MIN_HASHRATE && _newHashrate <= MAX_HASHRATE, "Invalid hashrate");
        
        Miner storage miner = miners[msg.sender];
        require(miner.active, "Miner not active");
        
        // 妫€娴嬪紓甯哥畻鍔涘彉鍖?(绂荤嚎鍚庣獊鐒舵彁鍗?
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
     * @notice 璁＄畻寰呴鍙栧鍔?
     * @param _miner 鐭垮伐鍦板潃
     * @return 寰呴鍙栧鍔遍噾棰?
     */
    function calculatePendingReward(address _miner) public view returns (uint256) {
        require(registeredMiners[_miner], "Miner not registered");
        
        Miner storage miner = miners[_miner];
        if (!miner.active || miner.hashrate == 0) return miner.pendingReward;
        
        // 妫€鏌ラ攣浠撴湡
        if (block.timestamp < miner.registeredTime + lockupPeriod) {
            return miner.pendingReward;  // 閿佷粨鏈熷唴涓嶈绠楀鍔?
        }
        
        // 鏃堕棿宸?
        uint256 timePassed = block.timestamp - miner.lastClaimed;
        
        // 濂栧姳 = 鍏ㄥ眬鏃ヤ骇 * (璇ョ熆宸ョ畻鍔?/ 鍏ㄧ悆鎬荤畻鍔? * 鏃堕棿姣斾緥
        uint256 dailyGlobalReward = DAILY_EMISSION;
        uint256 minerShare = (dailyGlobalReward * miner.hashrate) / (totalActiveHashrate == 0 ? 1 : totalActiveHashrate);
        uint256 reward = (minerShare * timePassed) / (1 days);
        
        return miner.pendingReward + reward;
    }
    
    /**
     * @notice 棰嗗彇濂栧姳
     */
    function claimReward() external nonReentrant {
        require(registeredMiners[msg.sender], "Miner not registered");
        
        Miner storage miner = miners[msg.sender];
        require(miner.active, "Miner not active");
        
        // 妫€鏌ュ喎鍗?
        uint256 timeSinceLast = block.timestamp - miner.lastClaimed;
        require(timeSinceLast >= claimCooldown, "Claim cooldown not met");
        
        // 璁＄畻濂栧姳
        uint256 reward = calculatePendingReward(msg.sender);
        require(reward > 0, "No reward to claim");
        
        // 妫€娴嬩綔寮婅涓?
        if (timeSinceLast > 7 days && miner.hashrate > MIN_HASHRATE * 10) {
            // 7 澶╂湭棰嗗彇鍗存湁楂樼畻鍔?= 鍙枒
            miner.suspiciousScore += 5;
        }
        
        // 閲嶇疆寰呴鍙栧鍔卞拰鏈€鍚庨鍙栨椂闂?
        miner.pendingReward = 0;
        miner.lastClaimed = block.timestamp;
        miner.totalClaimed += reward;
        totalEmitted += reward;
        
        // 杞处 SUPER 浠ｅ竵
        require(superToken.transfer(msg.sender, reward), "Token transfer failed");
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    /**
     * @notice 璋冩暣闅惧害 (瀹氭湡璋冪敤)
     */
    function adjustDifficulty() external onlyOwner {
        require(block.timestamp >= lastDifficultyAdjustment + difficultyAdjustmentPeriod, "Too early to adjust");
        
        globalHashrate = totalActiveHashrate;
        lastDifficultyAdjustment = block.timestamp;
        
        emit DifficultyAdjusted(globalHashrate);
    }
    
    /**
     * @notice 鏇存柊濂栧姳鍙傛暟 (浠?Owner)
     * @param _rewardPerHash 姣忓崟浣嶇畻鍔涚殑濂栧姳
     * @param _claimCooldown 鏂扮殑鍐峰嵈鏃堕棿
     */
    function updateRewardParameters(uint256 _rewardPerHash, uint256 _claimCooldown) external onlyOwner {
        rewardPerHashPerDay = _rewardPerHash;
        claimCooldown = _claimCooldown;
        
        emit RewardParametersUpdated(_rewardPerHash, _claimCooldown);
    }
    
    /**
     * @notice 鍋滅敤鐭垮伐 (寮傚父妫€娴?
     * @param _miner 鐭垮伐鍦板潃
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
     * @notice 鑾峰彇鐭垮伐淇℃伅
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
     * @notice 鑾峰彇鍏ㄥ眬缁熻
     */
    function getGlobalStats() external view returns (
        uint256 totalEm,
        uint256 totalActive,
        uint256 minerCount
    ) {
        return (totalEmitted, totalActiveHashrate, totalMiners);
    }
}


