import { NextRequest, NextResponse } from "next/server";
import { isAddress, parseEther } from "ethers";
import { parseDeadlineInput } from "@/lib/dates";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/models/Proposal";
import User from "@/models/User";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { getGroupAccess } from "@/lib/authorization";
import { sumAtomicAmounts } from "@/lib/proposal-metrics";

function serializeProposal(proposal: any) {
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

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const groupId = req.nextUrl.searchParams.get("group")?.trim();
    if (!groupId) return NextResponse.json([]);

    const access = await getGroupAccess(groupId, user._id.toString());
    if (!access?.group) return NextResponse.json({ message: "Group not found." }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const proposals = await Proposal.find({ groupId }).sort({ createdAt: -1 }).populate({ path: "creatorId", select: "_id name email", model: User }).lean();
    return NextResponse.json(proposals.map(serializeProposal));
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("GET PROPOSALS ERROR:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const targetInput = typeof body.targetAmount === "string" || typeof body.targetAmount === "number" ? String(body.targetAmount).trim() : "";
    const deadlineInput = typeof body.deadline === "string" ? body.deadline : "";
    const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
    if (!title || !description || !targetInput || !deadlineInput || !groupId) return NextResponse.json({ message: "Title, description, target, deadline, and group are required." }, { status: 400 });
    if (title.length > 120 || description.length > 4000) return NextResponse.json({ message: "Title or description is too long." }, { status: 400 });

    let targetAtomic: bigint;
    try { targetAtomic = parseEther(targetInput); } catch { return NextResponse.json({ message: "Target must be a valid BOT amount with up to 18 decimals." }, { status: 400 }); }
    if (targetAtomic <= 0n) return NextResponse.json({ message: "Target must be greater than zero." }, { status: 400 });

    const deadline = parseDeadlineInput(deadlineInput);
    if (!deadline || deadline.getTime() <= Date.now()) return NextResponse.json({ message: "Deadline must be a valid future date." }, { status: 400 });

    const access = await getGroupAccess(groupId, user._id.toString());
    if (!access?.group) return NextResponse.json({ message: "Group not found." }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ message: "You must be an active group member to create a proposal." }, { status: 403 });
    if (!user.walletAddress || !isAddress(user.walletAddress) || !user.walletVerifiedAt) return NextResponse.json({ message: "Verify your MetaMask wallet before creating a fundraising proposal." }, { status: 400 });

    const proposal = await Proposal.create({
      title,
      description,
      targetAmount: targetAtomic.toString(),
      targetAmountAtomic: targetAtomic.toString(),
      fundedAmount: "0",
      fundedAmountAtomic: "0",
      deadline,
      groupId,
      creator: user.name,
      creatorId: user._id,
      recipientWallet: user.walletAddress,
      status: "Pending",
      validationStatus: "Pending",
      adminReviewStatus: "Pending",
      withdrawalStatus: "None",
      blockchainStatus: "PENDING",
    });

    const hydrated = await Proposal.findById(proposal._id).populate({ path: "creatorId", select: "_id name email", model: User }).lean();
    return NextResponse.json(serializeProposal(hydrated), { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("CREATE PROPOSAL ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
