"use client";
import ProfileHero from "./components/ProfileHero";
import ProfileInfo from "./components/ProfileInfo";
import { useProfile } from "./hooks/useProfile";
import PageHeading from "@/components/ui/PageHeading";
import { ErrorState, LoadingState } from "@/components/ui/ContentState";

export default function ProfileScreen() {
  const { profile, loading, error, refresh } = useProfile();
  return <div className="space-y-8 max-w-4xl">
    <PageHeading eyebrow="GOOD TO HAVE YOU HERE" title="The person behind the pledge." description="Your account, your community identity, and your connected wallet." />
    {loading ? <LoadingState label="Loading your profile…" /> : error || !profile ? <ErrorState message={error?.message || "Your profile could not be found."} onRetry={() => void refresh()} /> : <><ProfileHero profile={profile} /><ProfileInfo profile={profile} /></>}
  </div>;
}
