"use client";

import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import type { Proposal } from "@/types/group";

export default function ValidatorCard({ proposal }: { proposal: Proposal }) {
  const validationLabel = proposal.validationStatus === "Approved" ? "Validator approved" : proposal.validationStatus === "Rejected" ? "Validator rejected" : "Waiting for validator review";
  const releaseLabel = proposal.withdrawalStatus === "ValidatorApproved" ? "Validator approved withdrawal" : proposal.withdrawalStatus === "AdminApproved" ? "Validator + admin approved withdrawal" : proposal.withdrawalStatus === "Rejected" ? "Withdrawal was rejected" : proposal.withdrawalStatus === "Requested" ? "Waiting for release review" : "No withdrawal requested";
  return (
    <div className="bg-white border p-6 shadow-brutal space-y-5">
      <h2 className="text-xl font-bold">Validation & Release Review</h2>
      <div className="flex items-center gap-3"><ShieldCheck size={24} /> <div><h3 className="font-semibold">Proposal validation</h3><p className="text-sm text-gray-500">{validationLabel}</p>{proposal.validationNote && <p className="text-xs text-gray-500 mt-1">Note: {proposal.validationNote}</p>}</div>{proposal.validationStatus === "Approved" ? <CheckCircle2 className="ml-auto text-green-600" /> : proposal.validationStatus === "Rejected" ? <XCircle className="ml-auto text-red-600" /> : <Clock3 className="ml-auto text-yellow-600" />}</div>
      <div className="flex items-center gap-3"><ShieldCheck size={24} /> <div><h3 className="font-semibold">Withdrawal review</h3><p className="text-sm text-gray-500">{releaseLabel}</p>{proposal.releaseRejectedReason && <p className="text-xs text-red-600 mt-1">Reason: {proposal.releaseRejectedReason}</p>}</div></div>
      {proposal.status === "Release Rejected" && <p className="text-sm text-gray-500">The BOT remains escrowed. The fundraiser may submit another withdrawal request.</p>}
    </div>
  );
}
