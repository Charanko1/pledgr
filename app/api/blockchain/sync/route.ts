import { NextRequest, NextResponse } from "next/server";
import { isHexString } from "ethers";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { syncVerifiedBlockchainEvent } from "@/lib/blockchain-sync";
import Proposal from "@/models/Proposal";
import { getGroupAccess } from "@/lib/authorization";
import type { VerifiedEventType } from "@/lib/blockchain-server";

const EVENT_TYPES: readonly VerifiedEventType[] = [
  "CampaignCreated", "CampaignApproved", "WithdrawalRequested", "Donated", "CampaignCancelled", "ValidatorReleaseApproved", "ValidatorReleaseApprovalReset", "AdminReleaseApproved", "RefundClaimed", "FundReleased",
];

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const type = typeof body.type === "string" ? body.type : "";
    const proposalId = typeof body.proposalId === "string" ? body.proposalId.trim() : "";
    const txHash = typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";

    if (!EVENT_TYPES.includes(type as VerifiedEventType)) {
      return NextResponse.json({ message: "Unsupported blockchain event." }, { status: 400 });
    }
    if (!proposalId || !isHexString(txHash, 32)) {
      return NextResponse.json({ message: "A valid proposal ID and transaction hash are required." }, { status: 400 });
    }

    const proposal = await Proposal.findById(proposalId).select("groupId").lean();
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const adminEvents: readonly VerifiedEventType[] = ["CampaignCreated", "CampaignApproved", "ValidatorReleaseApprovalReset", "AdminReleaseApproved", "FundReleased"];
    const validatorEvents: readonly VerifiedEventType[] = ["ValidatorReleaseApproved"];
    if (adminEvents.includes(type as VerifiedEventType) && !access.isGroupAdmin) {
      return NextResponse.json({ message: "Only a group admin can synchronize this blockchain action." }, { status: 403 });
    }
    if (validatorEvents.includes(type as VerifiedEventType) && !access.isValidator) {
      return NextResponse.json({ message: "Only an active group validator can synchronize this blockchain action." }, { status: 403 });
    }
    if (type === "WithdrawalRequested") {
      const isCreator = Boolean((await Proposal.findById(proposalId).select("creatorId").lean())?.creatorId?.toString() === user._id.toString());
      if (!isCreator && !access.isGroupAdmin) return NextResponse.json({ message: "Only the fundraiser or a group admin can synchronize a withdrawal request." }, { status: 403 });
    }

    const result = await syncVerifiedBlockchainEvent({
      proposalId,
      txHash,
      eventType: type as VerifiedEventType,
    });

    return NextResponse.json({
      message: result.alreadyProcessed ? "Blockchain event was already synchronized." : "Blockchain event synchronized successfully.",
      event: type,
      txHash,
      proposal: result.proposal,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("BLOCKCHAIN SYNC ERROR:", error);
    const message = error instanceof Error ? error.message : "Could not synchronize blockchain event.";
    return NextResponse.json({ message }, { status: message === "Unauthorized" ? 401 : 409 });
  }
}
