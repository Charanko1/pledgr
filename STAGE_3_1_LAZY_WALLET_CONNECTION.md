# PLEDGR Stage 3.1 — Lazy MetaMask Connection

## Goal
Opening dashboards, groups, and proposal detail pages must not automatically prompt MetaMask or trigger a wallet/network connection.

## Changes
- `WalletContext` now keeps an `activeAddress` that starts empty.
- MetaMask permission (`eth_requestAccounts`) is requested only from the explicit `connectWallet()` action.
- Saved `profile.walletAddress` is treated as the fundraiser recipient record, not proof that MetaMask is currently connected.
- Existing MetaMask `accountsChanged` events are followed only after an explicit wallet session exists.
- `getContractAdmin()` uses the read-only BOT RPC provider and never requests MetaMask access.
- `getCampaignOnChain()` uses the read-only BOT RPC provider.
- Group admin checks are lazy: they run when the user clicks an on-chain approve/release action.
- Creating a fundraising proposal still requires a wallet and will open MetaMask from the user action.
- Donating still requires a wallet and will open MetaMask from the user action.

## Expected UX
1. Open proposal/group page → no MetaMask popup and no wallet permission request.
2. Click **Connect wallet** → MetaMask opens.
3. Click **New Proposal** without a wallet → user is prompted to connect.
4. Click **Donate BOT** without a wallet → user is prompted to connect.
5. Click **Approve on-chain** or **Release funds** as admin without a wallet → user is prompted to connect.
