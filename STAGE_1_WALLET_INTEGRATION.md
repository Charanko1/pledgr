# PLEDGR — Stage 1 Wallet Integration

This stage connects the authenticated PLEDGR account to a MetaMask EVM wallet and binds every newly created fundraising proposal to that wallet.

## Implemented

- Dedicated `POST /api/wallet/connect` endpoint.
- EVM address validation and checksum normalization.
- Prevents one wallet address from being connected to multiple accounts.
- MetaMask account changes are persisted automatically.
- Creating a proposal requires a connected wallet.
- `recipientWallet` is captured from the authenticated user on the server; it is never trusted from the create-proposal request body.
- The proposal creator is now the authenticated user's name instead of a hard-coded name.
- Proposal and profile UI display the fundraiser wallet.
- Login/session data includes `walletAddress`.

## Current blockchain behavior

The existing Remix contract and donation flow are intentionally unchanged in this stage. Donated funds still follow the current contract behavior. Stage 2 will add proposal-specific recipients and a contract-controlled release flow so approved funds can be released to `recipientWallet`.

## Required runtime

- MetaMask
- BOT Chain Testnet (`0x3C8`)
- Existing PLEDGR API environment variables
