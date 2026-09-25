import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import GroupMember from "@/models/GroupMember";
import { getGroupAccess } from "@/lib/authorization";
import Membership from "@/models/Membership";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const access = await getGroupAccess(id, user._id.toString());
    if (!access?.group) return NextResponse.json({ message: "Group not found" }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const members = await GroupMember.find({ groupId: id, status: "ACTIVE" })
      .populate({ path: "membershipId", select: "_id userId name walletAddress", model: Membership })
      .sort({ role: 1, createdAt: 1 })
      .lean();

    return NextResponse.json(
      members
        .filter((m: any) => m.membershipId)
        .map((m: any) => ({
          _id: String(m.membershipId._id),
          membershipId: String(m.membershipId._id),
          userId: String(m.membershipId.userId),
          name: m.membershipId.name,
          walletAddress: m.membershipId.walletAddress || "",
          role: m.role,
          status: m.status,
        }))
    );
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET GROUP MEMBERS ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
