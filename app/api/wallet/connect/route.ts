import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, verifyMessage } from "ethers";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import User from "@/models/User";
import Membership from "@/models/Membership";
import Proposal from "@/models/Proposal";
import GroupMember from "@/models/GroupMember";
import { buildWalletMessage } from "@/lib/wallet-verification";
import { ACTIVE_PROPOSAL_STATUSES } from "@/lib/proposal-state";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";

    if (!isAddress(walletAddress) || !signature) {
      return NextResponse.json({ message: "Wallet address and signature are required." }, { status: 400 });
    }
    if (!user.walletNonce || !user.walletNonceExpiresAt || user.walletNonceExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ message: "Wallet verification expired. Please reconnect MetaMask." }, { status: 409 });
    }

    const normalized = getAddress(walletAddress);
    if (user.walletAddress && isAddress(user.walletAddress) && getAddress(user.walletAddress) !== normalized) {
      const activeProposal = await Proposal.exists({
        creatorId: user._id,
        status: { $in: [...ACTIVE_PROPOSAL_STATUSES] },
      });
      const userMemberships = await Membership.find({ userId: user._id.toString() }).select("_id").lean();
      const membershipIds = userMemberships.map((item) => item._id);
      const validatorMemberships = membershipIds.length
        ? await GroupMember.find({ membershipId: { $in: membershipIds }, status: "ACTIVE", role: "Validator" }).select("groupId membershipId").lean()
        : [];
      if (activeProposal) {
        return NextResponse.json({ message: "You cannot change your wallet while you have an active fundraising proposal." }, { status: 409 });
      }
      if (validatorMemberships.length) {
        const validatorGroups = validatorMemberships.map((item: any) => item.groupId);
        const activeValidatorProposal = await Proposal.exists({
          groupId: { $in: validatorGroups },
          status: { $in: [...ACTIVE_PROPOSAL_STATUSES] },
        });
        if (activeValidatorProposal) return NextResponse.json({ message: "You cannot change your wallet while you are an active validator on groups with proposals in progress." }, { status: 409 });
      }
    }

    const message = buildWalletMessage(normalized, user.walletNonce);
    let recovered: string;
    try {
      recovered = getAddress(verifyMessage(message, signature));
    } catch {
      return NextResponse.json({ message: "Wallet signature is invalid." }, { status: 401 });
    }
    if (recovered !== normalized) {
      return NextResponse.json({ message: "Wallet signature does not prove ownership of this address." }, { status: 401 });
    }

    const owner = await User.findOne({
      walletAddress: { $regex: new RegExp(`^${normalized}$`, "i") },
      _id: { $ne: user._id },
    }).select("_id").lean();
    if (owner) return NextResponse.json({ message: "This wallet is already connected to another account." }, { status: 409 });

    user.walletAddress = normalized;
    user.walletNonce = "";
    user.walletNonceExpiresAt = null;
    user.walletVerifiedAt = new Date();
    await user.save();

    await Membership.updateMany(
      { userId: user._id.toString() },
      { name: user.name, walletAddress: normalized }
    );

    return NextResponse.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
      walletVerifiedAt: user.walletVerifiedAt,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("WALLET CONNECT ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not connect wallet." }, { status: 500 });
  }
}
