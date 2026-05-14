import * as fs from 'fs';
import { ethers } from 'hardhat';
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
      MiningPool: string;
    };
  };

  const superToken = await ethers.getContractAt('SUPER', deployment.contracts.SUPER, signer);
  const miningPool = await ethers.getContractAt('MiningPool', deployment.contracts.MiningPool, signer);

  const txHashes: string[] = [];

  // Ensure enough token balances for seeding.
  const extraSuper = ethers.parseEther('1000000');
  const mintTx = await superToken.mint(signer.address, extraSuper);
  await mintTx.wait();
  txHashes.push(mintTx.hash);

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

  const summary = {
    seededAt: new Date().toISOString(),
    wallet: signer.address,
    txCount: txHashes.length,
    txHashes,
    onChainSnapshot: {
      totalEmitted: stats[0].toString(),
      totalActiveHashrate: stats[1].toString(),
      totalMiners: stats[2].toString(),
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
