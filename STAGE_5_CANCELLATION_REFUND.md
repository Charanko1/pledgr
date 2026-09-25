# Stage 5 — Campaign cancellation and donor refunds

- Added `cancelCampaign()` callable by the on-chain fundraiser or contract admin.
- Approved campaigns can be cancelled until funds are released.
- Added pull-based donor refunds via `claimRefund()`; each donor claims only their own contributed BOT. This is intentional: cancellation freezes the campaign, then each donor claims their own refund to avoid an unbounded loop/gas failure.
- Added `getRefundableAmount()` so the UI can check the connected wallet's refund.
- Added `CampaignCancelled` and `RefundClaimed` events and realtime synchronization.
- Added `CANCELLED` blockchain/proposal states and MongoDB refund/cancellation records.
- Added admin/fundraiser cancel actions and a claim-refund action in proposal detail.

## Important

Refunds are implemented as a pull pattern rather than looping through every donor during cancellation. This avoids making the cancellation transaction dependent on an unbounded number of donors. The cancellation transaction freezes further donations; each donor then claims their own BOT.

A campaign that has already been released cannot be cancelled by this contract because the funds have left the treasury.
