-- One DTR row per employee per calendar day
alter table public.attendance
  add column if not exists date date;

-- Enforces one row per employee per day (resolve duplicate historical rows before applying)
create unique index if not exists attendance_employee_id_date_key
  on public.attendance (employee_id, date);
