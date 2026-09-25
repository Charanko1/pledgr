"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Asterisk, LayoutDashboard, History, UserCircle } from "lucide-react";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { useWallet } from "@/context/WalletContext";
import styles from "./DashboardShell.module.css";

const menus = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, number: "01" },
  { title: "History", href: "/history", icon: History, number: "02" },
  { title: "Profile", href: "/profile", icon: UserCircle, number: "03" },
];
export default function MainSidebar() {
  const pathname = usePathname();
  const { profile, error } = useProfile();
  const { address } = useWallet();
  return <aside className={styles.sidebar}>
    <Link href="/dashboard" className={styles.brand} aria-label="PLEDGR dashboard"><span className={styles.brandMark} aria-hidden="true">p<ArrowUpRight size={17} /></span>PLEDGR<span>.</span></Link>
    <p className={styles.sidebarCaption}>SMALL PLEDGES. BIG POSSIBILITIES.</p>
    <nav aria-label="Main navigation" className={styles.navigation}>{menus.map(({ title, href, icon: Icon, number }) => {
      const active = pathname === href || (href === "/dashboard" && pathname.startsWith("/organization/"));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={20} aria-hidden="true" /><span>{title}</span><small>{number}</small></Link>;
    })}</nav>
    <div className={styles.communityNote}><Asterisk size={30} aria-hidden="true" /><p>A little from each of us.<br /><strong>A lot of good, together.</strong></p></div>
    <Link href="/profile" className={styles.userCard}><span className={styles.avatar}>{profile?.name?.charAt(0).toUpperCase() || "P"}</span><span><strong>{profile?.name || (error ? "Your account" : "Loading profile…")}</strong><small>{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Wallet not connected"}</small></span><ArrowUpRight size={18} aria-hidden="true" /></Link>
  </aside>;
}
