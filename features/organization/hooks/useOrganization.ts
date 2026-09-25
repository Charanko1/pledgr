"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { apiClient } from "@/lib/api-client";
import type { OrganizationSummary } from "@/types/organization";
import {
  APP_REALTIME_INTERVAL_MS,
  APP_DATA_REFRESH_INTERVAL_MS,
} from "@/lib/realtime";

interface Organization extends OrganizationSummary {
  code: string;
}

interface Group {
  _id: string;
  name: string;
  description: string;
  leader: string;
  members: number;
  joined: boolean;
  pending: boolean;
}

interface Member {
  _id: string;
  userId: string;
  name: string;
  walletAddress: string;
  role: "Admin" | "Member" | "Validator";
}

interface JoinRequest {
  _id: string;
  membershipId: string;
  groupId: string;
  groupName: string;
  memberName: string;
  walletAddress?: string;
  createdAt: string;
}

export function useOrganization(orgId: string) {
  const client = useQueryClient();
  const { profile } = useProfile();

  const organizationQuery = useQuery({
    queryKey: ["organization", orgId],
    enabled: Boolean(orgId),
    refetchInterval: APP_DATA_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      apiClient<Organization>(`/api/organizations/${orgId}`, { signal }),
  });

  const groupsQuery = useQuery({
    queryKey: ["organization-groups", orgId],
    enabled: Boolean(orgId),
    refetchInterval: APP_DATA_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      apiClient<Group[]>(`/api/groups?organization=${orgId}`, { signal }),
  });

  const membersQuery = useQuery({
    queryKey: ["organization-members", orgId],
    enabled: Boolean(orgId),
    refetchInterval: APP_DATA_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      apiClient<Member[]>(`/api/memberships?organization=${orgId}`, { signal }),
  });

  const myRole =
    membersQuery.data?.find((member) => member.userId === profile?._id)?.role ||
    "Member";

  const requestsQuery = useQuery({
    queryKey: ["join-requests", orgId],
    enabled: Boolean(orgId) && myRole === "Admin",
    refetchInterval: APP_REALTIME_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      apiClient<JoinRequest[]>(
        `/api/groups/join-requests?organization=${encodeURIComponent(orgId)}`,
        { signal }
      ),
  });

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["organization", orgId] }),
      client.invalidateQueries({ queryKey: ["organization-groups", orgId] }),
      client.invalidateQueries({ queryKey: ["organization-members", orgId] }),
      client.invalidateQueries({ queryKey: ["join-requests", orgId] }),
      client.invalidateQueries({ queryKey: ["history"] }),
    ]);
  }

  return {
    org: organizationQuery.data,
    groups: groupsQuery.data || [],
    members: membersQuery.data || [],
    requests: requestsQuery.data || [],
    myRole,
    loading:
      organizationQuery.isPending ||
      groupsQuery.isPending ||
      membersQuery.isPending,
    error:
      organizationQuery.error || groupsQuery.error || membersQuery.error || requestsQuery.error,
    refresh,
  };
}
