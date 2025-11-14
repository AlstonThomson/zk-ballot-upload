const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("ZKBallot", function () {
  let ballot;
  let owner, voter1, voter2, voter3;
  let merkleTree, merkleRoot;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    
    const ZKBallot = await ethers.getContractFactory("ZKBallot");
    ballot = await ZKBallot.deploy();
    await ballot.waitForDeployment();

    // Create Merkle tree for eligible voters
    const eligibleVoters = [voter1.address, voter2.address, voter3.address];
    const leaves = eligibleVoters.map(addr => keccak256(addr));
    merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getRoot();
  });

  describe("Deployment", function () {
    it("Should set the correct admin roles", async function () {
      const ADMIN_ROLE = await ballot.ADMIN_ROLE();
      expect(await ballot.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should have correct default parameters", async function () {
      expect(await ballot.defaultVotingPeriod()).to.equal(3 * 24 * 60 * 60);
      expect(await ballot.defaultRevealPeriod()).to.equal(24 * 60 * 60);
      expect(await ballot.minimumQuorum()).to.equal(10);
    });
  });

  describe("Proposal Creation", function () {
    it("Should create a proposal successfully", async function () {
      await expect(
        ballot.createProposal(
          "Test Proposal",
          "Description",
          "QmHash",
          merkleRoot,
          3 * 24 * 60 * 60
        )
      ).to.emit(ballot, "ProposalCreated");
    });

    it("Should reject proposal without title", async function () {
      await expect(
        ballot.createProposal("", "Description", "QmHash", merkleRoot, 0)
      ).to.be.revertedWith("Title required");
    });

    it("Should reject proposal with invalid merkle root", async function () {
      await expect(
        ballot.createProposal("Title", "Desc", "QmHash", ethers.ZeroHash, 0)
      ).to.be.revertedWith("Invalid merkle root");
    });
  });

  describe("Voting Process", function () {
    let proposalId;
    
    beforeEach(async function () {
      const tx = await ballot.createProposal(
        "Test Proposal",
        "Description",
        "QmHash",
        merkleRoot,
        3 * 24 * 60 * 60
      );
      const receipt = await tx.wait();
      proposalId = 0;
    });

    it("Should commit a vote with valid proof", async function () {
      const choice = 1; // For
      const salt = ethers.randomBytes(32);
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["uint8", "bytes32"], [choice, salt])
      );

      const leaf = keccak256(voter1.address);
      const proof = merkleTree.getHexProof(leaf);

      await expect(
        ballot.connect(voter1).commitVote(proposalId, commitment, proof)
      ).to.emit(ballot, "VoteCommitted");
    });

    it("Should reject vote from ineligible voter", async function () {
      const choice = 1;
      const salt = ethers.randomBytes(32);
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["uint8", "bytes32"], [choice, salt])
      );

      // Use wrong address for proof
      const leaf = keccak256(voter1.address);
      const proof = merkleTree.getHexProof(leaf);

      await expect(
        ballot.connect(owner).commitVote(proposalId, commitment, proof)
      ).to.be.revertedWith("Not eligible to vote");
    });

    it("Should reject double voting", async function () {
      const choice = 1;
      const salt = ethers.randomBytes(32);
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["uint8", "bytes32"], [choice, salt])
      );

      const leaf = keccak256(voter1.address);
      const proof = merkleTree.getHexProof(leaf);

      await ballot.connect(voter1).commitVote(proposalId, commitment, proof);

      await expect(
        ballot.connect(voter1).commitVote(proposalId, commitment, proof)
      ).to.be.revertedWith("Already voted");
    });
  });

  describe("Vote Reveal", function () {
    let proposalId, choice, salt, commitment, proof;

    beforeEach(async function () {
      // Create proposal
      await ballot.createProposal(
        "Test",
        "Desc",
        "QmHash",
        merkleRoot,
        1 // 1 second for testing
      );
      proposalId = 0;

      // Commit vote
      choice = 1;
      salt = ethers.randomBytes(32);
      commitment = ethers.keccak256(
        ethers.solidityPacked(["uint8", "bytes32"], [choice, salt])
      );

      const leaf = keccak256(voter1.address);
      proof = merkleTree.getHexProof(leaf);

      await ballot.connect(voter1).commitVote(proposalId, commitment, proof);
    });

    it("Should reveal vote correctly", async function () {
      // Wait for voting period to end
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine");

      await expect(
        ballot.connect(voter1).revealVote(proposalId, choice, salt)
      ).to.emit(ballot, "VoteRevealed");
    });

    it("Should reject reveal with wrong salt", async function () {
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine");

      const wrongSalt = ethers.randomBytes(32);
      await expect(
        ballot.connect(voter1).revealVote(proposalId, choice, wrongSalt)
      ).to.be.revertedWith("Invalid reveal");
    });
  });

  describe("Voting Power", function () {
    it("Should set voting power correctly", async function () {
      await ballot.setVotingPower(voter1.address, 100);
      expect(await ballot.votingPower(voter1.address)).to.equal(100);
    });

    it("Should batch set voting power", async function () {
      const voters = [voter1.address, voter2.address];
      const powers = [100, 200];

      await ballot.batchSetVotingPower(voters, powers);

      expect(await ballot.votingPower(voter1.address)).to.equal(100);
      expect(await ballot.votingPower(voter2.address)).to.equal(200);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to update parameters", async function () {
      await ballot.updateVotingParameters(
        7 * 24 * 60 * 60, // 7 days
        2 * 24 * 60 * 60, // 2 days
        20 // 20%
      );

      expect(await ballot.defaultVotingPeriod()).to.equal(7 * 24 * 60 * 60);
      expect(await ballot.defaultRevealPeriod()).to.equal(2 * 24 * 60 * 60);
      expect(await ballot.minimumQuorum()).to.equal(20);
    });

    it("Should reject non-admin parameter updates", async function () {
      await expect(
        ballot.connect(voter1).updateVotingParameters(1, 1, 1)
      ).to.be.reverted;
    });
  });
});
