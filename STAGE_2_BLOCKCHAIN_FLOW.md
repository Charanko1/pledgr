# PLEDGR Stage 2 — BOT Smart Contract Flow

Stage 2 moves proposal lifecycle and fund release into the PLEDGR smart contract while keeping MongoDB as application metadata storage.

## Business flow

1. Fundraiser connects MetaMask on BOT Chain Testnet.
2. PLEDGR creates the proposal in MongoDB.
3. The frontend registers the proposal on-chain with `createCampaign(proposalId, targetAmount)`.
4. The smart contract fixes the connected fundraiser wallet (`msg.sender`) as `recipient`.
5. The PLEDGR contract admin approves the campaign with `approveCampaign(proposalId)`.
6. Donors send native BOT to the campaign with `donate(proposalId)`.
7. The contract keeps the BOT until the contract admin executes `releaseFund(proposalId)`.
8. The contract sends all collected BOT for that campaign to the fundraiser wallet stored on-chain.
9. MongoDB stores tx hashes and UI metadata for history/reporting.

## Important: BOT is the native currency here

This contract uses `msg.value` because the project's BOT setup treats BOT as the native currency of the configured EVM network. It is not an ERC-20 `transferFrom` flow.

## Remix deployment

Open `contracts/TrustKasTreasury.sol` in Remix and compile with Solidity `0.8.20` (or a compatible `0.8.x` compiler).

Deploy with MetaMask using the wallet that should be the PLEDGR contract admin. The deploying wallet becomes the immutable `admin`.

After deployment, copy the contract address into:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedTrustKasTreasury
```

The frontend is configured for:

- Chain ID: `968` (`0x3C8`)
- RPC: `https://rpc.bohr.life`
- Explorer: `https://scan.bohr.life`

## Contract operations

### Fundraiser

```text
createCampaign(proposalId, targetAmountWei)
```

The recipient is always `msg.sender`.

### Contract admin

```text
approveCampaign(proposalId)
```

### Donor

```text
donate(proposalId) + native BOT value
```

### Contract admin

```text
releaseFund(proposalId)
```

The release cannot run twice and cannot run before approval.

## Security rules implemented in the app

- Fundraiser wallet cannot be entered as an arbitrary recipient when registering on-chain; the contract uses `msg.sender`.
- Approval is done on-chain before a proposal is allowed to receive donations.
- Donation records require the connected user's wallet to match the donor wallet stored by the app.
- A transaction hash cannot be recorded twice for the same proposal.
- Release records require the connected wallet to match the release wallet and the contract itself still enforces `onlyAdmin`.
- The contract rejects direct BOT transfers without a proposal ID to avoid untracked funds.

## Existing deployed contract

The old contract cannot be upgraded by this source file. Deploy the Stage 2 contract as a new contract in Remix, then update `NEXT_PUBLIC_CONTRACT_ADDRESS` to the new deployment address.
