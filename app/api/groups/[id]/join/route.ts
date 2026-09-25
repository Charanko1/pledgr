import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Group from "@/models/Group";
import Membership from "@/models/Membership";
import GroupMember from "@/models/GroupMember";
import GroupJoinRequest from "@/models/GroupJoinRequest";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const group = await Group.findById(id, "organizationId").lean();
    if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

    const membership = await Membership.findOne({ organizationId: group.organizationId, userId: user._id.toString() }, "_id role").lean();
    if (!membership) return NextResponse.json({ message: "You are not a member of this organization" }, { status: 403 });
    if (membership.role === "Admin") return NextResponse.json({ message: "Organization admin is already part of this group." }, { status: 400 });

    const active = await GroupMember.findOne({ groupId: id, membershipId: membership._id, status: "ACTIVE" });
    if (active) return NextResponse.json({ message: "You already joined this group" }, { status: 400 });

    const request = await GroupJoinRequest.findOne({ groupId: id, membershipId: membership._id });
    if (request?.status === "Pending") {
      return NextResponse.json({ message: "Join request already pending" }, { status: 400 });
    }

    // A previously approved request can belong to a member who was later
    // removed from the group. In that case there is no ACTIVE GroupMember,
    // so the user must be allowed to request membership again. Reuse the
    // existing request document instead of creating a duplicate.
    if (request?.status === "Approved") {
      request.status = "Pending";
      await request.save();
      return NextResponse.json({ message: "Join request sent successfully", request }, { status: 200 });
    }

    if (request) {
      request.status = "Pending";
      await request.save();
      return NextResponse.json({ message: "Join request sent successfully", request }, { status: 200 });
    }

    const newRequest = await GroupJoinRequest.create({ groupId: id, membershipId: membership._id, status: "Pending" });
    return NextResponse.json({ message: "Join request sent successfully", request: newRequest }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("JOIN GROUP ERROR:", error);
    return NextResponse.json({ message: error?.code === 11000 ? "A join request is already pending." : "Internal Server Error" }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
