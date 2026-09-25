# Stage 4 — Proposal Creator / Profile Binding

## Problem
Proposal cards and detail pages displayed the denormalized `creator` string, which can become stale or reflect legacy/hard-coded data.

## Fix
- Proposal creation stores the authenticated user's `_id` as `creatorId`.
- Proposal list and detail APIs populate `creatorId` from the `User` collection.
- The displayed `creator` value is derived from the current User profile `name` whenever the reference exists.
- A `creatorProfile` payload is returned for future profile linking/UI.
- The old stored `creator` string remains only as a backward-compatible fallback for legacy proposals that have no `creatorId`.
- `creatorId` is indexed for efficient lookups.

## Important
Existing legacy proposals without `creatorId` cannot be reliably assigned to a member automatically because the original submitter identity is not present in those records. New proposals are bound to the authenticated user automatically.
