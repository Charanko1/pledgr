"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { ErrorState, LoadingState } from "@/components/ui/ContentState";
import ProposalHero from "@/features/proposal/components/ProposalHero";
import FundingCard from "@/features/proposal/components/FundingCard";
import ValidatorCard from "@/features/proposal/components/ValidatorCard";
import { useWallet } from "@/context/WalletContext";
import { getExplorerTxUrl } from "@/lib/blockchain";
import { parseBotAmount, formatBotAmount, fundingPercentage } from "@/lib/bot";
import { APP_REALTIME_INTERVAL_MS } from "@/lib/realtime";
import { getAddress } from "ethers";
import type { Proposal } from "@/types/group";

type ProposalResponse = Proposal & { permissions?: { isCreator: boolean; isAdmin: boolean; isValidator: boolean; isMember: boolean } };

export default function ProposalDetailPage() {
  const { proposalId } = useParams() as { proposalId: string };
  const { address, connectWallet, connecting } = useWallet();
  const client = useQueryClient();
  const pending = useRef(false);
  const [donating, setDonating] = useState(false);
  const [donationAmount, setDonationAmount] = useState("0.001");
  const [message, setMessage] = useState("");

  const query = useQuery({
    queryKey: ["proposal", proposalId],
    refetchInterval: APP_REALTIME_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) => apiClient<ProposalResponse>(`/api/proposals/${proposalId}`, { signal }),
  });
  const proposal = query.data;

  async function walletOrThrow() {
    const live = address || await connectWallet();
    if (!live) throw new Error("Connect MetaMask to continue.");
    return live;
  }

  async function invalidate() {
    await Promise.all([
      query.refetch(),
      client.invalidateQueries({ queryKey: ["group"] }),
      client.invalidateQueries({ queryKey: ["history"] }),
      client.invalidateQueries({ queryKey: ["organizations"] }),
      client.invalidateQueries({ queryKey: ["organization"] }),
    ]);
  }

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setMessage("");
    try { await action(); await invalidate(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The action could not be completed."); }
    finally { pending.current = false; }
  }

  if (query.isPending) return <LoadingState label="Opening this proposal…" />;
  if (query.error || !proposal) return <ErrorState message={query.error?.message || "Proposal not found."} onRetry={() => void query.refetch()} />;

  const permissions = proposal.permissions || { isCreator: false, isAdmin: false, isValidator: false, isMember: true };
  const isCancelled = proposal.status === "Cancelled" || proposal.blockchainStatus === "CANCELLED";
  const isReleased = proposal.status === "Released" || proposal.blockchainStatus === "RELEASED";
  const finished = BigInt(proposal.fundedAmountAtomic || "0") >= BigInt(proposal.targetAmountAtomic || "0") || new Date(proposal.deadline).getTime() <= Date.now();
  const fundingOpen = proposal.status === "Funding" && proposal.blockchainStatus === "APPROVED" && !finished && !isCancelled && !isReleased;
  const percentage = fundingPercentage(proposal.fundedAmountAtomic || "0", proposal.targetAmountAtomic || "0");

  async function donate() {
    let amountAtomic: bigint;
    try { amountAtomic = parseBotAmount(donationAmount); } catch (error) { setMessage(error instanceof Error ? error.message : "Enter a valid BOT amount."); return; }
    await run(async () => {
      await walletOrThrow();
      const { getContract } = await import("@/lib/blockchain");
      const tx = await (await getContract()).donate(proposal._id, { value: amountAtomic });
      await tx.wait();
      await apiClient(`/api/proposals/${proposal._id}/donate`, { method: "POST", body: JSON.stringify({ txHash: tx.hash }) });
      setDonationAmount("0.001");
      setMessage(`Donation confirmed: ${formatBotAmount(amountAtomic)} BOT.`);
    });
    setDonating(false);
  }

  async function registerOnChain() {
    await run(async () => {
      const live = await walletOrThrow();
      if (!permissions.isAdmin) throw new Error("Only a group admin can register the campaign on-chain.");
      const { getContract, getContractAdmin } = await import("@/lib/blockchain");
      const liveAdmin = await (await import("@/lib/blockchain")).getWalletAddress();
      if ((await getContractAdmin()).toLowerCase() !== liveAdmin.toLowerCase()) throw new Error("Connected wallet is not the PLEDGR contract admin.");
      const members = await apiClient<any[]>(`/api/groups/${proposal.groupId}/members`);
      const validators = members.filter((member) => member.role === "Validator" && member.status === "ACTIVE" && member.walletAddress).map((member) => getAddress(member.walletAddress));
      if (!validators.length) throw new Error("At least one active validator with a verified wallet is required.");
      const deadline = Math.floor(new Date(proposal.deadline).getTime() / 1000);
      const tx = await (await getContract()).createCampaign(proposal._id, BigInt(proposal.targetAmountAtomic), deadline, proposal.recipientWallet, validators);
      await tx.wait();
      await apiClient(`/api/proposals/${proposal._id}`, { method: "PATCH", body: JSON.stringify({ blockchainStatus: "CREATED", blockchainCreateTxHash: tx.hash }) });
      setMessage("Proposal registered on-chain. Waiting for admin to activate funding.");
    });
  }

  async function activateFunding() {
    await run(async () => {
      await walletOrThrow();
      if (!permissions.isAdmin) throw new Error("Only a group admin can activate funding.");
      const { getContract, getContractAdmin } = await import("@/lib/blockchain");
      const live = await (await import("@/lib/blockchain")).getWalletAddress();
      if ((await getContractAdmin()).toLowerCase() !== live.toLowerCase()) throw new Error("Connected wallet is not the PLEDGR contract admin.");
      const tx = await (await getContract()).approveCampaign(proposal._id);
      await tx.wait();
      await apiClient(`/api/proposals/${proposal._id}`, { method: "PATCH", body: JSON.stringify({ blockchainStatus: "APPROVED", blockchainApprovalTxHash: tx.hash }) });
      setMessage("Funding is now open on-chain.");
    });
  }

  async function reviewProposal(action: "approve" | "reject") {
    await run(async () => {
      await apiClient(`/api/proposals/${proposal._id}/admin-review`, { method: "PATCH", body: JSON.stringify({ action }) });
    });
  }

  async function validateProposal(action: "approve" | "reject") {
    await run(async () => {
      await apiClient(`/api/proposals/${proposal._id}/validation`, { method: "PATCH", body: JSON.stringify({ action }) });
    });
  }

  async function requestWithdrawal() {
    await run(async () => {
      if (proposal.status === "Release Rejected") {
        await apiClient(`/api/proposals/${proposal._id}/withdraw`, { method: "POST", body: JSON.stringify({}) });
        return;
      }
      const liveWallet = await walletOrThrow();
      if (liveWallet.toLowerCase() !== proposal.recipientWallet.toLowerCase()) throw new Error("Connect the fundraiser wallet to request withdrawal.");
      const { getContract } = await import("@/lib/blockchain");
      const tx = await (await getContract()).requestWithdrawal(proposal._id);
      await tx.wait();
      await apiClient(`/api/proposals/${proposal._id}/withdraw`, { method: "POST", body: JSON.stringify({ txHash: tx.hash }) });
    });
  }

  async function reviewWithdrawal(action: "approve" | "reject") {
    await run(async () => {
      if (action === "reject") {
        if (permissions.isAdmin && proposal.withdrawalStatus === "ValidatorApproved") {
          await walletOrThrow();
          const { getContract } = await import("@/lib/blockchain");
          const tx = await (await getContract()).resetValidatorReleaseApproval(proposal._id);
          await tx.wait();
          await apiClient(`/api/proposals/${proposal._id}/withdrawal-review`, { method: "PATCH", body: JSON.stringify({ action, resetTxHash: tx.hash }) });
        } else {
          await apiClient(`/api/proposals/${proposal._id}/withdrawal-review`, { method: "PATCH", body: JSON.stringify({ action }) });
        }
        return;
      }
      await walletOrThrow();
      const { getContract } = await import("@/lib/blockchain");
      const contract = await getContract();
      const approvalType = permissions.isValidator && !permissions.isAdmin && proposal.withdrawalStatus === "Requested" ? "validator" : permissions.isAdmin && proposal.withdrawalStatus === "ValidatorApproved" ? "admin" : "";
      if (!approvalType) throw new Error("This withdrawal is not awaiting approval from your role.");
      const tx = approvalType === "validator" ? await contract.approveValidatorRelease(proposal._id) : await contract.approveAdminRelease(proposal._id);
      await tx.wait();
      await apiClient(`/api/proposals/${proposal._id}/withdrawal-review`, { method: "PATCH", body: JSON.stringify({ action, blockchainTxHash: tx.hash, blockchainApprovalType: approvalType }) });
    });
  }

  async function releaseFund() {
    await run(async () => {
      await walletOrThrow();
      const { getContract, getContractAdmin, getWalletAddress } = await import("@/lib/blockchain");
      const live = await getWalletAddress();
      if ((await getContractAdmin()).toLowerCase() !== live.toLowerCase()) throw new Error("Connected wallet is not the PLEDGR contract admin.");
      const campaign = await getContract().getCampaign(proposal._id);
      if (BigInt(campaign.totalRaised) <= 0n) throw new Error("There are no BOT funds to release.");
      const tx = await getContract().releaseFund(proposal._id);
      await tx.wait();
      await apiClient(`/api/proposals/${proposal._id}/release`, { method: "POST", body: JSON.stringify({ txHash: tx.hash }) });
    });
  }

  async function cancel() {
    await run(async () => {
      const live = await walletOrThrow();
      if (!permissions.isCreator && !permissions.isAdmin) throw new Error("Only the fundraiser or group admin can cancel this proposal.");
      if (proposal.blockchainStatus === "PENDING") {
        await apiClient(`/api/proposals/${proposal._id}/cancel`, { method: "POST", body: JSON.stringify({}) });
        return;
      }
      const { getContract, getContractAdmin } = await import("@/lib/blockchain");
      const fundraiser = live.toLowerCase() === proposal.recipientWallet.toLowerCase();
      if (!fundraiser && (await getContractAdmin()).toLowerCase() !== live.toLowerCase()) throw new Error("Connect the fundraiser wallet or PLEDGR contract admin wallet to cancel on-chain.");
      const tx = await getContract().cancelCampaign(proposal._id);
      await tx.wait();
      await apiClient(`/api/proposals/${proposal._id}/cancel`, { method: "POST", body: JSON.stringify({ txHash: tx.hash }) });
    });
  }

  async function deleteProposal() {
    if (!window.confirm("Delete this proposal? This cannot be undone.")) return;
    await run(async () => { await apiClient(`/api/proposals/${proposal._id}`, { method: "DELETE" }); setMessage("Proposal deleted."); });
  }

  async function claimRefund() {
    await run(async () => {
      const donor = await walletOrThrow();
      const { getContract, getReadContract } = await import("@/lib/blockchain");
      const refundable = BigInt(await getReadContract().getRefundableAmount(proposal._id, donor));
      if (refundable <= 0n) throw new Error("This wallet has no BOT refund remaining.");
      const tx = await getContract().claimRefund(proposal._id);
      await tx.wait();
      await apiClient(`/api/proposals/${proposal._id}/refund`, { method: "POST", body: JSON.stringify({ txHash: tx.hash }) });
      setMessage(`Refund confirmed: ${formatBotAmount(refundable)} BOT returned to your wallet.`);
    });
  }

  return (
    <div className="space-y-8">
      {message && <p role="status" className="pledgr-panel p-4 break-words">{message}</p>}
      <ProposalHero proposal={proposal} />
      <div className="bg-white border p-6 shadow-brutal">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Workflow Status</h2><p className="text-sm text-gray-500 mt-1">{proposal.status}</p></div><span className="text-xs border-2 border-foreground px-3 py-1">Blockchain: {proposal.blockchainStatus || "PENDING"}</span></div>
        {proposal.creatorProfile && <p className="mt-3 text-sm">Creator: <span className="font-semibold">{proposal.creatorProfile.name}</span></p>}
        <p className="mt-2 text-sm break-all">Fundraiser wallet: <span className="font-semibold">{proposal.recipientWallet}</span></p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {permissions.isValidator && proposal.status === "Pending" && <><button onClick={() => void validateProposal("approve")} className="bg-green-600 text-white px-4 py-2">Validate</button><button onClick={() => void validateProposal("reject")} className="bg-red-600 text-white px-4 py-2">Reject</button></>}
          {permissions.isAdmin && proposal.status === "Validated" && <><button onClick={() => void reviewProposal("approve")} className="bg-green-600 text-white px-4 py-2">Approve Proposal</button><button onClick={() => void reviewProposal("reject")} className="bg-red-600 text-white px-4 py-2">Reject Proposal</button></>}
          {permissions.isCreator && ["Pending", "Rejected"].includes(proposal.status) && proposal.blockchainStatus === "PENDING" && <button onClick={() => void deleteProposal()} className="bg-red-600 text-white px-4 py-2">Delete Proposal</button>}
          {permissions.isAdmin && proposal.status === "Approved" && proposal.blockchainStatus === "PENDING" && <button onClick={() => void registerOnChain()} disabled={connecting} className="bg-primary text-white px-4 py-2">Register On-chain</button>}
          {permissions.isAdmin && proposal.status === "Approved" && proposal.blockchainStatus === "CREATED" && <button onClick={() => void activateFunding()} disabled={connecting} className="bg-purple-600 text-white px-4 py-2">Activate Funding</button>}
          {fundingOpen && finished && permissions.isCreator && ["Funding", "Release Rejected"].includes(proposal.status) && <button onClick={() => void requestWithdrawal()} disabled={connecting} className="bg-primary text-white px-4 py-2">Request Withdrawal</button>}
          {proposal.status === "Withdrawal Requested" && permissions.isValidator && !permissions.isAdmin && <><button onClick={() => void reviewWithdrawal("approve")} className="bg-green-600 text-white px-4 py-2">Approve Release</button><button onClick={() => void reviewWithdrawal("reject")} className="bg-red-600 text-white px-4 py-2">Reject Release</button></>}
          {proposal.status === "Validator Release Approved" && permissions.isAdmin && <><button onClick={() => void reviewWithdrawal("approve")} className="bg-green-600 text-white px-4 py-2">Final Approve Release</button><button onClick={() => void reviewWithdrawal("reject")} className="bg-red-600 text-white px-4 py-2">Reject Release</button></>}
          {proposal.status === "Release Approved" && permissions.isAdmin && <button onClick={() => void releaseFund()} className="bg-black text-white px-4 py-2">Release BOT</button>}
          {permissions.isCreator || permissions.isAdmin ? (!isCancelled && !isReleased && ["Validated", "Approved", "Funding"].includes(proposal.status) ? <button onClick={() => { if (window.confirm("Cancel this proposal? Donors will be able to claim their BOT refunds.")) void cancel(); }} className="border-2 border-red-600 text-red-700 px-4 py-2">Cancel Proposal</button> : null) : null}
        </div>
      </div>

      <FundingCard target={proposal.targetAmount} funded={proposal.fundedAmount} targetAtomic={proposal.targetAmountAtomic} fundedAtomic={proposal.fundedAmountAtomic} />
      <ValidatorCard proposal={proposal} />

      {fundingOpen && <div className="bg-white border p-6 shadow-brutal"><h2 className="text-xl font-bold mb-2">Donate BOT</h2><p className="text-gray-500 mb-5">BOT is held by the PLEDGR smart contract until the campaign is released or cancelled.</p><div className="flex flex-col sm:flex-row gap-3"><input inputMode="decimal" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="flex-1 border-2 border-foreground p-3 shadow-brutal" placeholder="0.001" /><button onClick={() => { setDonating(true); void donate(); }} disabled={donating || connecting} className="bg-primary text-white px-5 py-3 border-2 border-foreground shadow-brutal">{donating ? "Waiting…" : "Donate BOT"}</button></div><div className="mt-4 text-sm text-gray-500">Progress: {percentage}% · Deadline: {new Date(proposal.deadline).toLocaleDateString()}</div></div>}

      {isCancelled && <div className="bg-white border p-6 shadow-brutal"><h2 className="text-xl font-bold">Campaign Cancelled</h2><p className="text-sm text-gray-600 mt-2">Donors can claim back the BOT they contributed from the smart contract.</p><button onClick={() => void claimRefund()} disabled={connecting} className="mt-4 bg-primary text-white px-5 py-3 border-2 border-foreground shadow-brutal">{address ? "Claim my BOT refund" : "Connect wallet to claim refund"}</button></div>}

      <div className="bg-white border p-6 shadow-brutal"><h2 className="text-xl font-bold mb-3">Blockchain Transactions</h2><div className="space-y-2 text-xs font-mono break-all">{proposal.blockchainCreateTxHash && <a className="text-primary underline block" href={getExplorerTxUrl(proposal.blockchainCreateTxHash)} target="_blank" rel="noreferrer">Creation: {proposal.blockchainCreateTxHash}</a>}{proposal.blockchainApprovalTxHash && <a className="text-primary underline block" href={getExplorerTxUrl(proposal.blockchainApprovalTxHash)} target="_blank" rel="noreferrer">Activation: {proposal.blockchainApprovalTxHash}</a>}{proposal.withdrawalRequestTxHash && <a className="text-primary underline block" href={getExplorerTxUrl(proposal.withdrawalRequestTxHash)} target="_blank" rel="noreferrer">Withdrawal request: {proposal.withdrawalRequestTxHash}</a>}{proposal.validatorReleaseApprovalTxHash && <a className="text-primary underline block" href={getExplorerTxUrl(proposal.validatorReleaseApprovalTxHash)} target="_blank" rel="noreferrer">Validator release: {proposal.validatorReleaseApprovalTxHash}</a>}{proposal.validatorReleaseResetTxHash && <a className="text-primary underline block" href={getExplorerTxUrl(proposal.validatorReleaseResetTxHash)} target="_blank" rel="noreferrer">Validator reset: {proposal.validatorReleaseResetTxHash}</a>}{proposal.adminReleaseApprovalTxHash && <a className="text-primary underline block" href={getExplorerTxUrl(proposal.adminReleaseApprovalTxHash)} target="_blank" rel="noreferrer">Admin release approval: {proposal.adminReleaseApprovalTxHash}</a>}{proposal.cancelTxHash && <a className="text-primary underline block" href={getExplorerTxUrl(proposal.cancelTxHash)} target="_blank" rel="noreferrer">Cancellation: {proposal.cancelTxHash}</a>}{proposal.releaseTxHash && <a className="text-primary underline block" href={getExplorerTxUrl(proposal.releaseTxHash)} target="_blank" rel="noreferrer">Release: {proposal.releaseTxHash}</a>}{!proposal.blockchainCreateTxHash && !proposal.blockchainApprovalTxHash && !proposal.withdrawalRequestTxHash && !proposal.validatorReleaseApprovalTxHash && !proposal.validatorReleaseResetTxHash && !proposal.adminReleaseApprovalTxHash && !proposal.cancelTxHash && !proposal.releaseTxHash && <span className="text-gray-500">No blockchain transactions yet.</span>}</div></div>
    </div>
  );
}
