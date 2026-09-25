import { NextRequest, NextResponse } from "next/server";
import { getAddress, isHexString } from "ethers";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/models/Proposal";
import User from "@/models/User";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { getGroupAccess } from "@/lib/authorization";
import { sumAtomicAmounts } from "@/lib/proposal-metrics";
import { syncVerifiedBlockchainEvent } from "@/lib/blockchain-sync";

interface Params { params: Promise<{ id: string }> }

function serialize(proposal: any) {
  const creator = proposal.creatorId && typeof proposal.creatorId === "object" && "name" in proposal.creatorId ? proposal.creatorId : null;
  return {
    ...proposal,
    _id: String(proposal._id),
    groupId: String(proposal.groupId),
    creator: creator?.name || proposal.creator,
    creatorId: creator?._id ? String(creator._id) : proposal.creatorId ? String(proposal.creatorId) : undefined,
    creatorProfile: creator ? { _id: String(creator._id), name: creator.name, email: creator.email } : null,
    refundedAmountAtomic: sumAtomicAmounts(proposal.refunds),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const proposal = await Proposal.findById(id).populate({ path: "creatorId", select: "_id name email", model: User }).lean();
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const isCreator = Boolean(proposal.creatorId && String((proposal.creatorId as any)._id || proposal.creatorId) === user._id.toString());
    return NextResponse.json({
      ...serialize(proposal),
      permissions: {
        isCreator,
        isAdmin: access.isGroupAdmin,
        isValidator: access.isValidator,
        isMember: access.isGroupMember,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET PROPOSAL ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const proposal = await Proposal.findById(id);
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const createHash = typeof body.blockchainCreateTxHash === "string" ? body.blockchainCreateTxHash.trim().toLowerCase() : "";
    if (body.blockchainStatus === "CREATED" && createHash) {
      if (!isHexString(createHash, 32)) return NextResponse.json({ message: "Invalid blockchain transaction hash." }, { status: 400 });
      if (!access.isGroupAdmin) return NextResponse.json({ message: "Only a group admin can register the approved campaign on-chain." }, { status: 403 });
      if (proposal.status !== "Approved" || proposal.validationStatus !== "Approved" || proposal.adminReviewStatus !== "Approved") return NextResponse.json({ message: "The proposal needs validator and admin approval before blockchain registration." }, { status: 409 });
      if (proposal.blockchainStatus !== "PENDING") return NextResponse.json({ message: "This proposal is no longer waiting for blockchain registration." }, { status: 409 });
      if (!user.walletAddress || !user.walletVerifiedAt) return NextResponse.json({ message: "Verify the admin wallet before registering the proposal." }, { status: 403 });
      const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash: createHash, eventType: "CampaignCreated" });
      if (getAddress(result.txFrom) !== getAddress(user.walletAddress)) return NextResponse.json({ message: "The registration transaction belongs to a different wallet." }, { status: 403 });
      return NextResponse.json(serialize(result.proposal));
    }

    const approvalHash = typeof body.blockchainApprovalTxHash === "string" ? body.blockchainApprovalTxHash.trim().toLowerCase() : "";
    if (body.blockchainStatus === "APPROVED" && approvalHash) {
      if (!access.isGroupAdmin) return NextResponse.json({ message: "Only a group admin can activate funding." }, { status: 403 });
      if (!isHexString(approvalHash, 32)) return NextResponse.json({ message: "A valid blockchain approval transaction hash is required." }, { status: 400 });
      if (proposal.status !== "Approved" || proposal.validationStatus !== "Approved" || proposal.adminReviewStatus !== "Approved") return NextResponse.json({ message: "The proposal is not fully approved in PLEDGR." }, { status: 409 });
      if (proposal.blockchainStatus !== "CREATED") return NextResponse.json({ message: "Register the proposal on-chain before activating funding." }, { status: 409 });
      if (!user.walletAddress || !user.walletVerifiedAt) return NextResponse.json({ message: "Verify your wallet before activating funding." }, { status: 403 });
      const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash: approvalHash, eventType: "CampaignApproved", expectedTxFrom: user.walletAddress });
      if (getAddress(result.txFrom) !== getAddress(user.walletAddress)) return NextResponse.json({ message: "The activation transaction belongs to a different wallet." }, { status: 403 });
      return NextResponse.json(serialize(result.proposal));
    }

    const validatorHash = typeof body.validatorReleaseTxHash === "string" ? body.validatorReleaseTxHash.trim().toLowerCase() : "";
    if (body.blockchainStatus === "VALIDATOR_RELEASE_APPROVED" && validatorHash) {
      if (!access.isValidator) return NextResponse.json({ message: "Only an active group validator can approve release on-chain." }, { status: 403 });
      if (!isHexString(validatorHash, 32)) return NextResponse.json({ message: "Invalid validator release transaction hash." }, { status: 400 });
      const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash: validatorHash, eventType: "ValidatorReleaseApproved" });
      return NextResponse.json(serialize(result.proposal));
    }

    const adminReleaseHash = typeof body.adminReleaseApprovalTxHash === "string" ? body.adminReleaseApprovalTxHash.trim().toLowerCase() : "";
    if (body.blockchainStatus === "ADMIN_RELEASE_APPROVED" && adminReleaseHash) {
      if (!access.isGroupAdmin) return NextResponse.json({ message: "Only a group admin can approve the final release on-chain." }, { status: 403 });
      if (!isHexString(adminReleaseHash, 32)) return NextResponse.json({ message: "Invalid admin release transaction hash." }, { status: 400 });
      const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash: adminReleaseHash, eventType: "AdminReleaseApproved" });
      return NextResponse.json(serialize(result.proposal));
    }

    return NextResponse.json({ message: "No valid blockchain synchronization was provided." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("UPDATE PROPOSAL ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not update proposal." }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const proposal = await Proposal.findById(id);
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    if (!proposal.creatorId || proposal.creatorId.toString() !== user._id.toString()) return NextResponse.json({ message: "You do not own this proposal." }, { status: 403 });
    if (!(proposal.status === "Pending" || proposal.status === "Rejected") || proposal.blockchainStatus !== "PENDING") return NextResponse.json({ message: "Only an unregistered pending or rejected proposal can be deleted." }, { status: 409 });
    await Proposal.findByIdAndDelete(id);
    return NextResponse.json({ message: "Proposal deleted successfully." });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("DELETE PROPOSAL ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not delete proposal." }, { status: 500 });
  }
}
