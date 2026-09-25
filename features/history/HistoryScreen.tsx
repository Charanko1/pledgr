"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Vote, FileText, RotateCcw, Users, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import PageHeading from "@/components/ui/PageHeading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/ContentState";
import { APP_DATA_REFRESH_INTERVAL_MS } from "@/lib/realtime";
import { formatBotAmount } from "@/lib/bot";

interface Activity {
  _id: string;
  type: "DONATION" | "WITHDRAW" | "RELEASE" | "PROPOSAL" | "APPROVAL" | "VOTE" | "VALIDATOR" | "MEMBER" | "CANCEL" | "REFUND";
  title: string;
  description: string;
  amount?: string;
  amountAtomic?: string;
  txHash?: string;
  createdAt: string;
}

export default function HistoryScreen() {
  const query = useQuery({
    queryKey: ["history"],
    refetchInterval: APP_DATA_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: ({ signal }) => apiClient<Activity[]>("/api/history", { signal }),
  });
  const activities = query.data || [];

  return <div className="space-y-8">
    <PageHeading eyebrow="EVERY LITTLE ACTION ADDS UP" title="A trail of good." description="Follow your community’s contributions, proposals, and decisions." aside={<span className="pledgr-badge bg-lime">Activity history</span>} />
    {query.isPending ? <LoadingState label="Loading community activity…" /> : query.error ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : !activities.length ? <EmptyState title="The story is just beginning." description="Your community’s activity will appear here as people contribute and ideas move forward." /> : <div className="pledgr-panel p-5 sm:p-8"><ol className="divide-y-2 divide-foreground">{activities.map(item => {
      const Icon = item.type === "DONATION" ? ArrowDownLeft : item.type === "WITHDRAW" || item.type === "RELEASE" ? ArrowUpRight : item.type === "REFUND" ? RotateCcw : item.type === "PROPOSAL" ? FileText : item.type === "MEMBER" ? Users : item.type === "VALIDATOR" ? ShieldCheck : Vote;
      const amount = item.amountAtomic ? formatBotAmount(item.amountAtomic) : item.amount;
      return <li key={item._id} className="flex gap-4 py-6 first:pt-0 last:pb-0"><span className="w-11 h-11 shrink-0 border-2 border-foreground bg-accent-soft grid place-items-center"><Icon size={21} aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{item.title}</h2><time dateTime={item.createdAt} className="text-sm text-muted">{new Date(item.createdAt).toLocaleString()}</time></div><p className="text-muted mt-2">{item.description}</p>{amount !== undefined && amount !== "0" && <p className="font-bold mt-3">{item.type === "WITHDRAW" || item.type === "REFUND" ? "−" : "+"}{amount} BOT</p>}{item.txHash && <p className="text-xs font-mono text-primary break-all mt-3">{item.txHash}</p>}</div></li>;
    })}</ol></div>}
  </div>;
}
