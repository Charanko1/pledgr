import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import GroupJoinRequest from "@/models/GroupJoinRequest";
import Membership from "@/models/Membership";
import History from "@/models/History";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { requestId } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (action !== "Approved" && action !== "Rejected") return NextResponse.json({ message: "Action must be Approved or Rejected." }, { status: 400 });

    const request = await GroupJoinRequest.findById(requestId);
    if (!request) return NextResponse.json({ message: "Request not found" }, { status: 404 });
    if (request.status !== "Pending") return NextResponse.json({ message: "This join request is no longer pending." }, { status: 409 });
    const group = await Group.findById(request.groupId);
    if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

    const adminMembership = await Membership.findOne({ organizationId: group.organizationId, userId: user._id.toString(), role: "Admin" }).lean();
    const isGroupLeader = String(group.leaderId) === user._id.toString();
    if (!adminMembership && !isGroupLeader) return NextResponse.json({ message: "Only a group admin can manage join requests." }, { status: 403 });

    const targetMembership = await Membership.findOne({ _id: request.membershipId, organizationId: group.organizationId }).lean();
    if (!targetMembership) return NextResponse.json({ message: "The member record for this request no longer exists." }, { status: 409 });

    if (action === "Rejected") {
      request.status = "Rejected";
      await request.save();
      await History.create({
        organizationId: group.organizationId,
        groupId: group._id,
        userId: user._id.toString(),
        type: "APPROVAL",
        title: "Join Request Rejected",
        description: String(targetMembership.name) + "'s request to join " + String(group.name) + " was rejected.",
      });
      return NextResponse.json({ message: "Request rejected" });
    }

    const existing = await GroupMember.findOne({ groupId: group._id, membershipId: request.membershipId });
    if (existing) {
      existing.status = "ACTIVE";
      existing.role = "Member";
      existing.removedAt = null;
      existing.removedBy = null;
      await existing.save();
    } else {
      await GroupMember.create({ groupId: group._id, membershipId: request.membershipId, role: "Member", status: "ACTIVE" });
    }

    request.status = "Approved";
    await request.save();
    const total = await GroupMember.countDocuments({ groupId: group._id, status: "ACTIVE" });
    await Group.updateOne({ _id: group._id }, { members: total });
    await History.create({
      organizationId: group.organizationId,
      groupId: group._id,
      userId: user._id.toString(),
      type: "APPROVAL",
      title: "Join Request Approved",
      description: String(targetMembership.name) + " joined " + String(group.name) + ".",
    });
    return NextResponse.json({ message: "Member approved successfully", members: total });
  } catch (error: any) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("UPDATE JOIN REQUEST ERROR:", error);
    return NextResponse.json({ message: error?.code === 11000 ? "Member already belongs to this group." : "Internal Server Error" }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
