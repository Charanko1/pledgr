import Group from "@/models/Group";
import Membership from "@/models/Membership";
import GroupMember from "@/models/GroupMember";

export async function getGroupAccess(groupId: string, userId: string) {
  const group = await Group.findById(groupId)
    .select("organizationId leaderId name organizationSlug organizationName")
    .lean();
  if (!group) return null;

  const membership = await Membership.findOne({ organizationId: group.organizationId, userId })
    .select("_id role name userId walletAddress")
    .lean();
  if (!membership) {
    return {
      group,
      membership: null,
      groupMember: null,
      groupRole: "Member" as const,
      isOrgAdmin: false,
      isGroupLeader: false,
      isGroupAdmin: false,
      isValidator: false,
      isGroupMember: false,
      allowed: false,
      currentUserId: userId,
    };
  }

  const groupMember = await GroupMember.findOne({
    groupId,
    membershipId: membership._id,
    status: "ACTIVE",
  }).select("_id role status").lean();

  const isOrgAdmin = membership.role === "Admin";
  const isGroupLeader = String(group.leaderId) === userId;
  const isGroupAdmin = isOrgAdmin || isGroupLeader || groupMember?.role === "Admin";
  const isValidator = groupMember?.role === "Validator" && groupMember.status === "ACTIVE";
  const isGroupMember = Boolean(groupMember);
  const allowed = isGroupAdmin || isValidator || isGroupMember;

  return {
    group,
    membership,
    groupMember,
    groupRole: (isGroupAdmin ? "Admin" : isValidator ? "Validator" : "Member") as "Admin" | "Validator" | "Member",
    isOrgAdmin,
    isGroupLeader,
    isGroupAdmin,
    isValidator,
    isGroupMember,
    allowed,
    currentUserId: userId,
  };
}

export async function canViewGroup(groupId: string, userId: string) {
  return (await getGroupAccess(groupId, userId))?.allowed ?? false;
}

export async function isOrganizationAdmin(organizationId: string, userId: string) {
  return Boolean(await Membership.exists({ organizationId, userId, role: "Admin" }));
}
