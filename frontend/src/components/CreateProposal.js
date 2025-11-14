import React, { useState } from 'react';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import './CreateProposal.css';

function CreateProposal({ contract, onSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [voterAddresses, setVoterAddresses] = useState('');
  const [votingDays, setVotingDays] = useState('3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Parse voter addresses
      const addresses = voterAddresses
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);

      if (addresses.length === 0) {
        setError('Please provide at least one voter address');
        setLoading(false);
        return;
      }

      // Generate Merkle tree
      const leaves = addresses.map(addr => keccak256(addr));
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = tree.getRoot();
      const merkleRoot = '0x' + root.toString('hex');

      // Calculate voting period in seconds
      const votingPeriod = parseInt(votingDays) * 24 * 60 * 60;

      // Create proposal
      const tx = await contract.createProposal(
        title,
        description,
        'QmHash...', // IPFS hash placeholder
        merkleRoot,
        votingPeriod
      );

      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();

      setSuccess('✅ Proposal created successfully!');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err.message || 'Failed to create proposal');
      setLoading(false);
    }
  };

  return (
    <div className="create-proposal">
      <h2>Create New Proposal</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter proposal title"
            required
          />
        </div>

        <div className="form-group">
          <label>Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your proposal in detail"
            rows="4"
            required
          />
        </div>

        <div className="form-group">
          <label>Eligible Voters (one address per line) *</label>
          <textarea
            value={voterAddresses}
            onChange={(e) => setVoterAddresses(e.target.value)}
            placeholder="0x1234...&#10;0x5678...&#10;0xabcd..."
            rows="6"
            required
          />
          <p className="help-text">
            Enter Ethereum addresses of eligible voters. A Merkle tree will be generated automatically.
          </p>
        </div>

        <div className="form-group">
          <label>Voting Period (days) *</label>
          <input
            type="number"
            value={votingDays}
            onChange={(e) => setVotingDays(e.target.value)}
            min="1"
            max="30"
            required
          />
          <p className="help-text">
            Duration for voting phase. Reveal period will be 1 day after voting ends.
          </p>
        </div>

        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <button
          type="submit"
          className="submit-button"
          disabled={loading}
        >
          {loading ? 'Creating Proposal...' : '✨ Create Proposal'}
        </button>
      </form>
    </div>
  );
}

export default CreateProposal;

