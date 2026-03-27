-- Ensure cutoff filtering works for payroll
-- `PayrollPage` filters allowances/deductions by `created_at`, but the column may not exist.

alter table public.allowances
  add column if not exists created_at timestamptz default now();

alter table public.deductions
  add column if not exists created_at timestamptz default now();

-- Keep default for future inserts/updates.
alter table public.allowances
  alter column created_at set default now();

alter table public.deductions
  alter column created_at set default now();

-- Backfill existing rows so `.gte/.lte("created_at", ...)` returns data right away.
update public.allowances
set created_at = now()
where created_at is null;

update public.deductions
set created_at = now()
where created_at is null;

