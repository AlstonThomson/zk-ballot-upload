import React, { useState, useEffect } from 'react';
import './VoteReveal.css';

function VoteReveal({ contract, proposals, account, onSuccess }) {
  const [selectedProposal, setSelectedProposal] = useState('');
  const [salt, setSalt] = useState('');
  const [choice, setChoice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedCommitments, setSavedCommitments] = useState([]);

  useEffect(() => {
    // Load saved commitments from localStorage
    const stored = JSON.parse(localStorage.getItem('voteCommitments') || '[]');
    setSavedCommitments(stored);
  }, []);

  const revealProposals = proposals.filter(p => {
    const now = Math.floor(Date.now() / 1000);
    return p.state === 1 && now >= p.endTime && now < p.revealEndTime && p.hasVoted && !p.hasRevealed;
  });

  const handleRevealVote = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const tx = await contract.revealVote(
        selectedProposal,
        parseInt(choice),
        salt
      );

      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();

      // Remove from localStorage after successful reveal
      const stored = JSON.parse(localStorage.getItem('voteCommitments') || '[]');
      const updated = stored.filter(c => c.proposalId !== selectedProposal);
      localStorage.setItem('voteCommitments', JSON.stringify(updated));

      setSuccess('✅ Vote revealed successfully!');

      setTimeout(() => {
        onSuccess();
        setSelectedProposal('');
        setSalt('');
        setChoice('');
      }, 2000);

      setLoading(false);
    } catch (err) {
      console.error('Error revealing vote:', err);
      setError(err.message || 'Failed to reveal vote. Check your salt and choice.');
      setLoading(false);
    }
  };

  const loadCommitment = (proposalId) => {
    const commitment = savedCommitments.find(c => c.proposalId === proposalId);
    if (commitment) {
      setSelectedProposal(proposalId);
      setSalt(commitment.salt);
      setChoice(commitment.choice.toString());
    }
  };

  if (revealProposals.length === 0) {
    return null;
  }

  const getChoiceName = (choiceNum) => {
    const choices = ['Abstain', 'For', 'Against'];
    return choices[parseInt(choiceNum)] || 'Unknown';
  };

  return (
    <div className="vote-reveal-section">
      <div className="reveal-card">
        <h2>🔓 Reveal Your Votes</h2>
        <p className="subtitle">Reveal period is active for {revealProposals.length} proposal(s)</p>

        {savedCommitments.length > 0 && (
          <div className="saved-commitments">
            <h4>Saved Commitments</h4>
            {savedCommitments.map((c, idx) => {
              const proposal = proposals.find(p => p.id === parseInt(c.proposalId));
              if (!proposal || proposal.hasRevealed) return null;

              return (
                <div key={idx} className="commitment-card">
                  <div className="commitment-details">
                    <strong>Proposal #{c.proposalId}</strong>
                    <span className="choice-badge">{getChoiceName(c.choice)}</span>
                  </div>
                  <button
                    className="load-button"
                    onClick={() => loadCommitment(c.proposalId)}
                  >
                    Load
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleRevealVote}>
          <div className="form-group">
            <label>Select Proposal to Reveal</label>
            <select
              value={selectedProposal}
              onChange={(e) => setSelectedProposal(e.target.value)}
              required
            >
              <option value="">Choose a proposal...</option>
              {revealProposals.map(p => (
                <option key={p.id} value={p.id}>
                  #{p.id} - {p.title}
                </option>
              ))}
            </select>
          </div>

          {selectedProposal && (
            <>
              <div className="form-group">
                <label>Your Vote Choice</label>
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  required
                >
                  <option value="">Select your vote...</option>
                  <option value="0">Abstain</option>
                  <option value="1">For</option>
                  <option value="2">Against</option>
                </select>
              </div>

              <div className="form-group">
                <label>Salt (from commitment phase)</label>
                <input
                  type="text"
                  value={salt}
                  onChange={(e) => setSalt(e.target.value)}
                  placeholder="0x..."
                  required
                />
                <p className="help-text">
                  Enter the salt that was generated when you committed your vote
                </p>
              </div>
            </>
          )}

          {error && <div className="message error">{error}</div>}
          {success && <div className="message success">{success}</div>}

          <button
            type="submit"
            className="submit-button"
            disabled={loading || !selectedProposal}
          >
            {loading ? 'Revealing Vote...' : '🔓 Reveal Vote'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default VoteReveal;

