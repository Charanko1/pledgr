import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Organization from "@/models/Organization";
import Membership from "@/models/Membership";
import History from "@/models/History";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import GroupJoinRequest from "@/models/GroupJoinRequest";
import Proposal from "@/models/Proposal";

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    if (!organizationId) return NextResponse.json({ message: "Organization is required." }, { status: 400 });

    const membership = await Membership.findOne({ organizationId, userId: user._id.toString() });
    if (!membership) return NextResponse.json({ message: "Membership not found." }, { status: 404 });
    if (membership.role === "Admin") return NextResponse.json({ message: "Leader cannot exit. Delete the organization instead." }, { status: 403 });

    const groups = await Group.find({ organizationId }, "_id").lean();
    const groupIds = groups.map((group) => group._id);
    const activeOwnedProposal = await Proposal.exists({
      groupId: { $in: groupIds },
      creatorId: user._id,
      blockchainStatus: { $in: ["CREATED", "APPROVED"] },
    });
    if (activeOwnedProposal) {
      return NextResponse.json({ message: "You cannot leave this organization while you own an active blockchain fundraising proposal. Cancel or release the proposal first." }, { status: 409 });
    }

    if (groupIds.length) {
      await GroupMember.deleteMany({ groupId: { $in: groupIds }, membershipId: membership._id });
      await GroupJoinRequest.deleteMany({ groupId: { $in: groupIds }, membershipId: membership._id });
      await Promise.all(groupIds.map(async (groupId) => {
        const total = await GroupMember.countDocuments({ groupId });
        await Group.updateOne({ _id: groupId }, { members: total });
      }));
    }

    await Promise.all([
      Membership.deleteOne({ _id: membership._id }),
      Organization.findByIdAndUpdate(organizationId, { $pull: { members: user._id } }),
      History.create({ organizationId, userId: user._id.toString(), type: "APPROVAL", title: "Member Left", description: `${user.name} left the organization.` }),
    ]);
    return NextResponse.json({ message: "Exited successfully." });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("EXIT ORGANIZATION ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
