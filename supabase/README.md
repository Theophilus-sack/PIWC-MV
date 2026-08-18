# Supabase setup

1. Create a free project at supabase.com.
2. In **Project Settings → API**, copy the Project URL and `anon` `public`
   key into `.env.local` (copy `.env.example` first) — see that file's
   comment for why the anon key is safe to expose client-side.
3. Run the migrations against the project: paste each file under
   `migrations/` (in order) into the **SQL Editor** and run it, or use the
   Supabase CLI (`supabase link`, then `supabase db push`) once it's set up.
4. **Bootstrap the first Super Admin** (one-time, chicken-and-egg step):
   inviting a user in-app requires an existing Super Admin/Pastor to send
   the invite, so the very first one has to be created directly:
   - Create a user via **Authentication → Users → Add user** (email +
     password) — this fires the `handle_new_user` trigger and creates their
     `profiles` row automatically, with `role` still `null`.
   - In the **SQL Editor** (runs as the Postgres superuser, bypasses RLS),
     run:
     ```sql
     update profiles set role = 'super_admin' where id = '<that user's uuid, from Authentication → Users>';
     ```
   - From then on, that Super Admin (or a Pastor) can invite everyone else
     — and assign their role in the same step — from the app's **Admin**
     page. No more manual dashboard steps needed after this one.

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

## Admin — invite-user Edge Function

Lets a Super Admin/Pastor invite a new login (and assign their role in
the same step) from the app's Admin page, instead of every user needing
to be created via the Supabase dashboard. Deploy it the same way:

```
supabase functions deploy invite-user
```

No secrets needed — it uses `SUPABASE_SERVICE_ROLE_KEY`, which Supabase
auto-provides to every deployed Edge Function. That key is the only thing
in this codebase with the authority to create auth accounts directly, so
it's deliberately confined to this one function and never touches the
client bundle. The function re-checks the caller's role itself (Super
Admin/Pastor only) before doing anything, since `auth.admin.*` calls
bypass RLS entirely — see the function's own comment for why.

Invite emails go out through Supabase's built-in email service. On the
free tier this is rate-limited and fine for occasional staff invites; for
higher volume, configure custom SMTP under **Project Settings → Auth**.
