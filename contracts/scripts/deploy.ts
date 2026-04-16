import * as fs from "fs";
import { ethers } from "hardhat";
import * as path from "path";

async function main() {
	console.log("Coin Planet Smart Contracts Deployment Started");
	console.log("================================================\n");

	const [deployer] = await ethers.getSigners();
	console.log("Deployer Address:", deployer.address);

	const balance = await ethers.provider.getBalance(deployer.address);
	console.log("Deployer Balance:", ethers.formatEther(balance), "BNB\n");

	console.log("Deploying SUPER Token...");
	const SuperTokenFactory = await ethers.getContractFactory("SUPER");
	const superToken = await SuperTokenFactory.deploy();
	await superToken.waitForDeployment();
	const superAddress = await superToken.getAddress();
	console.log("SUPER Token deployed:", superAddress);

	const initialSuperMint = ethers.parseEther("600000000");
	const mintTx = await superToken.mint(deployer.address, initialSuperMint);
	await mintTx.wait();
	console.log("Minted initial SUPER:", ethers.formatEther(initialSuperMint));

	console.log("\nDeploying USDT Mock...");
	const USDT = await ethers.getContractFactory("USDT_Mock");
	const usdt = await USDT.deploy();
	await usdt.waitForDeployment();
	const usdtAddress = await usdt.getAddress();
	console.log("USDT Mock deployed:", usdtAddress);

	console.log("\nDeploying MiningPool...");
	const MiningPool = await ethers.getContractFactory("MiningPool");
	const miningPool = await MiningPool.deploy(superAddress);
	await miningPool.waitForDeployment();
	const miningPoolAddress = await miningPool.getAddress();
	console.log("MiningPool deployed:", miningPoolAddress);

	console.log("\nDeploying SwapRouter...");
	const SwapRouter = await ethers.getContractFactory("SwapRouter");
	const swapRouter = await SwapRouter.deploy(superAddress, usdtAddress);
	await swapRouter.waitForDeployment();
	const swapRouterAddress = await swapRouter.getAddress();
	console.log("SwapRouter deployed:", swapRouterAddress);

	console.log("\nSetting up contract permissions...");
	await (await superToken.addMinter(miningPoolAddress)).wait();
	await (await superToken.addMinter(swapRouterAddress)).wait();
	console.log("Permissions configured");

	console.log("\nInitializing liquidity pool...");
	const initialLiquiditySuper = ethers.parseEther("50000000");
	const initialLiquidityUSDT = ethers.parseUnits("50000", 18);

	const superBalance = await superToken.balanceOf(deployer.address);
	const usdtBalance = await usdt.balanceOf(deployer.address);
	console.log("Deployer SUPER:", ethers.formatEther(superBalance));
	console.log("Deployer USDT:", ethers.formatUnits(usdtBalance, 18));

	await (await superToken.approve(swapRouterAddress, ethers.MaxUint256)).wait();
	await (await usdt.approve(swapRouterAddress, ethers.MaxUint256)).wait();
	await (await swapRouter.initializeLiquidity(initialLiquiditySuper, initialLiquidityUSDT)).wait();
	console.log("Liquidity initialized");

	const deploymentInfo = {
		network: "bscTestnet",
		timestamp: new Date().toISOString(),
		deployer: deployer.address,
		contracts: {
			SUPER: superAddress,
			USDT_Mock: usdtAddress,
			MiningPool: miningPoolAddress,
			SwapRouter: swapRouterAddress,
		},
		initialization: {
			liquiditySuper: ethers.formatEther(initialLiquiditySuper),
			liquidityUSDT: ethers.formatUnits(initialLiquidityUSDT, 18),
			superMinters: [miningPoolAddress, swapRouterAddress],
		},
	};

	const outputPath = path.join(__dirname, "../deployment.json");
	fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

	console.log("\nDeployment completed successfully");
	console.log("SUPER:", superAddress);
	console.log("USDT_Mock:", usdtAddress);
	console.log("MiningPool:", miningPoolAddress);
	console.log("SwapRouter:", swapRouterAddress);
}

main().catch((error) => {
	console.error("Deployment failed:", error);
	process.exitCode = 1;
});

