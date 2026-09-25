# Stage 6 — Application Realtime + Blockchain Realtime + Toolchain Cleanup

## Application realtime
- Organization/group data refreshes automatically while the page is visible.
- Join requests refresh every 2.5 seconds for organization admins.
- Group members/proposals refresh every 5 seconds.
- Window focus and reconnect trigger a fresh sync.
- No MetaMask connection is requested for passive page viewing.

## Blockchain realtime
- PLEDGR contract events are subscribed through ethers.
- Duplicate events are ignored by transaction hash + event name.
- Events continue to invalidate proposal/group/history/treasury queries.
- Realtime state remains read-only until a user explicitly submits a wallet transaction.

## Toolchain cleanup
- Removed Hardhat config and deploy script.
- Removed Hardhat/toolbox/ts-node dependencies.
- Removed unused Socket.IO, wagmi, viem, Recharts, and dotenv dependencies.
- Ethers remains the single Web3 client used by the application.

## Deployment note
Smart contracts are compiled and deployed through Remix IDE. The repository keeps `contracts/TrustKasTreasury.sol` as the source of truth.
