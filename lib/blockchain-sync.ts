import { getAddress, formatEther, Contract } from "ethers";
import Proposal from "@/models/Proposal";
import Group from "@/models/Group";
import Membership from "@/models/Membership";
import User from "@/models/User";
import GroupMember from "@/models/GroupMember";
import History from "@/models/History";
import BlockchainTransaction from "@/models/BlockchainTransaction";
import { SERVER_CONTRACT_ADDRESS, getServerProvider, verifyContractEvent, type VerifiedEventType } from "@/lib/blockchain-server";
import ABI from "@/lib/abi/TrustKasTreasury.json";

interface SyncOptions { proposalId: string; txHash: string; eventType: VerifiedEventType; expectedTxFrom?: string; expectedEventActor?: string; }
interface EventMeta { actor: string; recipient: string; amountAtomic: string; deadlineAtomic: string; }
interface SyncResult { proposal: any; parsedEvent: any; txFrom: string; alreadyProcessed: boolean; }

function displayAmount(amountAtomic: bigint) {
  const formatted = formatEther(amountAtomic);
  return formatted;
}
function atomicString(amount: bigint) { return amount.toString(); }
function getArg(event: any, key: string, index: number) { return event.args?.[key] ?? event.args?.[index]; }

async function loadProposalAndGroup(proposalId: string) {
  const proposal = await Proposal.findById(proposalId).lean();
  if (!proposal) throw new Error("Proposal not found.");
  const group = await Group.findById(proposal.groupId).select("organizationId name").lean();
  if (!group) throw new Error("Proposal group not found.");
  return { proposal, group };
}

async function onChainCampaign(proposalId: string) {
  const contract = new Contract(SERVER_CONTRACT_ADDRESS, ABI, getServerProvider());
  return contract.getCampaign(proposalId);
}

function eventMetadata(eventType: VerifiedEventType, event: any, txFrom: string): EventMeta {
  if (eventType === "CampaignCreated") return {
    actor: getAddress(String(getArg(event, "creator", 1))),
    recipient: getAddress(String(getArg(event, "recipient", 2))),
    amountAtomic: atomicString(getArg(event, "targetAmount", 3) as bigint),
    deadlineAtomic: atomicString(getArg(event, "deadline", 4) as bigint),
  };
  if (eventType === "CampaignApproved") return { actor: getAddress(String(getArg(event, "admin", 1))), recipient: "", amountAtomic: "0", deadlineAtomic: "0" };
  if (eventType === "WithdrawalRequested") return { actor: getAddress(String(getArg(event, "recipient", 1))), recipient: getAddress(String(getArg(event, "recipient", 1))), amountAtomic: "0", deadlineAtomic: "0" };
  if (eventType === "ValidatorReleaseApproved") return { actor: getAddress(String(getArg(event, "validator", 1))), recipient: "", amountAtomic: "0", deadlineAtomic: "0" };
  if (eventType === "ValidatorReleaseApprovalReset") return { actor: getAddress(String(getArg(event, "admin", 1))), recipient: "", amountAtomic: "0", deadlineAtomic: "0" };
  if (eventType === "AdminReleaseApproved") return { actor: getAddress(String(getArg(event, "admin", 1))), recipient: "", amountAtomic: "0", deadlineAtomic: "0" };
  if (eventType === "Donated") return { actor: getAddress(String(getArg(event, "donor", 0))), recipient: "", amountAtomic: atomicString(getArg(event, "amount", 1) as bigint), deadlineAtomic: "0" };
  if (eventType === "CampaignCancelled") return { actor: getAddress(String(getArg(event, "actor", 1))), recipient: "", amountAtomic: "0", deadlineAtomic: "0" };
  if (eventType === "RefundClaimed") return { actor: getAddress(String(getArg(event, "donor", 1))), recipient: "", amountAtomic: atomicString(getArg(event, "amount", 2) as bigint), deadlineAtomic: "0" };
  return { actor: getAddress(txFrom), recipient: getAddress(String(getArg(event, "recipient", 1))), amountAtomic: atomicString(getArg(event, "amount", 2) as bigint), deadlineAtomic: "0" };
}

async function ensureTransactionRecord(params: { txHash: string; eventType: VerifiedEventType; proposalId: string; actor: string; recipient?: string; amountAtomic?: string; blockNumber: number; }) {
  const existing = await BlockchainTransaction.findOne({ txHash: params.txHash }).lean();
  if (existing) {
    if (existing.proposalId.toString() !== params.proposalId || existing.eventType !== params.eventType) throw new Error("Transaction hash has already been used for a different PLEDGR event.");
    return true;
  }
  try { await BlockchainTransaction.create(params); return false; }
  catch (error: any) {
    if (error?.code !== 11000) throw error;
    const raced = await BlockchainTransaction.findOne({ txHash: params.txHash }).lean();
    if (!raced || raced.proposalId.toString() !== params.proposalId || raced.eventType !== params.eventType) throw new Error("Transaction hash has already been used for a different PLEDGR event.");
    return true;
  }
}

function refundsTotalAtomic(proposal: any) {
  return (proposal.refunds || []).reduce((sum: bigint, item: any) => { try { return sum + BigInt(String(item.amountAtomic || "0")); } catch { return sum; } }, 0n).toString();
}

async function writeHistory(group: any, proposal: any, eventType: VerifiedEventType, meta: EventMeta, txHash: string) {
  const blockchainEventKey = `${txHash}:${eventType}`;
  if (await History.exists({ blockchainEventKey })) return;
  const amountAtomic = meta.amountAtomic || "0";
  const amountDisplay = displayAmount(BigInt(amountAtomic));
  const base = { organizationId: group.organizationId, groupId: group._id, proposalId: proposal?._id, userId: meta.actor, amount: amountDisplay, amountAtomic, txHash, blockchainEventKey };
  let payload: any;
  if (eventType === "CampaignCreated") payload = { ...base, type: "PROPOSAL", title: "Proposal Registered On-chain", description: `${proposal.title} was registered on the PLEDGR blockchain.` };
  else if (eventType === "CampaignApproved") payload = { ...base, type: "APPROVAL", title: "Funding Opened On-chain", description: `${proposal.title} was activated for funding on the PLEDGR blockchain.` };
  else if (eventType === "ValidatorReleaseApproved") payload = { ...base, type: "APPROVAL", title: "Validator Approved Release", description: `${proposal.title} received validator approval for fund release.` };
  else if (eventType === "AdminReleaseApproved") payload = { ...base, type: "APPROVAL", title: "Admin Approved Release", description: `${proposal.title} received final admin approval for fund release.` };
  else if (eventType === "WithdrawalRequested") payload = { ...base, type: "WITHDRAW", title: "Withdrawal Requested", description: `${proposal.title} requested release of its collected BOT funds.` };
  else if (eventType === "ValidatorReleaseApprovalReset") payload = { ...base, type: "APPROVAL", title: "Release Approval Reset", description: `${proposal.title} had its validator release approval reset by the admin.` };
  else if (eventType === "Donated") payload = { ...base, type: "DONATION", title: "BOT Donation Confirmed", description: `${amountDisplay} BOT was donated to ${proposal.title}.` };
  else if (eventType === "CampaignCancelled") payload = { ...base, type: "CANCEL", title: "Proposal Cancelled", description: `${proposal.title} was cancelled. Donors can claim their BOT refunds.` };
  else if (eventType === "RefundClaimed") payload = { ...base, type: "REFUND", title: "BOT Refund Claimed", description: `${amountDisplay} BOT was refunded to the donor.` };
  else payload = { ...base, type: "RELEASE", title: "Campaign Funds Released", description: `${amountDisplay} BOT was released to ${meta.recipient}.` };
  try { await History.create(payload); } catch (error: any) { if (error?.code !== 11000) throw error; }
}

export async function syncVerifiedBlockchainEvent({ proposalId, txHash, eventType, expectedTxFrom, expectedEventActor }: SyncOptions): Promise<SyncResult> {
  if (!SERVER_CONTRACT_ADDRESS) throw new Error("PLEDGR contract address is not configured.");
  const { proposal: original, group } = await loadProposalAndGroup(proposalId);
  const { tx, receipt, parsedEvent } = await verifyContractEvent(txHash, eventType, proposalId);
  const meta = eventMetadata(eventType, parsedEvent, tx.from);
  if (expectedTxFrom && getAddress(tx.from) !== getAddress(expectedTxFrom)) throw new Error("This blockchain transaction was sent by a different wallet.");
  if (expectedEventActor && getAddress(meta.actor) !== getAddress(expectedEventActor)) throw new Error("This blockchain event belongs to a different wallet.");

  const existing = await BlockchainTransaction.findOne({ txHash }).lean();
  if (existing) {
    if (existing.proposalId.toString() !== proposalId || existing.eventType !== eventType) throw new Error("Transaction hash has already been used for a different PLEDGR event.");
    const current = await Proposal.findById(proposalId).lean();
    return { proposal: current, parsedEvent, txFrom: tx.from, alreadyProcessed: true };
  }

  const contractAdmin = getAddress(String(await new Contract(SERVER_CONTRACT_ADDRESS, ABI, getServerProvider()).admin()));
  if (eventType === "CampaignCreated" || eventType === "CampaignApproved" || eventType === "AdminReleaseApproved") {
    if (getAddress(tx.from) !== contractAdmin) throw new Error("The transaction sender is not the PLEDGR contract admin.");
    if (eventType !== "CampaignCreated" && getAddress(meta.actor) !== contractAdmin) throw new Error("The blockchain admin event actor is invalid.");
  } else if (eventType === "CampaignCreated") {
    // handled above; campaign creator is intentionally the fundraiser wallet.
  } else if (getAddress(meta.actor) !== getAddress(tx.from)) {
    throw new Error("The blockchain event actor does not match the transaction sender.");
  }

  const campaign = eventType === "CampaignCreated" ? null : await onChainCampaign(proposalId);

  if (eventType === "CampaignCreated") {
    if (original.blockchainStatus !== "PENDING") throw new Error("This proposal is no longer waiting for blockchain registration.");
    if (original.status !== "Approved" || original.adminReviewStatus !== "Approved" || original.validationStatus !== "Approved") throw new Error("Only a fully approved proposal can be registered on-chain.");
    if (original.targetAmountAtomic !== meta.amountAtomic) throw new Error("On-chain target amount does not match the proposal.");
    if (original.recipientWallet && getAddress(original.recipientWallet) !== meta.recipient) throw new Error("On-chain fundraiser wallet does not match the proposal owner wallet.");
    const expectedDeadline = Math.floor(new Date(original.deadline).getTime() / 1000);
    if (String(expectedDeadline) !== meta.deadlineAtomic) throw new Error("On-chain deadline does not match the proposal deadline.");
    const validatorsTx: string[] = (getArg(parsedEvent, "validators", 5) || []).map((v: string) => getAddress(String(v)));
    const validatorsDb = await GroupMember.find({ groupId: group._id, status: "ACTIVE", role: "Validator" }).select("membershipId").lean();
    const membershipIds = validatorsDb.map((v: any) => v.membershipId);
    const memberships = await Membership.find({ _id: { $in: membershipIds } }).select("walletAddress").lean();
    const expectedValidators = memberships.filter((m: any) => m.walletAddress).map((m: any) => getAddress(m.walletAddress)).sort();
    const actualValidators = validatorsTx.sort();
    if (JSON.stringify(expectedValidators) !== JSON.stringify(actualValidators)) throw new Error("On-chain validator assignments do not match the active verified group validators.");
  }

  if (eventType === "CampaignApproved") {
    if (original.blockchainStatus !== "CREATED") throw new Error("This proposal is not waiting for on-chain activation.");
    if (original.status !== "Approved" || original.validationStatus !== "Approved" || original.adminReviewStatus !== "Approved") throw new Error("The proposal has not passed application approval.");
  }
  if (eventType === "Donated") {
    if (!campaign?.approved || campaign.cancelled || campaign.released) throw new Error("Only an active approved proposal can receive donations.");
    if (BigInt(tx.value) !== BigInt(meta.amountAtomic)) throw new Error("Donation transaction value does not match the blockchain event.");
    if (original.blockchainStatus !== "APPROVED") throw new Error("The proposal is not active for funding.");
  }
  if (eventType === "ValidatorReleaseApprovalReset") {
    if (!campaign || campaign.cancelled || campaign.released) throw new Error("The campaign cannot reset its release approval in the current state.");
    if (!campaign.validatorReleaseApproved || campaign.adminReleaseApproved) throw new Error("The validator release approval cannot be reset now.");
    if (original.withdrawalStatus !== "ValidatorApproved") throw new Error("Only a validator-approved withdrawal can be reset by admin.");
  }
  if (eventType === "WithdrawalRequested") {
    if (!campaign?.approved || campaign.cancelled || campaign.released) throw new Error("The campaign is not eligible for withdrawal.");
    if (getAddress(meta.actor) !== getAddress(original.recipientWallet)) throw new Error("Only the fundraiser wallet can request withdrawal.");
    if (!campaign.withdrawalRequested) throw new Error("The blockchain withdrawal request was not recorded.");
    if (original.withdrawalStatus !== "None" && original.withdrawalStatus !== "Rejected") throw new Error("The application is not ready for a new withdrawal request.");
    if (BigInt(campaign.totalRaised) <= 0n) throw new Error("There are no BOT funds to withdraw.");
    if (BigInt(campaign.totalRaised) < BigInt(campaign.targetAmount) && Math.floor(Date.now() / 1000) < Number(campaign.deadline)) throw new Error("Campaign has not finished.");
  }
  if (eventType === "ValidatorReleaseApproved") {
    if (!campaign?.approved || campaign.cancelled || campaign.released) throw new Error("The campaign is not eligible for validator release approval.");
    if (BigInt(campaign.totalRaised) <= 0n) throw new Error("There are no BOT funds to release.");
    if (BigInt(campaign.totalRaised) < BigInt(campaign.targetAmount) && Math.floor(Date.now()/1000) < Number(campaign.deadline)) throw new Error("Campaign has not finished.");
    const contract = new Contract(SERVER_CONTRACT_ADDRESS, ABI, getServerProvider());
    const assigned = await contract.isCampaignValidator(proposalId, meta.actor);
    if (!assigned) throw new Error("The validator is not assigned to this campaign.");
    const validatorUser = await User.findOne({ walletAddress: { $regex: new RegExp(`^${meta.actor}$`, "i") } }).select("_id").lean();
    if (!validatorUser) throw new Error("Validator wallet is not linked to a PLEDGR user.");
    const validatorMembership = await Membership.findOne({ organizationId: group.organizationId, userId: validatorUser._id.toString() }).select("_id").lean();
    if (!validatorMembership) throw new Error("Validator is not a member of this organization.");
    const activeValidator = await GroupMember.exists({ groupId: group._id, membershipId: validatorMembership._id, role: "Validator", status: "ACTIVE" });
    if (!activeValidator) throw new Error("The wallet is no longer an active group validator.");
    if (original.withdrawalStatus !== "Requested") throw new Error("This withdrawal is not awaiting validator approval.");
  }
  if (eventType === "AdminReleaseApproved") {
    if (!campaign?.validatorReleaseApproved) throw new Error("Validator approval is required before admin release approval.");
    if (original.withdrawalStatus !== "ValidatorApproved") throw new Error("The withdrawal is not awaiting admin approval.");
  }
  if (eventType === "CampaignCancelled") {
    if (!campaign?.cancelled || campaign.released) throw new Error("The blockchain campaign is not in a refundable cancelled state.");
    if (!accessCancellable(original.blockchainStatus)) throw new Error("This proposal is not cancellable on-chain.");
    if (meta.actor.toLowerCase() !== getAddress(original.recipientWallet).toLowerCase() && meta.actor.toLowerCase() !== contractAdmin.toLowerCase()) throw new Error("Only the fundraiser or contract admin can cancel this campaign.");
  }
  if (eventType === "RefundClaimed" && (!campaign?.cancelled || campaign.released)) throw new Error("Refunds are only valid after proposal cancellation.");
  if (eventType === "FundReleased") {
    if (!campaign?.released || campaign.cancelled) throw new Error("The blockchain campaign is not released.");
    if (!campaign.validatorReleaseApproved || !campaign.adminReleaseApproved) throw new Error("Both on-chain release approvals are required.");
    if (original.withdrawalStatus !== "AdminApproved") throw new Error("The withdrawal did not receive both validator and admin approvals.");
    if (original.recipientWallet && getAddress(original.recipientWallet) !== meta.recipient) throw new Error("Release recipient does not match the fundraiser wallet on the proposal.");
  }

  const amountAtomic = BigInt(meta.amountAtomic || "0");
  const amountDisplay = displayAmount(amountAtomic);
  let updateFilter: any = { _id: original._id };
  let update: any = {};

  if (eventType === "CampaignCreated") {
    updateFilter.blockchainStatus = "PENDING";
    update = { $set: { blockchainStatus: "CREATED", blockchainCreateTxHash: txHash } };
  } else if (eventType === "CampaignApproved") {
    updateFilter.blockchainStatus = "CREATED";
    update = { $set: { status: "Funding", blockchainStatus: "APPROVED", blockchainApprovalTxHash: txHash } };
  } else if (eventType === "WithdrawalRequested") {
    updateFilter.withdrawalStatus = { $in: ["None", "Rejected"] };
    update = { $set: { status: "Withdrawal Requested", withdrawalStatus: "Requested", withdrawalRequestedAt: new Date(), withdrawalRequestTxHash: txHash, validatorReleaseApprovedBy: null, validatorReleaseApprovedAt: null, validatorReleaseNote: "", adminReleaseApprovedBy: null, adminReleaseApprovedAt: null, adminReleaseNote: "", releaseRejectedBy: null, releaseRejectedAt: null, releaseRejectedReason: "" } };
  } else if (eventType === "ValidatorReleaseApproved") {
    updateFilter.withdrawalStatus = "Requested";
    update = { $set: { status: "Validator Release Approved", withdrawalStatus: "ValidatorApproved", validatorReleaseApprovedAt: new Date(), validatorReleaseApprovalTxHash: txHash } };
  } else if (eventType === "ValidatorReleaseApprovalReset") {
    updateFilter.withdrawalStatus = "ValidatorApproved";
    update = { $set: { status: "Release Rejected", withdrawalStatus: "Rejected", validatorReleaseResetTxHash: txHash } };
  } else if (eventType === "AdminReleaseApproved") {
    updateFilter.withdrawalStatus = "ValidatorApproved";
    update = { $set: { status: "Release Approved", withdrawalStatus: "AdminApproved", adminReleaseApprovedAt: new Date(), adminReleaseApprovalTxHash: txHash } };
  } else if (eventType === "Donated") {
    updateFilter.blockchainStatus = "APPROVED";
    updateFilter["transactions.txHash"] = { $ne: txHash };
    const totalRaised = BigInt(campaign?.totalRaised as bigint);
    update = { $set: { status: "Funding", fundedAmountAtomic: totalRaised.toString(), fundedAmount: displayAmount(totalRaised) }, $push: { transactions: { amount: amountDisplay, amountAtomic: meta.amountAtomic, donor: meta.actor, txHash, donatedAt: new Date() } } };
  } else if (eventType === "CampaignCancelled") {
    updateFilter.blockchainStatus = { $in: ["CREATED", "APPROVED"] };
    updateFilter.cancelTxHash = { $ne: txHash };
    const remaining = BigInt(campaign?.totalRaised as bigint);
    update = { $set: { status: "Cancelled", blockchainStatus: "CANCELLED", cancelTxHash: txHash, cancelledAt: original.cancelledAt || new Date(), fundedAmountAtomic: remaining.toString(), fundedAmount: displayAmount(remaining) } };
  } else if (eventType === "RefundClaimed") {
    updateFilter.blockchainStatus = "CANCELLED";
    updateFilter["refunds.txHash"] = { $ne: txHash };
    const remaining = BigInt(campaign?.totalRaised as bigint);
    update = { $set: { fundedAmountAtomic: remaining.toString(), fundedAmount: displayAmount(remaining) }, $push: { refunds: { amount: amountDisplay, amountAtomic: meta.amountAtomic, donor: meta.actor, txHash, refundedAt: new Date() } } };
  } else {
    updateFilter.blockchainStatus = "APPROVED";
    updateFilter.releaseTxHash = { $ne: txHash };
    update = { $set: { status: "Released", blockchainStatus: "RELEASED", releaseTxHash: txHash, releasedAmountAtomic: meta.amountAtomic, releasedAmount: amountDisplay, releasedAt: original.releasedAt || new Date(), fundedAmountAtomic: "0", fundedAmount: "0" } };
  }

  let updated = await Proposal.findOneAndUpdate(updateFilter, update, { new: true, runValidators: true }).lean();
  if (!updated) {
    const now = await Proposal.findById(proposalId).lean();
    const alreadyOnProposal = eventType === "Donated"
      ? Boolean(now?.transactions?.some((item: any) => item.txHash?.toLowerCase() === txHash))
      : eventType === "RefundClaimed"
        ? Boolean(now?.refunds?.some((item: any) => item.txHash?.toLowerCase() === txHash))
        : eventType === "CampaignCreated"
          ? now?.blockchainCreateTxHash?.toLowerCase() === txHash
          : eventType === "CampaignApproved"
            ? now?.blockchainApprovalTxHash?.toLowerCase() === txHash
            : eventType === "CampaignCancelled"
              ? now?.cancelTxHash?.toLowerCase() === txHash
              : eventType === "FundReleased"
                ? now?.releaseTxHash?.toLowerCase() === txHash
                : false;
    if (!alreadyOnProposal) throw new Error("The proposal state changed before this blockchain event could be synchronized.");
    updated = now;
  }

  const alreadyProcessed = await ensureTransactionRecord({ txHash, eventType, proposalId: original._id.toString(), actor: meta.actor, recipient: meta.recipient, amountAtomic: meta.amountAtomic, blockNumber: receipt.blockNumber });
  await writeHistory(group, updated, eventType, meta, txHash);
  if (updated?.refunds) {
    const refundedAtomic = refundsTotalAtomic(updated);
    updated.refundedAmountAtomic = refundedAtomic;
    updated.refundedAmount = displayAmount(BigInt(refundedAtomic));
    await Proposal.updateOne({ _id: proposalId }, { $set: { refundedAmountAtomic: refundedAtomic, refundedAmount: displayAmount(BigInt(refundedAtomic)) } });
  }
  return { proposal: updated, parsedEvent, txFrom: tx.from, alreadyProcessed };
}

function accessCancellable(status?: string) { return status === "CREATED" || status === "APPROVED"; }
