import * as fs from 'fs';
import { ethers } from 'hardhat';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();

  const superAddress = process.env.SUPER_ADDRESS as string;
  const usdtAddress = process.env.USDT_ADDRESS as string;
  const miningPoolAddress = process.env.MINING_POOL_ADDRESS as string;
  const swapRouterAddress = process.env.SWAP_ROUTER_ADDRESS as string;

  if (!superAddress || !usdtAddress || !miningPoolAddress || !swapRouterAddress) {
    throw new Error('Missing one of SUPER_ADDRESS/USDT_ADDRESS/MINING_POOL_ADDRESS/SWAP_ROUTER_ADDRESS');
  }

  const superToken = await ethers.getContractAt('SUPER', superAddress, deployer);
  const usdt = await ethers.getContractAt('USDT_Mock', usdtAddress, deployer);
  const miningPool = await ethers.getContractAt('MiningPool', miningPoolAddress, deployer);
  const swapRouter = await ethers.getContractAt('SwapRouter', swapRouterAddress, deployer);

  const isMiningPoolMinter = await superToken.isMinter(miningPoolAddress);
  if (!isMiningPoolMinter) {
    const tx = await superToken.addMinter(miningPoolAddress);
    await tx.wait();
  }

  const isSwapRouterMinter = await superToken.isMinter(swapRouterAddress);
  if (!isSwapRouterMinter) {
    const tx = await superToken.addMinter(swapRouterAddress);
    await tx.wait();
  }

  const minRequiredSuper = ethers.parseEther('50000000');
  const superBalance = await superToken.balanceOf(deployer.address);
  if (superBalance < minRequiredSuper) {
    const mintTx = await superToken.mint(deployer.address, ethers.parseEther('100000000'));
    await mintTx.wait();
  }

  const minRequiredUsdt = ethers.parseUnits('50000', 18);
  const usdtBalance = await usdt.balanceOf(deployer.address);
  if (usdtBalance < minRequiredUsdt) {
    const faucetTx = await usdt.faucet();
    await faucetTx.wait();
  }

  const reserveSuper = await swapRouter.reserveSuper();
  const reserveUsdt = await swapRouter.reserveUSDT();

  if (reserveSuper === 0n && reserveUsdt === 0n) {
    const approveSuperTx = await superToken.approve(swapRouterAddress, ethers.MaxUint256);
    await approveSuperTx.wait();

    const approveUsdtTx = await usdt.approve(swapRouterAddress, ethers.MaxUint256);
    await approveUsdtTx.wait();

    const initTx = await swapRouter.initializeLiquidity(minRequiredSuper, minRequiredUsdt);
    await initTx.wait();
  }

  const deploymentInfo = {
    network: 'bscTestnet',
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SUPER: superAddress,
      USDT_Mock: usdtAddress,
      MiningPool: miningPoolAddress,
      SwapRouter: swapRouterAddress,
    },
    initialization: {
      liquiditySuper: ethers.formatEther(minRequiredSuper),
      liquidityUSDT: ethers.formatUnits(minRequiredUsdt, 18),
      superMinters: [miningPoolAddress, swapRouterAddress],
    },
  };

  const outputPath = path.join(__dirname, '../deployment.json');
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

  console.log('Finalize completed.');
  console.log('deployment.json written:', outputPath);
  console.log('SUPER:', superAddress);
  console.log('USDT:', usdtAddress);
  console.log('MiningPool:', miningPoolAddress);
  console.log('SwapRouter:', swapRouterAddress);
}

main().catch((error) => {
  console.error('Finalize failed:', error);
  process.exitCode = 1;
});
