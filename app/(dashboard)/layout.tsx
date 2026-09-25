import type { ReactNode } from "react";
import DashboardProviders from "@/components/layout/DashboardProviders";
import MainSidebar from "@/components/layout/MainSidebar";
import Header from "@/components/layout/Header";
import styles from "@/components/layout/DashboardShell.module.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardProviders>
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <MainSidebar />
      <div className={styles.workspace}>
        <Header />
        <main id="main-content" tabIndex={-1} className={styles.content}>{children}</main>
        <footer className={styles.footer}><span>A little kindness. A collective superpower.</span><span>PLEDGR / BUILT TOGETHER</span></footer>
      </div>
    </div>
  </DashboardProviders>;
}
