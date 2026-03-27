alter table public.employees
  add column if not exists manager_id uuid references public.employees(id) on delete set null;

