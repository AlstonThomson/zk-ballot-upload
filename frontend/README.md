# ZK-Ballot Frontend

React frontend for the ZK-Ballot anonymous voting system.

## Features

- 🔗 MetaMask wallet connection
- 📋 View all proposals and results
- ✨ Create new proposals (admin/proposer role)
- 🗳️ Cast anonymous votes with commitment scheme
- 🔓 Reveal votes after voting period
- 📊 Real-time results visualization

## Setup

```bash
npm install
npm start
```

## Environment Variables

Create `.env` file:

```
REACT_APP_CONTRACT_ADDRESS=0x2324BF3d2313532D1D1Ce946947b80661826a49E
REACT_APP_NETWORK=sepolia
REACT_APP_CHAIN_ID=11155111
```

## Deployment

```bash
npm run build
```

Deploy the `build` folder to Vercel, Netlify, or any static hosting service.

