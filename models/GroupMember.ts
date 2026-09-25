import mongoose, { Schema, models } from "mongoose";

const GroupMemberSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: "Membership", required: true, index: true },
    role: { type: String, enum: ["Admin", "Validator", "Member"], default: "Member" },
    status: { type: String, enum: ["ACTIVE", "REMOVED"], default: "ACTIVE", index: true },
    assignedAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },
    removedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

GroupMemberSchema.index(
  { groupId: 1, membershipId: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } }
);

export default models.GroupMember || mongoose.model("GroupMember", GroupMemberSchema);
