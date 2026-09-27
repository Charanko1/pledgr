# Pledgr mainnet deployment

Network: BOT Chain Mainnet, chain ID **677** (hex **0x2a5**), native coin **BOT**.
RPC: https://rpc.botchain.ai
Explorer: https://scan.botchain.ai

The application is prepared for mainnet; the contract address is deliberately empty until deployment. No mainnet contract has been deployed by this update.

## Deploy the existing V2 contract

1. Use `contracts/PledgrTreasuryV2.sol`, not the legacy `TrustKasTreasury.sol`.
2. Match the project's compiler settings: Solidity **0.8.30**, optimizer enabled with **1 run**, **viaIR enabled**, EVM **Shanghai**, OpenZeppelin contracts **5.4.0**. In Remix, pin each OpenZeppelin import to `@openzeppelin/contracts@5.4.0/...` so it resolves the same dependency version.
3. Connect MetaMask to BOT Chain Mainnet (677), using the RPC above. Obtain mainnet BOT for deployment gas from the organizers as described in the guidebook.
4. Deploy `PledgrTreasuryV2` with **no constructor arguments** and **zero BOT deployment value**. Review and confirm the deployment in your own wallet.
5. Save the resulting mainnet contract address and deployment transaction. Check the contract on the explorer. Source verification must use the same compiler, dependency versions and optimizer/EVM settings.

## Connect the application

Copy the network settings from `MAINNET.env.example` into the hosting environment. Set `NEXT_PUBLIC_PLEDGR_V2_ADDRESS` to the new mainnet address. Keep both legacy contract address variables empty unless you separately deploy the legacy contract.

Do not use the previous testnet address. Do not change stored proposal chain IDs or move testnet signatures to mainnet. Create new mainnet proposals and fresh signatures. Existing testnet funds remain on testnet and need the testnet configuration to access them.

Use a separate production MongoDB database for a clean launch so test proposals and activity do not appear alongside mainnet data. This update does not delete or migrate any database records. Configure the production database and authentication secrets in your host, never in public variables.

Run `node scripts/check-mainnet.cjs` after configuring the new address. It performs read-only network and contract checks; it does not send transactions or request a private key. Then rebuild (`npm run build`) and restart/redeploy: Next.js embeds public network settings during the build.

The header and auth-side network badge follow the configured network. The explorer link appears once the V2 address is configured. Wallet connections and signatures still open MetaMask; signatures remain gas-free.

## Lower-cost compilation in Remix

Cancel the previous unconfirmed deployment request. In Solidity Compiler, select 0.8.30, open Advanced Configurations and select Use configuration file. Import/select `contracts/remix-compiler.config.json` from this project, then recompile `PledgrTreasuryV2.sol`. Merely changing local files does not update an already-open Remix compilation.

Read-only mainnet estimates on 2026-09-27, with gas price 20 gwei:

| Build | Estimated deployment gas | Estimated BOT |
| --- | ---: | ---: |
| Optimizer disabled | 3,490,555 | 0.0698111 |
| Original optimizer, 200 runs | 1,970,658 | 0.03941316 |
| Optimizer, 1 run, viaIR | 1,707,947 | 0.03415894 |

Estimates are not guarantees: wallet margins and network prices may differ. The smaller build preserves the Solidity source, ABI and features. Low optimizer runs prioritize deployment size and can trade off later execution cost. Do not reduce the gas limit below what execution needs to force a smaller displayed fee; failed deployments can still consume gas. This update does not deploy a contract.
