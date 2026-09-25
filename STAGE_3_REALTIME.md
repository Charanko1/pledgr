# PLEDGR Stage 3 — Realtime Blockchain

Stage 3 adds one shared blockchain event subscription for the dashboard.

## Realtime events

- `CampaignCreated` — refreshes proposal/group state and on-chain history.
- `CampaignApproved` — refreshes approval state and history.
- `Donated` — refreshes the live funding amount and records the confirmed transaction.
- `FundReleased` — refreshes release state, funding amount, and history.

## Data flow

`BOT Chain → PLEDGR event listener → /api/blockchain/sync → MongoDB → React Query invalidation → UI`

The listener reads from the public BOT RPC and does not require MetaMask to be connected merely to observe events. MetaMask is still required for user-signed transactions.

## Configuration

- `NEXT_PUBLIC_CONTRACT_ADDRESS` must point to the deployed Remix `TrustKasTreasury` contract.
- `NEXT_PUBLIC_BOT_RPC_URL` is optional and defaults to `https://rpc.bohr.life`.

## Realtime status

The dashboard header and treasury widget expose a small `LIVE`, `SYNCING`, `OFFLINE`, or `BLOCKCHAIN OFF` state.
