import { Asterisk } from "lucide-react";
import type { Profile } from "@/types/profile";
export default function ProfileHero({ profile }: { profile: Profile }) {
  return <div className="pledgr-hero p-6 sm:p-8 flex flex-wrap gap-6 items-center"><div className="w-20 h-20 border-2 border-foreground shadow-brutal bg-card grid place-items-center text-4xl font-extrabold rotate-[-4deg] shrink-0">{profile.name.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><h2 className="text-3xl font-bold tracking-tight break-words">{profile.name}</h2><p className="mt-2 break-all">{profile.email}</p><span className="pledgr-badge bg-white mt-4 capitalize">{profile.role}</span></div><Asterisk className="hidden sm:block text-primary" size={58} aria-hidden="true" /></div>;
}
