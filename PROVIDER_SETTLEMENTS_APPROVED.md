# TEST: Provider period settlement implementation specification (approved 2026-10-19)

User approved implementation, TEST ONLY. Not yet implemented; do not claim otherwise.

- Every provider/freelancer has date-filtered settlement statements (from/to), covering exact case IDs and their service/transport financial components.
- Split by actual customer payment recipient:
  * Customer paid PawApp: PawApp owes provider the provider share.
  * Customer paid provider: provider owes PawApp the PawApp commission.
  * Unpaid client cases do not become collectible provider settlement liabilities merely by booking.
- Display each direction separately; NO netting/offset between the two directions.
- Full settlement only: Pending until entire calculated obligation for selected cases/direction has been paid, then Settled. NO partial payment UI, installment status or arbitrary amount input.
- Capture payment date, payment method, reference/receipt, settlement period, case IDs, payer/payee, amount, approver, and immutable audit trail.
- Historical settled periods remain stable. Backdated/new cases not previously included remain pending, not automatically added to approved settlement.
- Accounting role can review and settle according to approved permissions; admin oversight and auditable corrections.
- Reports show provider, period, due to PawApp, due to provider, settled and outstanding separately. Reconcile with underlying finance ledger and provider reports; avoid double counting.
- Never mark settled merely because the customer paid; require confirmed transfer to the entitled counterparty.
- All implementation and validation on TEST only, preserve PAW-0352 Bibi test until final QA.

## Explicit confirmation (2026-10-19): historical periods and both settlement directions
- Display Pending/Settled per provider AND per payment direction for ALL months, including already closed August and September 2026, not only October.
- Case workflow Closed and client_paid=true DO NOT prove inter-party transfer. Do not auto-mark settlement Settled solely from those flags.
- Historical gross, PawApp commission, provider share and actual recorded transfers must remain visible even when outstanding amount is zero or recipient is unknown.
- An accountant explicitly confirms each direction's full settlement with evidence, date, method and actor; do not silently alter historical financial amounts.
- Reports, dashboards, provider page, and exports must show identical direction-specific totals and status for the same date range. Handle missing payment recipient as review-required rather than a false zero or false Settled.
- Existing historical August/September operations remain unchanged; settlement confirmations are additive, auditable records.
