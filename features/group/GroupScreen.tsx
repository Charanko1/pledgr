"use client";

import dynamic from "next/dynamic";
import { ErrorState, LoadingState } from "@/components/ui/ContentState";
import { useState } from "react";
import { useParams } from "next/navigation";
import GroupHeader from "@/features/group/components/GroupHeader";
import GroupTabs from "@/features/group/components/GroupTabs";
import ProposalBoard from "@/features/group/components/ProposalBoard";
const MemberBoard = dynamic(() => import("./components/MemberBoard"));
const AboutBoard = dynamic(() => import("./components/AboutBoard"));
import { useGroup } from "./hooks/useGroup";
import GroupJoinRequestBoard from "./components/GroupJoinRequestBoard";

export default function GroupPage() {
  const { orgId, groupId } = useParams() as {
    orgId: string;
    groupId: string;
  };

  const [tab, setTab] = useState("proposal");
  const [actionError, setActionError] = useState("");

  const {
    loading,
    error,
    refresh,
    group,
    members,
    proposals,
    joinRequests,
    currentRole,
    createProposal,
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
    approveJoinRequest,
    rejectJoinRequest,
  } = useGroup(groupId);

  if (loading) {
    return <LoadingState label="Opening your group…" />;
  }

  if (error || !group) {
    return (
      <ErrorState
        message={error?.message || "Group not found."}
        onRetry={() => void refresh()}
      />
    );
  }

  async function safeAction(
    action: () => Promise<void> | void
  ): Promise<void> {
    setActionError("");

    try {
      await action();
    } catch (actionErrorValue: unknown) {
      setActionError(
        actionErrorValue instanceof Error
          ? actionErrorValue.message
          : "The action could not be completed. Please try again."
      );
    }
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div
          role="alert"
          className="border-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-brutal"
        >
          {actionError}
        </div>
      )}

      <GroupHeader group={group} />

      <GroupTabs
        tab={tab}
        setTab={setTab}
        showRequests={currentRole === "Admin"}
        requestCount={joinRequests.length}
      />

      {tab === "proposal" && (
        <ProposalBoard
          proposals={proposals}
          currentRole={currentRole}
          currentUserId={group.currentUserId}
          group={group}
          orgId={orgId}
          groupId={groupId}
          onCreate={(data) => safeAction(() => createProposal(data))}
          onDelete={(id) => void safeAction(() => deleteProposal(id))}
          onValidate={(id, action) =>
            void safeAction(() => validateProposal(id, action))
          }
          onAdminReview={(id, action) =>
            void safeAction(() => reviewProposal(id, action))
          }
          onRegisterOnChain={(id) =>
            void safeAction(() => registerProposalOnChain(id))
          }
          onActivateFunding={(id) =>
            void safeAction(() => activateFunding(id))
          }
          onRequestWithdrawal={(id) =>
            void safeAction(() => requestWithdrawal(id))
          }
          onWithdrawalReview={(id, action) =>
            void safeAction(() => reviewWithdrawal(id, action))
          }
          onRelease={(id) =>
            void safeAction(() => releaseFund(id))
          }
          onCancel={(id) =>
            void safeAction(() => cancelProposal(id))
          }
        />
      )}

      {tab === "join-requests" && currentRole === "Admin" && (
        <GroupJoinRequestBoard
          requests={joinRequests}
          onApprove={(id) =>
            void safeAction(() => approveJoinRequest(id))
          }
          onReject={(id) =>
            void safeAction(() => rejectJoinRequest(id))
          }
        />
      )}

      {tab === "members" && (
        <MemberBoard
          members={members}
          currentRole={currentRole}
          onSetValidator={(id) =>
            void safeAction(() => setValidator(id))
          }
          onRemoveValidator={(id) =>
            void safeAction(() => removeValidator(id))
          }
          onRemoveMember={(id) =>
            void safeAction(() => removeMember(id))
          }
        />
      )}

      {tab === "about" && <AboutBoard group={group} />}
    </div>
  );
}
