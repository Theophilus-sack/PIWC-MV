// Invites a new church-staff login by email and assigns their role in the
// same step. Creating an auth.users row requires the Supabase Admin API,
// which requires the service-role key — that key never reaches the
// client bundle, it only ever lives here, in Edge Function runtime env
// (SUPABASE_SERVICE_ROLE_KEY is auto-provided by Supabase for every
// deployed function, no manual secret needed).
//
// Authorization is checked manually rather than via RLS, because
// auth.admin.* calls bypass RLS entirely — this function is the only
// place that authority is enforced, so it re-derives the caller's role
// itself (via a client scoped to the CALLER's own JWT, reading their own
// profiles row — same profiles_select_self policy the app already relies
// on) and rejects anyone who isn't Super Admin/Pastor, mirroring
// canManageRoles() in src/lib/rbac.js exactly ("Only Super Admin and
// Pastor may create/assign roles").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROLES = ["super_admin", "pastor", "finance", "ministry_leader", "comms_media", "secretary"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Caller-scoped client — used only to verify who's asking. The
    // global.headers Authorization set here only applies to REST/table
    // calls (the .from("profiles") query below) — GoTrue's own
    // auth.getUser() manages its own session state and ignores it, so the
    // JWT has to be passed to getUser() explicitly or it just sees "no
    // session" and fails closed with a generic auth error.
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await callerClient.auth.getUser(jwt);
    if (userError || !userData?.user) return json({ error: "Not authenticated" }, 401);

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (profileError || !callerProfile) return json({ error: "Couldn't verify your role" }, 403);
    if (!["super_admin", "pastor"].includes(callerProfile.role)) {
      return json({ error: "Only Super Admin or Pastor can invite users" }, 403);
    }

    const { email, fullName, role, ministryId, redirectTo } = await req.json();
    if (!email || !fullName) return json({ error: "Email and full name are required" }, 400);
    if (role && !ROLES.includes(role)) return json({ error: "Invalid role" }, 400);
    if (role === "ministry_leader" && !ministryId) return json({ error: "Ministry Leader requires a ministry" }, 400);

    // Service-role client — the only place in the whole app this key is
    // used. Never returned to the client, never logged.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: redirectTo || undefined,
    });
    if (inviteError) return json({ error: inviteError.message }, 400);

    const newUserId = invited.user.id;

    // handle_new_user (0001_foundation.sql) already created a profiles row
    // with role=null from the auth.users insert trigger — this sets the
    // role/ministry the inviting admin chose in the same step, so the new
    // account shows up in Admin already configured rather than needing a
    // second "assign role" pass.
    if (role) {
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ role, ministry_id: role === "ministry_leader" ? ministryId : null, full_name: fullName })
        .eq("id", newUserId);
      if (updateError) return json({ error: `User invited, but role assignment failed: ${updateError.message}` }, 500);
    }

    return json({ success: true, userId: newUserId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
