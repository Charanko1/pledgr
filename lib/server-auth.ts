import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import User from "@/models/User";

type TokenPayload = { id?: string; email?: string; role?: string };

export class AuthenticationError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (header) {
    const [scheme, value] = header.split(/\s+/, 2);
    if (value && scheme.toLowerCase() === "bearer") return value.trim() || null;
  }

  const cookieToken = req.cookies.get("trustkas_token")?.value?.trim();
  return cookieToken || null;
}

export async function getAuthenticatedUserId(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) throw new AuthenticationError();

  let payload: TokenPayload;
  try {
    payload = verifyToken(token) as TokenPayload;
  } catch {
    throw new AuthenticationError();
  }

  if (!payload.id) throw new AuthenticationError();
  return payload.id;
}

export async function getAuthenticatedUser(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  const user = await User.findById(userId).select(
    "_id name email role walletAddress walletNonce walletNonceExpiresAt walletVerifiedAt"
  );
  if (!user) throw new AuthenticationError("User account no longer exists.");
  return user;
}

export function authErrorResponse(error: unknown) {
  return NextResponse.json(
    { message: error instanceof AuthenticationError ? error.message : "Unauthorized" },
    { status: 401 }
  );
}
