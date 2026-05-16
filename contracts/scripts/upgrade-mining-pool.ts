import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import * as path from "path";

type DeploymentInfo = {
  network?: string;
  timestamp?: string;
  deployer?: string;
  contracts?: {
    SUPER?: string;
    USDT?: string;
    MiningPool?: string;
  };
  implementations?: {
    SUPER?: string;
    MiningPool?: string;
  };
};

function readDeploymentInfo(): { path: string; info: DeploymentInfo } {
  const deploymentPath = path.join(__dirname, "../deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Missing deployment file: ${deploymentPath}`);
  }

  const info = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentInfo;
  if (!info.contracts?.MiningPool) {
    throw new Error("deployment.json is missing contracts.MiningPool");
  }

  return { path: deploymentPath, info };
}

async function main() {
  const { path: deploymentPath, info } = readDeploymentInfo();
  const proxyAddress = ethers.getAddress(info.contracts!.MiningPool!);
  const [deployer] = await ethers.getSigners();

  console.log("Coin Planet MiningPool Upgrade Started");
  console.log("=======================================\n");
  console.log("Network:", info.network ?? "unknown");
  console.log("Proxy:", proxyAddress);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(balance), "BNB\n");

  const MiningPool = await ethers.getContractFactory("MiningPool");

  try {
    await upgrades.forceImport(proxyAddress, MiningPool, { kind: "uups" });
    console.log("Proxy imported into local OpenZeppelin manifest");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already registered")) {
      throw error;
    }
    console.log("Proxy already present in local OpenZeppelin manifest");
  }

  const upgraded = await upgrades.upgradeProxy(proxyAddress, MiningPool, { kind: "uups" });
  await upgraded.waitForDeployment();

  const implementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  info.timestamp = new Date().toISOString();
  info.deployer = deployer.address;
  info.implementations = {
    ...(info.implementations ?? {}),
    MiningPool: implementation,
  };
  fs.writeFileSync(deploymentPath, JSON.stringify(info, null, 2));

  console.log("\nMiningPool upgrade completed successfully");
  console.log("Proxy:", proxyAddress);
  console.log("Implementation:", implementation);
}

main().catch((error) => {
  console.error("MiningPool upgrade failed:", error);
  process.exitCode = 1;
});
