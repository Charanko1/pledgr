"use client";

import { BOT_NETWORK } from "@/lib/network";
import { useState } from "react";
import { LogOut, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { useBlockchainRealtime } from "@/context/BlockchainRealtimeContext";
import { apiClient } from "@/lib/api-client";
import { logout } from "@/lib/session";
import styles from "./DashboardShell.module.css";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, connectWallet, connecting, error } = useWallet();
  const { status } = useBlockchainRealtime();
  const [loggingOut, setLoggingOut] = useState(false);
  const section = pathname === "/history" ? "Activity history" : pathname === "/profile" ? "Your profile" : pathname.includes("/proposal/") ? "Funding proposal" : pathname.includes("/groups/") ? "Your group" : pathname.startsWith("/organization/") ? "Your organization" : "Your community";

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiClient("/api/auth/logout", { method: "POST" });
    } catch (logoutError) {
      console.error("LOGOUT ERROR:", logoutError);
    } finally {
      logout();
      router.replace("/login");
    }
  }

  return <header className={styles.header}>
    <div><p className={styles.headerLabel}>YOUR LITTLE CORNER OF GOOD</p><p className={styles.headerTitle}>{section}</p></div>
    <div className={styles.walletArea}>
      <span className={styles.network}>BOT CHAIN {BOT_NETWORK.label} • {status === "connected" ? "LIVE" : status === "connecting" ? "SYNCING" : status === "disabled" ? "BLOCKCHAIN OFF" : "OFFLINE"}</span>
      {address ? <Link href="/profile" className={styles.walletConnected} title="Manage your wallet"><Wallet size={18} aria-hidden="true" />{address.slice(0, 6)}…{address.slice(-4)}</Link> : <button type="button" className="pledgr-button" onClick={() => void connectWallet()} disabled={connecting || loggingOut}><Wallet size={18} aria-hidden="true" />{connecting ? "Connecting…" : "Connect wallet"}</button>}
      <button type="button" className="pledgr-button pledgr-button-secondary" onClick={() => void handleLogout()} disabled={loggingOut} aria-label="Log out"> <LogOut size={17} aria-hidden="true" /> {loggingOut ? "Signing out…" : "Log out"}</button>
      {error && <p className={styles.walletError} role="alert">{error}</p>}
    </div>
  </header>;
}
