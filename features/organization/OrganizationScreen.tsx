"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "./hooks/useOrganization";
import { apiClient } from "@/lib/api-client";
import { ErrorState, LoadingState } from "@/components/ui/ContentState";
import OrganizationHero from "./components/OrganizationHero";
import OrganizationMenu from "./components/OrganizationMenu";
import MemberList from "./components/MemberList";
import GroupList from "./components/GroupList";
const CreateGroupModal = dynamic(() => import("@/features/group/components/CreateGroupModal"));
const JoinRequestModal = dynamic(() => import("@/features/group/components/JoinRequestModal"));

export default function OrganizationScreen() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const { org, groups, members, requests, myRole, loading, error, refresh } = useOrganization(orgId);
  const [groupOpen, setGroupOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState("");
  const api = async (url: string, options?: RequestInit) => {
    setActionError("");
    try {
      await apiClient(url, options);
      await client.invalidateQueries({ queryKey: ["organizations"] });
      if (options?.method === "DELETE" && url.startsWith("/api/organizations/")) { router.push("/dashboard"); return; }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The action could not be completed.");
      throw err;
    }
  };
  const copyCode = async () => {
    if (!org) return;
    try { await navigator.clipboard.writeText(org.code); setCopied(true); }
    catch { setActionError("Could not copy the code. Please copy it from the menu."); }
  };
  if (loading) return <LoadingState label="Opening your organization…" />;
  if (error || !org) return <ErrorState message={error?.message || "Organization not found."} onRetry={() => void refresh()} />;

  return <div className="space-y-7">
    {requestOpen && <JoinRequestModal open onClose={() => setRequestOpen(false)} requests={requests}
      onApprove={id => { void api(`/api/groups/join-requests/${id}`, { method: "PATCH", body: JSON.stringify({ action: "Approved" }) }).catch(() => {}); }}
      onReject={id => { void api(`/api/groups/join-requests/${id}`, { method: "PATCH", body: JSON.stringify({ action: "Rejected" }) }).catch(() => {}); }} />}
    {groupOpen && <CreateGroupModal open onClose={() => setGroupOpen(false)} onCreate={group => api("/api/groups", { method: "POST", body: JSON.stringify({ ...group, organizationSlug: orgId }) })} />}
    {actionError && <p role="alert" className="border-2 border-red-700 bg-red-50 p-4">{actionError}</p>}
    <div className="relative">
      <OrganizationHero org={org} groups={groups} />
      <OrganizationMenu menuOpen={menuOpen} setMenuOpen={setMenuOpen} copied={copied} code={org.code} copyCode={copyCode}
        exitOrganization={() => { void api("/api/organizations/exit", { method: "DELETE", body: JSON.stringify({ organizationId: org._id }) }).catch(() => {}); }}
        deleteOrganization={() => { void api(`/api/organizations/${org._id}`, { method: "DELETE" }).catch(() => {}); }} />
    </div>
    <MemberList members={members} myRole={myRole}
      onRemove={id => { void api(`/api/memberships/${id}`, { method: "DELETE" }).catch(() => {}); }} />
    <GroupList groups={groups} org={org} myRole={myRole} requests={requests} onOpenCreate={() => setGroupOpen(true)} onOpenRequests={() => setRequestOpen(true)}
      onJoin={id => { void api(`/api/groups/${id}/join`, { method: "POST" }).catch(() => {}); }} />
  </div>;
}
