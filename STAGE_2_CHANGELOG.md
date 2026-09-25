# Stage 2 Changelog — BOT Blockchain Fund Flow

## Smart contract

- Replaced the old global `withdraw(address)` treasury flow with proposal-specific campaigns.
- Added `createCampaign(proposalId, targetAmount)`.
- The connected fundraiser wallet is stored as the on-chain recipient using `msg.sender`.
- Added `approveCampaign(proposalId)` restricted to the contract admin.
- Donations remain native BOT and are accepted only for approved campaigns.
- Added `releaseFund(proposalId)` restricted to the contract admin.
- Release sends the campaign's collected BOT to the fixed fundraiser recipient.
- Added `CampaignCreated`, `CampaignApproved`, `Donated`, and `FundReleased` events.
- Added on-chain campaign lookup and campaign count helpers.
- Direct BOT transfers without a proposal are rejected.

## Frontend / blockchain integration

- Updated PLEDGR ABI to match the Stage 2 contract.
- Added contract-admin detection and wallet cache invalidation.
- Proposal creation now registers the same MongoDB proposal ID on-chain.
- Create flow rolls back the MongoDB proposal when blockchain registration fails.
- Approval UI calls `approveCampaign()` before marking the proposal Approved in MongoDB.
- Release UI calls `releaseFund()` and records the transaction hash.
- Donation amount is user-selectable and is paid as native BOT.
- Blockchain transaction hashes are linked to the configured block explorer.

## Database / API

- Added `creatorId` to proposals for safe rollback ownership checks.
- Added `blockchainStatus` and lifecycle tx hash fields.
- Added release amount and release timestamp fields.
- Donation endpoint validates the connected donor wallet and prevents duplicate tx hashes.
- Approval/rejection endpoint now requires an organization admin; on-chain approval additionally requires the contract admin wallet through the smart contract itself.
- Release endpoint requires an organization admin and the connected release wallet.
- Added blockchain-related history entries for proposal registration, approval, donation, and release.

## Deployment note

Deploy the new `contracts/TrustKasTreasury.sol` from Remix with the wallet that should control PLEDGR approval/release. Update `NEXT_PUBLIC_CONTRACT_ADDRESS` to the new deployed address.

The previous deployed contract is not upgraded automatically. Existing proposals created before Stage 2 have not been registered in the new contract and should not be treated as Stage 2 campaigns.
