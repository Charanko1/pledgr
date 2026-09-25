import { Schema, model, models } from "mongoose";

const ProposalSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    creator: { type: String, required: true, trim: true },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    recipientWallet: { type: String, required: true, trim: true },

    targetAmount: { type: String, required: true },
    targetAmountAtomic: { type: String, required: true, default: "0" },
    fundedAmount: { type: String, default: "0" },
    fundedAmountAtomic: { type: String, default: "0" },
    releasedAmount: { type: String, default: "0" },
    releasedAmountAtomic: { type: String, default: "0" },
    refundedAmount: { type: String, default: "0" },
    refundedAmountAtomic: { type: String, default: "0" },

    status: {
      type: String,
      enum: [
        "Pending",
        "Validated",
        "Approved",
        "Funding",
        "Withdrawal Requested",
        "Validator Release Approved",
        "Release Approved",
        "Release Rejected",
        "Rejected",
        "Cancelled",
        "Released",
      ],
      default: "Pending",
      index: true,
    },

    validationStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    validatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    validatedAt: { type: Date, default: null },
    validationNote: { type: String, default: "", trim: true, maxlength: 1000 },

    adminReviewStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    adminReviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    adminReviewedAt: { type: Date, default: null },
    adminReviewNote: { type: String, default: "", trim: true, maxlength: 1000 },

    withdrawalStatus: { type: String, enum: ["None", "Requested", "ValidatorApproved", "AdminApproved", "Rejected"], default: "None" },
    withdrawalRequestedAt: { type: Date, default: null },
    validatorReleaseApprovedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    validatorReleaseApprovedAt: { type: Date, default: null },
    validatorReleaseNote: { type: String, default: "", trim: true, maxlength: 1000 },
    adminReleaseApprovedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    adminReleaseApprovedAt: { type: Date, default: null },
    adminReleaseNote: { type: String, default: "", trim: true, maxlength: 1000 },
    releaseRejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    releaseRejectedAt: { type: Date, default: null },
    releaseRejectedReason: { type: String, default: "", trim: true, maxlength: 1000 },

    blockchainStatus: { type: String, enum: ["PENDING", "CREATED", "APPROVED", "CANCELLED", "RELEASED"], default: "PENDING", index: true },
    blockchainCreateTxHash: { type: String, default: "", trim: true },
    blockchainApprovalTxHash: { type: String, default: "", trim: true },
    withdrawalRequestTxHash: { type: String, default: "", trim: true },
    validatorReleaseApprovalTxHash: { type: String, default: "", trim: true },
    validatorReleaseResetTxHash: { type: String, default: "", trim: true },
    adminReleaseApprovalTxHash: { type: String, default: "", trim: true },
    releaseTxHash: { type: String, default: "", trim: true },
    cancelTxHash: { type: String, default: "", trim: true },

    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    deadline: { type: Date, required: true, index: true },

    refunds: [{
      amount: { type: String, required: true },
      amountAtomic: { type: String, required: true, default: "0" },
      txHash: { type: String, required: true },
      donor: { type: String, required: true },
      refundedAt: { type: Date, default: Date.now },
    }],
    transactions: [{
      amount: { type: String, required: true },
      amountAtomic: { type: String, required: true, default: "0" },
      txHash: { type: String, required: true },
      donor: { type: String, default: "" },
      donatedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

export default models.Proposal || model("Proposal", ProposalSchema);
