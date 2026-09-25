import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/models/Proposal";
import History from "@/models/History";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { getGroupAccess } from "@/lib/authorization";
import { isHexString } from "ethers";
import { syncVerifiedBlockchainEvent } from "@/lib/blockchain-sync";

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
    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!["Requested", "ValidatorApproved"].includes(proposal.withdrawalStatus)) return NextResponse.json({ message: "This withdrawal is not awaiting the current review stage." }, { status: 409 });

    if (action === "reject") {
      if (!access.isValidator && !access.isGroupAdmin) return NextResponse.json({ message: "Only a validator or group admin can reject a withdrawal." }, { status: 403 });
      if (!["Requested", "ValidatorApproved"].includes(proposal.withdrawalStatus)) return NextResponse.json({ message: "This withdrawal is not awaiting review." }, { status: 409 });
      const resetTxHash = typeof body.resetTxHash === "string" ? body.resetTxHash.trim().toLowerCase() : "";
      if (proposal.withdrawalStatus === "ValidatorApproved" && access.isGroupAdmin) {
        if (!isHexString(resetTxHash, 32)) return NextResponse.json({ message: "Admin rejection after validator approval requires a verified blockchain reset transaction." }, { status: 400 });
        await syncVerifiedBlockchainEvent({ proposalId: id, txHash: resetTxHash, eventType: "ValidatorReleaseApprovalReset", expectedTxFrom: user.walletAddress });
      }
      proposal.withdrawalStatus = "Rejected";
      proposal.status = "Release Rejected";
      proposal.releaseRejectedBy = user._id;
      proposal.releaseRejectedAt = new Date();
      proposal.releaseRejectedReason = note || "Withdrawal request rejected.";
      await proposal.save();
    } else {
      const blockchainTxHash = typeof body.blockchainTxHash === "string" ? body.blockchainTxHash.trim().toLowerCase() : "";
      const approvalType = body.blockchainApprovalType === "validator" ? "validator" : body.blockchainApprovalType === "admin" ? "admin" : "";
      if (!isHexString(blockchainTxHash, 32) || !approvalType) return NextResponse.json({ message: "A verified blockchain approval transaction is required." }, { status: 400 });
      const expectedType = access.isValidator && !access.isGroupAdmin ? "validator" : access.isGroupAdmin ? "admin" : "";
      if (expectedType !== approvalType) return NextResponse.json({ message: "You cannot submit an approval for another role." }, { status: 403 });
      const eventType = approvalType === "validator" ? "ValidatorReleaseApproved" : "AdminReleaseApproved";
      const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash: blockchainTxHash, eventType, expectedEventActor: approvalType === "validator" ? user.walletAddress : undefined, expectedTxFrom: approvalType === "admin" ? user.walletAddress : undefined });
      await Proposal.updateOne({ _id: id }, approvalType === "validator"
        ? { $set: { validatorReleaseApprovedBy: user._id, ...(note ? { validatorReleaseNote: note } : {}) } }
        : { $set: { adminReleaseApprovedBy: user._id, ...(note ? { adminReleaseNote: note } : {}) } });
      const title = approvalType === "validator" ? "Withdrawal Validated" : "Withdrawal Approved by Admin";
      return NextResponse.json({ message: title, proposal: result.proposal });
    }

    const title = action === "reject" ? "Withdrawal Rejected" : access.isValidator && !access.isGroupAdmin ? "Withdrawal Validated" : "Withdrawal Approved by Admin";
    await History.create({ organizationId: access.group.organizationId, groupId: access.group._id, proposalId: proposal._id, userId: user._id.toString(), type: "APPROVAL", title, description: `${proposal.title}: ${title.toLowerCase()}.` });
    return NextResponse.json({ message: title, proposal });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("WITHDRAWAL REVIEW ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not review withdrawal." }, { status: 409 });
  }
}
