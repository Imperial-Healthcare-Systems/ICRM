-- ─────────────────────────────────────────────────────────────────────
-- PHASE 13 — Partially-paid status + ledger as source of truth
-- ─────────────────────────────────────────────────────────────────────
-- 1. Add 'partially_paid' to the allowed status enum
-- 2. Backfill existing rows so paid_amount matches the actual ledger
--    sum, then re-derive status accordingly.
-- ─────────────────────────────────────────────────────────────────────

-- 1. Drop the old check, add the new one with partially_paid
alter table crm_invoices drop constraint if exists crm_invoices_status_check;
alter table crm_invoices
  add constraint crm_invoices_status_check
  check (status in ('draft','sent','partially_paid','paid','overdue','cancelled','void'));

-- 2. Recompute paid_amount from the ledger for every existing invoice
update crm_invoices i set paid_amount = coalesce(p.sum_amount, 0)
from (
  select invoice_id, sum(amount) as sum_amount
  from crm_invoice_payments
  group by invoice_id
) p
where p.invoice_id = i.id;

-- 3. Re-derive status from the corrected paid_amount
--    (only touches active invoices — skip cancelled/void/draft)
update crm_invoices set
  status = case
    when paid_amount >= total - 0.01 then 'paid'
    when paid_amount > 0 then 'partially_paid'
    when due_date is not null and due_date < current_date then 'overdue'
    else 'sent'
  end,
  paid_date = case
    when paid_amount >= total - 0.01 then coalesce(paid_date, current_date)
    else null
  end
where status not in ('cancelled', 'void', 'draft');

notify pgrst, 'reload schema';
