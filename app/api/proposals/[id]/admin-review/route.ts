import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/models/Proposal";
import History from "@/models/History";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { getGroupAccess } from "@/lib/authorization";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
    if (!action) return NextResponse.json({ message: "Action must be approve or reject." }, { status: 400 });

    const proposal = await Proposal.findById(id);
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    if (proposal.contractVersion === 2 && (String(proposal.creatorId) === String(user._id) || !user.walletVerifiedAt || !user.walletAddress || String(proposal.validatedBy) === String(user._id))) return NextResponse.json({ message: "V2 requires distinct, verified creator, validator and admin accounts." }, { status: 403 });
    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.isGroupAdmin) return NextResponse.json({ message: "Only a group admin can review proposals." }, { status: 403 });
    if (proposal.status !== "Validated" || proposal.validationStatus !== "Approved" || proposal.blockchainStatus !== "PENDING") return NextResponse.json({ message: "Only validator-approved pending proposals can receive admin approval." }, { status: 409 });

    if (action === "approve") {
      proposal.adminReviewStatus = "Approved";
      proposal.status = "Approved";
      proposal.adminReviewedBy = user._id;
      proposal.adminReviewedAt = new Date();
      proposal.adminReviewNote = note;
      proposal.approvedBy = user.name;
      proposal.approvedAt = new Date();
    } else {
      proposal.adminReviewStatus = "Rejected";
      proposal.status = "Rejected";
      proposal.adminReviewedBy = user._id;
      proposal.adminReviewedAt = new Date();
      proposal.adminReviewNote = note;
      proposal.approvedBy = user.name;
      proposal.approvedAt = new Date();
    }
    if (proposal.contractVersion === 2) {
      const result = await Proposal.updateOne({ _id: proposal._id, status: "Validated", blockchainStatus: "PENDING" }, { $set: {
        adminReviewStatus: proposal.adminReviewStatus, status: proposal.status, adminReviewedBy: user._id, adminReviewedAt: proposal.adminReviewedAt, adminReviewNote: note, approvedBy: user.name, approvedAt: proposal.approvedAt,
      } });
      if (!result.matchedCount) return NextResponse.json({ message: "Another review already changed this proposal." }, { status: 409 });
    } else await proposal.save();
    await History.create({ organizationId: access.group.organizationId, groupId: access.group._id, proposalId: proposal._id, userId: user._id.toString(), type: "APPROVAL", title: action === "approve" ? "Proposal Approved" : "Proposal Rejected by Admin", description: `${proposal.title} was ${action === "approve" ? "approved" : "rejected"} by ${user.name}.` });
    return NextResponse.json({ message: action === "approve" ? "Proposal approved." : "Proposal rejected.", proposal });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("ADMIN REVIEW ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not review proposal." }, { status: 500 });
  }
}
