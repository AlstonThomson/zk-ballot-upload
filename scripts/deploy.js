const hre = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

async function main() {
  console.log("Deploying ZKBallot Voting System...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy ZKBallot
  console.log("Deploying ZKBallot contract...");
  const ZKBallot = await hre.ethers.getContractFactory("ZKBallot");
  const ballot = await ZKBallot.deploy();
  await ballot.waitForDeployment();
  
  const ballotAddress = await ballot.getAddress();
  console.log("✓ ZKBallot deployed to:", ballotAddress);

  // Setup demo voting power
  console.log("\nSetting up voting power...");
  const voters = [deployer.address];
  const powers = [100];
  
  await ballot.batchSetVotingPower(voters, powers);
  console.log("✓ Voting power configured");

  // Create a demo Merkle tree for eligible voters
  console.log("\nGenerating Merkle tree for eligible voters...");
  const eligibleVoters = [
    deployer.address,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Example addresses
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  ];
  
  const leaves = eligibleVoters.map(addr => keccak256(addr));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot();
  
  console.log("✓ Merkle root:", "0x" + root.toString('hex'));

  // Create a demo proposal
  console.log("\nCreating demo proposal...");
  try {
    const tx = await ballot.createProposal(
      "Increase Platform Fee",
      "Proposal to increase the platform fee from 0.3% to 0.5% to fund development",
      "QmHash...", // IPFS hash placeholder
      "0x" + root.toString('hex'),
      3 * 24 * 60 * 60 // 3 days
    );
    await tx.wait();
    console.log("✓ Demo proposal created (ID: 0)");
  } catch (error) {
    console.log("Note: Demo proposal creation skipped");
  }

  console.log("\n" + "=".repeat(70));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(70));
  console.log("Contract Address:", ballotAddress);
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Voting Period:", "3 days");
  console.log("Reveal Period:", "1 day");
  console.log("Minimum Quorum:", "10%");
  console.log("=".repeat(70));

  // Save deployment info
  const fs = require("fs");
  const deploymentData = {
    network: hre.network.name,
    contractAddress: ballotAddress,
    deployer: deployer.address,
    merkleRoot: "0x" + root.toString('hex'),
    eligibleVoters: eligibleVoters,
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }

  const filename = `deployments/${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentData, null, 2));
  console.log("\nDeployment info saved to:", filename);
  
  console.log("\nImportant: Save the Merkle root for creating proposals!");
  console.log("Merkle Root:", "0x" + root.toString('hex'));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
