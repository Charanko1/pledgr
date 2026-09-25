import { NextRequest, NextResponse } from "next/server";
import { getAddress, isHexString } from "ethers";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Proposal from "@/models/Proposal";
import History from "@/models/History";
import { getGroupAccess } from "@/lib/authorization";
import { syncVerifiedBlockchainEvent } from "@/lib/blockchain-sync";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const proposal = await Proposal.findById(id);
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const isCreator = Boolean(proposal.creatorId && proposal.creatorId.toString() === user._id.toString());
    const canCancel = isCreator || access.isGroupAdmin;
    if (!canCancel) return NextResponse.json({ message: "Only the fundraiser or group admin can cancel this proposal." }, { status: 403 });
    if (["RELEASED", "CANCELLED"].includes(proposal.blockchainStatus || "")) return NextResponse.json({ message: "This proposal cannot be cancelled again." }, { status: 409 });
    if (["Released", "Cancelled"].includes(proposal.status)) return NextResponse.json({ message: "This proposal is already closed." }, { status: 409 });
    if (proposal.withdrawalStatus === "Requested" || proposal.withdrawalStatus === "ValidatorApproved" || proposal.withdrawalStatus === "AdminApproved") return NextResponse.json({ message: "A withdrawal review is in progress; the proposal cannot be cancelled until that review is resolved." }, { status: 409 });

    const body = await req.json().catch(() => ({}));
    const txHash = typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";

    // Before blockchain registration, cancellation is an application-level state change.
    if (proposal.blockchainStatus === "PENDING") {
      if (!["Pending", "Validated", "Approved", "Release Rejected"].includes(proposal.status)) return NextResponse.json({ message: "This proposal cannot be cancelled at its current stage." }, { status: 409 });
      proposal.status = "Cancelled";
      proposal.cancelledAt = new Date();
      proposal.withdrawalStatus = "None";
      await proposal.save();
      await History.create({ organizationId: access.group.organizationId, groupId: access.group._id, proposalId: proposal._id, userId: user._id.toString(), type: "CANCEL", title: "Proposal Cancelled", description: `${proposal.title} was cancelled before blockchain funding.` });
      return NextResponse.json({ message: "Proposal cancelled.", proposal, onChain: false });
    }

    if (!user.walletAddress || !user.walletVerifiedAt) return NextResponse.json({ message: "Verify your MetaMask wallet before cancelling." }, { status: 403 });
    if (!isHexString(txHash, 32)) return NextResponse.json({ message: "A valid cancellation transaction hash is required." }, { status: 400 });

    const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash, eventType: "CampaignCancelled", expectedEventActor: user.walletAddress });
    const actor = getAddress(String(result.parsedEvent.args[1]));
    if (actor !== getAddress(user.walletAddress)) return NextResponse.json({ message: "The cancellation transaction belongs to a different wallet." }, { status: 403 });
    return NextResponse.json({ message: result.alreadyProcessed ? "Cancellation was already synchronized." : "Proposal cancelled successfully.", proposal: result.proposal, alreadyProcessed: result.alreadyProcessed, onChain: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("CANCEL PROPOSAL ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not cancel the proposal." }, { status: 409 });
  }
}
