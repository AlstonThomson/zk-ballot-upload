import React, { useState } from 'react';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import './VoteCommit.css';

function VoteCommit({ contract, proposals, account, onSuccess }) {
  const [selectedProposal, setSelectedProposal] = useState('');
  const [voteChoice, setVoteChoice] = useState('');
  const [votersList, setVotersList] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [commitment, setCommitment] = useState(null);

  const activeProposals = proposals.filter(p => {
    const now = Math.floor(Date.now() / 1000);
    return p.state === 1 && now >= p.startTime && now < p.endTime && !p.hasVoted;
  });

  const handleCommitVote = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Generate random salt
      const salt = ethers.hexlify(ethers.randomBytes(32));

      // Create commitment
      const choice = parseInt(voteChoice);
      const commitmentHash = ethers.keccak256(
        ethers.solidityPacked(['uint8', 'bytes32'], [choice, salt])
      );

      // Parse voter addresses to generate Merkle proof
      const addresses = votersList
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);

      if (!addresses.includes(account)) {
        setError('Your address is not in the eligible voters list');
        setLoading(false);
        return;
      }

      // Generate Merkle tree and proof
      const leaves = addresses.map(addr => keccak256(addr));
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const leaf = keccak256(account);
      const proof = tree.getHexProof(leaf);

      // Submit vote commitment
      const tx = await contract.commitVote(
        selectedProposal,
        commitmentHash,
        proof
      );

      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();

      // Save commitment details for later reveal
      const commitmentData = {
        proposalId: selectedProposal,
        choice: choice,
        salt: salt,
        commitment: commitmentHash,
        timestamp: Date.now()
      };

      // Store in localStorage
      const stored = JSON.parse(localStorage.getItem('voteCommitments') || '[]');
      stored.push(commitmentData);
      localStorage.setItem('voteCommitments', JSON.stringify(stored));

      setCommitment(commitmentData);
      setSuccess('✅ Vote committed successfully! Save your salt for reveal phase.');

      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err) {
      console.error('Error committing vote:', err);
      setError(err.message || 'Failed to commit vote');
      setLoading(false);
    }
  };

  if (activeProposals.length === 0) {
    return null;
  }

  return (
    <div className="vote-commit-modal">
      <div className="modal-overlay" onClick={() => setSelectedProposal('')}></div>
      <div className="modal-content">
        <h2>🗳️ Cast Your Vote</h2>
        <p className="subtitle">Your vote will be hidden until the reveal phase</p>

        <form onSubmit={handleCommitVote}>
          <div className="form-group">
            <label>Select Proposal</label>
            <select
              value={selectedProposal}
              onChange={(e) => setSelectedProposal(e.target.value)}
              required
            >
              <option value="">Choose a proposal...</option>
              {activeProposals.map(p => (
                <option key={p.id} value={p.id}>
                  #{p.id} - {p.title}
                </option>
              ))}
            </select>
          </div>

          {selectedProposal && (
            <>
              <div className="form-group">
                <label>Your Vote</label>
                <div className="vote-options">
                  <label className={`vote-option ${voteChoice === '1' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="vote"
                      value="1"
                      checked={voteChoice === '1'}
                      onChange={(e) => setVoteChoice(e.target.value)}
                      required
                    />
                    <span className="option-label for">✓ For</span>
                  </label>

                  <label className={`vote-option ${voteChoice === '2' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="vote"
                      value="2"
                      checked={voteChoice === '2'}
                      onChange={(e) => setVoteChoice(e.target.value)}
                      required
                    />
                    <span className="option-label against">✗ Against</span>
                  </label>

                  <label className={`vote-option ${voteChoice === '0' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="vote"
                      value="0"
                      checked={voteChoice === '0'}
                      onChange={(e) => setVoteChoice(e.target.value)}
                      required
                    />
                    <span className="option-label abstain">○ Abstain</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Eligible Voters List (for Merkle proof)</label>
                <textarea
                  value={votersList}
                  onChange={(e) => setVotersList(e.target.value)}
                  placeholder="Paste the list of eligible voter addresses (one per line)"
                  rows="4"
                  required
                />
                <p className="help-text">
                  This must be the same list used when creating the proposal
                </p>
              </div>
            </>
          )}

          {commitment && (
            <div className="commitment-info">
              <h4>⚠️ IMPORTANT - Save this information!</h4>
              <div className="info-box">
                <p><strong>Salt:</strong></p>
                <code>{commitment.salt}</code>
                <p className="warning">
                  You MUST save this salt to reveal your vote later!
                </p>
              </div>
            </div>
          )}

          {error && <div className="message error">{error}</div>}
          {success && <div className="message success">{success}</div>}

          <button
            type="submit"
            className="submit-button"
            disabled={loading || !selectedProposal}
          >
            {loading ? 'Committing Vote...' : '🔒 Commit Vote'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default VoteCommit;

