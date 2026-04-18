import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { MiningPool, SUPER, SwapRouter, USDT_Mock } from "../typechain-types";

describe("Coin Planet Contracts", () => {
  let SUPER: SUPER;
  let usdt: USDT_Mock;
  let miningPool: MiningPool;
  let swapRouter: SwapRouter;
  let deployer: SignerWithAddress;
  let miner1: SignerWithAddress;
  let miner2: SignerWithAddress;

  async function deployContracts() {
    [deployer, miner1, miner2] = await ethers.getSigners();

    const SUPERFactory = await ethers.getContractFactory("SUPER");
    SUPER = await SUPERFactory.deploy();

    const USDTFactory = await ethers.getContractFactory("USDT_Mock");
    usdt = await USDTFactory.deploy();

    const MiningPoolFactory = await ethers.getContractFactory("MiningPool");
    miningPool = await MiningPoolFactory.deploy(await SUPER.getAddress());

    const SwapRouterFactory = await ethers.getContractFactory("SwapRouter");
    swapRouter = await SwapRouterFactory.deploy(await SUPER.getAddress(), await usdt.getAddress());

    await SUPER.addMinter(await miningPool.getAddress());
    await SUPER.addMinter(await swapRouter.getAddress());

    return { SUPER, usdt, miningPool, swapRouter, deployer, miner1, miner2 };
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
        .to.be.revertedWith("Only minter or owner can mint");
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
  });

  describe("SwapRouter", () => {
    beforeEach(async () => {
      const initialSuper = ethers.parseEther("50000000");
      await SUPER.mint(deployer.address, initialSuper);

      const superAmount = ethers.parseEther("50000000");  // 5000 涓?SUPER
      const usdtAmount = ethers.parseUnits("50000", 18); // 5 涓?USDT

      await SUPER.approve(await swapRouter.getAddress(), superAmount);
      await usdt.approve(await swapRouter.getAddress(), usdtAmount);
      
      await swapRouter.initializeLiquidity(superAmount, usdtAmount);
    });

    it("Should initialize liquidity correctly", async () => {
      const reserveSuper = await swapRouter.reserveSuper();
      const reserveUSDT = await swapRouter.reserveUSDT();

      expect(reserveSuper).to.equal(ethers.parseEther("50000000"));
      expect(reserveUSDT).to.equal(ethers.parseUnits("50000", 18));
    });

    it("Should allow SUPER to USDT swap", async () => {
      // 缁?miner1 涓€浜?SUPER
      await SUPER.mint(miner1.address, ethers.parseEther("1000"));

      const swapAmount = ethers.parseEther("100");
      await SUPER.connect(miner1).approve(await swapRouter.getAddress(), swapAmount);

      const usdtBefore = await usdt.balanceOf(miner1.address);
      
      await swapRouter.connect(miner1).swapSuperToUsdt(swapAmount);
      
      const usdtAfter = await usdt.balanceOf(miner1.address);
      expect(usdtAfter).to.be.greaterThan(usdtBefore);
    });

    it("Should track price correctly", async () => {
      const price = await swapRouter.getPrice();
      expect(price).to.be.greaterThan(0);
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


