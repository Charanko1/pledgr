"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function backDestination(path: string) {
  const proposal = path.match(/^(\/organization\/[^/]+\/groups\/[^/]+)\/proposal\/[^/]+\/?$/);
  if (proposal) return { href: proposal[1], label: "Back to group" };
  const group = path.match(/^(\/organization\/[^/]+)\/groups\/[^/]+\/?$/);
  if (group) return { href: group[1], label: "Back to organization" };
  return { href: "/dashboard", label: "Back to dashboard" };
}

export default function BackButton() {
  const path = usePathname();
  if (path === "/dashboard") return null;
  const { href, label } = backDestination(path);
  return <Link href={href} className="pledgr-button pledgr-button-secondary mb-6 w-fit"><ArrowLeft size={17} aria-hidden="true" />{label}</Link>;
}
