import { Plus, Users, ArrowUpRight } from "lucide-react";
export default function ActionCards({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return <div className="grid md:grid-cols-2 gap-6">
    <button onClick={onCreate} className="pledgr-panel bg-lime p-6 sm:p-7 text-left hover:-translate-y-1 transition-transform"><span className="flex justify-between items-start"><Plus size={32} aria-hidden="true" /><ArrowUpRight size={23} aria-hidden="true" /></span><h2 className="mt-6 text-2xl font-bold tracking-tight">Start something good.</h2><p className="mt-2">Create an organization for your people.</p><span className="inline-block mt-6 text-sm font-bold border-b-2 border-foreground pb-1">Create organization</span></button>
    <button onClick={onJoin} className="pledgr-panel bg-accent-soft p-6 sm:p-7 text-left hover:-translate-y-1 transition-transform"><span className="flex justify-between items-start"><Users size={32} aria-hidden="true" /><ArrowUpRight size={23} aria-hidden="true" /></span><h2 className="mt-6 text-2xl font-bold tracking-tight">Find your crew.</h2><p className="mt-2">Have an invite? Your community is waiting.</p><span className="inline-block mt-6 text-sm font-bold border-b-2 border-foreground pb-1">Join organization</span></button>
  </div>;
}
