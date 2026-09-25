import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Group from "@/models/Group";
import Organization from "@/models/Organization";
import Membership from "@/models/Membership";
import GroupMember from "@/models/GroupMember";
import GroupJoinRequest from "@/models/GroupJoinRequest";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const slug = req.nextUrl.searchParams.get("organization")?.trim();
    if (!slug) return NextResponse.json([]);
    const org = await Organization.findOne({ slug }, "_id").lean();
    if (!org) return NextResponse.json([]);
    const membership = await Membership.findOne({ organizationId: org._id, userId: user._id.toString() }, "_id role").lean();
    if (!membership) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const groups = await Group.find({ organizationId: org._id }).sort({ createdAt: -1 }).lean();
    const groupIds = groups.map((g) => g._id);
    const [counts, joined, pending] = await Promise.all([
      GroupMember.aggregate([{ $match: { groupId: { $in: groupIds }, status: "ACTIVE" } }, { $group: { _id: "$groupId", total: { $sum: 1 } } }]),
      GroupMember.find({ membershipId: membership._id, groupId: { $in: groupIds }, status: "ACTIVE" }, "groupId").lean(),
      GroupJoinRequest.find({ membershipId: membership._id, status: "Pending", groupId: { $in: groupIds } }, "groupId").lean(),
    ]);
    const countMap = new Map(counts.map((c: any) => [String(c._id), c.total]));
    const joinedSet = new Set(joined.map((j: any) => String(j.groupId)));
    const pendingSet = new Set(pending.map((p: any) => String(p.groupId)));
    return NextResponse.json(groups.map((g: any) => ({ ...g, members: countMap.get(String(g._id)) ?? 0, joined: joinedSet.has(String(g._id)), pending: pendingSet.has(String(g._id)) })));
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET GROUPS ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const organizationSlug = typeof body.organizationSlug === "string" ? body.organizationSlug.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!organizationSlug || !name || name.length > 120) return NextResponse.json({ message: "Organization and valid group name are required." }, { status: 400 });
    const org = await Organization.findOne({ slug: organizationSlug }).lean();
    if (!org) return NextResponse.json({ message: "Organization not found" }, { status: 404 });
    if (String(org.owner) !== user._id.toString()) return NextResponse.json({ message: "Only the organization leader can create groups" }, { status: 403 });
    const leader = await Membership.findOne({ organizationId: org._id, userId: user._id.toString(), role: "Admin" }).lean();
    if (!leader) return NextResponse.json({ message: "Leader membership not found" }, { status: 403 });
    const group = await Group.create({ name, description, organizationId: org._id, organizationSlug: org.slug, organizationName: org.name, leader: leader.name, leaderId: user._id.toString(), members: 1 });
    try {
      await GroupMember.create({ groupId: group._id, membershipId: leader._id, role: "Admin", status: "ACTIVE" });
    } catch (error) {
      await Group.deleteOne({ _id: group._id });
      throw error;
    }
    return NextResponse.json(group, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("CREATE GROUP ERROR:", error);
    return NextResponse.json({ message: error?.code === 11000 ? "Group already exists for this leader." : error instanceof Error ? error.message : "Internal Server Error" }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
