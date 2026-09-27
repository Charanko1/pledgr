import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Membership from "@/models/Membership";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    return NextResponse.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress || "",
      walletVerifiedAt: user.walletVerifiedAt,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET PROFILE ERROR:", error);
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) return NextResponse.json({ message: "A valid name is required." }, { status: 400 });

    const email = body.email === undefined ? user.email : typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
    if (email !== user.email) {
      const credentials = await User.findById(user._id).select("password").lean();
      if (typeof body.currentPassword !== "string" || !body.currentPassword || !credentials || !(await bcrypt.compare(body.currentPassword, credentials.password))) {
        return NextResponse.json({ message: "Enter your current password to change your email address." }, { status: 403 });
      }
      if (await User.exists({ email, _id: { $ne: user._id } })) return NextResponse.json({ message: "That email address is already in use." }, { status: 409 });
    }

    user.name = name;
    user.email = email;
    await user.save();
    await Membership.updateMany({ userId: user._id.toString() }, { name });
    return NextResponse.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress || "",
      walletVerifiedAt: user.walletVerifiedAt,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    if ((error as { code?: number })?.code === 11000) return NextResponse.json({ message: "That email address is already in use." }, { status: 409 });
    console.error("UPDATE PROFILE ERROR:", error);
    return NextResponse.json({ message: "Could not update profile." }, { status: 500 });
  }
}
