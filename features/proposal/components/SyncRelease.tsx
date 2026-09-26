"use client";

import { useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

export default function SyncRelease({ proposalId, onSynced }: { proposalId: string; onSynced: () => Promise<unknown> }) {
  const [hash, setHash] = useState("");
  const [type, setType] = useState("AdminReleaseApproved");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  async function sync() {
    if (lock.current) return;
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash.trim())) { setMessage("Enter the full transaction hash from your wallet activity."); return; }
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await apiClient("/api/blockchain/sync", { method: "POST", body: JSON.stringify({ proposalId, type, txHash: hash.trim() }) });
      await onSynced();
      setMessage("Confirmed transaction synchronized. The proposal is up to date.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not synchronize the transaction."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <details className="bg-white border-2 border-foreground p-5 shadow-brutal">
    <summary className="font-bold cursor-pointer">Sync confirmed transaction</summary>
    <p className="text-sm text-gray-600 my-3">Wallet shows success but this page is stuck? Select the completed action and paste its transaction hash. This checks the receipt without sending BOT or requesting another signature.</p>
    <div className="flex flex-col gap-3">
      <label className="text-sm font-bold">Completed action
        <select value={type} onChange={e => setType(e.target.value)} disabled={busy} className="block w-full border-2 p-2 mt-1">
          <option value="WithdrawalRequested">Request withdrawal</option>
          <option value="ValidatorReleaseApproved">Validator approval</option>
          <option value="AdminReleaseApproved">Final admin approval</option>
          <option value="ValidatorReleaseApprovalReset">Admin rejection / reset</option>
          <option value="FundReleased">Release BOT</option>
        </select>
      </label>
      <label className="text-sm font-bold">Transaction hash
        <input value={hash} onChange={e => setHash(e.target.value)} disabled={busy} placeholder="0x…" className="block w-full border-2 p-2 mt-1 font-mono" />
      </label>
      <button type="button" disabled={busy} onClick={() => void sync()} className="pledgr-action bg-primary text-white px-4 py-2 self-start">{busy ? "Checking receipt…" : "Sync transaction"}</button>
      {message && <p role="status" className="text-sm break-words">{message}</p>}
    </div>
  </details>;
}
