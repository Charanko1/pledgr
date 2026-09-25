import { Mail, Shield, Wallet, User } from "lucide-react";
import type { Profile } from "@/types/profile";
export default function ProfileInfo({ profile }: { profile: Profile }) {
  const fields = [
    { label: "Full name", value: profile.name, icon: User },
    { label: "Email address", value: profile.email, icon: Mail },
    { label: "Community role", value: profile.role, icon: Shield },
    { label: "Wallet address", value: profile.walletAddress || "Not connected yet", icon: Wallet },
  ];
  return <section className="pledgr-panel p-6 sm:p-8"><div className="flex justify-between gap-4 border-b-2 border-foreground pb-5"><h2 className="text-xl font-bold">Account information</h2><span className="pledgr-eyebrow self-center">THE BASICS</span></div><dl className="grid sm:grid-cols-2 gap-7 pt-7">{fields.map(({ label, value, icon: Icon }) => <div key={label} className="flex gap-4 min-w-0"><Icon className="text-primary shrink-0 mt-1" size={23} aria-hidden="true" /><div className="min-w-0"><dt className="text-muted text-sm">{label}</dt><dd className="mt-2 font-semibold break-all">{value}</dd></div></div>)}</dl></section>;
}
