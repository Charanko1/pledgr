import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { getGroupAccess } from "@/lib/authorization";
import GroupJoinRequest from "@/models/GroupJoinRequest";
import Membership from "@/models/Membership";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(_req);
    const { id } = await params;
    const access = await getGroupAccess(id, user._id.toString());
    if (!access?.group) return NextResponse.json({ message: "Group not found." }, { status: 404 });
    if (!access.isGroupAdmin) return NextResponse.json({ message: "Only a group admin can view join requests." }, { status: 403 });

    const requests = await GroupJoinRequest.aggregate([
      { $match: { groupId: access.group._id, status: "Pending" } },
      { $lookup: { from: "memberships", localField: "membershipId", foreignField: "_id", as: "member" } },
      { $unwind: "$member" },
      { $project: { _id: 1, membershipId: 1, groupId: 1, memberName: "$member.name", walletAddress: "$member.walletAddress", createdAt: 1 } },
      { $sort: { createdAt: -1 } },
    ]);
    return NextResponse.json(requests);
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET GROUP JOIN REQUESTS ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
