import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, authErrorResponse } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress || "",
        walletVerifiedAt: user.walletVerifiedAt || null,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
