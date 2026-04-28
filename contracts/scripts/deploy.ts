import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import * as path from "path";

function parseAdminAddresses(raw: string | undefined): string[] {
	if (!raw) return [];
	return Array.from(
		new Set(
			raw
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean)
				.map((item) => ethers.getAddress(item))
		)
	);
}

async function main() {
	console.log("Coin Planet Smart Contracts Deployment Started");
	console.log("================================================\n");

	const [deployer] = await ethers.getSigners();
	const additionalAdmins = parseAdminAddresses(process.env.DEPLOY_ADMIN_ADDRESSES).filter(
		(address) => address.toLowerCase() !== deployer.address.toLowerCase()
	);
	console.log("Deployer Address:", deployer.address);

	const balance = await ethers.provider.getBalance(deployer.address);
	console.log("Deployer Balance:", ethers.formatEther(balance), "BNB\n");

	console.log("Deploying SUPER Token...");
	const SuperTokenFactory = await ethers.getContractFactory("SUPER");
	const superToken = await upgrades.deployProxy(SuperTokenFactory, [deployer.address], {
		initializer: "initialize",
		kind: "uups",
	});
	await superToken.waitForDeployment();
	const superAddress = await superToken.getAddress();
	const superImplementation = await upgrades.erc1967.getImplementationAddress(superAddress);
	console.log("SUPER Token deployed:", superAddress);
	console.log("SUPER implementation:", superImplementation);

	const initialSuperMint = ethers.parseEther("600000000");
	const mintTx = await superToken.mint(deployer.address, initialSuperMint);
	await mintTx.wait();
	console.log("Minted initial SUPER:", ethers.formatEther(initialSuperMint));

	let usdtAddress: string;
	let usdt: any;
	if (process.env.USDT_REUSE_ADDRESS) {
		usdtAddress = process.env.USDT_REUSE_ADDRESS;
		console.log("\nUsing existing USDT:", usdtAddress);
		usdt = await ethers.getContractAt("IERC20", usdtAddress);
	} else {
		console.log("\nDeploying USDT Mock...");
		const USDT = await ethers.getContractFactory("USDT_Mock");
		usdt = await USDT.deploy();
		await usdt.waitForDeployment();
		usdtAddress = await usdt.getAddress();
		console.log("USDT Mock deployed:", usdtAddress);
	}

	console.log("\nDeploying MiningPool...");
	const MiningPool = await ethers.getContractFactory("MiningPool");
	const miningPool = await upgrades.deployProxy(MiningPool, [superAddress, deployer.address], {
		initializer: "initialize",
		kind: "uups",
	});
	await miningPool.waitForDeployment();
	const miningPoolAddress = await miningPool.getAddress();
	const miningPoolImplementation = await upgrades.erc1967.getImplementationAddress(miningPoolAddress);
	console.log("MiningPool deployed:", miningPoolAddress);
	console.log("MiningPool implementation:", miningPoolImplementation);

	console.log("\nDeploying SwapRouter...");
	const SwapRouter = await ethers.getContractFactory("SwapRouter");
	const swapRouter = await upgrades.deployProxy(SwapRouter, [superAddress, usdtAddress, deployer.address], {
		initializer: "initialize",
		kind: "uups",
	});
	await swapRouter.waitForDeployment();
	const swapRouterAddress = await swapRouter.getAddress();
	const swapRouterImplementation = await upgrades.erc1967.getImplementationAddress(swapRouterAddress);
	console.log("SwapRouter deployed:", swapRouterAddress);
	console.log("SwapRouter implementation:", swapRouterImplementation);

	console.log("\nSetting up contract permissions...");
	await (await superToken.addMinter(miningPoolAddress)).wait();
	await (await superToken.addMinter(swapRouterAddress)).wait();
	for (const adminAddress of additionalAdmins) {
		console.log("Adding chain admin:", adminAddress);
		await (await superToken.addAdmin(adminAddress)).wait();
		await (await miningPool.addAdmin(adminAddress)).wait();
		await (await swapRouter.addAdmin(adminAddress)).wait();
	}
	console.log("Permissions configured");

	console.log("\nInitializing liquidity pool...");
	const initialLiquiditySuper = ethers.parseEther("50000000");
	const initialLiquidityUSDT = ethers.parseUnits("50000", 18);

	const superBalance = await superToken.balanceOf(deployer.address);
	const usdtBalance = await usdt.balanceOf(deployer.address);
	console.log("Deployer SUPER:", ethers.formatEther(superBalance));
	console.log("Deployer USDT:", ethers.formatUnits(usdtBalance, 18));

	if (usdtBalance < initialLiquidityUSDT) {
		console.warn(`[WARNING] Deployer USDT Balance (${ethers.formatUnits(usdtBalance, 18)}) < Required (${ethers.formatUnits(initialLiquidityUSDT, 18)})`);
		console.warn("[WARNING] Skipping liquidity initialization! Please initialize manually after sending USDT.");
	} else {
		await (await superToken.approve(swapRouterAddress, ethers.MaxUint256)).wait();
		await (await usdt.approve(swapRouterAddress, ethers.MaxUint256)).wait();
		await (await swapRouter.initializeLiquidity(initialLiquiditySuper, initialLiquidityUSDT)).wait();
		console.log("Liquidity initialized");
	}

	const deploymentInfo = {
		network: "bsc",
		timestamp: new Date().toISOString(),
		deployer: deployer.address,
		contracts: {
			SUPER: superAddress,
			USDT_Mock: usdtAddress,
			MiningPool: miningPoolAddress,
			SwapRouter: swapRouterAddress,
		},
		implementations: {
			SUPER: superImplementation,
			MiningPool: miningPoolImplementation,
			SwapRouter: swapRouterImplementation,
		},
		initialization: {
			liquiditySuper: ethers.formatEther(initialLiquiditySuper),
			liquidityUSDT: ethers.formatUnits(initialLiquidityUSDT, 18),
			chainAdmins: [deployer.address, ...additionalAdmins],
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

