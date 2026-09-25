"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Profile } from "@/types/profile";

export const profileKey = ["profile"] as const;
export const profileQueryOptions = {
  queryKey: profileKey,
  queryFn: ({ signal }: { signal: AbortSignal }) => apiClient<Profile>("/api/profile", { signal }),
  staleTime: 30_000,
};
export function useProfile() {
  const query = useQuery(profileQueryOptions);
  return { profile: query.data, loading: query.isPending, error: query.error, refresh: query.refetch };
}
