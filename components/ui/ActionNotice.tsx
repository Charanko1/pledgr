"use client";

import { Info, X } from "lucide-react";

export function ActionNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return <div role="status" aria-live="polite" className="flex items-start gap-3 border-2 border-foreground bg-card p-4 shadow-brutal">
    <Info size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
    <p className="min-w-0 flex-1 break-words text-sm leading-relaxed">{message}</p>
    <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="shrink-0 p-1 focus-visible:outline-2 focus-visible:outline-offset-2"><X size={18} aria-hidden="true" /></button>
  </div>;
}
