import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("馃殌 Coin Planet Smart Contracts Deployment Started");
  console.log("================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("鉁?Deployer Address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("鉁?Deployer Balance:", ethers.formatEther(balance), "ETH\n");

  // ========== 閮ㄧ讲 SUPER Token ==========
  console.log("馃摝 Deploying SUPER Token...");
  const SuperTokenFactory = await ethers.getContractFactory("SUPER");
  const superToken = await SuperTokenFactory.deploy();
  await superToken.waitForDeployment();
  const superAddress = await superToken.getAddress();
  console.log("鉁?SUPER Token deployed:", superAddress);

  // Mint initial SUPER supply to deployer for liquidity/test initialization.
  const initialSuperMint = ethers.parseEther("600000000");
  const mintTx = await superToken.mint(deployer.address, initialSuperMint);
  await mintTx.wait();
  console.log("鉁?Minted initial SUPER to deployer:", ethers.formatEther(initialSuperMint));

  // ========== 閮ㄧ讲 USDT Mock ==========
  console.log("\n馃摝 Deploying USDT Mock...");
  const USDT = await ethers.getContractFactory("USDT_Mock");
  const usdt = await USDT.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("鉁?USDT Mock deployed:", usdtAddress);

  // ========== 閮ㄧ讲 MiningPool ==========
  console.log("\n馃摝 Deploying MiningPool...");
  const MiningPool = await ethers.getContractFactory("MiningPool");
  const miningPool = await MiningPool.deploy(superAddress);
  await miningPool.waitForDeployment();
  const miningPoolAddress = await miningPool.getAddress();
  console.log("鉁?MiningPool deployed:", miningPoolAddress);

  // ========== 閮ㄧ讲 SwapRouter ==========
  console.log("\n馃摝 Deploying SwapRouter...");
  const SwapRouter = await ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouter.deploy(superAddress, usdtAddress);
  await swapRouter.waitForDeployment();
  const swapRouterAddress = await swapRouter.getAddress();
  console.log("鉁?SwapRouter deployed:", swapRouterAddress);

  // ========== 閰嶇疆鍚堢害鏉冮檺 ==========
  console.log("\n馃攼 Setting up contract permissions...");

  // SUPER Token: 娣诲姞 MiningPool 鍜?SwapRouter 涓?Minter
  console.log("  Adding MiningPool as minter...");
  await superToken.addMinter(miningPoolAddress);
  console.log("  鉁?MiningPool added as minter");

  console.log("  Adding SwapRouter as minter...");
  await superToken.addMinter(swapRouterAddress);
  console.log("  鉁?SwapRouter added as minter");

  // ========== 鍒濆鍖栨祦鍔ㄦ€ф睜 ==========
  console.log("\n馃挧 Initializing liquidity pool...");
  
  const initialLiquiditySuper = ethers.parseEther("50000000");  // 5000 涓?SUPER
  const initialLiquidityUSDT = ethers.parseUnits("50000", 6); // 5 涓?USDT

  // 妫€鏌?Deployer 鎸佹湁鐨勪唬甯?
  const superBalance = await superToken.balanceOf(deployer.address);
  const usdtBalance = await usdt.balanceOf(deployer.address);
  
  console.log("  Deployer SUPER balance:", ethers.formatEther(superBalance));
  console.log("  Deployer USDT balance:", ethers.formatUnits(usdtBalance, 6));

  // 杞处浠ｅ竵缁?SwapRouter
  if (superBalance >= initialLiquiditySuper) {
    console.log("  Approving SUPER token...");
    await superToken.approve(swapRouterAddress, ethers.MaxUint256);
    console.log("  鉁?SUPER approved");
  } else {
    console.log("  鉁?Insufficient SUPER balance for liquidity!");
  }

  if (usdtBalance >= initialLiquidityUSDT) {
    console.log("  Approving USDT token...");
    await usdt.approve(swapRouterAddress, ethers.MaxUint256);
    console.log("  鉁?USDT approved");
  } else {
    console.log("  鉁?Insufficient USDT balance for liquidity!");
  }

  const superAllowance = await superToken.allowance(deployer.address, swapRouterAddress);
  const usdtAllowance = await usdt.allowance(deployer.address, swapRouterAddress);
  console.log("  SUPER allowance:", ethers.formatEther(superAllowance));
  console.log("  USDT allowance:", ethers.formatUnits(usdtAllowance, 6));

  // 鍒濆鍖栨祦鍔ㄦ€?
  console.log("  Initializing liquidity pool...");
  const initTx = await swapRouter.initializeLiquidity(initialLiquiditySuper, initialLiquidityUSDT);
  await initTx.wait();
  console.log("  鉁?Liquidity pool initialized");

  // ========== 楠岃瘉閰嶇疆 ==========
  console.log("\n鉁?Verifying deployment...");
  const superName = await superToken.name();
  const superSymbol = await superToken.symbol();
  const superSupply = await superToken.totalMinted();
  console.log("  SUPER Token: ", superName, "(" + superSymbol + ")");
  console.log("  SUPER Total Minted:", ethers.formatEther(superSupply));

  const usdtName = await usdt.name();
  const usdtSymbol = await usdt.symbol();
  console.log("  USDT Mock:", usdtName, "(" + usdtSymbol + ")");

  const poolReserveSuper = await swapRouter.reserveSuper();
  const poolReserveUSDT = await swapRouter.reserveUSDT();
  console.log("  SwapRouter SUPER Reserve:", ethers.formatEther(poolReserveSuper));
  console.log("  SwapRouter USDT Reserve:", ethers.formatUnits(poolReserveUSDT, 6));

  // ========== 淇濆瓨閮ㄧ讲淇℃伅 ==========
  console.log("\n馃捑 Saving deployment addresses...");
  const deploymentInfo = {
    network: "sepolia",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SUPER: superAddress,
      USDT_Mock: usdtAddress,
      MiningPool: miningPoolAddress,
      SwapRouter: swapRouterAddress
    },
    initialization: {
      liquiditySuper: ethers.formatEther(initialLiquiditySuper),
      liquidityUSDT: ethers.formatUnits(initialLiquidityUSDT, 6),
      superMinters: [miningPoolAddress, swapRouterAddress]
    }
  };

  const outputPath = path.join(__dirname, "../deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("鉁?Deployment info saved to", outputPath);

  // ========== 杈撳嚭 .env 閰嶇疆 ==========
  console.log("\n馃摑 Add these to your .env.local (or .env):\n");
  console.log("# Sepolia Deployed Contracts");
  console.log(`VITE_SUPER_ADDRESS=${superAddress}`);
  console.log(`VITE_MINING_POOL_ADDRESS=${miningPoolAddress}`);
  console.log(`VITE_SWAP_ROUTER_ADDRESS=${swapRouterAddress}`);
  console.log(`VITE_USDT_ADDRESS=${usdtAddress}`);
  console.log(`VITE_CHAIN_ID=11155111`);
  console.log(`VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY`);

  console.log("\n================================================");
  console.log("鉁?Deployment Completed Successfully!\n");
  
  return deploymentInfo;
}

main().catch((error) => {
  console.error("鉂?Deployment failed:", error);
  process.exitCode = 1;
});


