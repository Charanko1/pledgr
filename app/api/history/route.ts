import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Membership from "@/models/Membership";
import History from "@/models/History";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const memberships = await Membership.find({ userId: user._id.toString() }, "organizationId").lean();
    const organizationIds = memberships.map((m: any) => m.organizationId);
    if (!organizationIds.length) return NextResponse.json([]);
    const histories = await History.find({ organizationId: { $in: organizationIds } })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json(histories);
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET HISTORY ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
