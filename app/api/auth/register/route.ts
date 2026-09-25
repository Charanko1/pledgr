import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!name || !email || !password) return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    if (name.length > 100) return NextResponse.json({ message: "Name is too long." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
    if (await User.exists({ email })) return NextResponse.json({ message: "Email already exists" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: passwordHash, role: "member", walletAddress: "" });
    return NextResponse.json({ message: "Register success", user: { id: user._id, name: user.name, email: user.email, role: user.role, walletAddress: "" } }, { status: 201 });
  } catch (error: any) {
    console.error("REGISTER ERROR:", error);
    return NextResponse.json({ message: error?.code === 11000 ? "Email already exists" : "Internal server error" }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
