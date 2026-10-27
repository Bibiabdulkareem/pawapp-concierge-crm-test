# PawApp Concierge — original customer form cutover to the NEW LIVE CRM

**Decision confirmed (2026-10-27):** Promote the current TEST Concierge system into a NEW standalone LIVE system. Do NOT connect, merge, mutate or migrate records from the former LIVE CRM. The public customer booking URL must remain **https://conciergebooking.pawapp.net**.

## Verified current wiring (2026-10-27)
- Existing public customer form: `Bibiabdulkareem/pawapp-concierge/index.html`, custom domain via `CNAME`. Its submit handler opens `wa.me`; it does **not** create a CRM case.
- Working TEST booking-form code: `Bibiabdulkareem/pawapp-concierge-crm-test/booking/index.html`; on submit it POSTs JSON to `/functions/v1/crm-test-booking` of Supabase project `fccvnotgsmxirhztveai`, and opens WhatsApp only **after** the API replies `ok: true` with `case_id`.
- Current TEST Edge Function `crm-test-booking` is active and inserts into `public.test_cases`. Its output is a `new_request`, `client_paid=false`, price/share zero, source `booking_form_test`, and user/pet/service/intake fields. The provider and price are assigned by Operations later.
- On 2026-10-27 a stale TEST case-ID sequence was repaired. A case insert using the same booking-form columns succeeded in an intentional rollback-only QA transaction; no QA case persisted.
- Current Supabase project also holds old LIVE tables (`public.cases` etc.). **Do not** use these tables as the new production CRM. Isolation requires an independent project or otherwise fully independent datastore.

## Launch checklist — no redirect until all checks are green
1. Provision a **new independent production Supabase project** after organization/cost approval; deploy the approved TEST schema/RLS/functions/edge backend to it. Preserve approved production-opening records and finance status from TEST, including October's pending balances. Carefully migrate authenticated employee accounts or re-provision them securely; never copy passwords in plaintext.
2. Verify all new production functions point only to the NEW project and production tables. Use `crm-live-booking` and `booking_form` as production identifiers (or equivalent), not `crm-test-booking`/`booking_form_test`. Keep the service-role key server-side only.
3. Validate the live booking endpoint: request validation, user/pet details, safe generated case ID, pending payment, source, workflow, provider-unassigned state, retries/idempotency, and anti-spam/rate-limit protections. Perform a controlled end-to-end test: submit the form, verify exactly ONE NEW case in the NEW CRM and a matching case number in the subsequent WhatsApp message, then remove/reconcile the flagged QA case. Confirm OLD LIVE has no change.
4. Stage the public form **in a preview** using the same visual content and the new submit/save-first flow from TEST. Update only the customer-form repo `pawapp-concierge` when production endpoint is proven. Preserve its existing `CNAME` and URL; replace the WhatsApp-only submit path with the verified save-first path, swapping in the NEW production endpoint.
5. Independently test browser/mobile, Arabic/English, invalid form, network error (no false success), successful submission, repeat-click / replay, and WhatsApp handoff. Ensure both TEST and former LIVE endpoints do not receive a duplicate.
6. Deploy the new CRM as the official system (remove TEST banners and hard-coded TEST URLs) and make the public form point exclusively to it. Preserve the old LIVE CRM and all historical records unchanged, with rollback copy of the previous public form ready.

## Cutover safety rule
**NEVER point the existing `conciergebooking.pawapp.net` page at TEST data or at the old CRM. Do not modify the publicly serving form until the NEW backend is independently ready and its actual end-to-end case creation has been verified.**

This document is release preparation only: it does not deploy the new production project or change the public customer form.
