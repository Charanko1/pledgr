import type { ReactNode } from "react";
import { Asterisk, AlertCircle } from "lucide-react";
export function LoadingState({ label = "Loading your community…" }: { label?: string }) {
  return <div role="status" className="pledgr-panel p-8"><p className="font-semibold mb-6">{label}</p><div className="space-y-4 motion-safe:animate-pulse" aria-hidden="true"><div className="h-5 w-1/3 bg-accent-soft" /><div className="h-4 w-2/3 bg-stone-100" /><div className="h-4 w-1/2 bg-stone-100" /></div></div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="pledgr-panel p-8"><AlertCircle className="text-red-700 mb-4" aria-hidden="true" /><h2 className="text-xl font-bold">We couldn’t load this yet.</h2><p className="text-muted my-3">{message}</p><button onClick={onRetry} className="pledgr-button pledgr-button-secondary">Try again</button></div>;
}
export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="pledgr-panel p-8 sm:p-12 text-center"><span className="inline-grid place-items-center w-16 h-16 bg-lime border-2 border-foreground shadow-brutal rotate-[-5deg] mb-6"><Asterisk size={34} aria-hidden="true" /></span><h2 className="text-2xl font-bold tracking-tight">{title}</h2><p className="text-muted mt-3 max-w-md mx-auto">{description}</p>{children}</div>;
}
