-- Run this whole file once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

-- ========== TABLES ==========

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Other',
  description text,
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  prep_time text,
  servings text,
  image_url text,
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists likes (
  recipe_id uuid not null references recipes(id) on delete cascade,
  session_id text not null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, session_id)
);

create table if not exists saves (
  recipe_id uuid not null references recipes(id) on delete cascade,
  session_id text not null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, session_id)
);

-- ========== ROW LEVEL SECURITY ==========
-- IMPORTANT: replace 'kinyaashley04@gmaail.comm' below with the email you will
-- sign in with (see README "Create your owner account").

alter table recipes enable row level security;

create policy "Anyone can read recipes"
  on recipes for select
  using (true);

create policy "Only owner can add recipes"
  on recipes for insert
  with check (auth.jwt() ->> 'email' = 'kinyaashley04@gmaail.comm');

create policy "Only owner can edit recipes"
  on recipes for update
  using (auth.jwt() ->> 'email' = 'kinyaashley04@gmaail.comm');

create policy "Only owner can delete recipes"
  on recipes for delete
  using (auth.jwt() ->> 'email' = 'kinyaashley04@gmaail.comm');

alter table likes enable row level security;

create policy "Anyone can read likes"
  on likes for select
  using (true);

create policy "Anyone can like"
  on likes for insert
  with check (true);

create policy "Anyone can unlike"
  on likes for delete
  using (true);

alter table saves enable row level security;

create policy "Anyone can read their saves"
  on saves for select
  using (true);

create policy "Anyone can save"
  on saves for insert
  with check (true);

create policy "Anyone can unsave"
  on saves for delete
  using (true);

-- ========== STORAGE (recipe photos) ==========
-- Create a public bucket called "recipe-images" in
-- Dashboard -> Storage -> New bucket -> name: recipe-images, Public: ON
-- Then run the policies below.

create policy "Anyone can view recipe images"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

create policy "Only owner can upload recipe images"
  on storage.objects for insert
  with check (
    bucket_id = 'recipe-images'
    and auth.jwt() ->> 'email' = 'kinyaashley04@gmaail.comm'
  );

create policy "Only owner can delete recipe images"
  on storage.objects for delete
  using (
    bucket_id = 'recipe-images'
    and auth.jwt() ->> 'email' = 'kinyaashley04@gmaail.comm'
  );