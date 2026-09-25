import { NextRequest, NextResponse } from "next/server";
import { getAddress, isHexString } from "ethers";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import Proposal from "@/models/Proposal";
import { syncVerifiedBlockchainEvent } from "@/lib/blockchain-sync";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const txHash = typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";
    if (!isHexString(txHash, 32)) return NextResponse.json({ message: "A valid refund transaction hash is required." }, { status: 400 });

    const proposal = await Proposal.findById(id).lean();
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    if (!user.walletAddress || !user.walletVerifiedAt) return NextResponse.json({ message: "Verify your MetaMask wallet before claiming a refund." }, { status: 403 });

    const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash, eventType: "RefundClaimed", expectedEventActor: user.walletAddress });
    const donor = getAddress(String(result.parsedEvent.args[1]));
    if (donor !== getAddress(user.walletAddress)) return NextResponse.json({ message: "The refund transaction belongs to a different wallet." }, { status: 403 });

    return NextResponse.json({ message: result.alreadyProcessed ? "Refund was already synchronized." : "Refund verified and recorded.", proposal: result.proposal, alreadyProcessed: result.alreadyProcessed });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("RECORD REFUND ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not record the refund." }, { status: 409 });
  }
}
