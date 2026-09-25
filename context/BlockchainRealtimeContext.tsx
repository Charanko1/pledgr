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
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Blockchain event synchronization failed.");
}

export function BlockchainRealtimeProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "disabled"
  >(getRealtimeContract() ? "connecting" : "disabled");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    if (!getRealtimeContract()) {
      setStatus("disabled");
      return undefined;
    }

    setStatus("connecting");

    void subscribeToTrustKasEvents({
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
            const proposalKey = ["proposal", event.proposalId];
            void client.invalidateQueries({ queryKey: proposalKey });
            void client.invalidateQueries({ queryKey: ["group"] });
            void client.invalidateQueries({ queryKey: ["history"] });
            void client.invalidateQueries({ queryKey: ["organizations"] });
            void client.invalidateQueries({ queryKey: ["organization"] });
            void client.invalidateQueries({ queryKey: ["treasury-balance"] });
          });
      },
    }).then((release) => {
      if (cancelled) release();
      else cleanup = release;
    }).catch((error) => {
      console.error("BLOCKCHAIN REALTIME SUBSCRIPTION ERROR:", error);
      if (!cancelled) setStatus("disconnected");
    });

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
