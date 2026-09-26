# Pledgr approval and release fix

## Install

Back up your project, then copy the ZIP contents into your existing Pledgr project root, preserving the folders and replacing matching files. Keep your existing `.env` and dependencies. Restart Next.js. No database migration, dependency change, or contract deployment is required by this patch.

## Recover the proposal already stuck on Final Approve Release

1. Check the final approval transaction in MetaMask activity.
2. If it succeeded, open **View Detail → Sync confirmed transaction**. Select **Final admin approval**, paste the full transaction hash, and click **Sync transaction** using a group-admin account.
3. After the proposal shows **Release Approved**, click **Release BOT** using the contract-admin wallet. This is a separate on-chain transaction. The contract transfers the entire collected balance to the campaign's fundraiser wallet (1 BOT for a campaign that collected 1 BOT against a 0.1 BOT target).
4. If the release itself already succeeded but the page is stale, synchronize its hash with **Release BOT** selected instead. Do not send a second release.
5. If approval reverted or was never submitted, connect the wallet that deployed this contract, verify it with the app, and retry final approval. An application group-admin role does not grant the contract's immutable admin role.

The supplied Solidity uses `totalRaised >= targetAmount`; exceeding the target is permitted. A screenshot alone cannot establish whether the deployed contract matches this source or whether a specific wallet transaction reverted. No live transactions were signed or funds moved during this repair.

## Changes

- Handle verified receipt replays after realtime synchronization has already updated the proposal.
- Repair ledger/history persistence after a proposal update succeeded only partially.
- Recognize withdrawal, approval, and reset hashes when two sync requests race.
- Check the cleared validator flag after an admin reset transaction.
- Keep delayed donation updates from changing a release-review status back to Funding.
- Require a verified wallet for review; retain receipt, role, sender, and approval checks.
- Save approval/release transaction hashes locally until synchronization succeeds, so a retry does not submit another transaction.
- Share contract-admin checks and retry handling across the board and detail page.
- Add an explicit receipt-sync form for transactions submitted before this fix.
- Apply hard shadows, borders, pressed states, and focus outlines to proposal action buttons.

## Changed/new files

```
app/api/proposals/[id]/release/route.ts
app/api/proposals/[id]/withdrawal-review/route.ts
app/globals.css
features/group/components/ProposalBoard.tsx
features/group/hooks/useGroup.ts
features/proposal/ProposalScreen.tsx
features/proposal/components/SyncRelease.tsx
lib/applied-blockchain-event.ts
lib/blockchain-sync.ts
lib/release-transaction.ts
tests/release-flow.test.cjs
```

## Verification

Run `node --test tests/release-flow.test.cjs`: 11 regression tests pass. These exercise the actual synchronization and client transaction helper with mocked database/RPC responses, including exact-target/over-target funding, full recorded release amounts, duplicate and partial synchronization, admin reset, wrong-wallet rejection, and retaining a submitted hash after an API failure. They do not execute deployed Solidity or establish the state of a live campaign.

TypeScript checking and `next build --webpack` passed using placeholder build-only database/JWT settings. A live authenticated wallet/database end-to-end test remains necessary in your testnet environment.
