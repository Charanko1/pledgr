import { getAddress } from "ethers";
import { getGroupAccess } from "@/lib/authorization";
import GroupMember from "@/models/GroupMember";
import Proposal from "@/models/Proposal";
import History from "@/models/History";
import { policyForCreator, proposalApproved, type ApprovalPolicy } from "@/lib/approval-policy";

export async function newApprovalPolicy(groupId: string, creatorId: string) {
  const access = await getGroupAccess(groupId, creatorId);
  if (!access?.allowed) throw new Error("Creator must be an active organization/group member.");
  const count = await GroupMember.countDocuments({ groupId, status: "ACTIVE", role: "Validator" });
  return policyForCreator(access.groupRole, count);
}
export async function readApprovalPolicy(p: any): Promise<ApprovalPolicy> {
  if (p.approvalPolicy) return p.approvalPolicy;
  // Existing on-chain policies and already signed registrations cannot be
  // weakened by a database/UI update.
  if (p.blockchainStatus !== "PENDING" || p.registration?.validatorSignature || p.registration?.adminSignature) {
    return { version: 0, creatorRole: "Member", requireValidator: true, requireAdmin: true };
  }
  return newApprovalPolicy(String(p.groupId), String(p.creatorId?._id || p.creatorId));
}
export async function ensureApprovalPolicy(p: any) {
  if (p.approvalPolicy) return p;
  const policy = await readApprovalPolicy(p);
  const status = ["Pending", "Validated", "Approved"].includes(p.status)
    ? (proposalApproved(policy, p) ? "Approved" : "Pending") : p.status;
  const update: any = { $set: { approvalPolicy: policy, status } };
  if (policy.version === 1) update.$unset = { registration: 1 };
  await Proposal.updateOne({ _id: p._id, approvalPolicy: { $exists: false }, blockchainStatus: p.blockchainStatus,
    status: p.status, validationStatus: p.validationStatus, adminReviewStatus: p.adminReviewStatus,
    ...(policy.version === 1 ? { "registration.validatorSignature": { $in: [null, ""] }, "registration.adminSignature": { $in: [null, ""] } } : {}),
  }, update);
  const current = await Proposal.findById(p._id);
  if (!current?.approvalPolicy) throw new Error("Proposal changed. Refresh before reviewing again.");
  return current;
}
export async function reviewProposal(p: any, user: any, role: "validator" | "admin", action: "approve" | "reject", note: string) {
  p = await ensureApprovalPolicy(p);
  const policy: ApprovalPolicy = p.approvalPolicy;
  const creatorId = String(p.creatorId?._id || p.creatorId);
  if (creatorId === String(user._id) || (user.walletAddress && getAddress(user.walletAddress) === getAddress(p.recipientWallet))) throw new Error("You created this proposal. Only the required other reviewers can approve it.");
  if (!user.walletVerifiedAt || !user.walletAddress) throw new Error("Verify your wallet before reviewing a proposal.");
  const access = await getGroupAccess(String(p.groupId), String(user._id));
  if (!access?.allowed || (role === "validator" ? !access.isValidator || !policy.requireValidator : !access.isGroupAdmin || !policy.requireAdmin)) throw new Error("This proposal does not require an approval from your role.");
  const field = role === "validator" ? "validationStatus" : "adminReviewStatus";
  const by = role === "validator" ? "validatedBy" : "adminReviewedBy";
  const at = role === "validator" ? "validatedAt" : "adminReviewedAt";
  const noteField = role === "validator" ? "validationNote" : "adminReviewNote";
  const allApproved = { $and: [policy.requireValidator ? { $eq: ["$validationStatus", "Approved"] } : true, policy.requireAdmin ? { $eq: ["$adminReviewStatus", "Approved"] } : true] };
  const result = await Proposal.findOneAndUpdate({ _id: p._id, blockchainStatus: "PENDING", status: { $in: ["Pending", "Validated"] }, [field]: "Pending" }, [
    { $set: { [field]: action === "approve" ? "Approved" : "Rejected", [by]: user._id, [at]: new Date(), [noteField]: { $literal: note } } },
    { $set: { status: action === "reject" ? "Rejected" : { $cond: [allApproved, "Approved", "Pending"] } } },
  ], { new: true, updatePipeline: true });
  if (!result) throw new Error("This review was already recorded or the proposal is no longer awaiting review.");
  await History.create({ organizationId: access.group.organizationId, groupId: p.groupId, proposalId: p._id, userId: String(user._id), type: "APPROVAL", title: `Proposal ${action === "approve" ? "approved" : "rejected"} by ${role}`, description: `${p.title}: ${user.name}` });
  return result;
}
