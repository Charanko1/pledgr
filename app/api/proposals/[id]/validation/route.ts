import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Proposal from "@/models/Proposal";
import History from "@/models/History";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { getGroupAccess } from "@/lib/authorization";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
    if (!action) return NextResponse.json({ message: "Action must be approve or reject." }, { status: 400 });

    const proposal = await Proposal.findById(id);
    if (!proposal) return NextResponse.json({ message: "Proposal not found." }, { status: 404 });
    const access = await getGroupAccess(proposal.groupId.toString(), user._id.toString());
    if (!access?.isValidator) return NextResponse.json({ message: "Only an active group validator can validate proposals." }, { status: 403 });
    if (proposal.status !== "Pending" || proposal.blockchainStatus !== "PENDING") return NextResponse.json({ message: "Only pending, unregistered proposals can be validated." }, { status: 409 });

    proposal.validationStatus = action === "approve" ? "Approved" : "Rejected";
    proposal.status = action === "approve" ? "Validated" : "Rejected";
    proposal.validatedBy = user._id;
    proposal.validatedAt = new Date();
    proposal.validationNote = note;
    await proposal.save();

    await History.create({ organizationId: access.group.organizationId, groupId: access.group._id, proposalId: proposal._id, userId: user._id.toString(), type: "VALIDATOR", title: action === "approve" ? "Proposal Validated" : "Proposal Rejected by Validator", description: `${proposal.title} was ${action === "approve" ? "validated" : "rejected"} by ${user.name}.` });
    return NextResponse.json({ message: action === "approve" ? "Proposal validated." : "Proposal rejected.", proposal });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("VALIDATE PROPOSAL ERROR:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not validate proposal." }, { status: 500 });
  }
}
