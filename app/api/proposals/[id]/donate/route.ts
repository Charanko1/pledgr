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
    if (!isHexString(txHash, 32)) return NextResponse.json({ message: "A valid blockchain transaction hash is required." }, { status: 400 });

    const proposal = await Proposal.findById(id).lean();
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    if (proposal.status !== "Funding" || proposal.blockchainStatus !== "APPROVED") return NextResponse.json({ message: "This campaign is not currently open for BOT donations." }, { status: 409 });
    if (!user.walletAddress || !user.walletVerifiedAt) return NextResponse.json({ message: "Verify your MetaMask wallet before donating." }, { status: 403 });

    const result = await syncVerifiedBlockchainEvent({ proposalId: id, txHash, eventType: "Donated", expectedEventActor: user.walletAddress });
    const eventDonor = getAddress(String(result.parsedEvent.args[0]));
    if (eventDonor !== getAddress(user.walletAddress)) {
      return NextResponse.json({ message: "The donation transaction belongs to a different wallet." }, { status: 403 });
    }

    return NextResponse.json({
      message: result.alreadyProcessed ? "Donation was already synchronized." : "Donation verified and recorded.",
      proposal: result.proposal,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("RECORD DONATION ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not record donation." }, { status: 409 });
  }
}
