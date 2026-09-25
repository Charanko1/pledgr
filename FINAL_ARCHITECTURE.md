# PLEDGR Final Architecture

## Runtime stack

- Next.js App Router + React + TypeScript
- MongoDB + Mongoose
- ethers v6
- MetaMask
- Solidity smart contract deployed from Remix IDE
- BOT Chain Testnet (chain ID 968)
- React Query for client cache and focused application realtime

Hardhat, Socket.IO, wagmi, viem, Recharts and dotenv are intentionally not part of the runtime stack.

## Group roles

Roles are group-scoped through `GroupMember`, not global user roles.

- `Admin`: manage members, assign/remove validators, review proposals, review withdrawals, and perform final application approvals.
- `Validator`: review proposals and withdrawal requests inside groups where the user is an active validator.
- `Member`: create proposals and use normal group features.

Removing a member changes the group membership to `REMOVED`; it does not delete the global User, historical proposals or blockchain records. An existing removed membership is reactivated when a new join request is approved. Group join requests are available to group admins and refresh automatically.

## Authentication

Login creates an HttpOnly `trustkas_token` cookie. The browser never stores the JWT token in localStorage. Client-side localStorage only keeps a non-sensitive user profile for fast rendering.

All protected API routes accept the HttpOnly cookie (and continue to tolerate a Bearer token for compatibility). The dashboard validates the session before mounting data and blockchain listeners.

## Wallet ownership

Connecting a wallet is lazy: visiting a proposal or group does not request MetaMask access. A wallet prompt is triggered only for explicit actions such as create proposal, donate, approve, release, cancel, refund, or the Connect Wallet button.

Wallet ownership is proven with a server-issued nonce plus an EIP-191 signature. Wallet addresses are globally unique in MongoDB and wallet changes are blocked while the user owns an active on-chain proposal.

## Proposal lifecycle

The application lifecycle is:

`Pending → Validated → Approved → Blockchain Creating → Funding → Withdrawal Requested → Validator Release Approved → Release Approved → Released`

Alternative states:

- `Pending/Validated → Rejected`
- `Approved/Funding/Release Rejected → Cancelled → donor refund claims`
- `Withdrawal Requested/Validator Release Approved → Release Rejected → request again`

Delete is only allowed for a creator while the proposal is still `Pending` and has never been registered on-chain. Once an on-chain workflow exists, cancellation preserves the history and opens the donor refund mechanism.

## Creator and wallet relationship

Every proposal stores:

- `creatorId` → the User who submitted the proposal
- `creator` → a compatibility/display snapshot
- `recipientWallet` → the creator's verified MetaMask address used for the fundraising campaign

Proposal reads populate the current User profile name, so the Creator label follows the account profile rather than a hard-coded string.

## Proposal approvals

### Proposal approval

1. Member creates a proposal in MongoDB.
2. An active group Validator approves or rejects it.
3. After validator approval, a group Admin approves or rejects it.
4. Only a fully approved proposal can be registered on-chain.

### Withdrawal approval

1. When the target is reached or the deadline passes, the fundraiser requests withdrawal.
2. A Validator approves or rejects the withdrawal.
3. After validator approval, an Admin gives the final application approval or rejects it.
4. Only after both application approvals can the contract admin perform `releaseFund()`.

A rejected withdrawal does not refund donors; the BOT remains escrowed and the fundraiser can request withdrawal again.

## Blockchain source of truth

MongoDB stores application metadata and verified transaction history. The blockchain is authoritative for BOT movement and campaign execution.

PLEDGR uses **native BOT**, not an ERC-20 token. The `TrustKasTreasury` contract is deployed from Remix and holds campaign funds.

Flow:

1. Fundraiser verifies a MetaMask wallet.
2. Proposal draft is stored in MongoDB with `creatorId`, `recipientWallet`, `targetAmountAtomic`, and deadline.
3. Fundraiser calls `createCampaign(proposalId, targetAmount, deadline)`.
4. Server verifies the confirmed transaction and `CampaignCreated` event before marking the proposal on-chain.
5. The PLEDGR contract admin activates the campaign with `approveCampaign()` after the app-level validator/admin approvals are complete.
6. Donors call `donate(proposalId)` with native BOT.
7. The contract tracks each donor's refundable balance.
8. If cancelled before release, each donor calls `claimRefund()` for their own BOT.
9. When the campaign is finished and the app-level withdrawal approvals are complete, the contract admin calls `releaseFund(proposalId)` and BOT is sent to the fundraiser wallet stored in the campaign.

## Transaction integrity

Mutation APIs accept only a transaction hash for blockchain mutations. The server does not trust client-provided donor, amount, recipient or balance fields.

The server verifies:

- transaction is confirmed on BOT Chain
- transaction target is the configured PLEDGR contract
- calldata matches the expected function and proposal ID
- receipt contains the expected PLEDGR event
- event actor matches the transaction sender
- event amount/recipient matches on-chain state and the stored proposal
- withdrawal release has both validator and admin application approvals

A unique `BlockchainTransaction.txHash` record makes synchronization idempotent.

## Realtime

### Application realtime

MongoDB-backed group, membership, proposal and join-request views use focused React Query polling. Join requests refresh every 2.5 seconds while an organization page is active; broader organization/group/proposal data refreshes every 5 seconds. Window focus and reconnect trigger immediate refreshes.

This is deploy-friendly and does not require a custom Socket.IO server.

### Blockchain realtime

The browser subscribes to PLEDGR contract events through ethers and the BOT RPC provider. Events trigger verified `/api/blockchain/sync` calls followed by React Query cache invalidation.

Handled events:

- `CampaignCreated`
- `CampaignApproved`
- `Donated`
- `CampaignCancelled`
- `RefundClaimed`
- `FundReleased`

Dynamic indexed Solidity string values are resolved from confirmed transaction calldata rather than trusting an indexed hash as the proposal ID.

## Data precision

All blockchain amounts are stored as exact atomic strings (`uint256`, 18 decimals). Numeric fields remain only for backwards-compatible display and should not be used as the blockchain source of truth.

## Remix deployment

Whenever `TrustKasTreasury.sol` changes:

1. Compile it in Remix.
2. Deploy a new `TrustKasTreasury` instance on BOT Chain Testnet.
3. Copy the new address into `NEXT_PUBLIC_CONTRACT_ADDRESS` and `TRUSTKAS_CONTRACT_ADDRESS`.
4. Restart Next.js.

The native BOT asset itself does not need a new token deployment.
