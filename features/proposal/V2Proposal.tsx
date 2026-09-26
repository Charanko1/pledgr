"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEther, getAddress, parseEther } from "ethers";
import { apiClient } from "@/lib/api-client";
import { getSigner, getExplorerTxUrl } from "@/lib/blockchain";
import { v2Transaction } from "@/lib/v2/client";
import { ErrorState, LoadingState } from "@/components/ui/ContentState";
import type { Proposal } from "@/types/group";
import type { TypedDataDomain, TypedDataField } from "ethers";

type State = {
  domain: TypedDataDomain;
  registrationTypes: Record<string,TypedDataField[]>;
  withdrawalTypes: Record<string,TypedDataField[]>;
  registration: {message:any;validatorSignature:string;adminSignature:string}|null;
  withdrawal: {message:any;status:string;validUntil:number;requestId:string;validatorSignature:string;adminSignature:string}|null;
  chain: {campaignId:string;creator:string;validator:string;reviewerAdmin:string;target:string;deadline:number;totalRaised:string;totalWithdrawn:string;totalRefunded:string;available:string;nonce:string;cancelled:boolean;eligible:boolean;timestamp:number}|null;
  permissions:{isCreator:boolean;isAdmin:boolean;isValidator:boolean};
  wallet:string;serverTime:number;
};
const button="pledgr-action px-4 py-2 bg-primary text-white";
const input="mt-2 w-full border-2 border-foreground bg-white p-3";
const panel="border-2 border-foreground bg-card p-6 shadow-brutal space-y-4";
const same=(a?:string,b?:string)=>Boolean(a&&b&&a.toLowerCase()===b.toLowerCase());

export default function V2Proposal({proposal:p}:{proposal:Proposal}) {
  const client=useQueryClient();
  const lock=useRef(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [donation,setDonation]=useState("0.01");
  const [amount,setAmount]=useState("");
  const [target,setTarget]=useState("");
  const [deadline,setDeadline]=useState("");
  const [unlimited,setUnlimited]=useState(false);
  const [hash,setHash]=useState("");
  const endpoint=`/api/proposals/${p._id}/v2`;
  const query=useQuery({queryKey:["proposal-v2",p._id],queryFn:({signal})=>apiClient<State>(endpoint,{signal}),refetchInterval:15000,refetchIntervalInBackground:false});
  const post=(body:unknown)=>apiClient(endpoint,{method:"POST",body:JSON.stringify(body)});
  async function run(action:()=>Promise<unknown>,success="Saved.") {
    if(lock.current)return;
    lock.current=true;setBusy(true);setMessage("");
    try {
      await action();
      await Promise.all([client.invalidateQueries({queryKey:["proposal-v2",p._id]}),client.invalidateQueries({queryKey:["proposal",p._id]}),client.invalidateQueries({queryKey:["group"]}),client.invalidateQueries({queryKey:["history"]})]);
      setMessage(success);
    }catch(error){setMessage(error instanceof Error?error.message:"Action failed.");}
    finally{lock.current=false;setBusy(false);}
  }
  if(query.isPending)return <LoadingState label="Reading campaign and signatures…"/>;
  if(query.error||!query.data)return <ErrorState message={query.error?.message||"Campaign unavailable."} onRetry={()=>void query.refetch()}/>;
  const s=query.data,c=s.chain,r=s.registration,w=s.withdrawal;
  const creator=s.permissions.isCreator;
  const expired=Boolean(w&&w.validUntil<=Math.max(s.serverTime,c?.timestamp||0));
  const registrationExpired=Boolean(r&&r.message.validUntil<=s.serverTime);
  const canRequest=Boolean(c?.eligible&&BigInt(c.available)>0n&&(!w||w.status==="Rejected"||expired));
  const reviewerRole=s.permissions.isValidator&&same(s.wallet,c?.validator||r?.message.validator)?"validator":s.permissions.isAdmin&&same(s.wallet,c?.reviewerAdmin||r?.message.reviewerAdmin)?"admin":null;

  async function signer(expected:string) {
    const signer=await getSigner();
    if(getAddress(await signer.getAddress())!==getAddress(expected))throw new Error("Select the verified wallet assigned to this action in MetaMask.");
    if(Number((await signer.provider.getNetwork()).chainId)!==Number(s.domain.chainId))throw new Error("Switch to the campaign network.");
    return signer;
  }
  async function signRegistration() {
    if(!r||!reviewerRole)return;
    const wallet=reviewerRole==="validator"?r.message.validator:r.message.reviewerAdmin;
    const signature=await (await signer(wallet)).signTypedData(s.domain,s.registrationTypes,r.message);
    await post({action:"signRegistration",role:reviewerRole,signature});
  }
  async function signWithdrawal() {
    if(!w||!c||!reviewerRole)return;
    const signature=await (await signer(reviewerRole==="validator"?c.validator:c.reviewerAdmin)).signTypedData(s.domain,s.withdrawalTypes,w.message);
    await post({action:"reviewWithdrawal",requestId:w.requestId,role:reviewerRole,signature});
  }
  async function register() {
    if(!r)return;
    await signer(p.recipientWallet);
    await v2Transaction(p._id,p.contractAddress!,"register",contract=>contract.registerCampaign(p._id,r.message,r.validatorSignature,r.adminSignature));
  }
  async function claim() {
    if(!w||!c)return;
    await signer(c.creator);
    await v2Transaction(p._id,p.contractAddress!,`claim:${w.message.nonce}`,contract=>contract.claim(w.message,w.validatorSignature,w.adminSignature));
  }
  async function updateTerms() {
    if(!c)return;
    const nextTarget=target.trim()?parseEther(target):BigInt(c.target);
    if(nextTarget<BigInt(c.target))throw new Error("The target can only increase.");
    const nextDeadline=unlimited?0:deadline?Math.floor(new Date(deadline).getTime()/1000):c.deadline;
    if(!Number.isFinite(nextDeadline))throw new Error("Enter a valid date.");
    await signer(c.creator);
    await v2Transaction(p._id,p.contractAddress!,"terms",contract=>contract.updateTerms(c.campaignId,nextTarget,nextDeadline));
    setTarget("");setDeadline("");setUnlimited(false);
  }
  const awaitingReviewer=Boolean(w&&!expired&&((reviewerRole==="validator"&&w.status==="Requested")||(reviewerRole==="admin"&&w.status==="ValidatorApproved")));
  return <div className="space-y-6">
    <header className="pledgr-hero p-6 space-y-3"><p className="pledgr-eyebrow">Community funding · V2</p><h1 className="text-3xl font-bold">{p.title}</h1><p>{p.description}</p><p className="text-sm break-all">Creator: {p.creator} · {p.recipientWallet}</p></header>
    {message&&<p role="status" className="border-2 border-foreground bg-lime p-4 break-words">{message}</p>}
    <fieldset disabled={busy} aria-busy={busy} className="space-y-6 min-w-0">
      {!c&&<section className={panel}>
        <h2 className="text-xl font-bold">Creator registration</h2>
        <p>Proposal status: {p.status}. Validator and admin authorize the campaign without gas. The creator then registers it in one transaction; funding opens immediately.</p>
        <div className="flex flex-wrap gap-3">
          {p.status==="Pending"&&s.permissions.isValidator&&<button className={button} onClick={()=>void run(()=>apiClient(`/api/proposals/${p._id}/validation`,{method:"PATCH",body:JSON.stringify({action:"approve"})}))}>Validate proposal</button>}
          {p.status==="Validated"&&s.permissions.isAdmin&&<button className={button} onClick={()=>void run(()=>apiClient(`/api/proposals/${p._id}/admin-review`,{method:"PATCH",body:JSON.stringify({action:"approve"})}))}>Approve proposal</button>}
          {p.status==="Approved"&&(!r||registrationExpired)&&<button className={button} onClick={()=>void run(()=>post({action:"prepareRegistration"}))}>{r?"Renew registration authorization":"Prepare registration"}</button>}
          {r&&!registrationExpired&&reviewerRole&&!(reviewerRole==="validator"?r.validatorSignature:r.adminSignature)&&<button className={button} onClick={()=>void run(signRegistration,"Registration signature saved. No gas charged.")}>Sign as {reviewerRole} · no gas</button>}
          {r&&!registrationExpired&&creator&&r.validatorSignature&&r.adminSignature&&<button className={button} onClick={()=>void run(register,"Campaign registered. Donations are open.")}>Register my campaign</button>}
        </div>
        {r&&<p className="text-sm">Validator: {r.validatorSignature?"signed":"awaiting signature"} · Admin: {r.adminSignature?"signed":"awaiting signature"}. Authorization expires {new Date(r.message.validUntil*1000).toLocaleString()}.</p>}
      </section>}
      {c&&<>
        <section className={panel}><h2 className="text-xl font-bold">Funding overview</h2>
          <div className="grid sm:grid-cols-3 gap-4"><div><p>Total collected</p><strong className="text-2xl">{formatEther(c.totalRaised)} BOT</strong></div><div><p>Withdrawn</p><strong className="text-2xl">{formatEther(c.totalWithdrawn)} BOT</strong></div><div><p>Available</p><strong className="text-2xl">{formatEther(c.available)} BOT</strong></div></div>
          <p>Target: {formatEther(c.target)} BOT · Deadline: {c.deadline?new Date(c.deadline*1000).toLocaleString():"Unlimited"}</p>
          <p>{c.cancelled?"Campaign cancelled. Donors may claim refunds.":"Donations remain open after the deadline and after reaching the target."}</p>
        </section>
        {!c.cancelled&&<section className={panel}><h2 className="text-xl font-bold">Contribute BOT</h2>
          <label className="block">Donation amount (BOT)<input className={input} inputMode="decimal" value={donation} onChange={e=>setDonation(e.target.value)}/></label>
          <button className={button} onClick={()=>void run(async()=>{const value=parseEther(donation);if(value<=0n)throw new Error("Enter a positive amount.");await v2Transaction(p._id,p.contractAddress!,"donate",contract=>contract.donate(c.campaignId,{value}));},"Donation confirmed.")}>Donate BOT</button>
        </section>}
        {!c.cancelled&&<section className={panel}><h2 className="text-xl font-bold">Partial withdrawal</h2>
          <p>Request an exact amount. A validator and admin sign it without gas. The creator submits one claim transaction to receive that amount.</p>
          {!c.eligible&&<p>Withdrawal unlocks when the target is met or a dated campaign reaches its deadline. Unlimited campaigns unlock at the target.</p>}
          {creator&&canRequest&&<div className="space-y-3"><label className="block">Amount to withdraw (BOT)<input className={input} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`Up to ${formatEther(c.available)}`}/></label><button className={button} onClick={()=>void run(()=>post({action:"requestWithdrawal",amount}),"Withdrawal requested. No wallet transaction needed.")}>Request withdrawal · no gas</button></div>}
          {w&&<div className="border-2 border-foreground bg-white p-4 space-y-3">
            <p className="font-bold">{formatEther(w.message.amount)} BOT · {expired?"Expired":w.status}</p>
            <p className="text-sm">Validator: {w.validatorSignature?"signed":"pending"} · Admin: {w.adminSignature?"signed":"pending"}. Expires {new Date(w.validUntil*1000).toLocaleString()}.</p>
            <p className="text-sm">This amount is fixed for both signatures. Each later withdrawal needs a new request and signatures.</p>
            {awaitingReviewer&&<div className="flex flex-wrap gap-3"><button className={button} onClick={()=>void run(signWithdrawal,"Approval signed. No gas charged.")}>Sign approval · no gas</button><button className="pledgr-action px-4 py-2 bg-red-600 text-white" onClick={()=>void run(()=>post({action:"reviewWithdrawal",requestId:w.requestId,role:reviewerRole,reject:true}),"Request rejected.")}>Reject request</button></div>}
            {creator&&w.status==="Approved"&&!expired&&<button className={button} onClick={()=>void run(claim,"Claim confirmed. BOT was sent to the creator wallet.")}>Claim {formatEther(w.message.amount)} BOT</button>}
          </div>}
          <p className="text-sm text-gray-600">Signing approvals opens a MetaMask signature prompt but costs no gas. Claiming opens a transaction prompt.</p>
        </section>}
        {creator&&!c.cancelled&&<section className={panel}><h2 className="text-xl font-bold">Keep fundraising</h2><p>Increase the target, extend the deadline, or switch to unlimited. Collected and withdrawn balances stay intact. Withdrawal eligibility already earned is preserved.</p>
          <label className="block">New target (BOT, optional)<input className={input} inputMode="decimal" value={target} onChange={e=>setTarget(e.target.value)} placeholder={formatEther(c.target)}/></label>
          {c.deadline!==0&&<><label className="block">Extend deadline (optional)<input type="datetime-local" disabled={unlimited||busy} className={input} value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><label className="flex gap-2"><input type="checkbox" checked={unlimited} onChange={e=>setUnlimited(e.target.checked)}/> Switch to unlimited</label></>}
          <button className={button} onClick={()=>void run(updateTerms,"Campaign terms updated.")}>Update campaign terms</button><p className="text-sm text-gray-600">This changes the public contract state and requires a transaction.</p>
          {BigInt(c.totalWithdrawn)===0n&&<button className="pledgr-action px-4 py-2 bg-red-600 text-white" onClick={()=>{if(window.confirm("Cancel this campaign and enable donor refunds?"))void run(async()=>{await signer(c.creator);await v2Transaction(p._id,p.contractAddress!,"cancel",contract=>contract.cancel(c.campaignId));});}}>Cancel campaign</button>}
        </section>}
        {c.cancelled&&<section className={panel}><h2 className="text-xl font-bold">Donor refunds</h2><button className={button} onClick={()=>void run(()=>v2Transaction(p._id,p.contractAddress!,"refund",contract=>contract.refund(c.campaignId)),"Refund confirmed.")}>Claim my refund</button></section>}
        <section className={panel}><h2 className="text-xl font-bold">Recent donations</h2>{p.transactions?.length?p.transactions.slice(-10).reverse().map(tx=><p key={tx.txHash}><a className="underline break-all" href={getExplorerTxUrl(tx.txHash)} target="_blank" rel="noreferrer">{formatEther(tx.amountAtomic)} BOT · {tx.donor}</a></p>):<p>No synchronized donations yet.</p>}</section>
      </>}
      <details className={panel}><summary className="font-bold cursor-pointer">Sync confirmed transaction</summary><p>Paste a successful registration, donation, claim, terms update, cancellation, or refund hash if the page has not caught up.</p><label className="block">Transaction hash<input className={input} value={hash} onChange={e=>setHash(e.target.value)} placeholder="0x…"/></label><button className={button} onClick={()=>void run(()=>post({action:"sync",txHash:hash.trim()}),"Transaction synchronized.")}>Sync transaction</button></details>
    </fieldset>
    {busy&&<p role="status">Waiting for confirmation…</p>}
  </div>;
}
