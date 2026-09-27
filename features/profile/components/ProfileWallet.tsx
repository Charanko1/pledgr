"use client";
import { ArrowLeftRight, Unplug, Wallet } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import type { Profile } from "@/types/profile";

export default function ProfileWallet({ profile }: { profile: Profile }) {
  const { address, connecting, error, connectWallet, changeWallet, disconnectWallet } = useWallet();
  return <section className="pledgr-panel p-6 sm:p-8 min-w-0 space-y-5">
    <div className="flex justify-between items-start gap-3 border-b-2 border-foreground pb-5"><div><p className="pledgr-eyebrow mb-2">YOUR CONNECTION</p><h2 className="text-xl font-bold">Wallet &amp; funding</h2></div><Wallet size={28} className="text-primary shrink-0" /></div>
    <span className={`pledgr-badge ${address ? "bg-lime" : "bg-accent-soft"}`}>{address ? "Connected in this browser" : "Disconnected in this browser"}</span>
    <div><p className="text-sm text-muted">Verified account wallet</p><p className="font-semibold break-all mt-2">{profile.walletAddress || "No wallet linked yet"}</p></div>
    <p className="text-sm text-muted">Your wallet connects your pledges to the blockchain. Disconnecting ends this browser connection; your saved address and campaign funds stay intact.</p>
    <div className="flex flex-wrap gap-3">
      {!address && <button className="pledgr-button" onClick={() => void connectWallet()} disabled={connecting}><Wallet size={17} />{connecting ? "Connecting…" : "Connect wallet"}</button>}
      {profile.walletAddress && <button className="pledgr-button pledgr-button-secondary" onClick={() => void changeWallet()} disabled={connecting}><ArrowLeftRight size={17} />Change wallet</button>}
      {address && <button className="pledgr-button pledgr-button-secondary" onClick={() => void disconnectWallet()} disabled={connecting}><Unplug size={17} />Disconnect</button>}
    </div>
    <p className="text-sm text-muted">Changing the saved address requires a wallet signature. A wallet still needed by a campaign cannot be replaced until its funding responsibilities are complete.</p>
    {error && <p role="alert" className="text-sm text-red-700 break-words">{error}</p>}
  </section>;
}
