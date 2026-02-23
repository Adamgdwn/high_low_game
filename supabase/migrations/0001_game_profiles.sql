-- Web + Android shared game profile storage (fake chips only / social casino demo)

create table if not exists public.game_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_game_profiles_updated_at on public.game_profiles;
create trigger trg_game_profiles_updated_at
before update on public.game_profiles
for each row execute function public.set_updated_at();

alter table public.game_profiles enable row level security;

drop policy if exists "Users can read own game profile" on public.game_profiles;
create policy "Users can read own game profile"
on public.game_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own game profile" on public.game_profiles;
create policy "Users can insert own game profile"
on public.game_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own game profile" on public.game_profiles;
create policy "Users can update own game profile"
on public.game_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
