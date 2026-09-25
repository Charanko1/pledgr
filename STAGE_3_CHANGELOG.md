# Stage 3 Change Log — Realtime Blockchain

## Added

- Shared `BlockchainRealtimeProvider`.
- Public BOT RPC event listener for TrustKasTreasury events.
- Server-side `/api/blockchain/sync` event verification and MongoDB synchronization.
- Live treasury balance query using a read-only provider (wallet not required).
- Realtime status indicator in the dashboard header and treasury card.

## Changed

- `DashboardProviders` now mounts the shared realtime provider once per dashboard session.
- Blockchain events invalidate proposal, group, history, organization, and treasury React Query caches.
- External donations/approvals/releases can update the application without a page refresh, provided the dashboard is open.

## Safety notes

- The sync route verifies the transaction receipt, contract address, transaction success, and expected event before mutating proposal/history records.
- The source of truth for collected BOT remains the smart contract; MongoDB mirrors confirmed on-chain state for application reads.
