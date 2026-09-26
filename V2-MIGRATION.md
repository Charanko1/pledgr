# Pledgr V2: creator registration and signature-based partial claims

## Activation

The source changes are complete, but they cannot change the bytecode of an already deployed treasury. Deploy the **new** `contracts/PledgrTreasuryV2.sol` contract on the BOT network using your team's deployment wallet. The constructor has no arguments. The deployer has no privileged role in campaign registration or claims.

Then add this setting to the application's environment and restart/rebuild Next.js:

```
NEXT_PUBLIC_PLEDGR_V2_ADDRESS=0xYourNewV2ContractAddress
```

Keep the existing `NEXT_PUBLIC_CONTRACT_ADDRESS` / `TRUSTKAS_CONTRACT_ADDRESS` values pointing at V1. Keep the server and public BOT RPC/chain settings on the same network. Do not replace the V1 address with V2: existing campaigns still hold funds in V1 and use its ABI and flow. Existing proposal records default to version 1; newly created proposals explicitly pin version 2, chain ID, and the new contract address. If V2 is not configured, creating a new campaign returns a setup message instead of registering it against the wrong contract.

No live deployment or wallet transfer was performed during development. New campaigns use V2; existing funds are not automatically migrated. An old campaign cannot be converted into V2 by editing its database record.

## Workflow

1. Creator submits a proposal, including a target and optional unlimited deadline.
2. Existing application validator/admin proposal reviews select the two reviewers. Creator, validator and admin must be distinct verified wallets/accounts.
3. In the proposal detail screen, prepare registration. The selected validator and admin sign the registration terms without gas. This prevents a creator changing reviewer identities or terms without their consent.
4. The creator submits `registerCampaign`. Funding opens immediately; there is no separate on-chain admin activation.
5. Donations remain open after targets, deadlines, and partial/full claims, until the creator explicitly cancels an unwithdrawn campaign.
6. Once eligible, the creator enters an exact BOT amount and requests withdrawal through the API. This action needs no wallet transaction or signature.
7. The assigned validator signs the withdrawal using EIP-712, followed by the assigned admin. Approval costs no gas.
8. The creator clicks **Claim X BOT**. One transaction verifies both signatures, consumes the nonce, updates total withdrawn, and transfers exactly the approved amount to the creator.
9. A later partial withdrawal requires a fresh request and both signatures. The already-approved amount cannot be edited at claim time.

The claim is the **only transaction in the withdrawal request/review/claim flow**. Registration, donations, public target/deadline updates, cancellation and donor refunds remain ordinary blockchain transactions. EIP-712 signing still opens a wallet **signature** prompt; it cannot be made prompt-free in MetaMask while retaining explicit wallet consent. No private keys are held by the backend.

## Target, deadline and balances

- `totalRaised` is lifetime contributions, `totalWithdrawn` is cumulative creator payouts, and `totalRefunded` is cumulative donor refunds.
- Available balance is `totalRaised - totalWithdrawn - totalRefunded`. All monetary calculations use integer wei and native BOT's 18 decimals. This is native BOT, matching the existing treasury, not an ERC-20 allowance/transfer flow.
- Donations have no target/deadline cutoff. Reaching a target does not force a withdrawal.
- The creator can increase the target, extend a dated deadline, or switch to unlimited. Targets cannot decrease, deadlines cannot shorten, and unlimited cannot switch back to a dated campaign.
- Withdrawal eligibility is permanently retained once earned. Increasing a reached target or extending an elapsed deadline does not lock previously eligible funds.
- Unlimited campaigns with no previously earned eligibility unlock at their target.
- A full claim leaves the campaign open for future donations and new claims.
- Cancellation and full donor refunds are available only before any creator payout. Cancellation invalidates pending claim permits. After partial payout, full refunds would be insolvent, so cancellation is disabled.

## Signature and permission boundaries

Registration binds campaign ID, creator, reviewer addresses, target, deadline and expiration. The campaign ID namespaces the database proposal ID with its creator address, preventing another wallet from occupying that creator's ID.

Withdrawal binds campaign ID, random request ID, creator recipient, exact amount, nonce and expiration. The EIP-712 domain binds version 2, chain ID and verifying contract. Nonces increment on successful claims; expired/replayed/wrong-amount/wrong-recipient/wrong-network/wrong-contract signatures fail. OpenZeppelin EIP712, ECDSA and ReentrancyGuard are used.

The contract has no on-chain organization membership directory. Its two reviewer addresses are immutable, distinct, public campaign configuration; both must authorize registration. The app checks that they are the actual approved group reviewers and rechecks active membership when accepting withdrawal signatures. Reviewers losing their application roles can block future approval collection: maintain these assignments for active campaigns. The contract does not read later database role changes, and already issued signatures remain valid until their expiration or nonce consumption/campaign cancellation. Off-chain rejection is allowed only before both approvals are complete; it cannot revoke an already published, fully signed permit.

Requests/registration authorizations expire after 24 hours. Request updates use compare-and-set conditions and a unique proposal/nonce index. Rejected or expired requests require a new request ID and fresh signatures. Confirmed transaction retries preserve hashes locally; the receipt synchronization form can repair an interrupted API sync without resending funds. Synchronization verifies successful receipts, target contract, campaign ID, creator and reviewers, and records monotonic balance snapshots.

## Files and verification

- `contracts/PledgrTreasuryV2.sol`: new contract; the original Solidity/ABI remain for V1.
- `lib/v2/`: shared typed data, server workflow, and client transaction retry logic.
- `models/WithdrawalRequest.ts`: off-chain requests/signatures.
- `app/api/proposals/[id]/v2/route.ts`: authenticated request/review/sync API.
- `features/proposal/V2Proposal.tsx`: registration, donations, partial withdrawal and terms controls.
- `lib/abi/PledgrTreasuryV2.json` and `contracts/artifacts/PledgrTreasuryV2.json`: generated ABI and deployment artifact.

From the project root:

```
npm ci --prefix contracts
npm run build --prefix contracts
npm test --prefix contracts
node --test tests/v2-backend.test.cjs tests/v2-ui.test.cjs tests/release-flow.test.cjs
npx tsc --noEmit --incremental false
npm run build -- --webpack
```

The contract toolchain is pinned separately in `contracts/package-lock.json`; it does not add browser dependencies. The compiler targets Shanghai EVM. Confirm that the deployment network supports Shanghai before deploying, or choose a supported EVM target and recompile/retest.

Verification performed: real local-EVM contract tests for creator registration, partial/native transfers, repeat claims, authorization tampering, expiry, target/deadline flexibility and refunds; backend tests for amount validation, approval order, role checks and renewal; existing V1 regression tests; TypeScript and optimized Next.js build. Backend tests use mocked persistence/RPC responses; they are not a substitute for a testnet run with your actual MongoDB and wallet accounts. This implementation has not had an independent smart-contract audit.

References: [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [OpenZeppelin cryptography](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography).
