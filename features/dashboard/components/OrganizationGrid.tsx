import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/ui/ContentState";
import type { OrganizationSummary } from "@/types/organization";
export default function OrganizationGrid({ loading, organizations, searching, onClear }: { loading: boolean; organizations: OrganizationSummary[]; searching: boolean; onClear: () => void }) {
  if (loading) return <LoadingState label="Finding your organizations…" />;
  if (!organizations.length) return <EmptyState title={searching ? "No matches this time." : "Your next chapter starts here."} description={searching ? "Try another name to find your organization." : "Create your first organization or join your crew with an invitation code."}>{searching && <button onClick={onClear} className="pledgr-button pledgr-button-secondary mt-5">Clear search</button>}</EmptyState>;
  return <div className="grid md:grid-cols-2 gap-6">{organizations.map(org => <Link key={org._id} href={`/organization/${org.slug}`} className="pledgr-panel p-6 hover:-translate-y-1 transition-transform block"><div className="flex gap-4 justify-between"><h3 className="font-bold text-xl break-words min-w-0">{org.name}</h3><ArrowUpRight className="shrink-0" aria-hidden="true" /></div><p className="flex items-center gap-2 mt-3 text-muted text-sm"><Users size={16} aria-hidden="true" />{org.members} members</p><p className="text-muted mt-5 line-clamp-2">{org.description || "A community bringing good ideas to life."}</p><div className="border-t-2 border-foreground mt-6 pt-4 flex flex-wrap gap-2 justify-between"><span className="text-sm">Community treasury</span><span className="font-bold text-primary">{org.treasury} BOT</span></div></Link>)}</div>;
}
