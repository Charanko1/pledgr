import { NextRequest, NextResponse } from "next/server";
import { getAddress, isHexString } from "ethers";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Proposal from "@/models/Proposal";
import { syncVerifiedBlockchainEvent } from "@/lib/blockchain-sync";
import { getServerContract } from "@/lib/blockchain-server";
import { getGroupAccess } from "@/lib/authorization";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const txHash = typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";
    if (!isHexString(txHash, 32)) return NextResponse.json({ message: "A valid release transaction hash is required." }, { status: 400 });

    const proposal = await Proposal.findById(id);
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!access.isGroupAdmin) return NextResponse.json({ message: "Only a group admin can execute final fund release." }, { status: 403 });
    if (proposal.withdrawalStatus !== "AdminApproved" || proposal.status !== "Release Approved") return NextResponse.json({ message: "Validator and admin withdrawal approvals are required before release." }, { status: 409 });
    if (!user.walletAddress || !user.walletVerifiedAt) return NextResponse.json({ message: "Verify the contract admin wallet before releasing funds." }, { status: 403 });

    const contractAdmin = getAddress(String(await getServerContract().admin()));
    if (contractAdmin !== getAddress(user.walletAddress)) return NextResponse.json({ message: "Your connected wallet is not the PLEDGR contract admin." }, { status: 403 });

    const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash, eventType: "FundReleased", expectedTxFrom: user.walletAddress });
    if (getAddress(result.txFrom) !== getAddress(user.walletAddress)) return NextResponse.json({ message: "The release transaction belongs to a different wallet." }, { status: 403 });
    return NextResponse.json({ message: result.alreadyProcessed ? "Release was already synchronized." : "Funds released successfully.", proposal: result.proposal, alreadyProcessed: result.alreadyProcessed });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("RELEASE FUND ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not release funds." }, { status: 409 });
  }
}
