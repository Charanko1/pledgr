import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "PLEDGR — Join the good",
  description: "Back the ideas you believe in. Build something bigger, together.",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
