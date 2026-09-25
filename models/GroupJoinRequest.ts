import mongoose, { Schema, models } from "mongoose";

const GroupJoinRequestSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: "Membership", required: true, index: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending", index: true },
  },
  { timestamps: true }
);

GroupJoinRequestSchema.index(
  { groupId: 1, membershipId: 1 },
  { unique: true, partialFilterExpression: { status: "Pending" } }
);

export default models.GroupJoinRequest || mongoose.model("GroupJoinRequest", GroupJoinRequestSchema);
