"use client";

import { getContract, getWalletAddress, BOT_CHAIN_ID, CONTRACT_ADDRESS, getReadProvider } from "@/lib/blockchain";

type Action = "approveValidatorRelease" | "approveAdminRelease" | "resetValidatorReleaseApproval" | "releaseFund";
const pending = new Set<string>();

// Keep the submitted hash until the API acknowledges it. Retrying after an
// API outage must verify the same transaction, never send a second payment.
export async function releaseTransaction(id: string, action: Action, sync: (hash: string) => Promise<unknown>) {
  const wallet = await getWalletAddress();
  const key = `pledgr:release:${BOT_CHAIN_ID}:${CONTRACT_ADDRESS.toLowerCase()}:${wallet.toLowerCase()}:${id}:${action}`;
  if (pending.has(key)) throw new Error("This action is already in progress.");
  pending.add(key);
  let hash: string | null = null;
  try {
    hash = window.localStorage.getItem(key);
    if (!hash) {
      const contract = await getContract();
      if (action !== "approveValidatorRelease" && String(await contract.admin()).toLowerCase() !== wallet.toLowerCase()) {
        throw new Error("Connect the wallet that deployed the PLEDGR contract to approve or release funds. A group admin account alone is not enough.");
      }
      const campaign = await contract.getCampaign(id);
      const alreadyDone = action === "approveAdminRelease" ? campaign.adminReleaseApproved
        : action === "approveValidatorRelease" ? campaign.validatorReleaseApproved
        : action === "releaseFund" ? campaign.released : !campaign.validatorReleaseApproved;
      if (alreadyDone) throw new Error("This action is already recorded on-chain. Open View Detail and use Sync confirmed transaction with its transaction hash.");
      const tx = await contract[action](id);
      hash = tx.hash;
      window.localStorage.setItem(key, hash!);
    }
    const receipt = await getReadProvider().waitForTransaction(hash!, 1, 120000);
    if (!receipt) throw new Error("Confirmation is still pending. Retry to check the same transaction.");
    if (receipt.status !== 1) {
      window.localStorage.removeItem(key);
      throw new Error("The transaction reverted. No release was completed.");
    }
    await sync(hash!);
    window.localStorage.removeItem(key);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The action failed.";
    throw new Error(hash ? `${message} Transaction: ${hash}. Retry to synchronize it, or use Sync confirmed transaction in View Detail.` : message);
  } finally {
    pending.delete(key);
  }
}
