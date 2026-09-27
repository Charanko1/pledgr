import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, verifyMessage } from "ethers";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import User from "@/models/User";
import Membership from "@/models/Membership";


import { buildWalletMessage } from "@/lib/wallet-verification";
import { assertWalletCanChange } from "@/lib/wallet-change";

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
    try { await assertWalletCanChange(user, normalized); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Wallet change is unavailable." }, { status: 409 }); }

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
