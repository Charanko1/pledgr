import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Organization from "@/models/Organization";
import Membership from "@/models/Membership";

async function generateUniqueSlug(base: string) {
  const safe = base.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  const root = safe || `org-${randomBytes(4).toString("hex")}`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = attempt === 0 ? "" : `-${randomBytes(3).toString("hex")}`;
    const slug = `${root}${suffix}`;
    if (!(await Organization.exists({ slug }))) return slug;
  }
  throw new Error("Could not generate a unique organization slug.");
}

async function generateUniqueInviteCode(name: string) {
  const prefix = name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4) || "TRST";
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
    if (!(await Organization.exists({ code }))) return code;
  }
  throw new Error("Could not generate a unique invitation code.");
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const organizations = await Membership.aggregate([
      { $match: { userId: user._id.toString() } },
      { $lookup: { from: "organizations", localField: "organizationId", foreignField: "_id", as: "organization" } },
      { $unwind: "$organization" },
      { $project: { _id: "$organization._id", name: "$organization.name", slug: "$organization.slug", description: "$organization.description", treasury: "$organization.treasury", members: { $size: { $ifNull: ["$organization.members", []] } }, owner: "$organization.owner", code: "$organization.code" } },
    ]);
    return NextResponse.json(organizations);
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET ORGANIZATIONS ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!name || name.length > 120) return NextResponse.json({ message: "A valid organization name is required." }, { status: 400 });
    if (description.length > 2000) return NextResponse.json({ message: "Organization description is too long." }, { status: 400 });

    const slug = await generateUniqueSlug(typeof body.slug === "string" && body.slug.trim() ? body.slug : name);
    const code = await generateUniqueInviteCode(name);
    const organization = await Organization.create({ name, slug, description, code, treasury: 0, owner: user._id, members: [user._id] });
    try {
      await Membership.create({ organizationId: organization._id, userId: user._id.toString(), name: user.name, walletAddress: user.walletAddress || "", role: "Admin" });
    } catch (error) {
      await Organization.deleteOne({ _id: organization._id });
      throw error;
    }

    return NextResponse.json({ message: "Organization created", organization }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("CREATE ORGANIZATION ERROR:", error);
    return NextResponse.json({ message: error?.code === 11000 ? "Organization slug or invitation code already exists. Please try again." : error instanceof Error ? error.message : "Internal Server Error" }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
