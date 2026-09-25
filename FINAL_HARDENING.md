# PLEDGR Final Hardening

This revision locks the final application/blockchain workflow before deployment.

## Core safeguards
- Proposal approval remains a two-stage application decision: validator then group admin.
- Only the contract admin registers approved campaigns on-chain.
- Native BOT donations are verified from confirmed blockchain receipts/events before MongoDB is updated.
- First withdrawal requests are recorded on-chain with `requestWithdrawal()`. Retry after a rejected review is an application-level resubmission while the on-chain request remains valid.
- Release requires both an assigned validator approval and contract-admin approval on-chain.
- Admin rejection after validator approval requires an on-chain validator-approval reset.
- Cancel is blocked on-chain once withdrawal review has started; refund is available only after cancellation.
- Member removal is a soft removal and validator roles are scoped to each group.
- Wallet changes are blocked for active fundraiser proposals and active validators while group proposals are in progress.
- Blockchain amounts use atomic string values in MongoDB; JavaScript floating-point values are not used as the source of truth.
- Blockchain synchronization endpoints require authenticated group access and role-specific authorization for privileged events.

## Deployment
1. Compile `contracts/TrustKasTreasury.sol` in Remix.
2. Deploy it with the intended PLEDGR treasury admin wallet on BOT Chain Testnet (chain ID 968).
3. Set `NEXT_PUBLIC_CONTRACT_ADDRESS` and `TRUSTKAS_CONTRACT_ADDRESS` to the new deployment address.
4. Start Next.js and test the complete flow with a fresh campaign.
