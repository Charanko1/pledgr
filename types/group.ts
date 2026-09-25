export type GroupRole = "Admin" | "Validator" | "Member";

export interface Member {
  _id: string;
  membershipId: string;
  userId: string;
  name: string;
  email?: string;
  role: GroupRole;
  status: "ACTIVE" | "REMOVED";
  walletAddress?: string;
}

export interface GroupData {
  _id: string;
  name: string;
  description: string;
  leader: string;
  leaderId?: string;
  organizationId?: string;
  organizationName: string;
  organizationSlug?: string;
  members: number;
  totalProposal: number;
  isLeader: boolean;
  currentUserId?: string;
  currentRole: GroupRole;
  isValidator: boolean;
}

export type ProposalStatus =
  | "Pending"
  | "Validated"
  | "Approved"
  | "Funding"
  | "Withdrawal Requested"
  | "Validator Release Approved"
  | "Release Approved"
  | "Release Rejected"
  | "Rejected"
  | "Cancelled"
  | "Released";

export interface Proposal {
  _id: string;
  title: string;
  description: string;
  creator: string;
  creatorId?: string;
  creatorProfile?: { _id: string; name: string; email?: string } | null;
  recipientWallet: string;
  targetAmount: string;
  targetAmountAtomic: string;
  fundedAmount: string;
  fundedAmountAtomic: string;
  status: ProposalStatus;
  approvedBy?: string;
  approvedAt?: string;
  deadline: string;
  validationStatus: "Pending" | "Approved" | "Rejected";
  validatedBy?: string | null;
  validatedAt?: string | null;
  validationNote?: string;
  adminReviewStatus: "Pending" | "Approved" | "Rejected";
  adminReviewedBy?: string | null;
  adminReviewedAt?: string | null;
  adminReviewNote?: string;
  withdrawalStatus: "None" | "Requested" | "ValidatorApproved" | "AdminApproved" | "Rejected";
  withdrawalRequestedAt?: string | null;
  validatorReleaseApprovedBy?: string | null;
  validatorReleaseApprovedAt?: string | null;
  validatorReleaseNote?: string;
  adminReleaseApprovedBy?: string | null;
  adminReleaseApprovedAt?: string | null;
  adminReleaseNote?: string;
  releaseRejectedBy?: string | null;
  releaseRejectedAt?: string | null;
  releaseRejectedReason?: string;
  blockchainStatus?: "PENDING" | "CREATED" | "APPROVED" | "CANCELLED" | "RELEASED";
  blockchainCreateTxHash?: string;
  blockchainApprovalTxHash?: string;
  withdrawalRequestTxHash?: string;
  validatorReleaseApprovalTxHash?: string;
  validatorReleaseResetTxHash?: string;
  adminReleaseApprovalTxHash?: string;
  releaseTxHash?: string;
  cancelTxHash?: string;
  releasedAmount?: string;
  releasedAmountAtomic?: string;
  releasedAt?: string;
  cancelledAt?: string;
  refundedAmount?: string;
  refundedAmountAtomic?: string;
  refunds?: { amount: string; amountAtomic: string; txHash: string; donor: string; refundedAt?: string }[];
  transactions?: { amount: string; amountAtomic: string; txHash: string; donor: string; donatedAt?: string }[];
}

export interface CreateProposalData {
  title: string;
  description: string;
  target: string;
  deadline: string;
}
