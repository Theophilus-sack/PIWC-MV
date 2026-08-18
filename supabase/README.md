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

## Messaging (Phase 4) — send-sms Edge Function

The Messages module works end-to-end today in **mock mode** with zero
setup: batches are created and "sent" against a simulated provider that
never makes a network call. Deploy the function so the mock path works
through the real Supabase pipeline (not just against a local stub):

```
supabase functions deploy send-sms
```

No secrets are required for mock mode — `SMS_MODE` defaults to `mock`
when unset.

**Switching to live Arkesel sends**, once you have real credentials:

```
supabase secrets set SMS_MODE=live
supabase secrets set ARKESEL_API_KEY=<your key>
supabase secrets set ARKESEL_SENDER_ID=<your registered sender ID>
```

No code changes needed — `getProvider()` in
`functions/send-sms/provider.ts` picks the provider from `SMS_MODE` at
request time. The Arkesel API key never reaches the client bundle; it
only ever lives in Edge Function secrets.

**Known gap:** scheduled sends (a batch with `scheduled_at` in the
future) are inserted correctly and the function refuses to send them
early, but nothing currently calls this function *at* that future time —
that needs a `pg_cron` job (or external scheduler) hitting a "send all
due batches" variant once that becomes a real requirement.
