"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  getRealtimeContract,
  subscribeToTrustKasEvents,
  type BlockchainEvent,
} from "@/lib/blockchain-events";

interface BlockchainRealtimeContextValue {
  status: "connecting" | "connected" | "disconnected" | "disabled";
  lastEventAt: number | null;
}

const BlockchainRealtimeContext =
  createContext<BlockchainRealtimeContextValue | null>(null);

async function syncEvent(event: BlockchainEvent) {
  if (!event.txHash || !event.proposalId) return;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await apiClient("/api/blockchain/sync", {
        method: "POST",
        body: JSON.stringify({
          type: event.type,
          proposalId: event.proposalId,
          txHash: event.txHash,
        }),
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Blockchain event synchronization failed.");
}

function invalidateBlockchainRelatedQueries(
  client: ReturnType<typeof useQueryClient>,
  event: BlockchainEvent
) {
  // These are prefix keys on purpose: only mounted/active queries refetch,
  // while inactive queries simply receive a stale mark.
  const keys = [
    ["proposal", event.proposalId],
    ["proposals"],
    ["group"],
    ["group-members"],
    ["group-join-requests"],
    ["history"],
    ["organizations"],
    ["organization"],
    ["organization-groups"],
    ["organization-members"],
    ["treasury-balance"],
  ];

  for (const queryKey of keys) {
    void client.invalidateQueries({ queryKey });
  }
}

export function BlockchainRealtimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const client = useQueryClient();
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "disabled"
  >(getRealtimeContract() ? "connecting" : "disabled");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const connect = async () => {
      if (cancelled) return;

      if (!getRealtimeContract()) {
        setStatus("disabled");
        return;
      }

      setStatus("connecting");

      try {
        cleanup = await subscribeToTrustKasEvents({
          onStatus: (nextStatus) => {
            if (!cancelled) setStatus(nextStatus);
          },
          onEvent: (event) => {
            if (cancelled) return;
            setLastEventAt(Date.now());

            void syncEvent(event)
              .catch((error) => {
                console.error("BLOCKCHAIN REALTIME SYNC ERROR:", error);
              })
              .finally(() => {
                invalidateBlockchainRelatedQueries(client, event);
              });
          },
        });
      } catch (error) {
        console.error("BLOCKCHAIN REALTIME SUBSCRIPTION ERROR:", error);
        if (!cancelled) setStatus("disconnected");
      }
    };

    void connect();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [client]);

  const value = useMemo(
    () => ({ status, lastEventAt }),
    [status, lastEventAt]
  );

  return (
    <BlockchainRealtimeContext.Provider value={value}>
      {children}
    </BlockchainRealtimeContext.Provider>
  );
}

export function useBlockchainRealtime() {
  const context = useContext(BlockchainRealtimeContext);
  if (!context) {
    throw new Error(
      "useBlockchainRealtime must be used inside BlockchainRealtimeProvider."
    );
  }
  return context;
}
