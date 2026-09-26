// A receipt is verified before this helper is used. Stored hashes allow retries
// to repair the event ledger without repeating or regressing a state transition.
export function hasAppliedEvent(proposal: any, eventType: string, txHash: string): boolean {
  const hash = txHash.toLowerCase();
  const fields: Record<string, string> = {
    CampaignCreated: "blockchainCreateTxHash",
    CampaignApproved: "blockchainApprovalTxHash",
    WithdrawalRequested: "withdrawalRequestTxHash",
    ValidatorReleaseApproved: "validatorReleaseApprovalTxHash",
    ValidatorReleaseApprovalReset: "validatorReleaseResetTxHash",
    AdminReleaseApproved: "adminReleaseApprovalTxHash",
    CampaignCancelled: "cancelTxHash",
    FundReleased: "releaseTxHash",
  };
  if (eventType === "Donated" || eventType === "RefundClaimed") {
    const entries = proposal?.[eventType === "Donated" ? "transactions" : "refunds"] || [];
    return entries.some((item: { txHash?: string }) => item.txHash?.toLowerCase() === hash);
  }
  return Boolean(fields[eventType] && proposal?.[fields[eventType]]?.toLowerCase() === hash);
}
