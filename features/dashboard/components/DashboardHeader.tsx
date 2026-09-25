import PageHeading from "@/components/ui/PageHeading";
export default function DashboardHeader({ count }: { count?: number }) {
  return <PageHeading eyebrow="GOOD IDEAS DESERVE A TEAM" title="Big things start together." description="Create a home for your community. Back the ideas that matter." aside={count !== undefined ? <span className="pledgr-badge bg-lime">{count} {count === 1 ? "organization" : "organizations"}</span> : undefined} />;
}
