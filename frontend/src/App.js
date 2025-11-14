import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WalletConnect from './components/WalletConnect';
import ProposalList from './components/ProposalList';
import CreateProposal from './components/CreateProposal';
import VoteCommit from './components/VoteCommit';
import VoteReveal from './components/VoteReveal';
import './App.css';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS;
const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID || '11155111');

const CONTRACT_ABI = [
  "function proposalCount() view returns (uint256)",
  "function getProposalInfo(uint256 proposalId) view returns (address proposer, string title, string description, uint256 startTime, uint256 endTime, uint256 revealEndTime, uint8 state)",
  "function getProposalResults(uint256 proposalId) view returns (uint256 forVotes, uint256 againstVotes, uint256 abstain, uint256 total)",
  "function hasVoted(uint256 proposalId, address voter) view returns (bool)",
  "function hasRevealed(uint256 proposalId, address voter) view returns (bool)",
  "function createProposal(string title, string description, string ipfsHash, bytes32 merkleRoot, uint256 votingPeriod) returns (uint256)",
  "function commitVote(uint256 proposalId, bytes32 commitment, bytes32[] merkleProof)",
  "function revealVote(uint256 proposalId, uint8 choice, bytes32 salt)",
  "function finalizeProposal(uint256 proposalId)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function PROPOSER_ROLE() view returns (bytes32)"
];

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProposer, setIsProposer] = useState(false);
  const [activeTab, setActiveTab] = useState('proposals');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account && provider) {
      initContract();
    }
  }, [account, provider]);

  useEffect(() => {
    if (contract && account) {
      loadProposals();
      checkRoles();
    }
  }, [contract, account]);

  const initContract = async () => {
    try {
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setContract(contractInstance);
    } catch (error) {
      console.error("Error initializing contract:", error);
    }
  };

  const checkRoles = async () => {
    try {
      const adminRole = await contract.ADMIN_ROLE();
      const proposerRole = await contract.PROPOSER_ROLE();
      const hasAdminRole = await contract.hasRole(adminRole, account);
      const hasProposerRole = await contract.hasRole(proposerRole, account);
      setIsAdmin(hasAdminRole);
      setIsProposer(hasProposerRole);
    } catch (error) {
      console.error("Error checking roles:", error);
    }
  };

  const loadProposals = async () => {
    try {
      setLoading(true);
      const count = await contract.proposalCount();
      const proposalList = [];

      for (let i = 0; i < Number(count); i++) {
        const info = await contract.getProposalInfo(i);
        const results = await contract.getProposalResults(i);
        const voted = await contract.hasVoted(i, account);
        const revealed = await contract.hasRevealed(i, account);

        proposalList.push({
          id: i,
          proposer: info[0],
          title: info[1],
          description: info[2],
          startTime: Number(info[3]),
          endTime: Number(info[4]),
          revealEndTime: Number(info[5]),
          state: Number(info[6]),
          forVotes: Number(results[0]),
          againstVotes: Number(results[1]),
          abstain: Number(results[2]),
          totalVotes: Number(results[3]),
          hasVoted: voted,
          hasRevealed: revealed
        });
      }

      setProposals(proposalList.reverse());
      setLoading(false);
    } catch (error) {
      console.error("Error loading proposals:", error);
      setLoading(false);
    }
  };

  const handleWalletConnect = (walletAccount, walletProvider) => {
    setAccount(walletAccount);
    setProvider(walletProvider);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>🗳️ ZK-Ballot</h1>
          <p className="subtitle">Anonymous Voting with Zero-Knowledge Proofs</p>
        </div>
        <WalletConnect onConnect={handleWalletConnect} />
      </header>

      {!account ? (
        <div className="welcome-section">
          <div className="welcome-card">
            <h2>Welcome to ZK-Ballot</h2>
            <p>A decentralized anonymous voting system with commitment-based privacy</p>
            <div className="features">
              <div className="feature">
                <span className="icon">🔒</span>
                <h3>Anonymous Voting</h3>
                <p>Votes hidden until reveal phase</p>
              </div>
              <div className="feature">
                <span className="icon">🌲</span>
                <h3>Merkle Tree Verification</h3>
                <p>Cryptographic eligibility proofs</p>
              </div>
              <div className="feature">
                <span className="icon">⏱️</span>
                <h3>Time-Locked Phases</h3>
                <p>Separate voting and reveal periods</p>
              </div>
              <div className="feature">
                <span className="icon">⚖️</span>
                <h3>Weighted Voting</h3>
                <p>Configurable voting power</p>
              </div>
            </div>
            <div className="cta">
              <p>Connect your wallet to get started</p>
            </div>
          </div>
        </div>
      ) : (
        <main className="main-content">
          <div className="tabs">
            <button
              className={activeTab === 'proposals' ? 'active' : ''}
              onClick={() => setActiveTab('proposals')}
            >
              📋 Proposals
            </button>
            {(isAdmin || isProposer) && (
              <button
                className={activeTab === 'create' ? 'active' : ''}
                onClick={() => setActiveTab('create')}
              >
                ➕ Create Proposal
              </button>
            )}
          </div>

          <div className="tab-content">
            {activeTab === 'proposals' && (
              <ProposalList
                proposals={proposals}
                loading={loading}
                onRefresh={loadProposals}
                account={account}
              />
            )}
            {activeTab === 'create' && (isAdmin || isProposer) && (
              <CreateProposal
                contract={contract}
                onSuccess={() => {
                  loadProposals();
                  setActiveTab('proposals');
                }}
              />
            )}
          </div>

          {contract && (
            <>
              <VoteCommit
                contract={contract}
                proposals={proposals}
                account={account}
                onSuccess={loadProposals}
              />
              <VoteReveal
                contract={contract}
                proposals={proposals}
                account={account}
                onSuccess={loadProposals}
              />
            </>
          )}
        </main>
      )}

      <footer className="App-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">
              📄 Contract
            </a>
            <a href="https://github.com/AlstonThomson/zk-ballot-upload" target="_blank" rel="noopener noreferrer">
              💻 GitHub
            </a>
          </div>
          <p>Built with ❤️ for privacy-preserving governance</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

