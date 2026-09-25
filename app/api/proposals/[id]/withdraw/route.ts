import { NextRequest, NextResponse } from "next/server";
import { getAddress, isHexString } from "ethers";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/models/Proposal";
import History from "@/models/History";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { getGroupAccess } from "@/lib/authorization";
import { getServerContract } from "@/lib/blockchain-server";
import { syncVerifiedBlockchainEvent } from "@/lib/blockchain-sync";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const txHash = typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";
    const proposal = await Proposal.findById(id);
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });

    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!proposal.creatorId || proposal.creatorId.toString() !== user._id.toString()) return NextResponse.json({ message: "Only the fundraiser can request withdrawal." }, { status: 403 });
    if (proposal.blockchainStatus !== "APPROVED" || !["Funding", "Release Rejected"].includes(proposal.status)) {
      return NextResponse.json({ message: "The campaign must be active on-chain before withdrawal." }, { status: 409 });
    }
    if (["Requested", "ValidatorApproved", "AdminApproved"].includes(proposal.withdrawalStatus)) {
      return NextResponse.json({ message: "A withdrawal request is already in progress." }, { status: 409 });
    }
    if (!user.walletAddress || !user.walletVerifiedAt) return NextResponse.json({ message: "Verify your fundraiser wallet before requesting withdrawal." }, { status: 403 });
    if (getAddress(user.walletAddress) !== getAddress(proposal.recipientWallet)) return NextResponse.json({ message: "Connected wallet does not match the fundraiser wallet." }, { status: 403 });

    const campaign = await getServerContract().getCampaign(id);
    const totalRaised = BigInt(campaign.totalRaised);
    const target = BigInt(campaign.targetAmount);
    const deadline = Number(campaign.deadline);
    if (!campaign.approved || campaign.cancelled || campaign.released) return NextResponse.json({ message: "The campaign is not eligible for withdrawal." }, { status: 409 });
    if (totalRaised <= 0n) return NextResponse.json({ message: "There are no BOT funds to withdraw." }, { status: 409 });
    if (totalRaised < target && Math.floor(Date.now() / 1000) < deadline) return NextResponse.json({ message: "Withdrawal becomes available when the target is reached or the deadline passes." }, { status: 409 });

    if (proposal.status === "Release Rejected") {
      // A rejection is an application review outcome; the on-chain withdrawal
      // request remains valid, and the next validator review starts fresh.
      proposal.withdrawalStatus = "Requested";
      proposal.withdrawalRequestedAt = new Date();
      proposal.status = "Withdrawal Requested";
      proposal.validatorReleaseApprovedBy = null;
      proposal.validatorReleaseApprovedAt = null;
      proposal.validatorReleaseNote = "";
      proposal.adminReleaseApprovedBy = null;
      proposal.adminReleaseApprovedAt = null;
      proposal.adminReleaseNote = "";
      proposal.releaseRejectedBy = null;
      proposal.releaseRejectedAt = null;
      proposal.releaseRejectedReason = "";
      await proposal.save();
      await History.create({ organizationId: access.group.organizationId, groupId: access.group._id, proposalId: proposal._id, userId: user._id.toString(), type: "WITHDRAW", title: "Withdrawal Requested Again", description: `${proposal.title} was submitted again for release review.` });
      return NextResponse.json({ message: "Withdrawal request resubmitted.", proposal, onChainAlreadyRequested: Boolean(campaign.withdrawalRequested) });
    }

    if (!isHexString(txHash, 32)) return NextResponse.json({ message: "The first withdrawal request must include its confirmed blockchain transaction hash." }, { status: 400 });

    if (campaign.withdrawalRequested) {
      return NextResponse.json({ message: "The blockchain withdrawal request already exists. Refresh and submit the application review again." }, { status: 409 });
    }

    const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash, eventType: "WithdrawalRequested", expectedEventActor: user.walletAddress });
    if (getAddress(result.txFrom) !== getAddress(user.walletAddress)) return NextResponse.json({ message: "The withdrawal request transaction belongs to a different wallet." }, { status: 403 });
    return NextResponse.json({ message: result.alreadyProcessed ? "Withdrawal request was already synchronized." : "Withdrawal request submitted.", proposal: result.proposal, alreadyProcessed: result.alreadyProcessed });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("WITHDRAWAL REQUEST ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not request withdrawal." }, { status: 409 });
  }
}
