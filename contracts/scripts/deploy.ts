import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 MinerHub Smart Contracts Deployment Started");
  console.log("================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("✓ Deployer Address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("✓ Deployer Balance:", ethers.formatEther(balance), "ETH\n");

  // ========== 部署 MM Token ==========
  console.log("📦 Deploying MM Token...");
  const MM = await ethers.getContractFactory("MM");
  const mm = await MM.deploy();
  await mm.waitForDeployment();
  const mmAddress = await mm.getAddress();
  console.log("✓ MM Token deployed:", mmAddress);

  // ========== 部署 USDT Mock ==========
  console.log("\n📦 Deploying USDT Mock...");
  const USDT = await ethers.getContractFactory("USDT_Mock");
  const usdt = await USDT.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("✓ USDT Mock deployed:", usdtAddress);

  // ========== 部署 MiningPool ==========
  console.log("\n📦 Deploying MiningPool...");
  const MiningPool = await ethers.getContractFactory("MiningPool");
  const miningPool = await MiningPool.deploy(mmAddress);
  await miningPool.waitForDeployment();
  const miningPoolAddress = await miningPool.getAddress();
  console.log("✓ MiningPool deployed:", miningPoolAddress);

  // ========== 部署 SwapRouter ==========
  console.log("\n📦 Deploying SwapRouter...");
  const SwapRouter = await ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouter.deploy(mmAddress, usdtAddress);
  await swapRouter.waitForDeployment();
  const swapRouterAddress = await swapRouter.getAddress();
  console.log("✓ SwapRouter deployed:", swapRouterAddress);

  // ========== 配置合约权限 ==========
  console.log("\n🔐 Setting up contract permissions...");

  // MM Token: 添加 MiningPool 和 SwapRouter 为 Minter
  console.log("  Adding MiningPool as minter...");
  await mm.addMinter(miningPoolAddress);
  console.log("  ✓ MiningPool added as minter");

  console.log("  Adding SwapRouter as minter...");
  await mm.addMinter(swapRouterAddress);
  console.log("  ✓ SwapRouter added as minter");

  // ========== 初始化流动性池 ==========
  console.log("\n💧 Initializing liquidity pool...");
  
  const initialLiquidityMM = ethers.parseEther("50000000");  // 5000 万 MM
  const initialLiquidityUSDT = ethers.parseUnits("50000", 6); // 5 万 USDT

  // 检查 Deployer 持有的代币
  const mmBalance = await mm.balanceOf(deployer.address);
  const usdtBalance = await usdt.balanceOf(deployer.address);
  
  console.log("  Deployer MM balance:", ethers.formatEther(mmBalance));
  console.log("  Deployer USDT balance:", ethers.formatUnits(usdtBalance, 6));

  // 转账代币给 SwapRouter
  if (mmBalance >= initialLiquidityMM) {
    console.log("  Approving MM token...");
    await mm.approve(swapRouterAddress, initialLiquidityMM);
    console.log("  ✓ MM approved");
  } else {
    console.log("  ✗ Insufficient MM balance for liquidity!");
  }

  if (usdtBalance >= initialLiquidityUSDT) {
    console.log("  Approving USDT token...");
    await usdt.approve(swapRouterAddress, initialLiquidityUSDT);
    console.log("  ✓ USDT approved");
  } else {
    console.log("  ✗ Insufficient USDT balance for liquidity!");
  }

  // 初始化流动性
  console.log("  Initializing liquidity pool...");
  const initTx = await swapRouter.initializeLiquidity(initialLiquidityMM, initialLiquidityUSDT);
  const initReceipt = await initTx.wait();
  console.log("  ✓ Liquidity pool initialized");

  // ========== 验证配置 ==========
  console.log("\n✅ Verifying deployment...");
  const mmName = await mm.name();
  const mmSymbol = await mm.symbol();
  const mmSupply = await mm.totalMinted();
  console.log("  MM Token: ", mmName, "(" + mmSymbol + ")");
  console.log("  MM Total Minted:", ethers.formatEther(mmSupply));

  const usdtName = await usdt.name();
  const usdtSymbol = await usdt.symbol();
  console.log("  USDT Mock:", usdtName, "(" + usdtSymbol + ")");

  const poolReserveMM = await swapRouter.reserveMM();
  const poolReserveUSDT = await swapRouter.reserveUSDT();
  console.log("  SwapRouter MM Reserve:", ethers.formatEther(poolReserveMM));
  console.log("  SwapRouter USDT Reserve:", ethers.formatUnits(poolReserveUSDT, 6));

  // ========== 保存部署信息 ==========
  console.log("\n💾 Saving deployment addresses...");
  const deploymentInfo = {
    network: "sepolia",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MM: mmAddress,
      USDT_Mock: usdtAddress,
      MiningPool: miningPoolAddress,
      SwapRouter: swapRouterAddress
    },
    initialization: {
      liquidityMM: ethers.formatEther(initialLiquidityMM),
      liquidityUSDT: ethers.formatUnits(initialLiquidityUSDT, 6),
      mmMinters: [miningPoolAddress, swapRouterAddress]
    }
  };

  const outputPath = path.join(__dirname, "../deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✓ Deployment info saved to", outputPath);

  // ========== 输出 .env 配置 ==========
  console.log("\n📝 Add these to your .env.local (or .env):\n");
  console.log("# Sepolia Deployed Contracts");
  console.log(`VITE_MM_ADDRESS=${mmAddress}`);
  console.log(`VITE_MINING_POOL_ADDRESS=${miningPoolAddress}`);
  console.log(`VITE_SWAP_ROUTER_ADDRESS=${swapRouterAddress}`);
  console.log(`VITE_USDT_ADDRESS=${usdtAddress}`);
  console.log(`VITE_CHAIN_ID=11155111`);
  console.log(`VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY`);

  console.log("\n================================================");
  console.log("✅ Deployment Completed Successfully!\n");
  
  return deploymentInfo;
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
