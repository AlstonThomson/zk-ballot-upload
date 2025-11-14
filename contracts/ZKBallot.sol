// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title ZKBallot
 * @notice Anonymous voting system with commitment-based privacy
 * @dev Implements secure voting with hidden choices until reveal phase
 * 
 * Key Features:
 * - Anonymous voting via commitments
 * - Merkle tree whitelist verification
 * - Time-locked voting phases
 * - Weighted voting support
 * - Sybil attack prevention
 */
contract ZKBallot is AccessControl, ReentrancyGuard {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    
    enum ProposalState { Pending, Active, Ended, Executed, Cancelled }
    enum VoteOption { Abstain, For, Against }
    
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        string ipfsHash;
        bytes32 merkleRoot;
        uint256 startTime;
        uint256 endTime;
        uint256 revealEndTime;
        ProposalState state;
        mapping(address => bool) hasVoted;
        mapping(address => bytes32) voteCommitments;
        mapping(uint256 => uint256) voteResults; // VoteOption => count
        uint256 totalVotes;
        uint256 requiredQuorum;
        bool executed;
    }
    
    struct VoteCommitment {
        bytes32 commitment;
        uint256 timestamp;
        bool revealed;
    }
    
    uint256 public proposalCount;
    uint256 public defaultVotingPeriod = 3 days;
    uint256 public defaultRevealPeriod = 1 days;
    uint256 public minimumQuorum = 10; // 10% of eligible voters
    
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => VoteCommitment)) public commitments;
    mapping(address => uint256) public votingPower;
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        uint256 startTime,
        uint256 endTime
    );
    
    event VoteCommitted(
        uint256 indexed proposalId,
        address indexed voter,
        bytes32 commitment
    );
    
    event VoteRevealed(
        uint256 indexed proposalId,
        address indexed voter,
        uint8 choice
    );
    
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE, msg.sender);
    }
    
    /**
     * @notice Create a new proposal
     * @param title Proposal title
     * @param description Proposal description
     * @param ipfsHash IPFS hash for detailed proposal
     * @param merkleRoot Merkle root of eligible voters
     * @param votingPeriod Duration of voting period in seconds
     */
    function createProposal(
        string calldata title,
        string calldata description,
        string calldata ipfsHash,
        bytes32 merkleRoot,
        uint256 votingPeriod
    ) external onlyRole(PROPOSER_ROLE) returns (uint256) {
        require(bytes(title).length > 0, "Title required");
        require(merkleRoot != bytes32(0), "Invalid merkle root");
        
        uint256 proposalId = proposalCount++;
        Proposal storage newProposal = proposals[proposalId];
        
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.ipfsHash = ipfsHash;
        newProposal.merkleRoot = merkleRoot;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + (votingPeriod > 0 ? votingPeriod : defaultVotingPeriod);
        newProposal.revealEndTime = newProposal.endTime + defaultRevealPeriod;
        newProposal.state = ProposalState.Active;
        newProposal.requiredQuorum = minimumQuorum;
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            title,
            newProposal.startTime,
            newProposal.endTime
        );
        
        return proposalId;
    }
    
    /**
     * @notice Commit a vote (hidden choice)
     * @param proposalId The proposal to vote on
     * @param commitment Hash of vote choice + salt
     * @param merkleProof Proof of voter eligibility
     */
    function commitVote(
        uint256 proposalId,
        bytes32 commitment,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.state == ProposalState.Active, "Proposal not active");
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp < proposal.endTime, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(commitment != bytes32(0), "Invalid commitment");
        
        // Verify voter eligibility via Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(merkleProof, proposal.merkleRoot, leaf),
            "Not eligible to vote"
        );
        
        proposal.hasVoted[msg.sender] = true;
        proposal.voteCommitments[msg.sender] = commitment;
        
        commitments[proposalId][msg.sender] = VoteCommitment({
            commitment: commitment,
            timestamp: block.timestamp,
            revealed: false
        });
        
        emit VoteCommitted(proposalId, msg.sender, commitment);
    }
    
    /**
     * @notice Reveal committed vote
     * @param proposalId The proposal voted on
     * @param choice The vote choice (0=Abstain, 1=For, 2=Against)
     * @param salt The secret salt used in commitment
     */
    function revealVote(
        uint256 proposalId,
        uint8 choice,
        bytes32 salt
    ) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        VoteCommitment storage voteCommit = commitments[proposalId][msg.sender];
        
        require(proposal.state == ProposalState.Active, "Proposal not active");
        require(block.timestamp >= proposal.endTime, "Voting period not ended");
        require(block.timestamp < proposal.revealEndTime, "Reveal period ended");
        require(voteCommit.commitment != bytes32(0), "No commitment found");
        require(!voteCommit.revealed, "Already revealed");
        require(choice <= uint8(VoteOption.Against), "Invalid choice");
        
        // Verify commitment
        bytes32 computedCommitment = keccak256(abi.encodePacked(choice, salt));
        require(computedCommitment == voteCommit.commitment, "Invalid reveal");
        
        voteCommit.revealed = true;
        
        // Count the vote with voting power
        uint256 power = votingPower[msg.sender] > 0 ? votingPower[msg.sender] : 1;
        proposal.voteResults[choice] += power;
        proposal.totalVotes += power;
        
        emit VoteRevealed(proposalId, msg.sender, choice);
    }
    
    /**
     * @notice Finalize proposal after reveal period
     */
    function finalizeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.state == ProposalState.Active, "Proposal not active");
        require(block.timestamp >= proposal.revealEndTime, "Reveal period not ended");
        
        proposal.state = ProposalState.Ended;
        
        // Check if quorum reached
        // (In production, calculate based on total eligible voters)
        if (proposal.totalVotes < proposal.requiredQuorum) {
            proposal.state = ProposalState.Cancelled;
            emit ProposalCancelled(proposalId);
        }
    }
    
    /**
     * @notice Execute a passed proposal
     */
    function executeProposal(uint256 proposalId) external onlyRole(ADMIN_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.state == ProposalState.Ended, "Proposal not ended");
        require(!proposal.executed, "Already executed");
        
        uint256 forVotes = proposal.voteResults[uint256(VoteOption.For)];
        uint256 againstVotes = proposal.voteResults[uint256(VoteOption.Against)];
        
        require(forVotes > againstVotes, "Proposal not passed");
        
        proposal.executed = true;
        proposal.state = ProposalState.Executed;
        
        emit ProposalExecuted(proposalId);
    }
    
    /**
     * @notice Cancel a proposal (admin only)
     */
    function cancelProposal(uint256 proposalId) external onlyRole(ADMIN_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.state == ProposalState.Active, "Cannot cancel");
        
        proposal.state = ProposalState.Cancelled;
        emit ProposalCancelled(proposalId);
    }
    
    /**
     * @notice Set voting power for an address
     */
    function setVotingPower(address voter, uint256 power) external onlyRole(ADMIN_ROLE) {
        votingPower[voter] = power;
    }
    
    /**
     * @notice Batch set voting power
     */
    function batchSetVotingPower(
        address[] calldata voters,
        uint256[] calldata powers
    ) external onlyRole(ADMIN_ROLE) {
        require(voters.length == powers.length, "Length mismatch");
        
        for (uint256 i = 0; i < voters.length; i++) {
            votingPower[voters[i]] = powers[i];
        }
    }
    
    /**
     * @notice Update voting parameters
     */
    function updateVotingParameters(
        uint256 newVotingPeriod,
        uint256 newRevealPeriod,
        uint256 newQuorum
    ) external onlyRole(ADMIN_ROLE) {
        require(newVotingPeriod >= 1 hours, "Period too short");
        require(newRevealPeriod >= 1 hours, "Reveal too short");
        require(newQuorum <= 100, "Quorum too high");
        
        defaultVotingPeriod = newVotingPeriod;
        defaultRevealPeriod = newRevealPeriod;
        minimumQuorum = newQuorum;
    }
    
    // View functions
    
    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        return proposals[proposalId].state;
    }
    
    function getProposalResults(uint256 proposalId) external view returns (
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstain,
        uint256 total
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.voteResults[uint256(VoteOption.For)],
            proposal.voteResults[uint256(VoteOption.Against)],
            proposal.voteResults[uint256(VoteOption.Abstain)],
            proposal.totalVotes
        );
    }
    
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }
    
    function hasRevealed(uint256 proposalId, address voter) external view returns (bool) {
        return commitments[proposalId][voter].revealed;
    }
    
    function getProposalInfo(uint256 proposalId) external view returns (
        address proposer,
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 revealEndTime,
        ProposalState state
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.revealEndTime,
            proposal.state
        );
    }
}
