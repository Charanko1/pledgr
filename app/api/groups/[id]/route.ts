import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Proposal from "@/models/Proposal";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import { getGroupAccess } from "@/lib/authorization";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const access = await getGroupAccess(id, user._id.toString());
    if (!access?.group) return NextResponse.json({ message: "Group not found" }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ message: "You haven't joined this group" }, { status: 403 });

    const [memberCount, proposalCount] = await Promise.all([
      GroupMember.countDocuments({ groupId: id, status: "ACTIVE" }),
      Proposal.countDocuments({ groupId: id }),
    ]);
    const group = await Group.findById(id).lean();
    return NextResponse.json({
      ...group,
      members: memberCount,
      totalProposal: proposalCount,
      isLeader: Boolean(access.isGroupAdmin),
      currentUserId: user._id.toString(),
      currentRole: access.groupRole,
      isValidator: access.isValidator,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET GROUP ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
