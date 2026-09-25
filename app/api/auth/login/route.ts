import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { generateToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return NextResponse.json({ message: "Email and password are required." }, { status: 400 });

    const user = await User.findOne({ email }).select("_id name email role password walletAddress walletVerifiedAt").lean();
    if (!user || !(await bcrypt.compare(password, user.password))) return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });

    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });
    const response = NextResponse.json({ user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, walletAddress: user.walletAddress || "" } });
    response.cookies.set("trustkas_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
    return response;
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
