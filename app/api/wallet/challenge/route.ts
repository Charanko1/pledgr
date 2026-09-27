import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "ethers";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import User from "@/models/User";



import { buildWalletMessage } from "@/lib/wallet-verification";
import { assertWalletCanChange } from "@/lib/wallet-change";

const NONCE_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";

    if (!isAddress(walletAddress)) {
      return NextResponse.json({ message: "A valid MetaMask address is required." }, { status: 400 });
    }

    const normalized = getAddress(walletAddress);
    const owner = await User.findOne({
      walletAddress: { $regex: new RegExp(`^${normalized}$`, "i") },
      _id: { $ne: user._id },
    }).select("_id").lean();

    if (owner) {
      return NextResponse.json({ message: "This wallet is already connected to another account." }, { status: 409 });
    }

    try { await assertWalletCanChange(user, normalized); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Wallet change is unavailable." }, { status: 409 }); }

    const nonce = randomBytes(24).toString("hex");
    user.walletNonce = nonce;
    user.walletNonceExpiresAt = new Date(Date.now() + NONCE_TTL_MS);
    await user.save();

    return NextResponse.json({
      message: buildWalletMessage(normalized, nonce),
      expiresAt: user.walletNonceExpiresAt,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("WALLET CHALLENGE ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not create wallet challenge." }, { status: 500 });
  }
}
