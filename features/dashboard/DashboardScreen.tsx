"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ErrorState } from "@/components/ui/ContentState";
import DashboardHeader from "./components/DashboardHeader";
import SearchBar from "./components/SearchBar";
import ActionCards from "./components/ActionCards";
import OrganizationGrid from "./components/OrganizationGrid";
import type { OrganizationSummary } from "@/types/organization";
import { APP_DATA_REFRESH_INTERVAL_MS } from "@/lib/realtime";

const CreateOrgModal = dynamic(() => import("@/features/organization/components/CreateOrgModal"));
const JoinOrgModal = dynamic(() => import("@/features/organization/components/JoinOrgModal"));

export default function DashboardScreen() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const query = useQuery({ queryKey: ["organizations"], refetchInterval: APP_DATA_REFRESH_INTERVAL_MS, refetchIntervalInBackground: false, refetchOnWindowFocus: true, refetchOnReconnect: true, queryFn: ({ signal }) => apiClient<OrganizationSummary[]>("/api/organizations", { signal }) });
  const organizations = query.data || [];
  const filtered = organizations.filter(org => org.name.toLowerCase().includes(search.toLowerCase()));
  const refresh = () => { void client.invalidateQueries({ queryKey: ["organizations"] }); };

  return <div className="space-y-8">
    {createOpen && <CreateOrgModal open onClose={() => setCreateOpen(false)} onSuccess={refresh} />}
    {joinOpen && <JoinOrgModal open onClose={() => setJoinOpen(false)} onSuccess={refresh} />}
    <DashboardHeader count={query.data?.length} />
    <ActionCards onCreate={() => setCreateOpen(true)} onJoin={() => setJoinOpen(true)} />
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between pt-2"><h2 className="text-xl font-bold tracking-tight">Your organizations</h2><SearchBar value={search} onChange={setSearch} /></div>
    {query.error ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : <OrganizationGrid loading={query.isPending} organizations={filtered} searching={!!search.trim()} onClear={() => setSearch("")} />}
  </div>;
}
