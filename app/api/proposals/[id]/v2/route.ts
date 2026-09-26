import { NextRequest, NextResponse } from "next/server";
import { getAddress, parseEther } from "ethers";
import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedUser, AuthenticationError, authErrorResponse } from "@/lib/server-auth";
import { getGroupAccess } from "@/lib/authorization";
import Proposal from "@/models/Proposal";
import WithdrawalRequest from "@/models/WithdrawalRequest";
import { chainSnapshot, domainFor, prepareRegistration, registrationMessage, requestWithdrawal, reviewWithdrawal, signRegistration, syncV2, withdrawalMessage } from "@/lib/v2/server";
import { registrationTypes, withdrawalTypes } from "@/lib/v2/typed-data";

type Params = { params: Promise<{ id: string }> };
async function context(req: NextRequest, params: Params["params"]) {
  await connectDB();
  const user = await getAuthenticatedUser(req);
  const { id } = await params;
  const p = await Proposal.findById(id);
  if (!p || p.contractVersion !== 2) throw new Error("V2 proposal not found.");
  const access = await getGroupAccess(String(p.groupId),String(user._id));
  if (!access?.allowed) throw new AuthenticationError("You do not have access to this group.");
  return {user,p,access};
}
function errorResponse(error: unknown) {
  if(error instanceof AuthenticationError)return authErrorResponse(error);
  return NextResponse.json({message:error instanceof Error?error.message:"Campaign action failed."},{status:409});
}
export async function GET(req: NextRequest,{params}:Params) {
  try {
    const {user,p,access}=await context(req,params);
    const c=await chainSnapshot(p);
    const w=c?await WithdrawalRequest.findOne({proposalId:p._id,nonce:c.nonce}).lean():null;
    const registration=p.registration?.validUntil?{message:registrationMessage(p),validatorSignature:p.registration.validatorSignature,adminSignature:p.registration.adminSignature}:null;
    return NextResponse.json({
      domain:domainFor(p),registrationTypes,withdrawalTypes,registration,chain:c,
      withdrawal:w?{...w,message:withdrawalMessage(w)}:null,
      permissions:{isCreator:String(p.creatorId)===String(user._id),isValidator:access.isValidator,isAdmin:access.isGroupAdmin},
      wallet:user.walletAddress||"", serverTime:Math.floor(Date.now()/1000),
    });
  }catch(error){return errorResponse(error);}
}
export async function POST(req:NextRequest,{params}:Params) {
  try {
    const {user,p,access}=await context(req,params);
    const body=await req.json();
    const isCreator=String(p.creatorId)===String(user._id);
    if(body.action==="sync") {
      const chain=await syncV2(p,String(body.txHash||""),access.group);
      return NextResponse.json({chain,message:"Transaction synchronized."});
    }
    if(body.action==="prepareRegistration") {
      await prepareRegistration(p);
    } else if(body.action==="signRegistration") {
      if(body.role!=="validator"&&body.role!=="admin")throw new Error("Invalid reviewer role.");
      await signRegistration(p,user,body.role,String(body.signature||""));
    } else if(body.action==="requestWithdrawal") {
      if(!isCreator || !user.walletVerifiedAt || !user.walletAddress || getAddress(user.walletAddress)!==getAddress(p.recipientWallet))throw new Error("Only the verified campaign creator can request withdrawal.");
      await requestWithdrawal(p,parseEther(String(body.amount||"")));
    } else if(body.action==="reviewWithdrawal") {
      if(body.role!=="validator"&&body.role!=="admin")throw new Error("Invalid reviewer role.");
      await reviewWithdrawal(p,user,String(body.requestId||""),body.role,String(body.signature||""),body.reject===true);
    } else throw new Error("Unsupported action.");
    return NextResponse.json({message:"Saved. No blockchain transaction was submitted."});
  }catch(error){return errorResponse(error);}
}
