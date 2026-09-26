export type CreatorRole = "Admin" | "Validator" | "Member";
export interface ApprovalPolicy {
  version: number;
  creatorRole: CreatorRole;
  requireAdmin: boolean;
  requireValidator: boolean;
}

export function policyForCreator(creatorRole: CreatorRole, validatorCount: number): ApprovalPolicy {
  return { version: 1, creatorRole, requireAdmin: creatorRole !== "Admin", requireValidator: creatorRole !== "Validator" || validatorCount >= 2 };
}
export function proposalApproved(policy: ApprovalPolicy, proposal: { validationStatus?: string; adminReviewStatus?: string }) {
  return (!policy.requireValidator || proposal.validationStatus === "Approved") && (!policy.requireAdmin || proposal.adminReviewStatus === "Approved");
}
export function approvalLabel(policy: ApprovalPolicy) {
  return policy.requireAdmin && policy.requireValidator ? "Admin + validator (either order)" : policy.requireAdmin ? "Admin only" : "Validator only";
}
