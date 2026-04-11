import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [signer] = await ethers.getSigners();
  const deploymentPath = path.join(__dirname, '../deployment.json');

  if (!fs.existsSync(deploymentPath)) {
    throw new Error('deployment.json not found. Deploy contracts first.');
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8')) as {
    contracts: {
      SUPER: string;
      USDT_Mock: string;
      MiningPool: string;
      SwapRouter: string;
    };
  };

  const superToken = await ethers.getContractAt('SUPER', deployment.contracts.SUPER, signer);
  const usdt = await ethers.getContractAt('USDT_Mock', deployment.contracts.USDT_Mock, signer);
  const miningPool = await ethers.getContractAt('MiningPool', deployment.contracts.MiningPool, signer);
  const swapRouter = await ethers.getContractAt('SwapRouter', deployment.contracts.SwapRouter, signer);

  const txHashes: string[] = [];

  // Ensure enough token balances for seeding.
  const extraSuper = ethers.parseEther('1000000');
  const mintTx = await superToken.mint(signer.address, extraSuper);
  await mintTx.wait();
  txHashes.push(mintTx.hash);

  const faucetTx = await usdt.faucet();
  await faucetTx.wait();
  txHashes.push(faucetTx.hash);

  // Seed swap activities.
  for (const amount of ['1000', '1500', '2000']) {
    const amountWei = ethers.parseEther(amount);
    const approveTx = await superToken.approve(await swapRouter.getAddress(), amountWei);
    await approveTx.wait();
    txHashes.push(approveTx.hash);

    const swapTx = await swapRouter.swapSuperToUsdt(amountWei);
    await swapTx.wait();
    txHashes.push(swapTx.hash);
  }

  for (const amount of ['5', '8']) {
    const amountUsdt = ethers.parseUnits(amount, 6);
    const approveUsdtTx = await usdt.approve(await swapRouter.getAddress(), amountUsdt);
    await approveUsdtTx.wait();
    txHashes.push(approveUsdtTx.hash);

    const swapBackTx = await swapRouter.swapUsdtToSuper(amountUsdt);
    await swapBackTx.wait();
    txHashes.push(swapBackTx.hash);
  }

  // Seed mining activity.
  try {
    const regTx = await miningPool.registerMiner(1500, `seed-${Date.now()}`);
    await regTx.wait();
    txHashes.push(regTx.hash);
  } catch {
    // If already registered, continue and just update hashrate.
  }

  for (const rate of [1800, 2200, 2600]) {
    const updateTx = await miningPool.updateHashrate(rate);
    await updateTx.wait();
    txHashes.push(updateTx.hash);
  }

  const stats = await miningPool.getGlobalStats();
  const reserveSuper = await swapRouter.reserveSuper();
  const reserveUsdt = await swapRouter.reserveUSDT();

  const summary = {
    seededAt: new Date().toISOString(),
    wallet: signer.address,
    txCount: txHashes.length,
    txHashes,
    onChainSnapshot: {
      totalEmitted: stats[0].toString(),
      totalActiveHashrate: stats[1].toString(),
      totalMiners: stats[2].toString(),
      reserveSuper: reserveSuper.toString(),
      reserveUSDT: reserveUsdt.toString(),
    },
  };

  const outPath = path.join(__dirname, '../seed-data.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('Seed completed.');
  console.log('Seed file:', outPath);
  console.log('Transactions:', txHashes.length);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
