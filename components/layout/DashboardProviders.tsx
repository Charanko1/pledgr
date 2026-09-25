"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "@/context/WalletContext";
import { BlockchainRealtimeProvider } from "@/context/BlockchainRealtimeContext";
import { ApiError } from "@/lib/api-client";
import { saveSession, type SessionUser } from "@/lib/session";

export default function DashboardProviders({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
  } } }));

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new ApiError(data?.message || "Unauthorized", response.status);
        return data as { user: SessionUser };
      })
      .then((data) => {
        if (cancelled) return;
        saveSession(undefined, data.user);
        setReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        console.error("SESSION CHECK ERROR:", error);
        setReady(true);
      });

    return () => { cancelled = true; };
  }, [router]);

  if (!ready) {
    return <main className="min-h-screen grid place-items-center bg-[var(--background)] px-6"><p className="pledgr-eyebrow">Checking your session…</p></main>;
  }

  return <QueryClientProvider client={client}><BlockchainRealtimeProvider><WalletProvider>{children}</WalletProvider></BlockchainRealtimeProvider></QueryClientProvider>;
}
