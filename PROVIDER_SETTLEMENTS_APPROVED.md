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
