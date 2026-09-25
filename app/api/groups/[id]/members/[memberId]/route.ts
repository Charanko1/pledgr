import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Group from "@/models/Group";
import Membership from "@/models/Membership";
import GroupMember from "@/models/GroupMember";
import GroupJoinRequest from "@/models/GroupJoinRequest";
import History from "@/models/History";
import User from "@/models/User";
import Proposal from "@/models/Proposal";

async function getAdmin(groupId: string, userId: string) {
  const group = await Group.findById(groupId, "organizationId leaderId name").lean();
  if (!group) return null;
  const membership = await Membership.findOne({ organizationId: group.organizationId, userId }, "_id role name").lean();
  const isOrgAdmin = membership?.role === "Admin";
  const groupMember = membership
    ? await GroupMember.findOne({ groupId, membershipId: membership._id, status: "ACTIVE" }).lean()
    : null;
  const isGroupLeader = String(group.leaderId) === userId;
  if (!isOrgAdmin && !isGroupLeader && groupMember?.role !== "Admin") return null;
  return { group, membership, groupMember };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id, memberId } = await params;
    const admin = await getAdmin(id, user._id.toString());
    if (!admin) return NextResponse.json({ message: "Only a group admin can manage group members and validators." }, { status: 403 });

    const target = await GroupMember.findOne({ groupId: id, membershipId: memberId, status: "ACTIVE" });
    if (!target) return NextResponse.json({ message: "Member not found in this group." }, { status: 404 });
    const targetMembership = await Membership.findById(memberId, "name userId").lean();
    if (!targetMembership) return NextResponse.json({ message: "Member account not found." }, { status: 404 });
    if (String(targetMembership.userId) === user._id.toString()) return NextResponse.json({ message: "You cannot change your own group role." }, { status: 400 });
    if (target.role === "Admin") return NextResponse.json({ message: "The group admin role cannot be changed here." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (action === "set-validator") {
      const targetUser = await User.findById(targetMembership.userId).select("walletAddress walletVerifiedAt").lean();
      if (!targetUser?.walletAddress || !targetUser.walletVerifiedAt) return NextResponse.json({ message: "The member must verify a MetaMask wallet before becoming a validator." }, { status: 409 });
      target.role = "Validator";
      target.assignedAt = new Date();
      target.removedAt = null;
      target.removedBy = null;
      await target.save();
      await History.create({ organizationId: admin.group.organizationId, groupId: admin.group._id, userId: user._id.toString(), type: "VALIDATOR", title: "Validator Appointed", description: `${targetMembership.name} was appointed as a validator in ${admin.group.name}.` });
      return NextResponse.json({ message: "Member is now a validator." });
    }
    if (action === "remove-validator") {
      target.role = "Member";
      target.assignedAt = null;
      await target.save();
      await History.create({ organizationId: admin.group.organizationId, groupId: admin.group._id, userId: user._id.toString(), type: "VALIDATOR", title: "Validator Role Removed", description: `${targetMembership.name} is now a member in ${admin.group.name}.` });
      return NextResponse.json({ message: "Validator role removed." });
    }
    return NextResponse.json({ message: "Action must be set-validator or remove-validator." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("UPDATE GROUP MEMBER ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not update member." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id, memberId } = await params;
    const admin = await getAdmin(id, user._id.toString());
    if (!admin) return NextResponse.json({ message: "Only a group admin can remove members." }, { status: 403 });

    const target = await GroupMember.findOne({ groupId: id, membershipId: memberId, status: "ACTIVE" });
    if (!target) return NextResponse.json({ message: "Member not found in this group." }, { status: 404 });
    const targetMembership = await Membership.findById(memberId, "name userId").lean();
    if (!targetMembership) return NextResponse.json({ message: "Member account not found." }, { status: 404 });
    if (String(targetMembership.userId) === user._id.toString()) return NextResponse.json({ message: "You cannot remove yourself from the group." }, { status: 400 });
    if (target.role === "Admin") return NextResponse.json({ message: "The group admin cannot be removed from this group." }, { status: 400 });

    if (target.role === "Validator") {
      const remainingValidators = await GroupMember.countDocuments({ groupId: id, status: "ACTIVE", role: "Validator", _id: { $ne: target._id } });
      if (remainingValidators === 0) {
        const activeWorkflow = await Proposal.exists({
          groupId: id,
          status: { $in: ["Pending", "Validated", "Approved", "Funding", "Withdrawal Requested", "Validator Release Approved", "Release Approved", "Release Rejected"] },
        });
        if (activeWorkflow) return NextResponse.json({ message: "This is the group's only active validator and cannot be removed while proposals are in progress." }, { status: 409 });
      }
    }

    target.status = "REMOVED";
    target.role = "Member";
    target.assignedAt = null;
    target.removedAt = new Date();
    target.removedBy = user._id;
    await target.save();
    await GroupJoinRequest.updateMany({ groupId: id, membershipId: memberId, status: "Pending" }, { $set: { status: "Rejected" } });
    await History.create({ organizationId: admin.group.organizationId, groupId: admin.group._id, userId: user._id.toString(), type: "MEMBER", title: "Member Removed", description: `${targetMembership.name} was removed from ${admin.group.name}.` });
    const members = await GroupMember.countDocuments({ groupId: id, status: "ACTIVE" });
    await Group.findByIdAndUpdate(id, { members });
    return NextResponse.json({ message: "Member removed from the group.", members });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("REMOVE GROUP MEMBER ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not remove member." }, { status: 500 });
  }
}
