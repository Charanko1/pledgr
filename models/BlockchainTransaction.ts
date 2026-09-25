import mongoose, { Schema, models } from "mongoose";

const BlockchainTransactionSchema = new Schema(
  {
    txHash: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    proposalId: { type: Schema.Types.ObjectId, ref: "Proposal", required: true },
    actor: { type: String, required: true },
    recipient: { type: String, default: "" },
    amountAtomic: { type: String, default: "0" },
    blockNumber: { type: Number, required: true },
  },
  { timestamps: true }
);

export default models.BlockchainTransaction ||
  mongoose.model("BlockchainTransaction", BlockchainTransactionSchema);
