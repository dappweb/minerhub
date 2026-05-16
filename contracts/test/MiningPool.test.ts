import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import type { MiningPool, SUPER } from "../typechain-types";

describe("Coin Planet Contracts", () => {
  let SUPER: SUPER;
  let miningPool: MiningPool;
  let deployer: SignerWithAddress;
  let miner1: SignerWithAddress;
  let miner2: SignerWithAddress;
  let admin1: SignerWithAddress;

  async function deployContracts() {
    [deployer, miner1, miner2, admin1] = await ethers.getSigners();

    const SUPERFactory = await ethers.getContractFactory("SUPER");
    SUPER = await upgrades.deployProxy(SUPERFactory, [deployer.address], {
      initializer: "initialize",
      kind: "uups",
    }) as unknown as SUPER;

    const MiningPoolFactory = await ethers.getContractFactory("MiningPool");
    miningPool = await upgrades.deployProxy(MiningPoolFactory, [await SUPER.getAddress(), deployer.address], {
      initializer: "initialize",
      kind: "uups",
    }) as unknown as MiningPool;

    await SUPER.addMinter(await miningPool.getAddress());

    return { SUPER, miningPool, deployer, miner1, miner2 };
  }

  beforeEach(async () => {
    await deployContracts();
  });

  describe("SUPER Token", () => {
    it("Should have correct initial state", async () => {
      expect(await SUPER.name()).to.equal("Coin Planet Token");
      expect(await SUPER.symbol()).to.equal("SUPER");
      expect(await SUPER.decimals()).to.equal(18);
    });

    it("Should allow minting only by minter", async () => {
      const amount = ethers.parseEther("1000");
      
      // Minter 鍙互閾搁€?
      await expect(miningPool.registerMiner(1000, "device-1"))
        .to.emit(miningPool, "MinerRegistered");

      // 闈?Minter 鏃犳硶閾搁€?
      await expect(SUPER.connect(miner1).mint(miner1.address, amount))
        .to.be.revertedWith("Only minter or admin can mint");
    });

    it("Should allow admins to manage minters and mint", async () => {
      await SUPER.addAdmin(admin1.address);
      await SUPER.connect(admin1).addMinter(miner1.address);

      await expect(SUPER.connect(miner1).mint(miner2.address, ethers.parseEther("50")))
        .to.emit(SUPER, "TokensMinted");
    });
  });

  describe("MiningPool", () => {
    it("Should allow miner registration", async () => {
      await expect(miningPool.connect(miner1).registerMiner(1000, "device-1"))
        .to.emit(miningPool, "MinerRegistered")
        .withArgs(miner1.address, 1000);

      const info = await miningPool.getMinerInfo(miner1.address);
      expect(info.hashrate).to.equal(1000);
      expect(info.active).to.be.true;
    });

    it("Should prevent duplicate registration", async () => {
      await miningPool.connect(miner1).registerMiner(1000, "device-1");
      
      await expect(miningPool.connect(miner1).registerMiner(2000, "device-2"))
        .to.be.revertedWith("Miner already registered");
    });

    it("Should update hashrate", async () => {
      await miningPool.connect(miner2).registerMiner(1500, "device-2");
      
      await expect(miningPool.connect(miner2).updateHashrate(2000))
        .to.emit(miningPool, "HashrateUpdated");

      const info = await miningPool.getMinerInfo(miner2.address);
      expect(info.hashrate).to.equal(2000);
    });

    it("Should reject invalid hashrate", async () => {
      await expect(miningPool.connect(miner1).registerMiner(50, "device-3"))
        .to.be.revertedWith("Invalid hashrate");
    });

    it("Should bind referral once", async () => {
      await expect(miningPool.connect(miner1).bindReferral(miner2.address))
        .to.emit(miningPool, "ReferralBound")
        .withArgs(miner1.address, miner2.address);

      expect(await miningPool.referrerOf(miner1.address)).to.equal(miner2.address);
      await expect(miningPool.connect(miner1).bindReferral(deployer.address))
        .to.be.revertedWith("Referral already bound");
    });

    it("Should reject invalid referral binding", async () => {
      await expect(miningPool.connect(miner1).bindReferral(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid inviter");
      await expect(miningPool.connect(miner1).bindReferral(miner1.address))
        .to.be.revertedWith("Cannot bind self referral");
    });

    it("Should allow admins to run owner operations", async () => {
      await miningPool.addAdmin(admin1.address);

      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(miningPool.connect(admin1).adjustDifficulty())
        .to.emit(miningPool, "DifficultyAdjusted");
    });

    it("Should keep at least one admin", async () => {
      await expect(miningPool.removeAdmin(deployer.address))
        .to.be.revertedWith("Owner admin cannot be removed");

      await miningPool.addAdmin(admin1.address);
      await expect(miningPool.removeAdmin(admin1.address)).to.emit(miningPool, "AdminRemoved");
      await expect(miningPool.removeAdmin(admin1.address))
        .to.be.revertedWith("Admin does not exist");
    });

    it("Should gate rewards by SUPER stake above the minimum", async () => {
      const minStake = ethers.parseEther("100");
      const equalStake = minStake;
      const eligibleStake = ethers.parseEther("101");

      await miningPool.setMinSuperStakeForReward(minStake);
      await miningPool.connect(miner1).registerMiner(1000, "device-1");
      await miningPool.connect(miner2).registerMiner(1000, "device-2");

      await SUPER.mint(miner1.address, ethers.parseEther("1000"));
      await SUPER.mint(miner2.address, ethers.parseEther("1000"));
      await SUPER.mint(await miningPool.getAddress(), ethers.parseEther("10000000"));

      await SUPER.connect(miner1).approve(await miningPool.getAddress(), equalStake);
      await miningPool.connect(miner1).stakeSuper(equalStake);
      expect(await miningPool.isRewardEligible(miner1.address)).to.equal(false);
      expect(await miningPool.totalEligibleHashrate()).to.equal(0);

      await SUPER.connect(miner2).approve(await miningPool.getAddress(), eligibleStake);
      await miningPool.connect(miner2).stakeSuper(eligibleStake);
      expect(await miningPool.isRewardEligible(miner2.address)).to.equal(true);
      expect(await miningPool.totalEligibleHashrate()).to.equal(1000);

      await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      expect(await miningPool.calculatePendingReward(miner1.address)).to.equal(0n);
      expect(await miningPool.calculatePendingReward(miner2.address)).to.be.greaterThan(0n);

      await miningPool.connect(miner2).unstakeSuper(ethers.parseEther("2"));
      expect(await miningPool.isRewardEligible(miner2.address)).to.equal(false);
      expect(await miningPool.totalEligibleHashrate()).to.equal(0);
    });
  });

  describe("Integration", () => {
    it("End-to-end mining flow", async () => {
      await miningPool.connect(miner1).registerMiner(5000, "device-1");

      await ethers.provider.send("hardhat_mine", ["0x10"]); // 16 涓尯鍧?

      const pending = await miningPool.calculatePendingReward(miner1.address);
      const info = await miningPool.getMinerInfo(miner1.address);

      expect(info.hashrate).to.equal(5000);
      expect(info.active).to.equal(true);
      expect(pending).to.equal(0n);
    });
  });
});


