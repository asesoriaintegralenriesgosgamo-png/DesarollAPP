create table public.personal_expense_categories (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.personal_expenses (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    category_id uuid references public.personal_expense_categories(id) on delete set null,
    date text,
    concept text not null,
    amount numeric(15,2) not null,
    type text not null,
    original_line text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS para personal_expense_categories
alter table public.personal_expense_categories enable row level security;

create policy "Enable all operations for users based on user_id"
on public.personal_expense_categories
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- RLS para personal_expenses
alter table public.personal_expenses enable row level security;

create policy "Enable all operations for users based on user_id"
on public.personal_expenses
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 5. GRANTs
grant select, insert, update, delete on public.personal_expense_categories to authenticated;
grant select, insert, update, delete on public.personal_expenses to authenticated;
