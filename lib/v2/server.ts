import { Contract, formatEther, getAddress, isAddress, isHexString, verifyTypedData, TypedDataEncoder, ZeroAddress } from "ethers";
import { randomBytes } from "node:crypto";
import ABI from "@/lib/abi/PledgrTreasuryV2.json";
import { getServerProvider, BOT_CHAIN_ID } from "@/lib/blockchain-server";
import { campaignKey, registrationTypes, withdrawalTypes, signingDomain } from "./typed-data";
import Proposal from "@/models/Proposal";
import User from "@/models/User";
import WithdrawalRequest from "@/models/WithdrawalRequest";
import History from "@/models/History";
import { getGroupAccess } from "@/lib/authorization";
import { ensureApprovalPolicy, readApprovalPolicy } from "@/lib/proposal-approval";
import { proposalApproved } from "@/lib/approval-policy";

export function v2Configuration() {
  const address = process.env.NEXT_PUBLIC_PLEDGR_V2_ADDRESS || "";
  if (!isAddress(address)) throw new Error("Deploy PledgrTreasuryV2 and configure NEXT_PUBLIC_PLEDGR_V2_ADDRESS before creating new campaigns.");
  return { address: getAddress(address), chainId: BOT_CHAIN_ID };
}
export function contractFor(p: any) {
  if (p.contractVersion !== 2 || !isAddress(p.contractAddress || "") || p.chainId !== BOT_CHAIN_ID) throw new Error("Campaign contract or network configuration does not match.");
  return new Contract(p.contractAddress, ABI, getServerProvider());
}
export function domainFor(p: any) { return signingDomain(p.chainId, p.contractAddress); }
export function registrationMessage(p: any) {
  const r = p.registration;
  if (!r?.validUntil) throw new Error("Prepare registration first.");
  return { campaignId: campaignKey(p.recipientWallet, String(p._id)), creator: p.recipientWallet, validator: r.validator, reviewerAdmin: r.reviewerAdmin, target: p.targetAmountAtomic, deadline: p.unlimited ? "0" : String(Math.floor(new Date(p.deadline).getTime()/1000)), validUntil: r.validUntil };
}
export function withdrawalMessage(w: any) {
  return { campaignId: w.campaignId, requestId: w.requestId, creator: w.creator, amount: w.amount, nonce: w.nonce, validUntil: w.validUntil };
}
export async function chainSnapshot(p: any) {
  const contract = contractFor(p);
  const id = campaignKey(p.recipientWallet, String(p._id));
  const block = await getServerProvider().getBlock("latest");
  if (!block) throw new Error("Blockchain is unavailable.");
  if (!(await contract.exists(id, { blockTag: block.number }))) return null;
  const c = await contract.getCampaign(id, { blockTag: block.number });
  if (!p.registration || getAddress(c.creator) !== getAddress(p.recipientWallet) || getAddress(c.validator) !== getAddress(p.registration.validator) || getAddress(c.reviewerAdmin) !== getAddress(p.registration.reviewerAdmin)) throw new Error("Registered creator/reviewers do not match this approved proposal.");
  return {
    campaignId: id, creator: String(c.creator), validator: String(c.validator), reviewerAdmin: String(c.reviewerAdmin),
    target: String(c.target), deadline: Number(c.deadline), totalRaised: String(c.totalRaised), totalWithdrawn: String(c.totalWithdrawn), totalRefunded: String(c.totalRefunded),
    available: (c.totalRaised-c.totalWithdrawn-c.totalRefunded).toString(), nonce: String(c.nonce), cancelled: Boolean(c.cancelled),
    eligible: !c.cancelled && (c.unlocked || c.totalRaised >= c.target || (c.deadline !== 0n && BigInt(block.timestamp) >= c.deadline)),
    blockNumber: block.number, timestamp: block.timestamp,
  };
}
async function reviewer(p: any, user: any, wallet: string, role: "validator" | "admin") {
  if (getAddress(wallet) === ZeroAddress) throw new Error("This campaign does not require this reviewer role.");
  if (!user.walletVerifiedAt || !user.walletAddress || getAddress(user.walletAddress) !== getAddress(wallet)) throw new Error("Use the verified wallet assigned to this review.");
  const access = await getGroupAccess(String(p.groupId), String(user._id));
  if (!access?.allowed || (role === "validator" ? !access.isValidator : !access.isGroupAdmin)) throw new Error("You no longer have the required reviewer role.");
  if (getAddress(wallet) === getAddress(p.recipientWallet)) throw new Error("Creators cannot approve their own withdrawals.");
}
export async function prepareRegistration(p: any) {
  p = await ensureApprovalPolicy(p);
  const policy = await readApprovalPolicy(p);
  if (!proposalApproved(policy,p) || p.status === "Rejected") throw new Error("All required proposal reviews must be completed first.");
  if (await chainSnapshot(p)) throw new Error("Already registered. Synchronize the registration transaction.");
  if (!policy.requireValidator || !policy.requireAdmin) {
    const supportsPolicy = async (proposal: any) => {
      try { return await contractFor(proposal).approvalPolicyVersion() === 1n; } catch { return false; }
    };
    if (!(await supportsPolicy(p))) {
      const configured = v2Configuration();
      const candidate = { contractVersion: 2, contractAddress: configured.address, chainId: configured.chainId };
      if (p.registration?.validatorSignature || p.registration?.adminSignature || getAddress(p.contractAddress) === configured.address || !(await supportsPolicy(candidate))) {
        throw new Error("This contract requires two reviewers. Deploy the revised PledgrTreasuryV2 and update NEXT_PUBLIC_PLEDGR_V2_ADDRESS for new, unsigned campaigns. Existing signed or funded campaigns keep their original contract.");
      }
      // Only unsigned drafts may adopt the newly configured deployment. No funds
      // or signed permits are migrated; existing campaigns stay at their address.
      const moved = await Proposal.findOneAndUpdate({ _id:p._id, contractAddress:p.contractAddress, blockchainStatus:"PENDING",
        "registration.validatorSignature":{$in:[null,""]}, "registration.adminSignature":{$in:[null,""]},
      }, {$set:{contractAddress:configured.address,chainId:configured.chainId},$unset:{registration:1}}, {new:true});
      if (!moved) throw new Error("Campaign changed. Refresh before preparing registration.");
      p = moved;
      if (await chainSnapshot(p)) throw new Error("Campaign already exists on the configured contract. Synchronize it before continuing.");
    }
  }
  if (p.registration?.validUntil > Math.floor(Date.now()/1000)) return p;
  const [validator, admin] = await Promise.all([policy.requireValidator ? User.findById(p.validatedBy) : null, policy.requireAdmin ? User.findById(p.adminReviewedBy) : null]);
  if ((policy.requireValidator && !validator?.walletAddress) || (policy.requireAdmin && !admin?.walletAddress)) throw new Error("Required reviewers must have verified wallets.");
  if (policy.requireValidator) await reviewer(p, validator, validator.walletAddress, "validator");
  if (policy.requireAdmin) await reviewer(p, admin, admin.walletAddress, "admin");
  if (validator && admin && getAddress(validator.walletAddress) === getAddress(admin.walletAddress)) throw new Error("Validator and admin must use distinct wallets.");
  const registration = { validator: validator?.walletAddress || ZeroAddress, reviewerAdmin: admin?.walletAddress || ZeroAddress, validUntil: Math.floor(Date.now()/1000)+86400, validatorSignature: "", adminSignature: "" };
  // Compare-and-set prevents a late prepare request discarding a signature.
  await Proposal.updateOne({ _id:p._id, contractAddress:p.contractAddress, blockchainStatus:"PENDING", status:"Approved", $or:[{"registration.validUntil":{$exists:false}},{"registration.validUntil":{$lte:Math.floor(Date.now()/1000)}}] }, { $set:{registration} });
  return Proposal.findById(p._id);
}
export async function signRegistration(p: any, user: any, role: "validator" | "admin", signature: string) {
  const message = registrationMessage(p);
  if (message.validUntil <= Math.floor(Date.now()/1000) || p.blockchainStatus !== "PENDING") throw new Error("Registration authorization expired or was already used.");
  const wallet = role === "validator" ? message.validator : message.reviewerAdmin;
  await reviewer(p,user,wallet,role);
  if (getAddress(verifyTypedData(domainFor(p),registrationTypes,message,signature)) !== getAddress(wallet)) throw new Error("Invalid registration signature.");
  const result = await Proposal.updateOne({_id:p._id,contractAddress:p.contractAddress,blockchainStatus:"PENDING","registration.validUntil":message.validUntil,"registration.validator":message.validator,"registration.reviewerAdmin":message.reviewerAdmin},{$set:{[`registration.${role === "validator" ? "validatorSignature" : "adminSignature"}`]:signature}});
  if (!result.matchedCount) throw new Error("Registration changed. Refresh and sign again.");
}
export async function requestWithdrawal(p: any, amount: bigint) {
  await WithdrawalRequest.init();
  const c = await chainSnapshot(p);
  if (!c?.eligible || amount <= 0n || amount > BigInt(c.available)) throw new Error("Withdrawal requires an eligible campaign and an amount within its available balance.");
  const existing = await WithdrawalRequest.findOne({proposalId:p._id,nonce:c.nonce});
  if (existing && existing.status !== "Rejected" && existing.validUntil > c.timestamp) throw new Error("A withdrawal is already awaiting review or claim.");
  const values = {proposalId:p._id,nonce:c.nonce,campaignId:c.campaignId,creator:c.creator,amount:amount.toString(),requestId:"0x"+randomBytes(32).toString("hex"),validUntil:c.timestamp+86400,validatorSignature:"",adminSignature:"",status:"Requested",claimTxHash:""};
  if (!existing) return WithdrawalRequest.create(values);
  const updated = await WithdrawalRequest.findOneAndUpdate({_id:existing._id,requestId:existing.requestId,$or:[{status:"Rejected"},{validUntil:{$lte:c.timestamp}}]},{$set:values},{new:true});
  if (!updated) throw new Error("Withdrawal changed. Refresh before requesting again.");
  return updated;
}
export async function reviewWithdrawal(p: any, user: any, requestId: string, role: "validator" | "admin", signature: string, reject: boolean) {
  const c = await chainSnapshot(p);
  if (!c || c.cancelled) throw new Error("Campaign is not active.");
  await reviewer(p,user,role === "validator" ? c.validator : c.reviewerAdmin,role);
  const w = await WithdrawalRequest.findOne({proposalId:p._id,nonce:c.nonce,requestId});
  if (!w || w.validUntil <= c.timestamp) throw new Error("This withdrawal request expired or changed.");
  const open = ["Requested", "ValidatorApproved", "AdminApproved"];
  const signatureField = role === "validator" ? "validatorSignature" : "adminSignature";
  if (!open.includes(w.status) || w[signatureField]) throw new Error("This request is not awaiting your review.");
  if (!reject) {
    const signer = verifyTypedData(domainFor(p),withdrawalTypes,withdrawalMessage(w),signature);
    if (getAddress(signer) !== getAddress(role === "validator" ? c.validator : c.reviewerAdmin)) throw new Error("Invalid withdrawal signature.");
  }
  const allSigned = { $and: [c.validator === ZeroAddress ? true : {$ne:["$validatorSignature", ""]}, c.reviewerAdmin === ZeroAddress ? true : {$ne:["$adminSignature", ""]}] };
  const update = reject ? [{$set:{status:"Rejected",validatorSignature:"",adminSignature:""}}] : [
    {$set:{[signatureField]:{$literal:signature}}},
    {$set:{status:{$cond:[allSigned,"Approved",{$cond:[{$ne:["$validatorSignature", ""]},"ValidatorApproved","AdminApproved"]}]}}},
  ];
  const result = await WithdrawalRequest.updateOne({_id:w._id,requestId,status:{$in:open},[signatureField]:""},update,{updatePipeline:true});
  if (!result.matchedCount) throw new Error("The request changed while being reviewed.");
}

export async function syncV2(p: any, txHash: string, group: any) {
  if (!isHexString(txHash,32)) throw new Error("Enter a valid transaction hash.");
  const contract = contractFor(p);
  const provider = getServerProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  const tx = await provider.getTransaction(txHash);
  if (!receipt || receipt.status !== 1 || !tx?.to || getAddress(tx.to) !== getAddress(p.contractAddress)) throw new Error("No successful transaction for this campaign contract was found.");
  const id = campaignKey(p.recipientWallet,String(p._id));
  const events = receipt.logs.filter(l=>getAddress(l.address)===getAddress(p.contractAddress)).map(l=>{try{return contract.interface.parseLog(l);}catch{return null;}}).filter(e=>e?.args.campaignId === id);
  if (!events.length) throw new Error("The receipt contains no event for this campaign.");
  const c = await chainSnapshot(p);
  if (!c || getAddress(c.creator)!==getAddress(p.recipientWallet)) throw new Error("Campaign creator mismatch.");
  const r = p.registration;
  if (!r || getAddress(c.validator)!==getAddress(r.validator) || getAddress(c.reviewerAdmin)!==getAddress(r.reviewerAdmin)) throw new Error("On-chain reviewers do not match the approved registration.");
  const registration = events.find(e=>e?.name==="CampaignRegistered");
  if (registration && (getAddress(tx.from)!==getAddress(p.recipientWallet) || !proposalApproved(await readApprovalPolicy(p),p))) throw new Error("Registration was not submitted by the approved creator.");
  if (registration && !p.blockchainCreateTxHash) {
    const submitted=contract.interface.parseTransaction({data:tx.data,value:tx.value});
    if (submitted?.name!=="registerCampaign" || String(submitted.args[0])!==String(p._id) || TypedDataEncoder.hash(domainFor(p),registrationTypes,submitted.args[1])!==TypedDataEncoder.hash(domainFor(p),registrationTypes,registrationMessage(p))) throw new Error("Registration terms do not match the approved proposal.");
  }
  // Monotonic snapshots prevent a slower request overwriting newer balances.
  await Proposal.updateOne({_id:p._id,$or:[{v2SyncedBlock:{$exists:false}},{v2SyncedBlock:{$lte:c.blockNumber}}]},{$set:{
    blockchainStatus:c.cancelled?"CANCELLED":"APPROVED",status:c.cancelled?"Cancelled":"Funding",v2SyncedBlock:c.blockNumber,
    targetAmountAtomic:c.target,targetAmount:formatEther(c.target),deadline:c.deadline?new Date(c.deadline*1000):null,unlimited:c.deadline===0,
    fundedAmountAtomic:c.totalRaised,fundedAmount:formatEther(c.totalRaised),releasedAmountAtomic:c.totalWithdrawn,releasedAmount:formatEther(c.totalWithdrawn),
    refundedAmountAtomic:c.totalRefunded,refundedAmount:formatEther(c.totalRefunded),availableAmountAtomic:c.available,
    ...(registration?{blockchainCreateTxHash:txHash}:{}),
  }});
  for (const event of events) {
    if (!event) continue;
    const amount = event.args.amount?.toString() || "0";
    if (event.name === "Claimed") await WithdrawalRequest.updateOne({proposalId:p._id,requestId:event.args.requestId,nonce:event.args.nonce.toString()},{$set:{status:"Claimed",claimTxHash:txHash}});
    if (event.name === "Donated" || event.name === "Refunded") {
      const field=event.name === "Donated"?"transactions":"refunds";
      await Proposal.updateOne({_id:p._id,[`${field}.txHash`]:{$ne:txHash}},{$push:{[field]:{amount:formatEther(amount),amountAtomic:amount,donor:String(event.args.donor),txHash}}});
    }
    const names:Record<string,string>={CampaignRegistered:"PROPOSAL",Donated:"DONATION",Claimed:"RELEASE",TermsUpdated:"PROPOSAL",CampaignCancelled:"CANCEL",Refunded:"REFUND"};
    const key=`v2:${p.chainId}:${p.contractAddress.toLowerCase()}:${txHash.toLowerCase()}:${event.name}`;
    try { await History.updateOne({blockchainEventKey:key},{$setOnInsert:{organizationId:group.organizationId,groupId:p.groupId,proposalId:p._id,userId:tx.from,type:names[event.name],title:`${p.title}: ${event.name}`,amount:formatEther(amount),amountAtomic:amount,txHash,blockchainEventKey:key}},{upsert:true}); } catch(error:any) { if(error?.code!==11000)throw error; }
  }
  return c;
}
