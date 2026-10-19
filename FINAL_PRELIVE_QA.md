# PawApp Concierge TEST — Final pre-LIVE QA checklist

Status: PENDING. No LIVE migration without user approval. Keep existing TEST and LIVE data untouched until approved.

## QA-01: New intake, customer/pet deduplication, finance, reports
- Manual, public booking form, and Excel import all follow the same rules.
- Customer identity is normalized Kuwaiti phone; customer name optional. Same phone with changed name counts as one customer. Missing phone must be explicitly flagged, not silently treated as verified unique customer.
- Pet name optional. Same owner + same pet type counts once when no distinguishing data exists. Different types count separately; two of same type count separately only with meaningful distinguishing information. Missing breed/name alone does not create another pet; age alone does not create another pet. Verify against existing pets and report ambiguous cases clearly.
- Cases count once per successfully saved case; imports are idempotent; no duplicates on retry.
- Verify gross price, fixed/percentage PawApp fee, provider payable, expenses, amounts paid by client, amounts paid to provider, balances, unpaid status, collection by PawApp versus provider, and all dashboard and partner reports. Do not treat unpaid amounts as cash received.
- Test sample scenarios: one phone, three cat cases; same phone cat and dog; two distinguishable cats; same phone different client names; absent client/pet names; missing type; manual vs form vs Excel; fixed and percentage commissions; partial and full payment where supported.
- Reconcile SQL sums/counts to dashboard and exports; investigate discrepancies, not just visual checks.
- Historical incomplete cases remain untouched; don't require filling historical gaps to test new intake.

## QA-02: Delete TEST booking and all financial records (LAST test)
- Keep PAW-0352 Bibi test until all other checks complete.
- User initiates deletion, never assistant. Confirm full deletion including finance records, payments, provider settlements, pet links, and updated reports/totals. Cancel must leave all data unchanged.
- Verify database and dashboard counts/sums before and after. Preserve audit behavior appropriate to TEST.
- Do not delete any real case or touch LIVE.

## Release gate
- Confirm end-to-end checks from the actual UI and database, document pass/fail and fixes, then obtain explicit user approval before any LIVE deployment.
