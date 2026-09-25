# PLEDGR Final Checklist

## UI and authentication
- Register uses the same visual system as Login and is branded PLEDGR.
- Register validates full name, email, password and confirmation.
- Register never requests MetaMask.
- Group/proposal pages never request MetaMask just to view data.
- Wallet prompt is lazy and triggered only by wallet-dependent actions.
- Wallet ownership is verified with server nonce + signature.
- JWT is stored in an HttpOnly cookie.

## Group and roles
- Roles are group-scoped: Admin, Validator, Member.
- Admin can appoint/remove a validator.
- Admin can remove a member without deleting the global User.
- Removed members cannot act in the group until re-approved.
- Proposal approvals are handled by Validator then Admin.
- Withdrawal approvals are handled by Validator then Admin.

## Proposal lifecycle
- Member creates a Pending proposal.
- Creator is linked through `creatorId` to the User profile.
- Creator wallet is stored as `recipientWallet`.
- Creator can delete only an unregistered Pending proposal.
- On-chain proposals are cancelled instead of deleted.
- Cancelled campaigns allow individual donor refunds.
- A rejected withdrawal keeps funds in the contract and can be requested again.
- Released campaigns cannot be cancelled or deleted.

## BOT blockchain
- PLEDGR uses native BOT, not ERC-20.
- Solidity is compiled/deployed with Remix IDE.
- Hardhat and its deployment scripts are removed.
- ethers v6 is the only Web3 JavaScript library.
- Contract functions cover campaign creation, activation, donation, cancellation, refund and release.
- Campaign release sends BOT to the fundraiser wallet stored by the contract.

## Transaction integrity
- Donation/release APIs accept only tx hashes from the frontend.
- Server confirms receipts and checks the PLEDGR contract address.
- Server verifies calldata, proposal ID and expected contract events.
- Server checks actor/recipient/amount against on-chain data.
- `BlockchainTransaction` and history event keys are idempotent.
- Blockchain amounts keep exact atomic string values.

## Realtime
- Join requests refresh every 2.5 seconds while the admin organization page or group join-request tab is active.
- Organization/group/proposal/member data refresh every 5 seconds.
- Window focus/reconnect triggers immediate refresh.
- Blockchain contract events invalidate affected React Query caches.
- Duplicate blockchain events are ignored safely.

## Deployment
1. Copy `.env.example` to `.env.local`.
2. Set `MONGODB_URI`.
3. Set a random `JWT_SECRET` of at least 32 characters.
4. Compile/deploy `contracts/TrustKasTreasury.sol` in Remix on BOT Chain Testnet.
5. Put the new contract address in `NEXT_PUBLIC_CONTRACT_ADDRESS` and `TRUSTKAS_CONTRACT_ADDRESS`.
6. Restart Next.js after changing the address.
7. Test: create → validator approve → admin approve → on-chain register → on-chain funding activation → donate → withdrawal request → validator approve → admin approve → release.
8. Test the alternative path: cancel → donor refund.
9. Test the rejection path: withdrawal reject → request again.

## Validation performed in this workspace
- TypeScript/TSX parser: PASS across 113 source files.
- `package.json`/`package-lock.json` dependency set check: PASS.
- PLEDGR ABI JSON: PASS.
- Solidity source copies: identical.
- Solidity bracket balance: PASS.
- Hardhat/runtime dependency search: no runtime/dependency references remain; historical changelog/docs may mention the cleanup.

A full `npm ci` / `npm run build` could not be completed in the workspace because dependency installation timed out. The shipped archive excludes `node_modules` and `.next`.
