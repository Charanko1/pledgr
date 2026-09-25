import mongoose, { Schema, models } from "mongoose";

const HistorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    proposalId: { type: Schema.Types.ObjectId, ref: "Proposal", default: null, index: true },
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["DONATION", "WITHDRAW", "RELEASE", "PROPOSAL", "APPROVAL", "VALIDATOR", "MEMBER", "CANCEL", "REFUND"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    amount: { type: String, default: "0" },
    amountAtomic: { type: String, default: "0" },
    txHash: { type: String, default: "", index: true },
    blockchainEventKey: { type: String, default: "" },
  },
  { timestamps: true }
);


// A deterministic event key prevents duplicate blockchain history rows while
// remaining compatible with legacy history rows that may share a txHash.
HistorySchema.index(
  { blockchainEventKey: 1 },
  { unique: true, partialFilterExpression: { blockchainEventKey: { $gt: "" } } }
);

export default models.History || mongoose.model("History", HistorySchema);
