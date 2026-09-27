export const ACTIVE_PROPOSAL_STATUSES = [
  "Pending",
  "Validated",
  "Approved",
  "Funding",
  "Withdrawal Requested",
  "Validator Release Approved",
  "Release Approved",
  "Release Rejected",
] as const;

export const CLOSED_PROPOSAL_STATUSES = ["Ended", "Rejected", "Cancelled", "Released"] as const;

export function isFinishedProposal(proposal: { status?: string; ended?: boolean }) {
  return proposal.ended === true || CLOSED_PROPOSAL_STATUSES.includes(proposal.status as (typeof CLOSED_PROPOSAL_STATUSES)[number]);
}

export function isActiveProposalStatus(status?: string) {
  return ACTIVE_PROPOSAL_STATUSES.includes(status as (typeof ACTIVE_PROPOSAL_STATUSES)[number]);
}
