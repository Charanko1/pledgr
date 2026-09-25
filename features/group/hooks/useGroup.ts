"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  GroupData,
  Member,
  Proposal,
  CreateProposalData,
  GroupRole,
} from "@/types/group";
import { useWallet } from "@/context/WalletContext";
import {
  APP_DATA_REFRESH_INTERVAL_MS,
  APP_REALTIME_INTERVAL_MS,
} from "@/lib/realtime";

export function useGroup(groupId: string) {
  const client = useQueryClient();
  const { address, connectWallet } = useWallet();

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    enabled: Boolean(groupId),
    refetchInterval: APP_DATA_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      apiClient<GroupData>(`/api/groups/${groupId}`, { signal }),
  });

  const proposalsQuery = useQuery({
    queryKey: ["proposals", groupId],
    enabled: Boolean(groupId),
    refetchInterval: APP_DATA_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      apiClient<Proposal[]>(`/api/proposals?group=${groupId}`, { signal }),
  });

  const membersQuery = useQuery({
    queryKey: ["group-members", groupId],
    enabled: Boolean(groupId),
    refetchInterval: APP_DATA_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      apiClient<Member[]>(`/api/groups/${groupId}/members`, { signal }),
  });

  const currentRole = groupQuery.data?.currentRole || "Member";

  const joinRequestsQuery = useQuery({
    queryKey: ["group-join-requests", groupId],
    enabled: Boolean(groupId) && currentRole === "Admin",
    refetchInterval: APP_REALTIME_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      apiClient<any[]>(`/api/groups/${groupId}/join-requests`, { signal }),
  });

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["group", groupId] }),
      client.invalidateQueries({ queryKey: ["proposals", groupId] }),
      client.invalidateQueries({ queryKey: ["group-members", groupId] }),
      client.invalidateQueries({ queryKey: ["group-join-requests", groupId] }),
      client.invalidateQueries({ queryKey: ["join-requests"] }),
    ]);
  }

  async function requireWallet() {
    const current = address || (await connectWallet());
    if (!current) throw new Error("Connect MetaMask to continue.");
    return current;
  }

  async function ensureContractAdminWallet() {
    const liveAddress = await requireWallet();
    const { getContractAdmin } = await import("@/lib/blockchain");
    const admin = await getContractAdmin();
    if (admin.toLowerCase() !== liveAddress.toLowerCase()) {
      throw new Error("The connected wallet is not the PLEDGR contract admin.");
    }
    return liveAddress;
  }

  async function createProposal(data: CreateProposalData) {
    await requireWallet();
    await apiClient<Proposal>("/api/proposals", {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        targetAmount: data.target,
        deadline: data.deadline,
        groupId,
      }),
    });
    await refresh();
  }

  async function handleJoinRequest(
    requestId: string,
    action: "Approved" | "Rejected"
  ) {
    await apiClient(`/api/groups/join-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    await refresh();
  }

  async function deleteProposal(id: string) {
    await apiClient(`/api/proposals/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function validateProposal(id: string, action: "approve" | "reject") {
    await apiClient(`/api/proposals/${id}/validation`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    await refresh();
  }

  async function reviewProposal(id: string, action: "approve" | "reject") {
    await apiClient(`/api/proposals/${id}/admin-review`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    await refresh();
  }

  async function registerProposalOnChain(id: string) {
    const liveWallet = await ensureContractAdminWallet();
    const group = groupQuery.data;
    if (group?.currentRole !== "Admin") {
      throw new Error("Only a group admin can register a campaign on-chain.");
    }

    const proposal = proposalsQuery.data?.find((item) => item._id === id);
    if (!proposal) throw new Error("Proposal not found.");

    const validators = (membersQuery.data || [])
      .filter(
        (member) =>
          member.role === "Validator" &&
          member.status === "ACTIVE" &&
          member.walletAddress
      )
      .map((member) => member.walletAddress!.toLowerCase());

    if (!validators.length) {
      throw new Error(
        "At least one active validator with a verified wallet is required."
      );
    }

    const { getContract } = await import("@/lib/blockchain");
    const targetAtomic = BigInt(proposal.targetAmountAtomic);
    const deadlineSeconds = Math.floor(
      new Date(proposal.deadline).getTime() / 1000
    );

    if (
      !Number.isFinite(deadlineSeconds) ||
      deadlineSeconds <= Math.floor(Date.now() / 1000)
    ) {
      throw new Error("The campaign deadline must be in the future.");
    }

    const contract = await getContract();
    const tx = await contract.createCampaign(
      id,
      targetAtomic,
      deadlineSeconds,
      proposal.recipientWallet,
      validators
    );
    await tx.wait();

    await apiClient(`/api/proposals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        blockchainStatus: "CREATED",
        blockchainCreateTxHash: tx.hash,
        blockchainActorWallet: liveWallet,
      }),
    });
    await refresh();
  }

  async function activateFunding(id: string) {
    await ensureContractAdminWallet();
    const { getContract } = await import("@/lib/blockchain");
    const contract = await getContract();
    const tx = await contract.approveCampaign(id);
    await tx.wait();

    await apiClient(`/api/proposals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        blockchainStatus: "APPROVED",
        blockchainApprovalTxHash: tx.hash,
      }),
    });
    await refresh();
  }

  async function requestWithdrawal(id: string) {
    const proposal = proposalsQuery.data?.find((item) => item._id === id);
    if (!proposal) throw new Error("Proposal not found.");

    if (proposal.status === "Release Rejected") {
      await apiClient(`/api/proposals/${id}/withdraw`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refresh();
      return;
    }

    const liveWallet = await requireWallet();
    if (liveWallet.toLowerCase() !== proposal.recipientWallet.toLowerCase()) {
      throw new Error("Connect the fundraiser wallet to request withdrawal.");
    }

    const { getContract } = await import("@/lib/blockchain");
    const contract = await getContract();
    const tx = await contract.requestWithdrawal(id);
    await tx.wait();

    await apiClient(`/api/proposals/${id}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ txHash: tx.hash }),
    });
    await refresh();
  }

  async function reviewWithdrawal(
    id: string,
    action: "approve" | "reject",
    note = ""
  ) {
    const proposal = proposalsQuery.data?.find((item) => item._id === id);
    if (!proposal) throw new Error("Proposal not found.");

    if (action === "reject") {
      if (
        proposal.withdrawalStatus === "ValidatorApproved" &&
        currentRole === "Admin"
      ) {
        await ensureContractAdminWallet();
        const { getContract } = await import("@/lib/blockchain");
        const contract = await getContract();
        const tx = await contract.resetValidatorReleaseApproval(id);
        await tx.wait();

        await apiClient(`/api/proposals/${id}/withdrawal-review`, {
          method: "PATCH",
          body: JSON.stringify({ action, note, resetTxHash: tx.hash }),
        });
      } else {
        await apiClient(`/api/proposals/${id}/withdrawal-review`, {
          method: "PATCH",
          body: JSON.stringify({ action, note }),
        });
      }

      await refresh();
      return;
    }

    await requireWallet();
    const { getContract } = await import("@/lib/blockchain");
    const contract = await getContract();
    let tx;

    if (
      currentRole === "Validator" &&
      proposal.withdrawalStatus === "Requested"
    ) {
      tx = await contract.approveValidatorRelease(id);
      await tx.wait();
      await apiClient(`/api/proposals/${id}/withdrawal-review`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          note,
          blockchainTxHash: tx.hash,
          blockchainApprovalType: "validator",
        }),
      });
    } else if (
      currentRole === "Admin" &&
      proposal.withdrawalStatus === "ValidatorApproved"
    ) {
      tx = await contract.approveAdminRelease(id);
      await tx.wait();
      await apiClient(`/api/proposals/${id}/withdrawal-review`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          note,
          blockchainTxHash: tx.hash,
          blockchainApprovalType: "admin",
        }),
      });
    } else {
      throw new Error("This withdrawal is not waiting for an approval from your role.");
    }

    await refresh();
  }

  async function releaseFund(id: string) {
    await ensureContractAdminWallet();
    const { getContract } = await import("@/lib/blockchain");
    const contract = await getContract();
    const campaign = await contract.getCampaign(id);
    const amount = BigInt(campaign.totalRaised);
    if (amount <= 0n) throw new Error("There are no BOT funds available to release.");

    const tx = await contract.releaseFund(id);
    await tx.wait();

    await apiClient(`/api/proposals/${id}/release`, {
      method: "POST",
      body: JSON.stringify({ txHash: tx.hash }),
    });
    await refresh();
  }

  async function cancelProposal(id: string) {
    const proposal = proposalsQuery.data?.find((item) => item._id === id);
    if (!proposal) throw new Error("Proposal not found.");

    if (["RELEASED", "CANCELLED"].includes(proposal.blockchainStatus || "")) {
      throw new Error("This proposal is already closed.");
    }

    if (
      ["Withdrawal Requested", "Validator Release Approved", "Release Approved"].includes(
        proposal.status
      )
    ) {
      throw new Error("This proposal is in withdrawal review and cannot be cancelled.");
    }

    if (proposal.blockchainStatus === "PENDING") {
      await apiClient(`/api/proposals/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refresh();
      return;
    }

    const liveWallet = await requireWallet();
    const { getContract, getContractAdmin } = await import("@/lib/blockchain");
    const isFundraiser =
      proposal.recipientWallet.toLowerCase() === liveWallet.toLowerCase();

    if (!isFundraiser) {
      const admin = await getContractAdmin();
      if (admin.toLowerCase() !== liveWallet.toLowerCase()) {
        throw new Error(
          "Connect the fundraiser wallet or PLEDGR contract admin wallet to cancel on-chain."
        );
      }
    }

    const contract = await getContract();
    const tx = await contract.cancelCampaign(id);
    await tx.wait();

    await apiClient(`/api/proposals/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ txHash: tx.hash }),
    });
    await refresh();
  }

  async function setValidator(memberId: string) {
    await apiClient(`/api/groups/${groupId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "set-validator" }),
    });
    await refresh();
  }

  async function removeValidator(memberId: string) {
    await apiClient(`/api/groups/${groupId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "remove-validator" }),
    });
    await refresh();
  }

  async function removeMember(memberId: string) {
    await apiClient(`/api/groups/${groupId}/members/${memberId}`, {
      method: "DELETE",
    });
    await refresh();
  }

  const group = groupQuery.data;
  const proposals = proposalsQuery.data || [];
  const members = membersQuery.data || [];
  const resolvedRole = currentRole as GroupRole;

  return {
    loading: groupQuery.isPending || proposalsQuery.isPending || membersQuery.isPending,
    error: groupQuery.error || proposalsQuery.error || membersQuery.error,
    group,
    members,
    proposals,
    joinRequests: joinRequestsQuery.data || [],
    currentRole: resolvedRole,
    isAdmin: resolvedRole === "Admin",
    isValidator: resolvedRole === "Validator",
    createProposal,
    approveJoinRequest: (id: string) => handleJoinRequest(id, "Approved"),
    rejectJoinRequest: (id: string) => handleJoinRequest(id, "Rejected"),
    deleteProposal,
    validateProposal,
    reviewProposal,
    registerProposalOnChain,
    activateFunding,
    requestWithdrawal,
    reviewWithdrawal,
    releaseFund,
    cancelProposal,
    setValidator,
    removeValidator,
    removeMember,
    refresh,
  };
}
