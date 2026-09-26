import GroupMember from "@/models/GroupMember";

// Each group has two unique active-validator slots. The database index, rather
// than a count-then-save check, prevents concurrent appointments exceeding two.
async function occupy(memberId: unknown, groupId: string) {
  for (const slot of [1, 2]) {
    try {
      const result = await GroupMember.findOneAndUpdate({ _id: memberId, groupId, status: "ACTIVE", role: { $in: ["Member", "Validator"] }, validatorSlot: null }, {
        $set: { role: "Validator", validatorSlot: slot, assignedAt: new Date(), removedAt: null, removedBy: null },
      }, { new: true, runValidators: true });
      if (result) return result;
      const current = await GroupMember.findById(memberId);
      if (current?.status === "ACTIVE" && current.role === "Validator" && current.validatorSlot) return current;
      throw new Error("Member changed while being appointed. Refresh and try again.");
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error("This group already has two validators. Remove one before appointing another.");
}

export async function appointValidator(groupId: string, memberId: unknown) {
  await GroupMember.init();
  await GroupMember.collection.createIndex({ groupId: 1, validatorSlot: 1 }, {
    unique: true, partialFilterExpression: { status: "ACTIVE", role: "Validator", validatorSlot: { $type: "number" } },
  });
  const existing = await GroupMember.find({ groupId, status: "ACTIVE", role: "Validator" }).sort({ _id: 1 });
  if (existing.length > 2) throw new Error("This group has more than two existing validators. Remove the extras before making new appointments.");
  // Backfill old records before allocating a slot to another member.
  for (const member of existing) if (!member.validatorSlot) await occupy(member._id, groupId);
  return occupy(memberId, groupId);
}
