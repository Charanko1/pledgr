import { Schema, models, model } from "mongoose";

const schema = new Schema({
  proposalId: { type: Schema.Types.ObjectId, ref: "Proposal", required: true },
  nonce: { type: String, required: true },
  requestId: { type: String, required: true },
  amount: { type: String, required: true },
  creator: { type: String, required: true },
  campaignId: { type: String, required: true },
  validUntil: { type: Number, required: true },
  validatorSignature: { type: String, default: "" },
  adminSignature: { type: String, default: "" },
  status: { type: String, enum: ["Requested", "ValidatorApproved", "Approved", "Rejected", "Claimed"], default: "Requested" },
  claimTxHash: { type: String, default: "" },
}, { timestamps: true });
schema.index({ proposalId: 1, nonce: 1 }, { unique: true });
export default models.WithdrawalRequest || model("WithdrawalRequest", schema);
