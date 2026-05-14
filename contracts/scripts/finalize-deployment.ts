import * as fs from 'fs';
import { ethers } from 'hardhat';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();

  const superAddress = process.env.SUPER_ADDRESS as string;
  const usdtAddress = process.env.USDT_ADDRESS as string;
  const miningPoolAddress = process.env.MINING_POOL_ADDRESS as string;

  if (!superAddress || !usdtAddress || !miningPoolAddress) {
    throw new Error('Missing one of SUPER_ADDRESS/USDT_ADDRESS/MINING_POOL_ADDRESS');
  }

  const superToken = await ethers.getContractAt('SUPER', superAddress, deployer);

  const isMiningPoolMinter = await superToken.isMinter(miningPoolAddress);
  if (!isMiningPoolMinter) {
    const tx = await superToken.addMinter(miningPoolAddress);
    await tx.wait();
  }

  const deploymentInfo = {
    network: 'bsc',
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SUPER: superAddress,
      USDT: usdtAddress,
      MiningPool: miningPoolAddress,
    },
    initialization: {
      superMinters: [miningPoolAddress],
    },
  };

  const outputPath = path.join(__dirname, '../deployment.json');
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

  console.log('Finalize completed.');
  console.log('deployment.json written:', outputPath);
  console.log('SUPER:', superAddress);
  console.log('USDT:', usdtAddress);
  console.log('MiningPool:', miningPoolAddress);
}

main().catch((error) => {
  console.error('Finalize failed:', error);
  process.exitCode = 1;
});
