# Supabase setup

1. Create a free project at supabase.com.
2. In **Project Settings → API**, copy the Project URL and `anon` `public`
   key into `.env.local` (copy `.env.example` first) — see that file's
   comment for why the anon key is safe to expose client-side.
3. Run the migrations against the project: paste each file under
   `migrations/` (in order) into the **SQL Editor** and run it, or use the
   Supabase CLI (`supabase link`, then `supabase db push`) once it's set up.
4. **Bootstrap the first Super Admin** (one-time, chicken-and-egg step):
   normal role assignment requires an existing Super Admin/Pastor, so the
   very first one has to be set directly:
   - Create a user via **Authentication → Users → Add user** (email +
     password) — this fires the `handle_new_user` trigger and creates their
     `profiles` row automatically, with `role` still `null`.
   - In the **SQL Editor** (runs as the Postgres superuser, bypasses RLS),
     run:
     ```sql
     update profiles set role = 'super_admin' where id = '<that user's uuid, from Authentication → Users>';
     ```
   - From then on, that Super Admin can assign roles to everyone else
     through the app's Admin module (Phase 5).

No real member names, phone numbers, or financial figures belong in any
seed/demo data — fake placeholders only.
