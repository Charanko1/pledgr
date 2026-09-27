# Proposal and account improvements

## What changed

- The creator can end a proposal. Registered campaigns close donations permanently and preserve remaining funds for the same creator-only, approved partial claims. Unsigned drafts can end without a wallet transaction.
- The proposal board separates Ongoing and Finished. Reaching the target, passing the deadline, or withdrawing funds does not automatically finish an open V2 campaign. Finished includes ended, cancelled, rejected, and released legacy proposals.
- Dashboard subpages have a back link to their parent page. Links work even when a detail page is opened directly.
- The profile uses the full content width, with account information and wallet controls side by side on desktop and stacked on mobile.
- Edit profile updates name and email. Email changes require the current password, and duplicate addresses are rejected. Account roles and wallet ownership cannot be changed through the profile form.
- Change wallet opens account selection and verifies the selected wallet. Disconnect closes the browser connection without erasing the saved wallet or moving funds. Reconnection is explicit.
- Wallet replacement is blocked while the old wallet is needed as creator or reviewer. An ended campaign with no remaining balance no longer blocks replacement; the balance is checked on-chain.
- The panel beside login and registration explains Pledgr's community purpose and transparent funding model.

## Activation

Restart the Next.js app after replacing source files, including the updated Mongoose model. Rebuild if running a production server.

The new end-campaign function requires deploying the latest `contracts/PledgrTreasuryV2.sol` and updating `NEXT_PUBLIC_PLEDGR_V2_ADDRESS`. There are no constructor arguments. See [V2-MIGRATION.md](./V2-MIGRATION.md) for deployment and compatibility details. Changing an environment variable does not change the code of an existing campaign's contract. No live contracts were deployed and no funds were moved during this update.

## Verification

67 automated tests passed, including 13 local-EVM tests and API, permission, wallet, and UI regression tests. TypeScript checking and the optimized Next.js build passed. Desktop and mobile pages were visually checked with fictional API fixtures; profile editing and list filtering were exercised in that preview. Mocked API tests and local-EVM tests do not verify your live MongoDB or browser-extension wallet.

Wallet permission behavior follows the [MetaMask account management documentation](https://docs.metamask.io/metamask-connect/evm/guides/manage-user-accounts/). Providers without permission revocation still disconnect locally and require explicit reconnection in Pledgr.
