"use client";

import { Contract } from "ethers";
import { getSigner, getReadProvider } from "@/lib/blockchain";
import { apiClient } from "@/lib/api-client";
import ABI from "@/lib/abi/PledgrTreasuryV2.json";

const locks=new Set<string>();
export async function v2Transaction(proposalId:string, address:string, action:string, send:(contract:Contract)=>Promise<{hash:string}>) {
  const signer=await getSigner();
  const chainId=(await signer.provider.getNetwork()).chainId;
  const wallet=await signer.getAddress();
  const key=`pledgr:v2:${chainId}:${address.toLowerCase()}:${proposalId}:${wallet.toLowerCase()}:${action}`;
  if(locks.has(key))throw new Error("This action is already in progress.");
  locks.add(key);
  let hash:string|null=null;
  try {
    hash=localStorage.getItem(key);
    if(!hash) {
      const tx=await send(new Contract(address,ABI,signer));
      hash=tx.hash;
      localStorage.setItem(key,hash);
    }
    const receipt=await getReadProvider().waitForTransaction(hash,1,120000);
    if(!receipt)throw new Error("Confirmation pending. Retry to check the same transaction.");
    if(receipt.status!==1){localStorage.removeItem(key);throw new Error("Transaction reverted.");}
    await apiClient(`/api/proposals/${proposalId}/v2`,{method:"POST",body:JSON.stringify({action:"sync",txHash:hash})});
    localStorage.removeItem(key);
  }catch(error){throw new Error(`${error instanceof Error?error.message:"Transaction failed."}${hash?` Transaction: ${hash}. Use Sync transaction if the wallet shows success.`:""}`);}
  finally{locks.delete(key);}
}
