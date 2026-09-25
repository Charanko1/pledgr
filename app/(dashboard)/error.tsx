"use client";
import { ErrorState } from "@/components/ui/ContentState";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <ErrorState message="Something went wrong opening this page. Please try again." onRetry={reset} />;
}
