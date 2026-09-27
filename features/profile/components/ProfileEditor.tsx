"use client";

import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { saveSession } from "@/lib/session";
import { profileKey } from "../hooks/useProfile";
import type { Profile } from "@/types/profile";

export default function ProfileEditor({ profile }: { profile: Profile }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const emailChanged = email.trim().toLowerCase() !== profile.email;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      const updated = await apiClient<Profile>("/api/profile", { method: "PATCH", body: JSON.stringify({ name, email, ...(emailChanged ? { currentPassword: password } : {}) }) });
      client.setQueryData(profileKey, updated);
      saveSession(undefined, { id: updated._id, name: updated.name, email: updated.email, role: updated.role, walletAddress: updated.walletAddress });
      await client.invalidateQueries({ queryKey: ["group"] });
      setEditing(false); setPassword(""); setMessage("Profile updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save your profile."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="pledgr-panel p-6 sm:p-8 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-foreground pb-5"><div><p className="pledgr-eyebrow mb-2">THE PERSON BEHIND THE PLEDGE</p><h2 className="text-xl font-bold">Account information</h2></div>
      {!editing && <button className="pledgr-button pledgr-button-secondary" onClick={() => { setName(profile.name); setEmail(profile.email); setPassword(""); setMessage(""); setEditing(true); }}><Pencil size={16} />Edit profile</button>}
    </div>
    {editing ? <form className="space-y-5 pt-6" onSubmit={save} aria-busy={busy}>
      <label className="block font-semibold" htmlFor="profile-name">Full name<input id="profile-name" autoComplete="name" className="mt-2 w-full border-2 border-foreground bg-white p-3 font-normal" value={name} onChange={e => setName(e.target.value)} required maxLength={100} disabled={busy} /></label>
      <label className="block font-semibold" htmlFor="profile-email">Email address<input id="profile-email" type="email" autoComplete="email" className="mt-2 w-full border-2 border-foreground bg-white p-3 font-normal" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} disabled={busy} /></label>
      {emailChanged && <label className="block font-semibold" htmlFor="profile-password">Current password<input id="profile-password" type="password" autoComplete="current-password" className="mt-2 w-full border-2 border-foreground bg-white p-3 font-normal" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /><span className="block mt-2 text-sm font-normal text-muted">Confirm your password to change the email you use to log in.</span></label>}
      <div className="flex flex-wrap gap-3"><button className="pledgr-button" disabled={busy}><Save size={17} />{busy ? "Saving…" : "Save changes"}</button><button type="button" className="pledgr-button pledgr-button-secondary" disabled={busy} onClick={() => { setEditing(false); setPassword(""); setMessage(""); }}><X size={17} />Cancel</button></div>
    </form> : <dl className="grid gap-6 pt-6"><div><dt className="text-sm text-muted">Full name</dt><dd className="font-semibold mt-1 break-words">{profile.name}</dd></div><div><dt className="text-sm text-muted">Email address</dt><dd className="font-semibold mt-1 break-all">{profile.email}</dd></div><div><dt className="text-sm text-muted">Account role</dt><dd className="font-semibold mt-1 capitalize">{profile.role}</dd><p className="text-sm text-muted mt-1">Your admin or validator role depends on the organization and group.</p></div></dl>}
    {message && <p role="status" className="mt-5 border-2 border-foreground bg-accent-soft p-3 text-sm">{message}</p>}
  </section>;
}
