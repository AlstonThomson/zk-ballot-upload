import React from 'react';
import './ProposalList.css';

const STATE_NAMES = ['Pending', 'Active', 'Ended', 'Executed', 'Cancelled'];

function ProposalList({ proposals, loading, onRefresh, account }) {
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getTimeRemaining = (endTime) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = endTime - now;

    if (remaining <= 0) return 'Ended';

    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const getPhase = (proposal) => {
    const now = Math.floor(Date.now() / 1000);

    if (now < proposal.startTime) return 'Not Started';
    if (now < proposal.endTime) return 'Voting Phase';
    if (now < proposal.revealEndTime) return 'Reveal Phase';
    return 'Finalized';
  };

  const calculatePercentages = (proposal) => {
    const total = proposal.forVotes + proposal.againstVotes + proposal.abstain;
    if (total === 0) return { for: 0, against: 0, abstain: 0 };

    return {
      for: ((proposal.forVotes / total) * 100).toFixed(1),
      against: ((proposal.againstVotes / total) * 100).toFixed(1),
      abstain: ((proposal.abstain / total) * 100).toFixed(1),
    };
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading proposals...</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="empty-state">
        <p>📭 No proposals yet</p>
        <p className="hint">Create the first proposal to get started!</p>
      </div>
    );
  }

  return (
    <div className="proposal-list">
      <div className="list-header">
        <h2>Active Proposals</h2>
        <button className="refresh-button" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>

      <div className="proposals">
        {proposals.map((proposal) => {
          const percentages = calculatePercentages(proposal);
          const phase = getPhase(proposal);

          return (
            <div key={proposal.id} className="proposal-card">
              <div className="proposal-header">
                <div className="proposal-title">
                  <h3>{proposal.title}</h3>
                  <span className={`status status-${proposal.state}`}>
                    {STATE_NAMES[proposal.state]}
                  </span>
                </div>
                <span className="proposal-id">#{proposal.id}</span>
              </div>

              <p className="proposal-description">{proposal.description}</p>

              <div className="proposal-meta">
                <div className="meta-item">
                  <span className="label">Phase:</span>
                  <span className="value phase">{phase}</span>
                </div>
                <div className="meta-item">
                  <span className="label">Time:</span>
                  <span className="value">{getTimeRemaining(proposal.endTime)}</span>
                </div>
              </div>

              <div className="voting-status">
                {proposal.hasVoted && (
                  <span className="badge voted">✓ You voted</span>
                )}
                {proposal.hasRevealed && (
                  <span className="badge revealed">✓ Revealed</span>
                )}
              </div>

              <div className="results">
                <h4>Results ({proposal.totalVotes} votes)</h4>
                <div className="result-bar">
                  <div className="bar">
                    <div
                      className="fill for"
                      style={{ width: `${percentages.for}%` }}
                    ></div>
                  </div>
                  <div className="result-label">
                    <span>For: {proposal.forVotes}</span>
                    <span>{percentages.for}%</span>
                  </div>
                </div>

                <div className="result-bar">
                  <div className="bar">
                    <div
                      className="fill against"
                      style={{ width: `${percentages.against}%` }}
                    ></div>
                  </div>
                  <div className="result-label">
                    <span>Against: {proposal.againstVotes}</span>
                    <span>{percentages.against}%</span>
                  </div>
                </div>

                <div className="result-bar">
                  <div className="bar">
                    <div
                      className="fill abstain"
                      style={{ width: `${percentages.abstain}%` }}
                    ></div>
                  </div>
                  <div className="result-label">
                    <span>Abstain: {proposal.abstain}</span>
                    <span>{percentages.abstain}%</span>
                  </div>
                </div>
              </div>

              <div className="proposal-footer">
                <span className="timestamp">
                  Started: {formatDate(proposal.startTime)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProposalList;

