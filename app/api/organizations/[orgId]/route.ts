import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Organization from "@/models/Organization";
import Membership from "@/models/Membership";
import History from "@/models/History";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import GroupJoinRequest from "@/models/GroupJoinRequest";
import Proposal from "@/models/Proposal";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { orgId } = await params;
    const org = await Organization.findOne({ slug: orgId }).lean();
    if (!org) return NextResponse.json({ message: "Organization not found" }, { status: 404 });
    const membership = await Membership.exists({ organizationId: org._id, userId: user._id.toString() });
    if (!membership) return NextResponse.json({ message: "You are not an organization member" }, { status: 403 });
    return NextResponse.json({
      _id: org._id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      treasury: org.treasury,
      members: org.members.length,
      owner: org.owner,
      code: org.code,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET ORGANIZATION ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    const user = await getAuthenticatedUser(req);
    const { orgId } = await params;
    let removed = false;
    await session.withTransaction(async () => {
      const org = await Organization.findById(orgId, "_id").session(session);
      if (!org) throw new Error("Organization not found");
      const leader = await Membership.exists({ organizationId: orgId, userId: user._id.toString(), role: "Admin" }).session(session);
      if (!leader) throw new Error("Only the leader can delete this organization");

      const groups = await Group.find({ organizationId: orgId }, "_id").session(session).lean();
      const groupIds = groups.map((g) => g._id);
      if (groupIds.length) {
        const onChainProposal = await Proposal.findOne({
          groupId: { $in: groupIds },
          blockchainStatus: { $ne: "PENDING" },
        }).session(session).select("_id blockchainStatus").lean();
        if (onChainProposal) {
          throw new Error("This organization cannot be deleted while it contains a proposal registered on the blockchain. Finish or cancel the proposal first.");
        }
        await Proposal.deleteMany({ groupId: { $in: groupIds } }).session(session);
        await GroupJoinRequest.deleteMany({ groupId: { $in: groupIds } }).session(session);
        await GroupMember.deleteMany({ groupId: { $in: groupIds } }).session(session);
      }
      await Group.deleteMany({ organizationId: orgId }).session(session);
      await Membership.deleteMany({ organizationId: orgId }).session(session);
      await History.deleteMany({ organizationId: orgId }).session(session);
      await Organization.deleteOne({ _id: orgId }).session(session);
      removed = true;
    });
    return NextResponse.json({ message: removed ? "Organization deleted successfully" : "Organization not found" });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message === "Organization not found" ? 404 : message.startsWith("Only") ? 403 : message.startsWith("This organization cannot") ? 409 : 500;
    return NextResponse.json({ message: status === 500 ? "Internal Server Error" : message }, { status });
  } finally {
    await session.endSession();
  }
}
