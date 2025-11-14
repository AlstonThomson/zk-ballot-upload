import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './WalletConnect.css';

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex

function WalletConnect({ onConnect }) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) return;

      const accounts = await ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const account = accounts[0];
        setAccount(account);
        const provider = new ethers.BrowserProvider(ethereum);
        onConnect(account, provider);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: SEPOLIA_CHAIN_ID,
              chainName: 'Sepolia Testnet',
              nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }],
          });
          return true;
        } catch (addError) {
          console.error('Error adding Sepolia network:', addError);
          return false;
        }
      }
      console.error('Error switching to Sepolia:', error);
      return false;
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError('');

      const { ethereum } = window;

      if (!ethereum) {
        setError('Please install MetaMask!');
        setLoading(false);
        return;
      }

      // Switch to Sepolia
      const switched = await switchToSepolia();
      if (!switched) {
        setError('Please switch to Sepolia Testnet');
        setLoading(false);
        return;
      }

      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      const account = accounts[0];
      setAccount(account);

      const provider = new ethers.BrowserProvider(ethereum);
      onConnect(account, provider);

      setLoading(false);
    } catch (error) {
      console.error(error);
      setError('Failed to connect wallet');
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    onConnect(null, null);
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(38)}`;
  };

  return (
    <div className="wallet-connect">
      {!account ? (
        <button
          className="connect-button"
          onClick={connectWallet}
          disabled={loading}
        >
          {loading ? 'Connecting...' : '🔗 Connect Wallet'}
        </button>
      ) : (
        <div className="connected">
          <span className="address">{formatAddress(account)}</span>
          <button className="disconnect-button" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default WalletConnect;

