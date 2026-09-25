import { Search } from "lucide-react";
export default function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="flex items-center gap-3 border-2 border-foreground bg-white px-4 py-3 w-full sm:max-w-sm focus-within:shadow-brutal"><Search size={19} className="text-muted shrink-0" aria-hidden="true" /><input aria-label="Search organizations" type="search" placeholder="Find your organization…" value={value} onChange={event => onChange(event.target.value)} className="w-full min-w-0 bg-transparent outline-none text-sm" /></div>;
}
